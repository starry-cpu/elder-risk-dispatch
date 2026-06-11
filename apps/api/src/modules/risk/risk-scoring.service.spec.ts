// apps/api/src/modules/risk/risk-scoring.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RiskScoringService } from './risk-scoring.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

// Built-in rules matching seed data / hardcoded behavior
const builtInRules = [
  { id: 'r1', name: '连续未报平安', condition: { field: 'hoursSinceLastCheckIn', operator: 'gte', value: 24 }, weight: 40, level: 'MEDIUM', version: 1, enabled: true, createdById: null, updatedAt: new Date() },
  { id: 'r2', name: '设备跌倒报警', condition: { field: 'metricType', operator: 'eq', value: 'FALL', requireAlarm: true }, weight: 60, level: 'HIGH', version: 1, enabled: true, createdById: null, updatedAt: new Date() },
  { id: 'r3', name: '烟感/水浸报警', condition: { field: 'metricType', operator: 'in', value: ['SMOKE', 'WATER'], requireAlarm: true }, weight: 50, level: 'HIGH', version: 1, enabled: true, createdById: null, updatedAt: new Date() },
  { id: 'r4', name: '异常文本', condition: { field: 'abnormalText', operator: 'eq', value: true }, weight: 30, level: 'MEDIUM', version: 1, enabled: true, createdById: null, updatedAt: new Date() },
  { id: 'r5', name: '高龄叠加慢病', condition: { field: 'age', operator: 'gte', value: 80, requireChronicDisease: true }, weight: 15, level: 'MEDIUM', version: 1, enabled: true, createdById: null, updatedAt: new Date() },
  { id: 'r6', name: '近7天高风险史', condition: { field: 'recentHighRisk', operator: 'eq', value: true, lookbackDays: 7 }, weight: 10, level: 'MEDIUM', version: 1, enabled: true, createdById: null, updatedAt: new Date() },
];

let currentRules: any[] = builtInRules;

const mockPrisma = {
  riskRule: {
    findMany: jest.fn().mockImplementation((args?: any) => {
      let rules = currentRules;
      if (args?.where?.enabled !== undefined) {
        rules = rules.filter((r: any) => r.enabled === args.where.enabled);
      }
      return Promise.resolve(rules);
    }),
  },
};

