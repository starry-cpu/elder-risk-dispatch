import { Test, TestingModule } from '@nestjs/testing';
import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('Notifications Integration (Redis)', () => {
  let notificationsQueue: Queue;

  const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6383';

  const mockPrisma = {
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection: { url: REDIS_URL } }),
        BullModule.registerQueue({ name: 'notifications' }),
      ],
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    notificationsQueue = module.get<Queue>(getQueueToken('notifications'));
  });

  afterAll(async () => {
    await notificationsQueue.close();
    await notificationsQueue.disconnect();
  });

  beforeEach(async () => {
    await notificationsQueue.drain();
    jest.clearAllMocks();
  });

  it('should enqueue notification and create DB record', async () => {
    const notificationRecord = {
      id: 'int-n-1',
      targetType: 'USER',
      targetId: 'u-1',
      channel: 'console',
      templateId: null,
      payload: { test: true },
      status: 'PENDING',
      sentAt: null,
      createdAt: new Date(),
    };
    mockPrisma.notification.create.mockResolvedValue(notificationRecord);

    const result = await new NotificationsService(mockPrisma as any, notificationsQueue).send({
      targetType: 'USER',
      targetId: 'u-1',
      payload: { test: true },
    });

    expect(result.id).toBe('int-n-1');
    expect(result.status).toBe('PENDING');

    const jobs = await notificationsQueue.getJobs(['waiting', 'active', 'delayed']);
    const ourJob = jobs.find((j) => j.data.notificationId === 'int-n-1');
    expect(ourJob).toBeDefined();
    expect(ourJob!.name).toBe('send-notification');
  });

  it('should respect exponential backoff job options', async () => {
    mockPrisma.notification.create.mockResolvedValue({
      id: 'int-n-2', targetType: 'USER', targetId: 'u-2', channel: 'console',
      templateId: null, payload: {}, status: 'PENDING', sentAt: null, createdAt: new Date(),
    });

    await new NotificationsService(mockPrisma as any, notificationsQueue).send({
      targetType: 'USER', targetId: 'u-2', payload: {},
    });

    const jobs = await notificationsQueue.getJobs(['waiting']);
    const job = jobs[0];

    expect(job.opts.attempts).toBe(5);
    expect(job.opts.backoff).toEqual({ type: 'exponential', delay: 60000 });
  });
});
