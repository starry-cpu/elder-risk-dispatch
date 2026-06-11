import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardAggregateProcessor } from './processors/dashboard-aggregate.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'scheduler' }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardAggregateProcessor],
})
export class DashboardModule {}
