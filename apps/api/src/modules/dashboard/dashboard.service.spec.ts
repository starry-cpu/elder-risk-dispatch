import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const family = { sub: 'family-1', role: Role.FAMILY, district: undefined };

  const mockPrisma = {
    riskEvent: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    workOrder: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    elder: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    checkIn: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  describe('getRiskOverview', () => {
    it('应返回风险等级分布和来源分布', async () => {
      mockPrisma.riskEvent.groupBy
        .mockResolvedValueOnce([
          { level: 'HIGH', _count: { id: 2 } },
          { level: 'MEDIUM', _count: { id: 3 } },
        ])
        .mockResolvedValueOnce([
          { source: 'MISSED_CHECKIN', _count: { id: 3 } },
          { source: 'DEVICE', _count: { id: 2 } },
        ]);
      mockPrisma.riskEvent.count.mockResolvedValue(5);
      mockPrisma.riskEvent.findMany.mockResolvedValue([
        { createdAt: new Date('2026-06-11') },
        { createdAt: new Date('2026-06-11') },
      ]);

      const result = await service.getRiskOverview({ period: '7d' }, admin);

      expect(result.total).toBe(5);
      expect(result.byLevel).toHaveLength(2);
      expect(result.bySource).toHaveLength(2);
      expect(mockPrisma.riskEvent.groupBy).toHaveBeenCalled();
    });

    it('片区角色应限制查询范围', async () => {
      mockPrisma.riskEvent.groupBy.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);
      mockPrisma.riskEvent.findMany.mockResolvedValue([]);

      await service.getRiskOverview({ period: '7d' }, worker);

      expect(mockPrisma.riskEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
            elder: { district: '朝阳区' },
          }),
        }),
      );
    });
  });

  describe('getWorkOrderEfficiency', () => {
    it('应返回工单状态分布和平均响应时长', async () => {
      mockPrisma.workOrder.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { id: 5 } },
        { status: 'COMPLETED', _count: { id: 3 } },
      ]);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.workOrder.count.mockResolvedValueOnce(8); // total
      mockPrisma.workOrder.count.mockResolvedValueOnce(0); // overdueCount

      const result = await service.getWorkOrderEfficiency({ period: '7d' }, admin);

      expect(result.byStatus).toHaveLength(2);
      expect(result.total).toBe(8);
    });
  });
});
