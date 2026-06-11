// apps/api/src/modules/risk/risk.module.ts
import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskScoringService } from './risk-scoring.service';

@Module({
  controllers: [RiskController],
  providers: [RiskScoringService, RiskService],
  exports: [RiskScoringService, RiskService],
})
export class RiskModule {}
