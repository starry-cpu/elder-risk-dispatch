import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSendProcessor } from './notification-send.processor';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ConsoleChannel } from '../channels/console.channel';
import { WeChatChannel } from '../channels/wechat.channel';
import { NOTIFICATION_CHANNEL } from '../channels/notification-channel.interface';
import { Job } from 'bullmq';

describe('NotificationSendProcessor', () => {
  let processor: NotificationSendProcessor;

  const mockJob = (overrides = {}) =>
    ({
      id: 'job-1',
      name: 'send-notification',
      data: {
        notificationId: 'notif-1',
        targetType: 'USER',
        targetId: 'u-1',
        templateId: 'tmpl-001',
        payload: { thing1: { value: '测试' } },
      },
      attemptsMade: 0,
      opts: { attempts: 5 },
      ...overrides,
    }) as unknown as Job;

  const mockConsoleChannel = { send: jest.fn() };
  const mockWechatChannel = { send: jest.fn() };
  const mockPrisma = { notification: { update: jest.fn() }, auditLog: { create: jest.fn() } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSendProcessor,
        { provide: ConsoleChannel, useValue: mockConsoleChannel },
        { provide: WeChatChannel, useValue: mockWechatChannel },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NOTIFICATION_CHANNEL, useValue: 'console' },
      ],
    }).compile();

    processor = module.get<NotificationSendProcessor>(NotificationSendProcessor);
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should dispatch to ConsoleChannel and update status to SENT', async () => {
      mockConsoleChannel.send.mockResolvedValue({ success: true });

      await processor.process(mockJob());

      expect(mockConsoleChannel.send).toHaveBeenCalledWith({
        targetType: 'USER',
        targetId: 'u-1',
        templateId: 'tmpl-001',
        payload: { thing1: { value: '测试' } },
      });
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { status: 'SENT', sentAt: expect.any(Date) },
      });
    });

    it('should dispatch to WeChatChannel when NOTIFICATION_CHANNEL is "wechat"', async () => {
      const module2: TestingModule = await Test.createTestingModule({
        providers: [
          NotificationSendProcessor,
          { provide: ConsoleChannel, useValue: mockConsoleChannel },
          { provide: WeChatChannel, useValue: mockWechatChannel },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: NOTIFICATION_CHANNEL, useValue: 'wechat' },
        ],
      }).compile();

      const p2 = module2.get<NotificationSendProcessor>(NotificationSendProcessor);
      mockWechatChannel.send.mockResolvedValue({ success: true });

      await p2.process(mockJob());

      expect(mockWechatChannel.send).toHaveBeenCalled();
      expect(mockConsoleChannel.send).not.toHaveBeenCalled();
    });

    it('should throw on channel failure to trigger BullMQ retry', async () => {
      mockConsoleChannel.send.mockResolvedValue({ success: false, error: 'send failed' });

      await expect(processor.process(mockJob())).rejects.toThrow('send failed');
      expect(mockPrisma.notification.update).not.toHaveBeenCalled();
    });

    it('should mark FAILED and create AuditLog on final retry exhaustion', async () => {
      mockConsoleChannel.send.mockResolvedValue({ success: false, error: 'exhausted' });

      await expect(
        processor.process(mockJob({ attemptsMade: 4, opts: { attempts: 5 } })),
      ).rejects.toThrow('exhausted');

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { status: 'FAILED' },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'NOTIFICATION_EXHAUSTED',
          resourceType: 'Notification',
          resourceId: 'notif-1',
        }),
      });
    });

    it('should skip unknown job names without throwing', async () => {
      await expect(
        processor.process(mockJob({ name: 'unknown-job' })),
      ).resolves.toBeUndefined();
      expect(mockConsoleChannel.send).not.toHaveBeenCalled();
    });
  });
});
