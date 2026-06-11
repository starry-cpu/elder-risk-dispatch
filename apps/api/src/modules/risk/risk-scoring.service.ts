// apps/api/src/modules/risk/risk-scoring.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
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

interface RuleCondition {
  field: string;
  operator: string;
  value: any;
  requireAlarm?: boolean;
  requireChronicDisease?: boolean;
  lookbackDays?: number;
}

@Injectable()
export class RiskScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(input: RiskInput): Promise<RiskResult> {
    const rules = await this.prisma.riskRule.findMany({
      where: { enabled: true },
    });

    let score = 0;
    const reason: string[] = [];
    let maxVersion = 1;

    for (const rule of rules) {
      maxVersion = Math.max(maxVersion, rule.version);
      const condition = rule.condition as unknown as RuleCondition;

      if (this.matchCondition(condition, input)) {
        score += rule.weight;
        reason.push(rule.name);
      }
    }

    const level =
      score >= 70 ? RiskLevel.HIGH
      : score >= 40 ? RiskLevel.MEDIUM
      : RiskLevel.LOW;

    return { score, level, reason, ruleVersion: maxVersion };
  }

  private matchCondition(condition: RuleCondition, input: RiskInput): boolean {
    const { field, operator, value, requireAlarm, requireChronicDisease } = condition;

    let fieldValue: any;
    switch (field) {
      case 'hoursSinceLastCheckIn':
        fieldValue = input.hoursSinceLastCheckIn;
        break;
      case 'age':
        fieldValue = input.age;
        break;
      case 'abnormalText':
      case 'aiClassification':
        fieldValue = input.abnormalText;
        break;
      case 'recentHighRisk':
        fieldValue = input.recentHighRisk;
        break;
      case 'metricType':
        fieldValue = input.deviceAlarms;
        break;
      default:
        return false;
    }

    let matched = false;
    switch (operator) {
      case 'gte':
        matched = typeof fieldValue === 'number' && fieldValue >= value;
        break;
      case 'eq':
        matched = fieldValue === value || (Array.isArray(fieldValue) && fieldValue.includes(value));
        break;
      case 'in':
        if (Array.isArray(fieldValue) && Array.isArray(value)) {
          matched = value.some((v: string) => fieldValue.includes(v));
        } else if (typeof fieldValue === 'string' && Array.isArray(value)) {
          matched = value.includes(fieldValue);
        }
        break;
      default:
        matched = false;
    }

    if (matched && requireChronicDisease !== undefined) {
      matched = input.hasChronicDisease === requireChronicDisease;
    }

    return matched;
  }
}
