import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SchedulerService } from '../scheduler.service';

@Processor('scheduler')
export class MissedCheckinProcessor extends WorkerHost {
  private readonly logger = new Logger(MissedCheckinProcessor.name);

  constructor(private readonly schedulerService: SchedulerService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== 'missed-checkin-scan') {
      this.logger.warn(`Unknown job name: ${job.name}, skipping`);
      return;
    }

    return this.handleMissedCheckinScan(job);
  }

  async handleMissedCheckinScan(job: Job): Promise<unknown> {
    this.logger.log(`Processing missed-checkin-scan job ${job.id}`);
    return this.schedulerService.scanMissedCheckIns();
  }
}
