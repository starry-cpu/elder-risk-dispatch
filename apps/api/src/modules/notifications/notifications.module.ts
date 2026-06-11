import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationSendProcessor } from './processors/notification-send.processor';
import { ConsoleChannel } from './channels/console.channel';
import { WeChatChannel } from './channels/wechat.channel';
import { NOTIFICATION_CHANNEL } from './channels/notification-channel.interface';
import { DashboardGateway } from './gateway/dashboard.gateway';
import { WsAuthGuard } from './gateway/ws-auth.guard';
import { WsRolesGuard } from './gateway/ws-roles.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications' }),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
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
    DashboardGateway,
    WsAuthGuard,
    WsRolesGuard,
  ],
  exports: [NotificationsService, DashboardGateway],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly gateway: DashboardGateway,
  ) {}

  onModuleInit() {
    // 将 Gateway 注入 Service 以解决模块内循环引用
    this.notificationsService.setGateway(this.gateway);
  }
}
