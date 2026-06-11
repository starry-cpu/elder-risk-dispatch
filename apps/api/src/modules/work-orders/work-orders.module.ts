import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { EvaluationsController } from './evaluations/evaluations.controller';
import { EvaluationsService } from './evaluations/evaluations.service';

@Module({
  imports: [RiskModule, NotificationsModule],
  controllers: [WorkOrdersController, EvaluationsController],
  providers: [WorkOrdersService, EvaluationsService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
