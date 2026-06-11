import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DispatchRecommendationService } from '../risk/dispatch-recommendation.service';
import { WorkOrderStateMachine } from './work-orders.state-machine';
import { WorkOrderType, WorkOrderStatus, RiskStatus, Role, RiskLevel } from '@prisma/client';

export interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

const ASSIGNABLE_ROLES: Role[] = [Role.GRID_WORKER, Role.COMMUNITY_DOCTOR, Role.PROPERTY, Role.VOLUNTEER];

function checkDistrictAccess(wo: { elder: { district: string } }, requester: Requester): void {
  if (
    requester.role !== Role.ADMIN &&
    requester.district &&
    wo.elder.district !== requester.district
  ) {
    throw new NotFoundException('工单不存在');
  }
}

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchRecommendationService,
  ) {}

  async create(
    input: {
      elderId: string;
      riskEventId?: string;
      type: WorkOrderType;
      level?: RiskLevel;
      deadline?: string;
      dispatchReason?: string;
    },
    requester: Requester,
  ) {
    const elder = await this.prisma.elder.findUnique({ where: { id: input.elderId } });
    if (!elder) throw new NotFoundException('老人不存在');

    let riskEvent: { level: RiskLevel; status: RiskStatus; elder: { district: string } } | null = null;
    if (input.riskEventId) {
      riskEvent = await this.prisma.riskEvent.findUnique({
        where: { id: input.riskEventId },
        include: { elder: { select: { district: true } } },
      });
      if (!riskEvent) throw new NotFoundException('风险事件不存在');
      if (riskEvent.status !== RiskStatus.CONFIRMED) {
        throw new BadRequestException('仅已确认的风险事件可生成工单');
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

    // District isolation
    if (requester.role !== Role.ADMIN) {
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
        assignee: { select: { id: true, name: true, phone: true } },
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

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.ASSIGNED, {
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

    return updated;
  }

  async start(id: string, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.IN_PROGRESS, {
      isAssignee: wo.assigneeId === requester.sub,
    });

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

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.COMPLETED, {});

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

    return updated;
  }

  async cancel(id: string, reason: string | undefined, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');
    checkDistrictAccess(wo, requester);

    const hasReason = reason !== undefined && reason.trim().length > 0;

    // For IN_PROGRESS, the state machine already requires hasReason
    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.CANCELLED, {
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

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.ASSIGNED, {
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
}
