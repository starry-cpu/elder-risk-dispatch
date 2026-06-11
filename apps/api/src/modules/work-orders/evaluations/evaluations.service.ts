import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WorkOrderStatus, Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workOrderId: string,
    input: { rating: number; comment?: string; tags?: string[] },
    requester: Requester,
  ) {
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('评分必须在 1-5 之间');
    }

    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (wo.status !== WorkOrderStatus.COMPLETED) {
      throw new BadRequestException('仅可对已完成的工单进行评价');
    }

    if (wo.createdById !== requester.sub) {
      throw new ForbiddenException('仅工单创建者可提交评价');
    }

    const existing = await this.prisma.serviceEvaluation.findUnique({
      where: { workOrderId },
    });
    if (existing) {
      throw new BadRequestException('该工单已评价');
    }

    return this.prisma.serviceEvaluation.create({
      data: {
        workOrderId,
        rating: input.rating,
        comment: input.comment ?? null,
        tags: input.tags ?? [],
      },
    });
  }

  async findByWorkOrderId(workOrderId: string, requester?: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (requester && requester.role !== Role.ADMIN && requester.district && wo.elder.district !== requester.district) {
      throw new NotFoundException('工单不存在');
    }

    return this.prisma.serviceEvaluation.findUnique({
      where: { workOrderId },
    });
  }
}
