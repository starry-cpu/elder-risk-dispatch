// apps/api/src/modules/risk/risk-scoring.service.ts
import { Injectable } from '@nestjs/common';
import { RiskLevel } from '@prisma/client';

export interface RiskInput {
  hoursSinceLastCheckIn: number;
  deviceAlarms: string[];
  abnormalText: boolean;
  age: number;
  hasChronicDisease: boolean;
  recentHighRisk: boolean;
}

export interface RiskResult {
  score: number;
  level: RiskLevel;
  reason: string[];
  ruleVersion: number;
}

@Injectable()
export class RiskScoringService {
  evaluate(input: RiskInput): RiskResult {
    let score = 0;
    const reason: string[] = [];

    if (input.hoursSinceLastCheckIn >= 24) {
      score += 40;
      reason.push('连续未报平安');
    }

    if (input.deviceAlarms.includes('FALL')) {
      score += 60;
      reason.push('设备跌倒报警');
    }

    if (input.deviceAlarms.some((a) => ['SMOKE', 'WATER'].includes(a))) {
      score += 50;
      reason.push('烟感/水浸报警');
    }

    if (input.abnormalText) {
      score += 30;
      reason.push('异常文本');
    }

    if (input.age >= 80 && input.hasChronicDisease) {
      score += 15;
      reason.push('高龄叠加慢病');
    }

    if (input.recentHighRisk) {
      score += 10;
      reason.push('近7天高风险史');
    }

    const hasCriticalAlarm = input.deviceAlarms.some((a) =>
      ['SMOKE', 'WATER'].includes(a),
    );

    const level =
      hasCriticalAlarm || score >= 70
        ? RiskLevel.HIGH
        : score >= 40
          ? RiskLevel.MEDIUM
          : RiskLevel.LOW;

    return { score, level, reason, ruleVersion: 1 };
  }
}
