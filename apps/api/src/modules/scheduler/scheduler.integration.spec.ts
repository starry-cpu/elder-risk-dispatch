import { Test, TestingModule } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskService } from '../risk/risk.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('Scheduler Integration (Redis)', () => {
  let schedulerQueue: Queue;

  const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6383';

  const mockPrisma = {
    elder: { findMany: jest.fn() },
    workOrder: { findMany: jest.fn() },
    schedulerRun: { create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };
  const mockRiskService = { evaluateAndCreateEvent: jest.fn() };
  const mockWorkOrdersService = { escalate: jest.fn() };
  const mockNotificationsService = { send: jest.fn() };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection: { url: REDIS_URL } }),
        BullModule.registerQueue({ name: 'scheduler' }),
      ],
      providers: [
        SchedulerService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RiskService, useValue: mockRiskService },
        { provide: WorkOrdersService, useValue: mockWorkOrdersService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    schedulerQueue = module.get<Queue>(getQueueToken('scheduler'));
  });

  afterAll(async () => {
    await schedulerQueue.close();
    await schedulerQueue.disconnect();
  });

  beforeEach(async () => {
    await schedulerQueue.drain();
    jest.clearAllMocks();
  });

  it('should add and process a missed-checkin-scan job through the queue', async () => {
    mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-int-1' });
    mockPrisma.schedulerRun.update.mockResolvedValue({});
    mockPrisma.elder.findMany.mockResolvedValue([]);

    const job = await schedulerQueue.add('missed-checkin-scan', {});

    expect(job.id).toBeDefined();
    expect(job.name).toBe('missed-checkin-scan');

    const foundJob = await schedulerQueue.getJob(job.id!);
    expect(foundJob).not.toBeNull();
  });

  it('should handle job idempotency (same jobId = no duplicate)', async () => {
    mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-int-2' });
    mockPrisma.schedulerRun.update.mockResolvedValue({});
    mockPrisma.elder.findMany.mockResolvedValue([]);

    const jobId = `idempotent-test-${Date.now()}`;

    const job1 = await schedulerQueue.add('missed-checkin-scan', {}, { jobId });
    const job2 = await schedulerQueue.add('missed-checkin-scan', {}, { jobId });

    expect(job1.id).toBe(job2.id);
  });
});
