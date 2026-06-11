import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationsService } from './evaluations.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WorkOrderStatus, Role } from '@prisma/client';

describe('EvaluationsService', () => {
  let service: EvaluationsService;

  const mockPrisma = {
    workOrder: { findUnique: jest.fn() },
    serviceEvaluation: { create: jest.fn(), findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<EvaluationsService>(EvaluationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应成功创建评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, createdById: 'admin-1',
        elder: { district: '东区' },
      });
      mockPrisma.serviceEvaluation.findUnique.mockResolvedValue(null);
      mockPrisma.serviceEvaluation.create.mockResolvedValue({
        id: 'ev-1', workOrderId: 'wo-1', rating: 5, comment: '很好', tags: ['及时'],
      });

      const result = await service.create('wo-1',
        { rating: 5, comment: '很好', tags: ['及时'] },
        { sub: 'admin-1', role: Role.ADMIN },
      );

      expect(result.rating).toBe(5);
      expect(mockPrisma.serviceEvaluation.create).toHaveBeenCalledWith({
        data: { workOrderId: 'wo-1', rating: 5, comment: '很好', tags: ['及时'] },
      });
    });

    it('应拒绝未完成工单的评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, createdById: 'admin-1',
        elder: { district: '东区' },
      });

      await expect(
        service.create('wo-1', { rating: 5 }, { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('仅可对已完成的工单进行评价');
    });

    it('应拒绝非创建者评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, createdById: 'admin-1',
        elder: { district: '东区' },
      });

      await expect(
        service.create('wo-1', { rating: 4 }, { sub: 'other-user', role: Role.GRID_WORKER }),
      ).rejects.toThrow('仅工单创建者可提交评价');
    });

    it('应拒绝重复评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, createdById: 'admin-1',
        elder: { district: '东区' },
      });
      mockPrisma.serviceEvaluation.findUnique.mockResolvedValue({
        id: 'ev-1', workOrderId: 'wo-1', rating: 4,
      });

      await expect(
        service.create('wo-1', { rating: 5 }, { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('该工单已评价');
    });

    it('应拒绝无效评分（<1 或 >5）', async () => {
      await expect(
        service.create('wo-1', { rating: 0 }, { sub: 'u1', role: Role.ADMIN }),
      ).rejects.toThrow('评分必须在 1-5 之间');
    });
  });

  describe('findByWorkOrderId', () => {
    it('应返回工单评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '东区' },
      });
      mockPrisma.serviceEvaluation.findUnique.mockResolvedValue({
        id: 'ev-1', workOrderId: 'wo-1', rating: 5, comment: '好', tags: [],
      });

      const result = await service.findByWorkOrderId('wo-1', { sub: 'u1', role: Role.ADMIN });
      expect(result).not.toBeNull();
      expect(result!.rating).toBe(5);
    });

    it('应拒绝跨片区查看评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '西区' },
      });

      await expect(
        service.findByWorkOrderId('wo-1', { sub: 'w1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('工单不存在');
    });
  });
});
