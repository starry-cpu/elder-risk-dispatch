import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SchedulerService } from '../scheduler.service';

@Processor('scheduler')
export class WorkorderTimeoutProcessor extends WorkerHost {
  private readonly logger = new Logger(WorkorderTimeoutProcessor.name);

  constructor(private readonly schedulerService: SchedulerService) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== 'workorder-timeout-escalate') {
      this.logger.warn(`Unknown job name: ${job.name}, skipping`);
      return;
    }

    return this.handleWorkorderTimeoutEscalate(job);
  }

  async handleWorkorderTimeoutEscalate(_job: Job): Promise<unknown> {
    this.logger.log(`Processing workorder-timeout-escalate job ${_job.id}`);
    return this.schedulerService.escalateTimeouts();
  }
}
