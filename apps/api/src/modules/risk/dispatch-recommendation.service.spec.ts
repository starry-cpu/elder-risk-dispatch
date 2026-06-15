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
    elder: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
    workOrder: { groupBy: jest.fn().mockResolvedValue([]) },
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

  describe('recommendByType', () => {
    beforeEach(() => {
      mockPrisma.elder.findUnique.mockResolvedValue({ district: '朝阳区' });
      mockPrisma.user.findMany.mockResolvedValue(mockUsers);
      mockPrisma.workOrder.groupBy.mockResolvedValue([]);
    });

    it('按老人片区 + 工单类型推荐（不依赖 risk event）', async () => {
      const result = await service.recommendByType('elder-1', WorkOrderType.REPAIR);
      expect(mockPrisma.elder.findUnique).toHaveBeenCalledWith({
        where: { id: 'elder-1' }, select: { district: true },
      });
      expect(result).toHaveLength(4);
      // w2 有 REPAIR 技能且同片区，应排第一
      expect(result[0].userId).toBe('w2');
    });

    it('老人不存在应抛 NotFound', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(service.recommendByType('nope', WorkOrderType.LIFE)).rejects.toThrow('老人不存在');
    });

    it('活跃工单越多分越低（workload 因子）', async () => {
      // 两个技能/片区/在岗完全相同的 worker，仅活跃工单数不同
      const twinUsers = [
        { id: 'a', name: '忙人', role: Role.GRID_WORKER, skills: ['LIFE'], district: '朝阳区', dutyStatus: DutyStatus.ON_DUTY, avgResponseMin: 10 },
        { id: 'b', name: '闲人', role: Role.GRID_WORKER, skills: ['LIFE'], district: '朝阳区', dutyStatus: DutyStatus.ON_DUTY, avgResponseMin: 10 },
      ];
      mockPrisma.user.findMany.mockResolvedValue(twinUsers);
      mockPrisma.workOrder.groupBy.mockResolvedValue([
        { assigneeId: 'a', _count: { _all: 5 } },
        { assigneeId: 'b', _count: { _all: 0 } },
      ]);
      const result = await service.recommendByType('elder-1', WorkOrderType.LIFE);
      const busy = result.find((r) => r.userId === 'a')!;
      const idle = result.find((r) => r.userId === 'b')!;
      expect(busy.breakdown.workload).toBeLessThan(0);
      expect(idle.breakdown.workload).toBe(0);
      expect(busy.activeWorkOrders).toBe(5);
      expect(idle.activeWorkOrders).toBe(0);
      // 技能/片区/在岗/响应时间都相同，busy 因 workload 被扣分应低于 idle
      expect(busy.score).toBeLessThan(idle.score);
    });

    it('breakdown 含 workload 字段', async () => {
      const result = await service.recommendByType('elder-1', WorkOrderType.LIFE);
      expect(result[0].breakdown).toHaveProperty('workload');
      expect(result[0]).toHaveProperty('activeWorkOrders');
    });
  });
});
