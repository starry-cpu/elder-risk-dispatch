// apps/api/src/modules/risk/risk-scoring.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RiskScoringService } from './risk-scoring.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

describe('RiskScoringService', () => {
  let service: RiskScoringService;

  const mockPrisma = {
    riskRule: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
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
      it('无任何风险因子时应返回 LOW', () => {
        const result = service.evaluate({
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
      it('24h 未报平安应命中并给原因', () => {
        const result = service.evaluate({
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

      it('跌倒报警必须判定为 HIGH', () => {
        const result = service.evaluate({
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

      it('烟感报警应命中', () => {
        const result = service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: ['SMOKE'],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.score).toBeGreaterThanOrEqual(50);
        expect(result.level).toBe(RiskLevel.HIGH);
        expect(result.reason.some((r: string) => r.includes('烟感') || r.includes('水浸'))).toBe(true);
      });

      it('水浸报警应命中', () => {
        const result = service.evaluate({
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

      it('异常文本应命中', () => {
        const result = service.evaluate({
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

      it('高龄+慢病叠加应命中（age>=80 AND hasChronicDisease）', () => {
        const result = service.evaluate({
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

      it('近期高风险史应命中', () => {
        const result = service.evaluate({
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
      it('未报平安+异常文本应累加分数', () => {
        const result = service.evaluate({
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

      it('跌倒+高龄+慢病全叠加应为 HIGH', () => {
        const result = service.evaluate({
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

      it('所有规则全部命中应达到最高分', () => {
        const result = service.evaluate({
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
      it('23小时未报平安不应触发规则', () => {
        const result = service.evaluate({
          hoursSinceLastCheckIn: 23,
          deviceAlarms: [],
          abnormalText: false,
          age: 50,
          hasChronicDisease: false,
          recentHighRisk: false,
        });
        expect(result.reason.some((r: string) => r.includes('未报平安'))).toBe(false);
      });

      it('age=79 且有慢病不应触发高龄叠加', () => {
        const result = service.evaluate({
          hoursSinceLastCheckIn: 0,
          deviceAlarms: [],
          abnormalText: false,
          age: 79,
          hasChronicDisease: true,
          recentHighRisk: false,
        });
        expect(result.reason.some((r: string) => r.includes('高龄'))).toBe(false);
      });

      it('age=80 且有慢病应触发高龄叠加', () => {
        const result = service.evaluate({
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
      it('score=0 → LOW', () => {
        const result = service.evaluate({
          hoursSinceLastCheckIn: 0, deviceAlarms: [], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.level).toBe(RiskLevel.LOW);
      });

      it('score=39 → LOW', () => {
        // 异常文本=30, 无其他
        const result = service.evaluate({
          hoursSinceLastCheckIn: 0, deviceAlarms: [], abnormalText: true,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(30);
        expect(result.level).toBe(RiskLevel.LOW);
      });

      it('score=40 → MEDIUM', () => {
        // 未报平安=40
        const result = service.evaluate({
          hoursSinceLastCheckIn: 24, deviceAlarms: [], abnormalText: false,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(40);
        expect(result.level).toBe(RiskLevel.MEDIUM);
      });

      it('score=69 → MEDIUM', () => {
        // 高龄叠加=15 + 高风险史=10 + 未报平安=40 = 65
        const result = service.evaluate({
          hoursSinceLastCheckIn: 24, deviceAlarms: [], abnormalText: false,
          age: 82, hasChronicDisease: true, recentHighRisk: true,
        });
        expect(result.score).toBe(65);
        expect(result.level).toBe(RiskLevel.MEDIUM);
      });

      it('score=70 → HIGH', () => {
        const result = service.evaluate({
          hoursSinceLastCheckIn: 25, deviceAlarms: [], abnormalText: true,
          age: 50, hasChronicDisease: false, recentHighRisk: false,
        });
        expect(result.score).toBe(70);
        expect(result.level).toBe(RiskLevel.HIGH);
      });
    });
  });
});
