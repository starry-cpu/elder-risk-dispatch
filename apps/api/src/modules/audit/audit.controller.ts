import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '查询操作审计日志（仅管理员）' })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findAll({
      userId: query.userId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
