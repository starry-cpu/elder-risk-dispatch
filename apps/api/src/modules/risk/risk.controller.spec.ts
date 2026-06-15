// apps/api/src/modules/risk/risk.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RiskController } from './risk.controller';
import { RiskService } from './risk.service';
import { RiskLevel, RiskStatus, Role } from '@prisma/client';

describe('RiskController', () => {
  let controller: RiskController;

  const mockRiskService = {
    evaluateAndCreateEvent: jest.fn(),
    assertCanEvaluate: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn(),
    findById: jest.fn(),
    reviewEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RiskController],
      providers: [{ provide: RiskService, useValue: mockRiskService }],
    }).compile();
    controller = module.get<RiskController>(RiskController);
    jest.clearAllMocks();
  });

  describe('evaluate', () => {
    it('应先鉴权再调用 service.evaluateAndCreateEvent 并返回结果', async () => {
      const dto = {
        elderId: 'elder-1',
        hoursSinceLastCheckIn: 25,
        deviceAlarms: [],
        abnormalText: false,
        age: 75, hasChronicDisease: false, recentHighRisk: false,
      };
      const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' as const };
      mockRiskService.evaluateAndCreateEvent.mockResolvedValue({
        id: 're-1', score: 40, level: RiskLevel.MEDIUM, status: RiskStatus.PENDING_REVIEW,
      });

      const result = await controller.evaluate(dto, admin);
      expect(result).toBeDefined();
      // 鉴权先于评估
      expect(mockRiskService.assertCanEvaluate).toHaveBeenCalledWith('elder-1', admin);
      expect(mockRiskService.evaluateAndCreateEvent).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('应返回分页列表', async () => {
      mockRiskService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      const result = await controller.findAll({ page: 1, limit: 20 }, { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result.total).toBe(0);
    });
  });

  describe('review', () => {
    it('应调用 service.reviewEvent', async () => {
      mockRiskService.reviewEvent.mockResolvedValue({ id: 're-1', status: RiskStatus.CONFIRMED });
      const result = await controller.review('re-1', { status: RiskStatus.CONFIRMED, note: '已确认' }, { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result.status).toBe(RiskStatus.CONFIRMED);
    });
  });
});
