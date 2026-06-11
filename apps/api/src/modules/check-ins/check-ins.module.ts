import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { AiModule } from '../ai/ai.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [AiModule, RiskModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