describe('RiskScoringService', () => {
  let service: RiskScoringService;

  beforeEach(async () => {
    currentRules = builtInRules;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskScoringService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RiskScoringService>(RiskScoringService);
    jest.clearAllMocks();
  });

  describe('evaluate', () => {
    describe('零风险场景', () => {
      it('无任何风险因子时应返回 LOW', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBe(0);
        expect(result.level).toBe(RiskLevel.LOW);
        expect(result.reason).toEqual([]);
        expect(result.ruleVersion).toBeGreaterThanOrEqual(1);
      });
    });

    describe('单条规则命中', () => {
      it('24h 未报平安应命中并给原因', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 25,
          deviceAlarms: [],
          abnormalText: false,
          age: 70,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(40);
        expect([RiskLevel.MEDIUM, RiskLevel.HIGH]).toContain(result.level);
        expect(result.reason).toContain('连续未报平安');
      });

      it('跌倒报警必须判定为 HIGH', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 1,
          deviceAlarms: ['FALL'],
          abnormalText: false,
          age: 82,
          hasChronicDisease: true,
          recentHighRisk: false,
        });
        expect(result.level).toBe(RiskLevel.HIGH);
        expect(result.reason.some((r: string) => r.includes('跌倒'))).toBe(true);
      });

      it('烟感报警应命中', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: ['SMOKE'],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.level).toBe(RiskLevel.MEDIUM);
        expect(result.reason.some((r: string) => r.includes('烟感') || r.includes('水浸'))).toBe(true);
      });

      it('水浸报警应命中', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: ['WATER'],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.reason.some((r: string) => r.includes('烟感') || r.includes('水浸'))).toBe(true);
      });

      it('异常文本应命中', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: true,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(30);
        expect(result.reason.some((r: string) => r.includes('文本'))).toBe(true);
      });

      it('高龄+慢病叠加应命中（age>=80 AND hasChronicDisease）', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: false,
          age: 82,
          hasChronicDisease: true,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(15);
        expect(result.reason.some((r: string) => r.includes('高龄'))).toBe(true);
      });

      it('近期高风险史应命中', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: true,
        });
        expect(result.score).toBeGreaterThanOrEqual(10);
        expect(result.reason.some((r: string) => r.includes('高风险史'))).toBe(true);
      });
    });

    describe('多条规则叠加', () => {
      it('未报平安+异常文本应累加分数', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 25,
          deviceAlarms: [],
          abnormalText: true,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(70);
        expect(result.level).toBe(RiskLevel.HIGH);
        expect(result.reason.length).toBeGreaterThanOrEqual(2);
      });

      it('跌倒+高龄+慢病全叠加应为 HIGH', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 10,
          deviceAlarms: ['FALL'],
          abnormalText: false,
          age: 85,
          hasChronicDisease: true,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(75);
        expect(result.level).toBe(RiskLevel.HIGH);
        expect(result.reason.length).toBeGreaterThanOrEqual(2);
      });

      it('所有规则全部命中应达到最高分', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 30,
          deviceAlarms: ['FALL', 'SMOKE'],
          abnormalText: true,
          age: 85,
          hasChronicDisease: true,
          recentHighRisk: true,
        });
        expect(result.score).toBeGreaterThanOrEqual(205);
        expect(result.level).toBe(RiskLevel.HIGH);
      });
    });

    describe('边界值', () => {
      it('23小时未报平安不应触发规则', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 23,
          deviceAlarms: [],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.reason.some((r: string) => r.includes('未报平安'))).toBe(false);
      });

      it('age=79 且有慢病不应触发高龄叠加', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: false,
          age: 79,
          hasChronicDisease: true,
          recentHighRisk: false,
        });
        expect(result.reason.some((r: string) => r.includes('高龄'))).toBe(false);
      });

      it('age=80 且有慢病应触发高龄叠加', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: false,
          age: 80,
          hasChronicDisease: true,
          recentHighRisk: false,
        });
        expect(result.reason.some((r: string) => r.includes('高龄'))).toBe(true);
      });
    });

    describe('score → level 阈值', () => {
      it('score=0 → LOW', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0, deviceAlarms: [], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.level).toBe(RiskLevel.LOW);
      });

      it('score=39 → LOW', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 0, deviceAlarms: [], abnormalText: true,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(30);
        expect(result.level).toBe(RiskLevel.LOW);
      });

      it('score=40 → MEDIUM', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 24, deviceAlarms: [], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(40);
        expect(result.level).toBe(RiskLevel.MEDIUM);
      });

      it('score=69 → MEDIUM', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 24, deviceAlarms: [], abnormalText: false,
          age: 82, hasChronicDisease: true, recentHighRisk: true,
        });
        expect(result.score).toBe(65);
        expect(result.level).toBe(RiskLevel.MEDIUM);
      });

      it('score=70 → HIGH', async () => {
        const result = await service.evaluate({
          hoursSinceLastCheckIn: 25, deviceAlarms: [], abnormalText: true,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(70);
        expect(result.level).toBe(RiskLevel.HIGH);
      });
    });

    describe('规则可配置化', () => {
      it('禁用的规则不应参与评分', async () => {
        currentRules = builtInRules.map((r: any) =>
          r.id === 'r1' ? { ...r, enabled: false } : r,
        );

        const result = await service.evaluate({
          hoursSinceLastCheckIn: 25, deviceAlarms: [], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(0);
        expect(result.reason).toEqual([]);
      });

      it('规则 weight 变更后应反映在新评分中', async () => {
        currentRules = builtInRules.map((r: any) =>
          r.id === 'r1' ? { ...r, weight: 60, version: 2 } : r,
        );

        const result = await service.evaluate({
          hoursSinceLastCheckIn: 25, deviceAlarms: [], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(60);
        expect(result.ruleVersion).toBe(2);
      });

      it('ruleVersion 应为所有命中规则中的最大 version', async () => {
        currentRules = builtInRules.map((r: any) =>
          r.id === 'r1' ? { ...r, version: 3 } : { ...r, version: 1 },
        );

        const result = await service.evaluate({
          hoursSinceLastCheckIn: 25, deviceAlarms: ['FALL'], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.ruleVersion).toBe(3);
      });
    });
  });
});
