import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
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
  async findAll(@Query() query: NotificationQueryDto) {
    return this.notificationsService.findAll({
      targetType: query.targetType,
      targetId: query.targetId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
