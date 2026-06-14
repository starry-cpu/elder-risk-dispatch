import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DispatchRecommendationService } from '../risk/dispatch-recommendation.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkOrderStateMachine } from './work-orders.state-machine';
import { WorkOrderType, WorkOrderStatus, RiskStatus, Role, RiskLevel, WorkOrderSource } from '@prisma/client';

export interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

const ASSIGNABLE_ROLES: Role[] = [Role.GRID_WORKER, Role.COMMUNITY_DOCTOR, Role.PROPERTY, Role.VOLUNTEER];

function safeTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  context: { isAssignee?: boolean; hasReason?: boolean } = {},
): WorkOrderStatus {
  try {
    return WorkOrderStateMachine.transition(from, to, context);
  } catch (e: any) {
    throw new BadRequestException(e.message ?? '非法的状态转移');
  }
}

function checkDistrictAccess(wo: { elder: { district: string } }, requester: Requester): void {
  if (requester.role === Role.ADMIN) return;
  // Non-ADMIN users MUST have a district and can only access their own district
  if (!requester.district || wo.elder.district !== requester.district) {
    throw new NotFoundException('工单不存在');
  }
}

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchRecommendationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private pushWorkOrderUpdate(workOrderId: string, status: string, type: string, elderId: string, assigneeId?: string | null) {
    const payload = { workOrderId, status, type, elderId };

    // Notify the assignee
    if (assigneeId) {
      this.notificationsService.emitAndPersist({
        event: 'workorder:update',
        roomType: 'user',
        roomId: assigneeId,
        payload,
      }).catch((err: unknown) => {
        this.logger.warn(`WS push failed (assignee ${assigneeId}): ${err instanceof Error ? err.message : String(err)}`);
      });
    }

    // Notify ADMIN role
    this.notificationsService.emitAndPersist({
      event: 'workorder:update',
      roomType: 'role',
      roomId: 'ADMIN',
      payload,
    }).catch((err: unknown) => {
      this.logger.warn(`WS push failed (ADMIN broadcast): ${err instanceof Error ? err.message : String(err)}`);
    });
  }

  async create(
    input: {
      elderId: string;
      riskEventId?: string;
      type: WorkOrderType;
      level?: RiskLevel;
      deadline?: string;
      dispatchReason?: string;
      /** 工单来源（默认 MANUAL）；家属请求自动派单时传 FAMILY_REQUEST */
      sourceFrom?: WorkOrderSource;
      /** 家属请求原文（来源为 FAMILY_REQUEST/SOS 时写入，展示给 worker）*/
      familyRequestText?: string;
    },
    requester: Requester,
  ) {
    const elder = await this.prisma.elder.findUnique({ where: { id: input.elderId } });
    if (!elder) throw new NotFoundException('老人不存在');

    // District isolation: non-ADMIN can only create work orders for elders in their district
    checkDistrictAccess({ elder: { district: elder.district } }, requester);

    let riskEvent: { level: RiskLevel; status: RiskStatus; elderId: string; elder: { district: string } } | null = null;
    if (input.riskEventId) {
      riskEvent = await this.prisma.riskEvent.findUnique({
        where: { id: input.riskEventId },
        include: { elder: { select: { district: true } } },
      });
      if (!riskEvent) throw new NotFoundException('风险事件不存在');

      // Validate risk event belongs to the same elder
      if (riskEvent.elderId !== input.elderId) {
        throw new BadRequestException('风险事件不属于该老人');
      }

      if (riskEvent.status !== RiskStatus.CONFIRMED) {
        throw new BadRequestException('仅已确认的风险事件可生成工单');
      }

      // Prevent duplicate work orders for the same risk event (riskEventId is @unique)
      const existing = await this.prisma.workOrder.findUnique({
        where: { riskEventId: input.riskEventId },
      });
      if (existing) {
        throw new BadRequestException('该风险事件已生成工单');
      }
    }

    const workOrder = await this.prisma.workOrder.create({
      data: {
        elderId: input.elderId,
        riskEventId: input.riskEventId ?? null,
        type: input.type,
        level: input.level ?? riskEvent?.level ?? RiskLevel.MEDIUM,
        status: WorkOrderStatus.PENDING,
        deadline: input.deadline ? new Date(input.deadline) : null,
        dispatchReason: input.dispatchReason ?? null,
        createdById: requester.sub,
        sourceFrom: input.sourceFrom ?? WorkOrderSource.MANUAL,
        familyRequestText: input.familyRequestText ?? null,
      },
    });

    // Record timeline
    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: workOrder.id,
        action: 'CREATED',
        operatorId: requester.sub,
        note: input.dispatchReason ?? null,
      },
    });

    // Update risk event status if linked
    if (input.riskEventId) {
      await this.prisma.riskEvent.update({
        where: { id: input.riskEventId },
        data: { status: RiskStatus.DISPATCHED },
      });
    }

    // Get dispatch recommendation (only when linked to a risk event)
    let recommendation: any[] = [];
    if (input.riskEventId) {
      try {
        recommendation = await this.dispatch.recommend(input.riskEventId, input.type);
      } catch {
        // Recommendation is optional — don't fail if it errors
      }
    }

    return { workOrder, recommendation };
  }

  async findAll(
    query: {
      page: number;
      limit: number;
      status?: WorkOrderStatus;
      type?: WorkOrderType;
      district?: string;
      elderId?: string;
      assigneeId?: string;
    },
    requester: Requester,
  ) {
    const { page, limit, status, type, district, elderId, assigneeId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (elderId) where.elderId = elderId;
    if (assigneeId) where.assigneeId = assigneeId;

    // 按角色隔离：FAMILY 只看关联老人的工单，worker 保持 district 隔离
    if (requester.role === Role.FAMILY) {
      const links = await this.prisma.elderFamilyLink.findMany({
        where: { userId: requester.sub },
        select: { elderId: true },
      });
      const elderIds = links.map((l: any) => l.elderId);
      // 越权防护：若传了 elderId 但不在自己的关联列表内，拒绝
      if (elderId && !elderIds.includes(elderId)) {
        throw new ForbiddenException('无权限查看此老人的工单');
      }
      where.elderId = { in: elderIds };
    } else if (requester.role !== Role.ADMIN) {
      // worker 保持原有 district 隔离
      where.elder = { district: requester.district ?? '' };
    } else if (district) {
      where.elder = { district };
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: {
          elder: { select: { id: true, name: true, district: true } },
          assignee: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string, requester?: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        elder: { select: { id: true, name: true, district: true } },
        assignee: { select: { id: true, name: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
        riskEvent: { select: { id: true, level: true, source: true } },
      },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (requester) checkDistrictAccess(wo, requester);

    return wo;
  }

  async assign(id: string, assigneeId: string, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    const user = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (!ASSIGNABLE_ROLES.includes(user.role)) {
      throw new BadRequestException('不可将工单派给该角色');
    }

    safeTransition(wo.status, WorkOrderStatus.ASSIGNED, {
      isAssignee: true,
    });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { assigneeId, status: WorkOrderStatus.ASSIGNED },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'ASSIGNED',
        operatorId: requester.sub,
        note: `派单给 ${(user as any).name}`,
      },
    });

    this.pushWorkOrderUpdate(updated.id, updated.status, updated.type, updated.elderId, assigneeId);

    return updated;
  }

  async start(id: string, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    if (wo.assigneeId !== requester.sub) {
      throw new ForbiddenException('只有接单人员可以开始处理');
    }

    safeTransition(wo.status, WorkOrderStatus.IN_PROGRESS, { isAssignee: true });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: WorkOrderStatus.IN_PROGRESS },
    });

    await this.prisma.workOrderTimeline.create({
      data: { workOrderId: id, action: 'IN_PROGRESS', operatorId: requester.sub },
    });

    return updated;
  }

  async complete(
    id: string,
    data: { result: string; photos?: string[] },
    requester: Requester,
  ) {
    if (!data.result || data.result.trim().length === 0) {
      throw new BadRequestException('完成工单必须填写处理结果');
    }

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    if (wo.assigneeId !== requester.sub) {
      throw new ForbiddenException('只有接单人员可以完成工单');
    }

    safeTransition(wo.status, WorkOrderStatus.COMPLETED, {});

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.COMPLETED,
        result: data.result,
        completedAt: new Date(),
      },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'COMPLETED',
        operatorId: requester.sub,
        note: data.result,
      },
    });

    this.pushWorkOrderUpdate(updated.id, updated.status, updated.type, updated.elderId, updated.assigneeId);

    return updated;
  }

  async cancel(id: string, reason: string | undefined, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    // Only ADMIN, GRID_WORKER, or the assignee can cancel
    if (
      requester.role !== Role.ADMIN &&
      requester.role !== Role.GRID_WORKER &&
      wo.assigneeId !== requester.sub
    ) {
      throw new ForbiddenException('无权限取消该工单');
    }

    const hasReason = reason !== undefined && reason.trim().length > 0;

    // For IN_PROGRESS, the state machine already requires hasReason
    safeTransition(wo.status, WorkOrderStatus.CANCELLED, {
      isAssignee: wo.assigneeId === requester.sub,
      hasReason,
    });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: WorkOrderStatus.CANCELLED },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'CANCELLED',
        operatorId: requester.sub,
        note: reason ?? null,
      },
    });

    this.pushWorkOrderUpdate(updated.id, updated.status, updated.type, updated.elderId, updated.assigneeId);

    return updated;
  }

  async reassign(id: string, newAssigneeId: string, reason: string, requester: Requester) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('改派时必须填写原因');
    }

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        elder: { select: { district: true } },
        assignee: { select: { name: true } },
      },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    const newUser = await this.prisma.user.findUnique({ where: { id: newAssigneeId } });
    if (!newUser) throw new NotFoundException('用户不存在');
    if (!ASSIGNABLE_ROLES.includes(newUser.role)) {
      throw new BadRequestException('不可将工单派给该角色');
    }

    safeTransition(wo.status, WorkOrderStatus.ASSIGNED, {
      hasReason: true,
    });

    const prevName = (wo as any).assignee?.name ?? '未指派';
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { assigneeId: newAssigneeId, status: WorkOrderStatus.ASSIGNED },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'REASSIGNED',
        operatorId: requester.sub,
        note: `从 ${prevName} 改派给 ${newUser.name}。原因: ${reason}`,
      },
    });

    return updated;
  }

  async getTimeline(id: string, requester?: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    if (requester) checkDistrictAccess(wo, requester);

    return this.prisma.workOrderTimeline.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
  /**
   * 超时自动升级工单 level（LOW→MEDIUM→HIGH）。
   * 仅由 SchedulerService.escalateTimeouts 在"已派单/处理中且超时"场景调用——
   * 调用方负责用 status 过滤确保不升级 PENDING/终态工单。
   */
  async escalate(id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    // Escalate level: LOW -> MEDIUM, MEDIUM -> HIGH, HIGH stays HIGH
    const levelOrder: RiskLevel[] = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH];
    const currentIdx = levelOrder.indexOf(wo.level);
    if (currentIdx < levelOrder.length - 1) {
      const newLevel = levelOrder[currentIdx + 1];
      const updated = await this.prisma.workOrder.update({
        where: { id },
        data: { level: newLevel },
      });

      await this.prisma.workOrderTimeline.create({
        data: {
          workOrderId: id,
          action: 'ESCALATED',
          note: `超时自动升级: ${wo.level} → ${newLevel}`,
        },
      });

      return updated;
    }

    return wo;
  }
}
