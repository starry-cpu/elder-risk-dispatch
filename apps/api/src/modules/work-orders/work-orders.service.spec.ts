import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersService } from './work-orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskLevel, WorkOrderStatus } from '@prisma/client';

describe('WorkOrdersService', () => {
  let service: WorkOrdersService;

  const mockPrisma = {
    workOrder: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    workOrderTimeline: { create: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WorkOrdersService>(WorkOrdersService);
    jest.clearAllMocks();
  });

  describe('escalate', () => {
    const overdueWo = {
      id: 'wo-1', elderId: 'elder-1', level: RiskLevel.MEDIUM, status: WorkOrderStatus.IN_PROGRESS,
      assigneeId: 'worker-1', deadline: new Date('2024-01-01'),
      elder: { district: '朝阳区' },
    };

    it('should bump level from MEDIUM to HIGH and add timeline', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue(overdueWo);
      mockPrisma.workOrder.update.mockResolvedValue({
        ...overdueWo, level: RiskLevel.HIGH,
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-1' });

      const result = await service.escalate('wo-1');

      expect(result.level).toBe(RiskLevel.HIGH);
      expect(mockPrisma.workOrder.update).toHaveBeenCalledWith({
        where: { id: 'wo-1' },
        data: { level: RiskLevel.HIGH },
      });
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workOrderId: 'wo-1',
          action: 'ESCALATED',
          note: expect.stringContaining('超时自动升级'),
        }),
      });
    });

    it('should not escalate HIGH level work orders', async () => {
      const highWo = { ...overdueWo, level: RiskLevel.HIGH };
      mockPrisma.workOrder.findUnique.mockResolvedValue(highWo);

      const result = await service.escalate('wo-1');

      expect(result.level).toBe(RiskLevel.HIGH);
      expect(mockPrisma.workOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for missing work order', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue(null);

      await expect(service.escalate('nonexistent')).rejects.toThrow('工单不存在');
    });
  });
});
