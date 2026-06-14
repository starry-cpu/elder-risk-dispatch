import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkOrderStatus } from '@prisma/client';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: RiskService,
    private readonly workOrdersService: WorkOrdersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async scanMissedCheckIns(): Promise<{
    processed: number;
    eventsCreated: number;
    errors: number;
  }> {
    const run = await this.prisma.schedulerRun.create({
      data: { jobName: 'missed-checkin-scan', status: 'RUNNING' },
    });

    try {
      const rawThreshold = parseInt(process.env.MISSED_CHECKIN_THRESHOLD_HOURS ?? '24', 10);
      const thresholdHours = isNaN(rawThreshold) || rawThreshold <= 0 ? 24 : rawThreshold;
      const threshold = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

      const elders = await this.prisma.elder.findMany({
        where: {
          checkIns: { none: { createdAt: { gte: threshold } } },
        },
        select: { id: true, name: true, district: true },
      });

      let eventsCreated = 0;
      let errors = 0;

      for (const elder of elders) {
        try {
          const event = await this.riskService.evaluateAndCreateEvent({
            elderId: elder.id,
            hoursSinceLastCheckIn: thresholdHours,
          });

          if (event) {
            eventsCreated++;
            if (event.level !== 'LOW') {
              try {
                await this.notificationsService.sendToRecipients({
                  elderId: elder.id,
                  templateId: process.env.WECHAT_TEMPLATE_MISSED_CHECKIN,
                  payload: {
                    thing1: { value: elder.name },
                    thing2: { value: `${thresholdHours}小时未报平安` },
                    thing3: { value: event.level },
                  },
                });
              } catch (notifError: any) {
                this.logger.warn(`Failed to enqueue notification for elder ${elder.id}: ${notifError.message}`);
              }
            }
          }
        } catch (error: any) {
          this.logger.error(`Failed to process elder ${elder.id}: ${error.message}`);
          errors++;
        }
      }

      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', completedAt: new Date(), itemsProcessed: elders.length },
      });

      this.logger.log(`missed-checkin-scan complete: ${elders.length} processed, ${eventsCreated} events, ${errors} errors`);
      return { processed: elders.length, eventsCreated, errors };
    } catch (error: any) {
      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), error: error.message },
      });
      throw error;
    }
  }

  async escalateTimeouts(): Promise<{
    processed: number;
    escalated: number;
    errors: number;
  }> {
    const run = await this.prisma.schedulerRun.create({
      data: { jobName: 'workorder-timeout-escalate', status: 'RUNNING' },
    });

    try {
      const now = new Date();

      const overdueOrders = await this.prisma.workOrder.findMany({
        where: {
          deadline: { lt: now },
          // 仅升级已派单（ASSIGNED）/ 处理中（IN_PROGRESS）的超时工单。
          // PENDING（未派单）超时不属于"升级"语义，应走催派单提醒而非 level 提升；
          // 终态（COMPLETED/CANCELLED）自然排除。
          status: { in: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS] },
        },
        select: { id: true, elderId: true, level: true, status: true, deadline: true },
      });

      let escalated = 0;
      let errors = 0;

      for (const wo of overdueOrders) {
        try {
          const oldLevel = wo.level;
          const updated = await this.workOrdersService.escalate(wo.id);
          if (updated.level !== oldLevel) {
            escalated++;

            try {
              await this.notificationsService.sendToRecipients({
                elderId: wo.elderId,
                templateId: process.env.WECHAT_TEMPLATE_ESCALATION,
                payload: {
                  thing1: { value: wo.id },
                  thing2: { value: `工单超时自动升级: ${oldLevel} → ${updated.level}` },
                },
              });
            } catch (_notifError: any) {
              this.logger.warn(`Failed to enqueue escalation notification for wo ${wo.id}`);
            }
          }
        } catch (error: any) {
          this.logger.error(`Failed to escalate work order ${wo.id}: ${error.message}`);
          errors++;
        }
      }

      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: { status: 'COMPLETED', completedAt: new Date(), itemsProcessed: overdueOrders.length },
      });

      this.logger.log(`workorder-timeout-escalate complete: ${overdueOrders.length} processed, ${escalated} escalated, ${errors} errors`);
      return { processed: overdueOrders.length, escalated, errors };
    } catch (error: any) {
      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', completedAt: new Date(), error: error.message },
      });
      throw error;
    }
  }

  async getRuns(query: { jobName?: string; page: number; limit: number }) {
    const { page, limit, jobName } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (jobName) where.jobName = jobName;

    const [items, total] = await Promise.all([
      this.prisma.schedulerRun.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.schedulerRun.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
