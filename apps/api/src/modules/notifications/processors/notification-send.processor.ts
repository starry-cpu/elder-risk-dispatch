import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  INotificationChannel,
  SendNotificationInput,
} from '../channels/notification-channel.interface';
import { ConsoleChannel } from '../channels/console.channel';
import { WeChatChannel } from '../channels/wechat.channel';

interface SendJobData {
  notificationId: string;
  targetType: string;
  targetId: string;
  templateId?: string;
  payload: Record<string, unknown>;
  channel?: string;
}

@Processor('notifications')
export class NotificationSendProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationSendProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly consoleChannel: ConsoleChannel,
    private readonly wechatChannel: WeChatChannel,
  ) {
    super();
  }

  async process(job: Job<SendJobData>): Promise<void> {
    if (job.name !== 'send-notification') {
      this.logger.warn(`Unknown job name: ${job.name}, skipping`);
      return;
    }

    return this.handleSend(job);
  }

  private getChannel(channelName?: string): INotificationChannel {
    return channelName === 'wechat' ? this.wechatChannel : this.consoleChannel;
  }

  private async handleSend(job: Job<SendJobData>): Promise<void> {
    const { notificationId, targetType, targetId, templateId, payload } = job.data;

    this.logger.log(
      `Processing notification ${notificationId} (attempt ${job.attemptsMade + 1}/${job.opts.attempts})`,
    );

    const input: SendNotificationInput = {
      targetType: targetType as 'USER' | 'ELDER',
      targetId,
      templateId,
      payload,
    };

    const result = await this.getChannel(job.data.channel).send(input);

    if (result.success) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'SENT', sentAt: new Date() },
      });
      this.logger.log(`Notification ${notificationId} sent successfully`);
      return;
    }

    // Check if this is the last retry
    const maxAttempts = job.opts.attempts ?? 5;
    const isLastAttempt = job.attemptsMade >= maxAttempts - 1;

    if (isLastAttempt) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { status: 'FAILED' },
      });
      await this.prisma.auditLog.create({
        data: {
          action: 'NOTIFICATION_EXHAUSTED',
          resourceType: 'Notification',
          resourceId: notificationId,
          detail: { error: result.error, attempts: job.attemptsMade + 1 },
        },
      });
      this.logger.error(`Notification ${notificationId} failed after ${maxAttempts} attempts`);
    }

    // Throw to trigger BullMQ retry
    throw new Error(result.error ?? 'Unknown send error');
  }
}
