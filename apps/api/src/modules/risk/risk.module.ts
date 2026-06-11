// apps/api/src/modules/risk/risk.module.ts
import { Module } from '@nestjs/common';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskScoringService } from './risk-scoring.service';
import { RulesController } from './rules/rules.controller';
import { RulesService } from './rules/rules.service';

@Module({
  controllers: [RiskController, RulesController],
  providers: [RiskScoringService, RiskService, RulesService],
  exports: [RiskScoringService, RiskService],
})
export class RiskModule {}
