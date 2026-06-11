// apps/api/src/modules/risk/dispatch-recommendation.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkOrderType, Role, DutyStatus } from '@prisma/client';

export interface DispatchCandidate {
  userId: string;
  name: string;
  score: number;
  district: string;
  dutyStatus: string;
  skills: string[];
  avgResponseMin: number | null;
  breakdown: {
    skillMatch: number;
    sameDistrict: number;
    onDuty: number;
    responseTime: number;
  };
}

@Injectable()
export class DispatchRecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(riskEventId: string, workOrderType?: WorkOrderType): Promise<DispatchCandidate[]> {
    const riskEvent = await this.prisma.riskEvent.findUnique({
      where: { id: riskEventId },
      include: { elder: { select: { id: true, district: true } } },
    });
    if (!riskEvent) throw new NotFoundException('风险事件不存在');

    const users = await this.prisma.user.findMany({
      where: {
        role: { in: [Role.GRID_WORKER, Role.COMMUNITY_DOCTOR, Role.PROPERTY, Role.VOLUNTEER] },
      },
    });

    const elderDistrict = riskEvent.elder.district;

    // Determine required skill from work order type
    const requiredSkill = workOrderType ? this.mapTypeToSkill(workOrderType) : null;

    // Collect max values for normalization
    const maxResponseMin = Math.max(...users.map((u: any) => u.avgResponseMin ?? 0), 1);

    const candidates: DispatchCandidate[] = users.map((user: any) => {
      const breakdown = {
        skillMatch: 0,
        sameDistrict: 0,
        onDuty: 0,
        responseTime: 0,
      };

      // Skill match (required, max 30)
      if (requiredSkill && user.skills.includes(requiredSkill)) {
        breakdown.skillMatch = 30;
      } else if (!requiredSkill) {
        breakdown.skillMatch = 30; // No specific skill required
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

      const score = breakdown.skillMatch + breakdown.sameDistrict + breakdown.onDuty + breakdown.responseTime;

      return {
        userId: user.id,
        name: user.name,
        score,
        district: user.district ?? '',
        dutyStatus: user.dutyStatus,
        skills: user.skills,
        avgResponseMin: user.avgResponseMin,
        breakdown,
      };
    });

    // Sort by score descending
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
