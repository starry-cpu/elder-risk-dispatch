import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationSendProcessor } from './processors/notification-send.processor';
import { ConsoleChannel } from './channels/console.channel';
import { WeChatChannel } from './channels/wechat.channel';
import { NOTIFICATION_CHANNEL } from './channels/notification-channel.interface';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications' }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationSendProcessor,
    ConsoleChannel,
    WeChatChannel,
    {
      provide: NOTIFICATION_CHANNEL,
      useValue: process.env.NOTIFICATION_CHANNEL ?? 'console',
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
