import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderType, WorkOrderStatus, Role, RiskLevel } from '@prisma/client';

describe('WorkOrdersController', () => {
  let controller: WorkOrdersController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    assign: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    reassign: jest.fn(),
    getTimeline: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrdersController],
      providers: [{ provide: WorkOrdersService, useValue: mockService }],
    }).compile();
    controller = module.get<WorkOrdersController>(WorkOrdersController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应调用 service.create 并返回结果', async () => {
      const dto = { elderId: 'elder-1', type: WorkOrderType.HEALTH, dispatchReason: '测试' };
      mockService.create.mockResolvedValue({ workOrder: { id: 'wo-1' }, recommendation: [] });
      const result = await controller.create(dto, { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result.workOrder.id).toBe('wo-1');
    });
  });

  describe('findAll', () => {
    it('应返回分页列表', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      const result = await controller.findAll(
        { page: 1, limit: 20 },
        { sub: 'u1', role: Role.ADMIN, loginType: 'admin' },
      );
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('应返回工单详情', async () => {
      mockService.findById.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.PENDING });
      const result = await controller.findById('wo-1', { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result.id).toBe('wo-1');
    });
  });

  describe('assign', () => {
    it('应调用 service.assign', async () => {
      mockService.assign.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.ASSIGNED });
      const result = await controller.assign('wo-1', { assigneeId: 'w1' }, { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
    });
  });

  describe('start', () => {
    it('应调用 service.start', async () => {
      mockService.start.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS });
      const result = await controller.start('wo-1', { sub: 'worker-1', role: Role.GRID_WORKER, loginType: 'admin' });
      expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
    });
  });

  describe('complete', () => {
    it('应调用 service.complete', async () => {
      mockService.complete.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.COMPLETED });
      const result = await controller.complete('wo-1', { result: '已完成' }, { sub: 'worker-1', role: Role.GRID_WORKER, loginType: 'admin' });
      expect(result.status).toBe(WorkOrderStatus.COMPLETED);
    });
  });

  describe('cancel', () => {
    it('应调用 service.cancel', async () => {
      mockService.cancel.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.CANCELLED });
      const result = await controller.cancel('wo-1', { reason: '不需要了' }, { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result.status).toBe(WorkOrderStatus.CANCELLED);
    });
  });

  describe('reassign', () => {
    it('应调用 service.reassign', async () => {
      mockService.reassign.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.ASSIGNED });
      const result = await controller.reassign('wo-1',
        { newAssigneeId: 'w2', reason: '换人' },
        { sub: 'u1', role: Role.ADMIN, loginType: 'admin' },
      );
      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
    });
  });

  describe('getTimeline', () => {
    it('应返回时间线', async () => {
      mockService.getTimeline.mockResolvedValue([{ id: 'tl-1', action: 'CREATED' }]);
      const result = await controller.getTimeline('wo-1', { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
      expect(result).toHaveLength(1);
    });
  });
});
