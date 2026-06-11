import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockQueue = { add: jest.fn() };
  const mockPrisma = {
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('notifications'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    jest.clearAllMocks();
  });

  describe('send', () => {
    it('should create Notification record and enqueue job', async () => {
      const notificationRecord = {
        id: 'notif-1',
        targetType: 'USER',
        targetId: 'u-1',
        channel: 'console',
        templateId: 'tmpl-001',
        payload: { thing1: { value: '测试' } },
        status: 'PENDING',
        sentAt: null,
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(notificationRecord);
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await service.send({
        targetType: 'USER',
        targetId: 'u-1',
        templateId: 'tmpl-001',
        payload: { thing1: { value: '测试' } },
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetType: 'USER',
          targetId: 'u-1',
          channel: 'console',
          status: 'PENDING',
        }),
      });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send-notification',
        expect.objectContaining({
          notificationId: 'notif-1',
          targetType: 'USER',
          targetId: 'u-1',
        }),
        expect.objectContaining({
          attempts: 5,
          backoff: expect.objectContaining({ type: 'exponential', delay: 60000 }),
        }),
      );
      expect(result.id).toBe('notif-1');
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        { id: 'n-1', targetType: 'USER', targetId: 'u-1', status: 'SENT' },
      ]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by targetType and targetId', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.findAll({ targetType: 'USER', targetId: 'u-1', page: 1, limit: 10 });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetType: 'USER', targetId: 'u-1' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
