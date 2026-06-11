import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersService } from './work-orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DispatchRecommendationService } from '../risk/dispatch-recommendation.service';
import {
  WorkOrderType, WorkOrderStatus, RiskLevel, RiskStatus, Role, DutyStatus,
} from '@prisma/client';

describe('WorkOrdersService', () => {
  let service: WorkOrdersService;

  const mockElder = { id: 'elder-1', name: '张三', district: '东区', healthTags: [] };
  const mockWorker = {
    id: 'worker-1', name: '网格员A', role: Role.GRID_WORKER,
    district: '东区', dutyStatus: DutyStatus.ON_DUTY, skills: ['HEALTH'],
    avgResponseMin: 10,
  };
  const mockCreator = { sub: 'admin-1', role: Role.ADMIN, district: '东区' };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    workOrder: {
      create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      update: jest.fn(), count: jest.fn(),
    },
    workOrderTimeline: { create: jest.fn(), findMany: jest.fn() },
    riskEvent: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  };

  const mockDispatch = {
    recommend: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DispatchRecommendationService, useValue: mockDispatch },
      ],
    }).compile();

    service = module.get<WorkOrdersService>(WorkOrdersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a work order and return dispatch recommendations', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.workOrder.create.mockResolvedValue({
        id: 'wo-1', elderId: 'elder-1', type: WorkOrderType.HEALTH,
        level: RiskLevel.HIGH, status: WorkOrderStatus.PENDING, createdById: 'admin-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-1' });
      mockPrisma.riskEvent.findUnique.mockResolvedValue({
        id: 're-1', elderId: 'elder-1', status: RiskStatus.CONFIRMED, level: RiskLevel.HIGH,
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.findUnique.mockResolvedValue(null); // no existing work order
      mockPrisma.riskEvent.update.mockResolvedValue({ id: 're-1', status: RiskStatus.DISPATCHED });
      mockDispatch.recommend.mockResolvedValue([
        { userId: 'worker-1', name: '网格员A', score: 85, district: '东区',
          dutyStatus: 'ON_DUTY', skills: ['HEALTH'], avgResponseMin: 10,
          breakdown: { skillMatch: 30, sameDistrict: 30, onDuty: 25, responseTime: 0 } },
      ]);

      const result = await service.create({
        elderId: 'elder-1', riskEventId: 're-1',
        type: WorkOrderType.HEALTH, dispatchReason: '测试创建',
      }, mockCreator);

      expect(result.workOrder).toBeDefined();
      expect(result.recommendation).toHaveLength(1);
      expect(mockPrisma.workOrder.create).toHaveBeenCalled();
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: { workOrderId: 'wo-1', action: 'CREATED', operatorId: 'admin-1', note: '测试创建' },
      });
      expect(mockDispatch.recommend).toHaveBeenCalledWith('re-1', WorkOrderType.HEALTH);
    });

    it('should reject non-existent elders', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ elderId: 'bad-id', type: WorkOrderType.HEALTH }, mockCreator),
      ).rejects.toThrow('老人不存在');
    });

    it('should reject unconfirmed risk events', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.riskEvent.findUnique.mockResolvedValue({
        id: 're-1', elderId: 'elder-1', status: RiskStatus.PENDING_REVIEW,
      });
      await expect(
        service.create({
          elderId: 'elder-1', riskEventId: 're-1', type: WorkOrderType.HEALTH,
        }, mockCreator),
      ).rejects.toThrow('仅已确认的风险事件可生成工单');
    });

    it('should handle missing riskEventId gracefully', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.workOrder.create.mockResolvedValue({
        id: 'wo-1', elderId: 'elder-1', type: WorkOrderType.LIFE,
        level: RiskLevel.MEDIUM, status: WorkOrderStatus.PENDING, createdById: 'admin-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-1' });
      mockDispatch.recommend.mockResolvedValue([]);

      const result = await service.create({
        elderId: 'elder-1', type: WorkOrderType.LIFE, dispatchReason: '无风险事件关联',
      }, mockCreator);

      expect(result.workOrder).toBeDefined();
      expect(result.recommendation).toEqual([]);
      expect(mockDispatch.recommend).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated list with district isolation', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([
        { id: 'wo-1', elder: { id: 'elder-1', name: '张三', district: '东区' } },
      ]);
      mockPrisma.workOrder.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 20 },
        { sub: 'worker-1', role: Role.GRID_WORKER, district: '东区' },
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should restrict non-ADMIN to their own district', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.workOrder.count.mockResolvedValue(0);

      await service.findAll(
        { page: 1, limit: 20 },
        { sub: 'w1', role: Role.GRID_WORKER, district: '东区' },
      );

      expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { elder: { district: '东区' } },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return work order detail with timeline and evaluation', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING,
        elder: { district: '东区' },
        timeline: [], evaluation: null, assignee: null,
      });
      const result = await service.findById('wo-1', { sub: 'admin-1', role: Role.ADMIN });
      expect(result.id).toBe('wo-1');
    });

    it('should reject cross-district access for non-ADMIN', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING,
        elder: { district: '西区' },
        timeline: [], evaluation: null, assignee: null,
      });
      await expect(
        service.findById('wo-1', { sub: 'w1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('工单不存在');
    });
  });

  describe('assign', () => {
    it('should assign work order and record timeline', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockWorker);
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, assigneeId: null,
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-2' });

      const result = await service.assign('wo-1', 'worker-1', { sub: 'admin-1', role: Role.ADMIN });

      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: {
          workOrderId: 'wo-1', action: 'ASSIGNED', operatorId: 'admin-1',
          note: '派单给 网格员A',
        },
      });
    });

    it('should reject illegal state transition', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockWorker);

      await expect(
        service.assign('wo-1', 'worker-2', { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('已完成的工单不可变更');
    });

    it('should reject assigning to non-assignable role', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, assigneeId: null,
        elder: { district: '东区' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'fam-1', name: '家属', role: Role.FAMILY,
      });

      await expect(
        service.assign('wo-1', 'fam-1', { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('不可将工单派给该角色');
    });
  });

  describe('start', () => {
    it('should allow assignee to start work order', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-3' });

      const result = await service.start('wo-1', { sub: 'worker-1', role: Role.GRID_WORKER, district: '东区' });

      expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
    });

    it('should reject non-assignee starting', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.start('wo-1', { sub: 'worker-2', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('只有接单人员可以开始处理');
    });
  });

  describe('complete', () => {
    it('should allow assignee to complete work order', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, completedAt: new Date(),
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-4' });

      const result = await service.complete('wo-1', { result: '已处理完毕', photos: [] },
        { sub: 'worker-1', role: Role.GRID_WORKER, district: '东区' });

      expect(result.status).toBe(WorkOrderStatus.COMPLETED);
      expect(mockPrisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: '已处理完毕', completedAt: expect.any(Date) }),
        }),
      );
    });

    it('should reject completing without result', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.complete('wo-1', { result: '', photos: [] },
          { sub: 'worker-1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('完成工单必须填写处理结果');
    });

    it('should reject non-assignee completing', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.complete('wo-1', { result: 'done', photos: [] },
          { sub: 'worker-2', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('只有接单人员可以完成工单');
    });
  });

  describe('cancel', () => {
    it('should allow cancel from PENDING without reason', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, assigneeId: null,
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.CANCELLED,
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-5' });

      const result = await service.cancel('wo-1', undefined, { sub: 'admin-1', role: Role.ADMIN });
      expect(result.status).toBe(WorkOrderStatus.CANCELLED);
    });

    it('should reject cancel from IN_PROGRESS without reason', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.cancel('wo-1', '', { sub: 'worker-1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('进行中的工单取消时必须填写原因');
    });
  });

  describe('reassign', () => {
    it('should reassign and reset status to ASSIGNED', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
        assignee: { name: '网格员A' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'worker-2', name: '网格员B', role: Role.GRID_WORKER,
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-2',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-6' });

      const result = await service.reassign('wo-1', 'worker-2', '原接单者请假',
        { sub: 'admin-1', role: Role.ADMIN });

      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: {
          workOrderId: 'wo-1', action: 'REASSIGNED', operatorId: 'admin-1',
          note: '从 网格员A 改派给 网格员B。原因: 原接单者请假',
        },
      });
    });

    it('should reject reassign without reason', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.reassign('wo-1', 'worker-2', '', { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('改派时必须填写原因');
    });
  });

  describe('getTimeline', () => {
    it('should return full work order timeline', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '东区' },
      });
      mockPrisma.workOrderTimeline.findMany.mockResolvedValue([
        {
          id: 'tl-1', action: 'CREATED', operatorId: 'admin-1',
          note: '创建', createdAt: new Date(),
        },
        {
          id: 'tl-2', action: 'ASSIGNED', operatorId: 'admin-1',
          note: '派单', createdAt: new Date(),
        },
      ]);

      const result = await service.getTimeline('wo-1', { sub: 'admin-1', role: Role.ADMIN });
      expect(result).toHaveLength(2);
    });

    it('should reject cross-district timeline access', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '西区' },
      });

      await expect(
        service.getTimeline('wo-1', { sub: 'w1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('工单不存在');
    });
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
