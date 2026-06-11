import { Controller, Post, Get, Query, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { SchedulerRunQueryDto } from './dto/trigger.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Scheduler')
@ApiBearerAuth()
@Controller('scheduler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SchedulerController {
  constructor(
    private readonly schedulerService: SchedulerService,
    @InjectQueue('scheduler') private readonly schedulerQueue: Queue,
  ) {}

  @Post('trigger/missed-checkin')
  @Roles(Role.ADMIN)
  async triggerMissedCheckin() {
    await this.schedulerQueue.add(
      'missed-checkin-scan',
      {},
      { jobId: `missed-checkin-manual-${Date.now()}` },
    );
    return { accepted: true, jobName: 'missed-checkin-scan' };
  }

  @Post('trigger/workorder-escalate')
  @Roles(Role.ADMIN)
  async triggerWorkorderEscalate() {
    await this.schedulerQueue.add(
      'workorder-timeout-escalate',
      {},
      { jobId: `workorder-escalate-manual-${Date.now()}` },
    );
    return { accepted: true, jobName: 'workorder-timeout-escalate' };
  }

  @Get('runs')
  @Roles(Role.ADMIN)
  async getRuns(@Query() query: SchedulerRunQueryDto) {
    return this.schedulerService.getRuns({
      jobName: query.jobName,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
