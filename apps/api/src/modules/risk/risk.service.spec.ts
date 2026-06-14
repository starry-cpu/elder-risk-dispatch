// apps/api/src/modules/risk/risk.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RiskService } from './risk.service';
import { RiskScoringService } from './risk-scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
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
      count: jest.fn(), update: jest.fn(), findFirst: jest.fn(),
    },
    checkIn: { findFirst: jest.fn() },
    deviceData: { findFirst: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockNotificationsService = {
    emitAndPersist: jest.fn().mockResolvedValue({ id: 'notif-99' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskService,
        { provide: RiskScoringService, useValue: mockScoringService },
        { provide: NotificationsService, useValue: mockNotificationsService },
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
    };

    it('应创建 RiskEvent 并返回', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
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
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
      mockScoringService.evaluate.mockReturnValue({
        score: 0, level: RiskLevel.LOW, reason: [], ruleVersion: 1,
      });

      const result = await service.evaluateAndCreateEvent({ elderId: 'elder-1' });
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

  describe('assertCanEvaluate (POST /risk/evaluate 鉴权)', () => {
    it('ADMIN 放行', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ district: '海淀区' });
      await expect(service.assertCanEvaluate('elder-1', admin)).resolves.toBeUndefined();
    });

    it('跨片区 worker 拒绝（防 IDOR 越权评估）', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ district: '海淀区' }); // 老人在海淀
      await expect(service.assertCanEvaluate('elder-1', worker)).rejects.toThrow('不存在');
      // worker.district === '朝阳区'
    });

    it('无片区的 worker 拒绝（避免全表可达）', async () => {
      const districtlessWorker = { sub: 'w-x', role: Role.GRID_WORKER, district: undefined };
      mockPrisma.elder.findUnique.mockResolvedValue({ district: '朝阳区' });
      await expect(service.assertCanEvaluate('elder-1', districtlessWorker)).rejects.toThrow('不存在');
    });

    it('老人不存在抛出 NotFound', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(service.assertCanEvaluate('nope', worker)).rejects.toThrow('不存在');
    });
  });

  describe('findById (GET /risk/events/:id 鉴权 + 脱敏)', () => {
    const eventWithElder = {
      ...mockRiskEvent,
      elder: {
        id: 'elder-1', name: '张大爷', gender: 'M', district: '朝阳区',
        serviceLevel: ServiceLevel.HIGH,
        familyLinks: [{ userId: 'family-1' }, { userId: 'family-other' }],
      },
      workOrder: { id: 'wo-1', status: 'PENDING', type: 'URGENT', level: 'HIGH' },
    };

    it('FAMILY 关联老人可查看，且 familyLinks 不外泄', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(eventWithElder);

      const result = await service.findById('re-1', familyUser);

      expect(result.elder.id).toBe('elder-1');
      // familyLinks 仅用于鉴权，必须从响应中剔除
      expect(result.elder.familyLinks).toBeUndefined();
    });

    it('FAMILY 非关联老人拒绝（防跨家属越权 + PII 泄露）', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(eventWithElder);
      const unrelatedFamily = { sub: 'family-stranger', role: Role.FAMILY, district: undefined };

      await expect(service.findById('re-1', unrelatedFamily)).rejects.toThrow('不存在');
    });

    it('跨片区 worker 拒绝', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(eventWithElder);

      await expect(service.findById('re-1', otherWorker)).rejects.toThrow('不存在');
    });

    it('ADMIN 可查看且 familyLinks 被剔除', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(eventWithElder);

      const result = await service.findById('re-1', admin);
      expect(result.elder.familyLinks).toBeUndefined();
      // 只 select 了安全字段：不含 idCard/address 密文
      expect(result.elder.idCard).toBeUndefined();
      expect(result.elder.address).toBeUndefined();
    });
  });
});
