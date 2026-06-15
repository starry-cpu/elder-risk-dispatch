import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { AiModule } from '../ai/ai.module';
import { RiskModule } from '../risk/risk.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  // WorkOrdersModule + NotificationsModule：家属请求派单流程需要建单/派单/通知
  imports: [AiModule, RiskModule, WorkOrdersModule, NotificationsModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
