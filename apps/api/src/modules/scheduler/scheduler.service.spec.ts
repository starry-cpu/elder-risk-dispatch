import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RiskLevel, RiskStatus, WorkOrderStatus } from '@prisma/client';

describe('SchedulerService', () => {
  let service: SchedulerService;

  const mockPrisma = {
    elder: { findMany: jest.fn() },
    workOrder: { findMany: jest.fn() },
    schedulerRun: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  const mockRiskService = { evaluateAndCreateEvent: jest.fn() };
  const mockWorkOrdersService = { escalate: jest.fn() };
  const mockNotificationsService = { send: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RiskService, useValue: mockRiskService },
        { provide: WorkOrdersService, useValue: mockWorkOrdersService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    jest.clearAllMocks();
  });

  describe('scanMissedCheckIns', () => {
    it('should find elders without recent check-in and create RiskEvents', async () => {
      const elders = [
        { id: 'e-1', name: '张大爷', district: '东区' },
        { id: 'e-2', name: '李奶奶', district: '西区' },
      ];
      mockPrisma.elder.findMany.mockResolvedValue(elders);
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-1' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});
      mockRiskService.evaluateAndCreateEvent.mockResolvedValue({
        id: 're-1', level: RiskLevel.HIGH, score: 70, status: RiskStatus.PENDING_REVIEW,
      });

      const result = await service.scanMissedCheckIns();

      expect(mockPrisma.elder.findMany).toHaveBeenCalledWith({
        where: { checkIns: { none: { createdAt: { gte: expect.any(Date) } } } },
        select: { id: true, name: true, district: true },
      });
      expect(mockRiskService.evaluateAndCreateEvent).toHaveBeenCalledTimes(2);
      expect(mockPrisma.schedulerRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'COMPLETED', itemsProcessed: 2 }),
      });
      expect(result.eventsCreated).toBe(2);
    });

    it('should return zero when no elders are overdue', async () => {
      mockPrisma.elder.findMany.mockResolvedValue([]);
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-1' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});

      const result = await service.scanMissedCheckIns();

      expect(result.processed).toBe(0);
      expect(result.eventsCreated).toBe(0);
      expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
    });

    it('should handle partial failures without stopping the batch', async () => {
      mockPrisma.elder.findMany.mockResolvedValue([
        { id: 'e-1', name: '张大爷', district: '东区' },
        { id: 'e-2', name: '李奶奶', district: '西区' },
        { id: 'e-3', name: '王爷爷', district: '东区' },
      ]);
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-1' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});
      mockRiskService.evaluateAndCreateEvent
        .mockResolvedValueOnce({ id: 're-1', level: RiskLevel.MEDIUM, score: 50 })
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce({ id: 're-2', level: RiskLevel.LOW, score: 20 });

      const result = await service.scanMissedCheckIns();

      expect(result.processed).toBe(3);
      expect(result.eventsCreated).toBe(2);
      expect(result.errors).toBe(1);
    });

    it('should record failure in SchedulerRun on critical error', async () => {
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-1' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});
      mockPrisma.elder.findMany.mockRejectedValue(new Error('Connection refused'));

      await expect(service.scanMissedCheckIns()).rejects.toThrow('Connection refused');

      expect(mockPrisma.schedulerRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({ status: 'FAILED', error: 'Connection refused' }),
      });
    });
  });

  describe('escalateTimeouts', () => {
    it('should find overdue work orders and escalate them', async () => {
      const overdueOrders = [
        { id: 'wo-1', elderId: 'e-1', level: RiskLevel.MEDIUM, status: WorkOrderStatus.IN_PROGRESS },
        { id: 'wo-2', elderId: 'e-2', level: RiskLevel.LOW, status: WorkOrderStatus.ASSIGNED },
      ];
      mockPrisma.workOrder.findMany.mockResolvedValue(overdueOrders);
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-2' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});
      mockWorkOrdersService.escalate.mockResolvedValue({});

      const result = await service.escalateTimeouts();

      expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith({
        where: {
          deadline: { lt: expect.any(Date) },
          status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED] },
        },
        select: { id: true, elderId: true, level: true, status: true, deadline: true },
      });
      expect(mockWorkOrdersService.escalate).toHaveBeenCalledTimes(2);
      expect(result.escalated).toBe(2);
    });

    it('should return zero when no orders are overdue', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-2' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});

      const result = await service.escalateTimeouts();

      expect(result.processed).toBe(0);
      expect(result.escalated).toBe(0);
    });

    it('should handle partial failures gracefully', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([
        { id: 'wo-1', elderId: 'e-1', level: RiskLevel.MEDIUM, status: WorkOrderStatus.IN_PROGRESS },
        { id: 'wo-2', elderId: 'e-2', level: RiskLevel.LOW, status: WorkOrderStatus.ASSIGNED },
      ]);
      mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-2' });
      mockPrisma.schedulerRun.update.mockResolvedValue({});
      mockWorkOrdersService.escalate
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Not found'));

      const result = await service.escalateTimeouts();

      expect(result.processed).toBe(2);
      expect(result.escalated).toBe(1);
      expect(result.errors).toBe(1);
    });
  });

  describe('getRuns', () => {
    it('should return paginated SchedulerRun history', async () => {
      mockPrisma.schedulerRun.findMany.mockResolvedValue([
        { id: 'run-1', jobName: 'missed-checkin-scan', status: 'COMPLETED', itemsProcessed: 5 },
      ]);
      mockPrisma.schedulerRun.count.mockResolvedValue(1);

      const result = await service.getRuns({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by jobName', async () => {
      mockPrisma.schedulerRun.findMany.mockResolvedValue([]);
      mockPrisma.schedulerRun.count.mockResolvedValue(0);

      await service.getRuns({ jobName: 'missed-checkin-scan', page: 1, limit: 10 });

      expect(mockPrisma.schedulerRun.findMany).toHaveBeenCalledWith({
        where: { jobName: 'missed-checkin-scan' },
        skip: 0,
        take: 10,
        orderBy: { startedAt: 'desc' },
      });
    });
  });
});
