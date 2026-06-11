import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Processor('scheduler')
export class DashboardAggregateProcessor extends WorkerHost {
  private readonly logger = new Logger(DashboardAggregateProcessor.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== 'dashboard-aggregate') {
      return;
    }

    return this.handleAggregate(job);
  }

  async handleAggregate(job: Job) {
    this.logger.log(`Processing dashboard-aggregate job ${job.id}`);

    const run = await this.prisma.schedulerRun.create({
      data: { jobName: 'dashboard-aggregate', status: 'RUNNING' },
    });

    const admin = { sub: 'system', role: 'ADMIN' as const };
    let itemsProcessed = 0;

    try {
      const results = await Promise.allSettled([
        this.dashboardService.getRiskOverview({ period: '7d' }, admin),
        this.dashboardService.getWorkOrderEfficiency({ period: '7d' }, admin),
        this.dashboardService.getElderCoverage({ period: '7d' }, admin),
        this.dashboardService.getGridWorkerPerformance({}, admin),
      ]);

      for (const result of results) {
        if (result.status === 'fulfilled') {
          itemsProcessed++;
        }
      }

      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown error')
        .join('; ');

      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: {
          status: errors ? 'PARTIAL' : 'COMPLETED',
          completedAt: new Date(),
          itemsProcessed,
          error: errors || null,
        },
      });

      this.logger.log(`Dashboard aggregate completed: ${itemsProcessed}/4 successful`);
    } catch (error) {
      this.logger.error(
        'Dashboard aggregate failed',
        error instanceof Error ? error.message : String(error),
      );

      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
