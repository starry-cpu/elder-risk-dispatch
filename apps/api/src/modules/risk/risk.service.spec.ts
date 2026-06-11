// apps/api/src/modules/risk/risk.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RiskService } from './risk.service';
import { RiskScoringService } from './risk-scoring.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskLevel, RiskStatus, Role, ServiceLevel } from '@prisma/client';

describe('RiskService', () => {
  let service: RiskService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };
  const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };

  const scoringResult = {
    score: 70, level: RiskLevel.HIGH, reason: ['连续未报平安', '异常文本'], ruleVersion: 1,
  };

  const mockScoringService = {
    evaluate: jest.fn(),
  };

  const mockElder = {
    id: 'elder-1', name: '张大爷', district: '朝阳区', birthDate: new Date('1940-01-01'),
    healthTags: ['高血压'], serviceLevel: ServiceLevel.HIGH,
    familyLinks: [{ userId: 'family-1', elderId: 'elder-1', relation: '子女' }],
  };

  const mockRiskEvent = {
    id: 're-1', elderId: 'elder-1', level: RiskLevel.HIGH, source: 'MISSED_CHECKIN',
    score: 70, reason: '连续未报平安,异常文本', status: RiskStatus.PENDING_REVIEW,
    reviewedBy: null, ruleVersion: '1', createdAt: new Date(), workOrder: null,
  };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    riskEvent: {
      create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(),
      count: jest.fn(), update: jest.fn(),
    },
    checkIn: { findFirst: jest.fn() },
    deviceData: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        { provide: RiskScoringService, useValue: mockScoringService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RiskService>(RiskService);
    jest.clearAllMocks();
  });

  describe('evaluateAndCreateEvent', () => {
    const input = {
      elderId: 'elder-1',
      hoursSinceLastCheckIn: 25,
      deviceAlarms: [],
      abnormalText: true,
      age: 75,
      hasChronicDisease: true,
      recentHighRisk: false,
    };

    it('应创建 RiskEvent 并返回', async () => {
      mockScoringService.evaluate.mockReturnValue(scoringResult);
      mockPrisma.riskEvent.create.mockResolvedValue(mockRiskEvent);

      const result = await service.evaluateAndCreateEvent(input);
      expect(result).not.toBeNull();
      expect(result!.score).toBe(70);
      expect(result!.level).toBe(RiskLevel.HIGH);
      expect(result!.status).toBe(RiskStatus.PENDING_REVIEW);
      expect(mockPrisma.riskEvent.create).toHaveBeenCalledTimes(1);
    });

    it('分数为 0 时不应创建事件', async () => {
      mockScoringService.evaluate.mockReturnValue({
        score: 0, level: RiskLevel.LOW, reason: [], ruleVersion: 1,
      });

      const result = await service.evaluateAndCreateEvent(input);
      expect(result).toBeNull();
      expect(mockPrisma.riskEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('应返回分页风险事件列表', async () => {
      mockPrisma.riskEvent.findMany.mockResolvedValue([mockRiskEvent]);
      mockPrisma.riskEvent.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 }, admin);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('ADMIN 可查询所有片区', async () => {
      mockPrisma.riskEvent.findMany.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 20, district: '海淀区' }, admin);
      expect(result.items).toEqual([]);
    });

    it('非 ADMIN 按片区隔离', async () => {
      mockPrisma.riskEvent.findMany.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 }, worker);
      expect(mockPrisma.riskEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            elder: { district: '朝阳区' },
          }),
        }),
      );
    });
  });

  describe('reviewEvent', () => {
    it('应确认 HIGH 风险并记录审核人', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(mockRiskEvent);
      mockPrisma.riskEvent.update.mockResolvedValue({
        ...mockRiskEvent, status: RiskStatus.CONFIRMED, reviewedBy: 'admin-1',
      });

      const result = await service.reviewEvent('re-1', RiskStatus.CONFIRMED, 'admin-1', '确认风险');
      expect(result.status).toBe(RiskStatus.CONFIRMED);
      expect(result.reviewedBy).toBe('admin-1');
    });

    it('应允许忽略 LOW 风险', async () => {
      const lowEvent = { ...mockRiskEvent, level: RiskLevel.LOW, score: 10 };
      mockPrisma.riskEvent.findUnique.mockResolvedValue(lowEvent);
      mockPrisma.riskEvent.update.mockResolvedValue({
        ...lowEvent, status: RiskStatus.IGNORED, reviewedBy: 'worker-1',
      });

      const result = await service.reviewEvent('re-l1', RiskStatus.IGNORED, 'worker-1', '不需要处理');
      expect(result.status).toBe(RiskStatus.IGNORED);
    });

    it('HIGH 级别不能直接忽略（必须经过确认或人工判断）', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(mockRiskEvent);

      await expect(
        service.reviewEvent('re-1', RiskStatus.IGNORED, 'worker-1', '直接忽略'),
      ).rejects.toThrow('HIGH 级别');
    });

    it('已复核的事件不能重复复核', async () => {
      const confirmedEvent = { ...mockRiskEvent, status: RiskStatus.CONFIRMED, reviewedBy: 'admin-1' };
      mockPrisma.riskEvent.findUnique.mockResolvedValue(confirmedEvent);

      await expect(
        service.reviewEvent('re-1', RiskStatus.CONFIRMED, 'worker-1', '重复确认'),
      ).rejects.toThrow('已复核');
    });

    it('事件不存在应抛出 NotFound', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(null);

      await expect(
        service.reviewEvent('nonexistent', RiskStatus.CONFIRMED, 'admin-1', ''),
      ).rejects.toThrow('不存在');
    });
  });
});
