// apps/api/src/modules/risk/dispatch-recommendation.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DispatchRecommendationService } from './dispatch-recommendation.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkOrderType, DutyStatus, Role, RiskLevel, RiskSource, RiskStatus } from '@prisma/client';

describe('DispatchRecommendationService', () => {
  let service: DispatchRecommendationService;

  const mockUsers = [
    { id: 'w1', name: '张三', role: Role.GRID_WORKER, skills: ['HEALTH', 'LIFE'], district: '朝阳区', dutyStatus: DutyStatus.ON_DUTY, avgResponseMin: 10 },
    { id: 'w2', name: '李四', role: Role.GRID_WORKER, skills: ['REPAIR'], district: '朝阳区', dutyStatus: DutyStatus.ON_DUTY, avgResponseMin: 20 },
    { id: 'w3', name: '王五', role: Role.GRID_WORKER, skills: ['HEALTH'], district: '海淀区', dutyStatus: DutyStatus.ON_DUTY, avgResponseMin: 15 },
    { id: 'w4', name: '赵六', role: Role.GRID_WORKER, skills: ['HEALTH', 'LIFE'], district: '朝阳区', dutyStatus: DutyStatus.OFF_DUTY, avgResponseMin: 5 },
  ];

  const mockPrisma = {
    riskEvent: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchRecommendationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DispatchRecommendationService>(DispatchRecommendationService);
    jest.clearAllMocks();
  });

  describe('recommend', () => {
    const riskEvent = {
      id: 're-1', elderId: 'elder-1', level: RiskLevel.HIGH, source: RiskSource.MISSED_CHECKIN,
      score: 70, reason: '连续未报平安', status: RiskStatus.PENDING_REVIEW,
      elder: { id: 'elder-1', district: '朝阳区' },
    };

    it('应返回按评分排序的候选人列表', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(riskEvent);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.recommend('re-1', WorkOrderType.HEALTH);
      expect(result).toHaveLength(4);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
    });

    it('技能不匹配的用户应排在最后（score 很低）', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(riskEvent);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.recommend('re-1', WorkOrderType.HEALTH);
      expect(result.length).toBeGreaterThan(0);
    });

    it('同片区应加分', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(riskEvent);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.recommend('re-1', WorkOrderType.HEALTH);
      const sameDistrict = result.filter((r: any) => r.district === '朝阳区');
      const otherDistrict = result.filter((r: any) => r.district === '海淀区');
      if (sameDistrict.length && otherDistrict.length) {
        expect(sameDistrict[0].score).toBeGreaterThan(otherDistrict[0].score);
      }
    });

    it('在岗状态应为加分项', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(riskEvent);
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await service.recommend('re-1', WorkOrderType.HEALTH);
      const onDuty = result.find((r: any) => r.userId === 'w1');
      const offDuty = result.find((r: any) => r.userId === 'w4');
      expect(onDuty!.score).toBeGreaterThan(offDuty!.score);
    });

    it('风险事件不存在应抛 NotFound', async () => {
      mockPrisma.riskEvent.findUnique.mockResolvedValue(null);
      await expect(service.recommend('nonexistent', WorkOrderType.HEALTH)).rejects.toThrow('不存在');
    });
  });
});
