// apps/api/src/modules/risk/dispatch-recommendation.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkOrderType, Role, DutyStatus, WorkOrderStatus } from '@prisma/client';

export interface DispatchCandidate {
  userId: string;
  name: string;
  score: number;
  district: string;
  dutyStatus: string;
  skills: string[];
  avgResponseMin: number | null;
  activeWorkOrders: number;
  breakdown: {
    skillMatch: number;
    sameDistrict: number;
    onDuty: number;
    responseTime: number;
    /** 负值：活跃工单越多扣分越多（最多 -20） */
    workload: number;
  };
}

@Injectable()
export class DispatchRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 基于风险事件推荐派单人选（原有入口，给风险派单流程用）。
   * 必须先有 riskEvent 才能调用。
   */
  async recommend(riskEventId: string, workOrderType?: WorkOrderType): Promise<DispatchCandidate[]> {
    const riskEvent = await this.prisma.riskEvent.findUnique({
      where: { id: riskEventId },
      include: { elder: { select: { id: true, district: true } } },
    });
    if (!riskEvent) throw new NotFoundException('风险事件不存在');
    return this.scoreCandidates(riskEvent.elder.district, workOrderType);
  }

  /**
   * 基于「老人片区 + 工单类型」直接推荐（新增入口，给家属请求自动派单用）。
   * 不需要先建 risk event，避免家属请求被强行塞进风险事件模型。
   */
  async recommendByType(elderId: string, workOrderType: WorkOrderType): Promise<DispatchCandidate[]> {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      select: { district: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');
    return this.scoreCandidates(elder.district, workOrderType);
  }

  /**
   * 共享打分逻辑。维度（满 ~140 分，workload 为负项）：
   *   skillMatch   0..30   技能匹配工单类型
   *   sameDistrict 0..30    同片区优先
   *   onDuty       0..25    在岗优先
   *   responseTime 0..25    历史响应越快越高
   *   workload     -20..0   当前活跃工单越多越扣分（实现"分配给有空的人"）
   */
  private async scoreCandidates(
    elderDistrict: string,
    workOrderType?: WorkOrderType,
  ): Promise<DispatchCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.GRID_WORKER, Role.COMMUNITY_DOCTOR, Role.PROPERTY, Role.VOLUNTEER] },
      },
    });

    const requiredSkill = workOrderType ? this.mapTypeToSkill(workOrderType) : null;

    // 批量统计每个 worker 当前活跃工单数（ASSIGNED / IN_PROGRESS）
    const activeCounts = await this.prisma.workOrder.groupBy({
      by: ['assigneeId'],
      where: {
        assigneeId: { in: users.map((u) => u.id) },
        status: { in: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS] },
      },
      _count: { _all: true },
    });
    const activeByUser = new Map<string, number>();
    for (const r of activeCounts) {
      if (r.assigneeId) activeByUser.set(r.assigneeId, r._count._all);
    }
    // 活跃工单数最大值（用于归一化）；至少为 1 避免除零
    const maxActive = Math.max(...Array.from(activeByUser.values()), 0, 1);

    const maxResponseMin = Math.max(...users.map((u: any) => u.avgResponseMin ?? 0), 1);

    const candidates: DispatchCandidate[] = users.map((user: any) => {
      const breakdown = {
        skillMatch: 0,
        sameDistrict: 0,
        onDuty: 0,
        responseTime: 0,
        workload: 0,
      };

      // Skill match (max 30)
      if (requiredSkill && user.skills.includes(requiredSkill)) {
        breakdown.skillMatch = 30;
      } else if (!requiredSkill) {
        breakdown.skillMatch = 30;
      }

      // Same district (+30)
      if (user.district === elderDistrict) {
        breakdown.sameDistrict = 30;
      }

      // On duty (+25)
      if (user.dutyStatus === DutyStatus.ON_DUTY) {
        breakdown.onDuty = 25;
      }

      // Response time (normalized, max 25)
      if (user.avgResponseMin != null && maxResponseMin > 0) {
        const normalized = 1 - (user.avgResponseMin / maxResponseMin);
        breakdown.responseTime = Math.round(normalized * 25);
      }

      // Workload（负项，最多 -20）：活跃工单占比越高扣越多
      const active = activeByUser.get(user.id) ?? 0;
      const workloadPenalty = -Math.round((active / maxActive) * 20);
      breakdown.workload = workloadPenalty === 0 ? 0 : workloadPenalty; // 规避 -0

      const score =
        breakdown.skillMatch +
        breakdown.sameDistrict +
        breakdown.onDuty +
        breakdown.responseTime +
        breakdown.workload;

      return {
        userId: user.id,
        name: user.name,
        score,
        district: user.district ?? '',
        dutyStatus: user.dutyStatus,
        skills: user.skills,
        avgResponseMin: user.avgResponseMin,
        activeWorkOrders: active,
        breakdown,
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates;
  }

  private mapTypeToSkill(type: WorkOrderType): string {
    const map: Record<WorkOrderType, string> = {
      [WorkOrderType.HEALTH]: 'HEALTH',
      [WorkOrderType.LIFE]: 'LIFE',
      [WorkOrderType.REPAIR]: 'REPAIR',
      [WorkOrderType.ESCORT]: 'LIFE',
      [WorkOrderType.COMPANION]: 'LIFE',
      [WorkOrderType.ERRAND]: 'LIFE',
    };
    return map[type];
  }
}
