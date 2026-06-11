import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

@Injectable()
export class WorkOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async escalate(id: string) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
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
