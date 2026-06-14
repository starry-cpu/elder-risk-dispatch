import { Controller, Post, Get, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  async send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.send({
      targetType: dto.targetType as 'USER' | 'ELDER',
      targetId: dto.targetId,
      templateId: dto.templateId,
      payload: dto.payload,
    });
  }

  @Get()
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  async findAll(@Query() query: NotificationQueryDto, @CurrentUser() user: any) {
    return this.notificationsService.findAll(
      {
        targetType: query.targetType,
        targetId: query.targetId,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
      },
      user,
    );
  }

  @Get('inbox')
  @ApiOperation({ summary: '当前用户通知列表' })
  async getInbox(
    @Query() query: NotificationQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.getInbox({
      userId: user.sub,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      includeRead: query.includeRead ?? false,
    });
  }

  @Post(':id/read')
  @ApiOperation({ summary: '标记通知已读' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    await this.notificationsService.markAsRead(id, user.sub);
    return { success: true };
  }

  @Get('unread-count')
  @ApiOperation({ summary: '未读通知计数' })
  async getUnreadCount(@CurrentUser() user: any) {
    const count = await this.notificationsService.getUnreadCount(user.sub);
    return { count };
  }
}
