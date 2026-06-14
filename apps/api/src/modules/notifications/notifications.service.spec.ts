import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Role } from '@prisma/client';

describe('NotificationsService', () => {
  let service: NotificationsService;

  const mockQueue = { add: jest.fn() };
  const mockPrisma = {
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
    // sendToRecipients 用到：
    elder: { findUnique: jest.fn() },
    user: { findMany: jest.fn() },
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

    it('ADMIN 传 requester 时不受可见范围限制（保留显式过滤）', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);
      const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };

      await service.findAll({ targetType: 'USER', targetId: 'someone-else', page: 1, limit: 10 }, admin);

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetType: 'USER', targetId: 'someone-else' },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('非 ADMIN 只能看本人 USER 通知与本片区 SYSTEM 广播（防 IDOR）', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);
      const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };

      // worker 即便试图查 targetId=someone-else，service 也会忽略该参数并强制可见范围
      await service.findAll({ targetType: 'USER', targetId: 'someone-else', page: 1, limit: 10 }, worker);

      const call = mockPrisma.notification.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { targetType: 'USER', targetId: 'worker-1' },
        { targetType: 'SYSTEM', targetId: '朝阳区' },
      ]);
      // 关键：不能把 someone-else 的 USER 通知透传进 where
      expect(call.where.targetId).toBeUndefined();
    });
  });

  describe('emitAndPersist', () => {
    it('应写入 Notification 表', async () => {
      const notificationRecord = {
        id: 'notif-2',
        targetType: 'SYSTEM',
        targetId: 'ADMIN',
        channel: 'websocket',
        templateId: null,
        payload: { event: 'risk:alert', level: 'HIGH', elderId: 'e-1' },
        status: 'SENT',
        sentAt: new Date(),
        readAt: null,
        createdAt: new Date(),
      };
      mockPrisma.notification.create.mockResolvedValue(notificationRecord);

      const result = await service.emitAndPersist({
        event: 'risk:alert',
        roomType: 'role',
        roomId: 'ADMIN',
        payload: { level: 'HIGH', elderId: 'e-1' },
      });

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channel: 'websocket',
          payload: expect.objectContaining({
            event: 'risk:alert',
            level: 'HIGH',
            elderId: 'e-1',
          }),
          status: 'SENT',
          sentAt: expect.any(Date),
        }),
      });
      expect(result.id).toBe('notif-2');
    });
  });

  describe('getInbox', () => {
    it('应返回当前用户的未读/已读通知', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([
        { id: 'n-1', targetType: 'USER', targetId: 'u-1', status: 'SENT', readAt: null, createdAt: new Date() },
      ]);
      mockPrisma.notification.count.mockResolvedValue(1);

      const result = await service.getInbox({ userId: 'u-1', page: 1, limit: 20, includeRead: true });

      expect(result.items).toHaveLength(1);
      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetType: 'USER', targetId: 'u-1' },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('includeRead=false 时应过滤已读', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([]);
      mockPrisma.notification.count.mockResolvedValue(0);

      await service.getInbox({ userId: 'u-1', page: 1, limit: 20, includeRead: false });

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { targetType: 'USER', targetId: 'u-1', readAt: null },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('markAsRead', () => {
    it('应更新通知的 readAt 字段', async () => {
      mockPrisma.notification.update.mockResolvedValue({
        id: 'n-1', readAt: new Date(),
      });

      await service.markAsRead('n-1', 'u-1');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'n-1', targetType: 'USER', targetId: 'u-1' },
        data: { readAt: expect.any(Date) },
      });
    });

    it('通知不存在或不属于用户时应抛出 NotFoundException', async () => {
      const prismaError = new Error('Record not found') as Error & { code: string };
      prismaError.code = 'P2025';
      mockPrisma.notification.update.mockRejectedValue(prismaError);

      await expect(
        service.markAsRead('n-999', 'u-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUnreadCount', () => {
    it('应返回未读通知数量', async () => {
      mockPrisma.notification.count.mockResolvedValue(5);

      const result = await service.getUnreadCount('u-1');

      expect(result).toBe(5);
      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: { targetType: 'USER', targetId: 'u-1', readAt: null },
      });
    });
  });

  describe('sendToRecipients (fan-out)', () => {
    it('应对老人的家属 + 本片区网格员各发一条 USER 通知（去重）', async () => {
      // 老人有 1 个关联家属；同片区 1 个网格员；另 1 个网格员在别区应排除
      mockPrisma.elder.findUnique.mockResolvedValue({
        district: '朝阳区',
        familyLinks: [{ userId: 'family-1' }],
      });
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'worker-1' }]);
      mockPrisma.notification.create.mockImplementation(({ data }: any) =>
        Promise.resolve({ id: `notif-${data.targetId}`, ...data }),
      );
      mockQueue.add.mockResolvedValue({ id: 'job-x' });

      const result = await service.sendToRecipients({
        elderId: 'e-1',
        templateId: 'tmpl-missed',
        payload: { thing1: { value: '张大爷' } },
      });

      expect(result.recipients).toEqual(expect.arrayContaining(['family-1', 'worker-1']));
      expect(result.recipients).toHaveLength(2);
      // 网格员查询按老人片区过滤
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: { role: Role.GRID_WORKER, district: '朝阳区' },
        select: { id: true },
      });
      // 每人写一行 + 入队一次
      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      const createdTargetIds = mockPrisma.notification.create.mock.calls.map(
        (c: any) => c[0].data.targetId,
      );
      expect(createdTargetIds).toEqual(expect.arrayContaining(['family-1', 'worker-1']));
      // 不应再出现占位符 'system'
      expect(createdTargetIds).not.toContain('system');
    });

    it('老人不存在时抛出 NotFound', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.sendToRecipients({ elderId: 'nope', payload: {} }),
      ).rejects.toThrow('老人不存在');
    });

    it('excludeUserIds 应排除指定接收人', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        district: '朝阳区',
        familyLinks: [{ userId: 'family-1' }, { userId: 'family-2' }],
      });
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.notification.create.mockResolvedValue({ id: 'n' });
      mockQueue.add.mockResolvedValue({});

      const result = await service.sendToRecipients({
        elderId: 'e-1',
        payload: {},
        excludeUserIds: ['family-1'],
      });

      expect(result.recipients).toEqual(['family-2']);
    });
  });
});
