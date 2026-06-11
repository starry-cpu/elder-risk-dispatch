import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { MissedCheckinProcessor } from './processors/missed-checkin.processor';
import { WorkorderTimeoutProcessor } from './processors/workorder-timeout.processor';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { RiskModule } from '../risk/risk.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'scheduler' }),
    PrismaModule,
    RiskModule,
    WorkOrdersModule,
    NotificationsModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService, MissedCheckinProcessor, WorkorderTimeoutProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
