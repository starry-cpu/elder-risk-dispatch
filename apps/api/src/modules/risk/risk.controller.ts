// apps/api/src/modules/risk/risk.controller.ts
import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RiskService } from './risk.service';
import { EvaluateRiskDto } from './dto/evaluate-risk.dto';
import { ReviewRiskEventDto } from './dto/review-risk-event.dto';
import { QueryRiskEventsDto } from './dto/query-risk-events.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Auditable } from '../audit/decorators/auditable.decorator';

@ApiTags('Risk')
@ApiBearerAuth()
@Controller()
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @Post('risk/evaluate')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '手动触发风险评估并生成 RiskEvent' })
  evaluate(@Body() dto: EvaluateRiskDto) {
    return this.riskService.evaluateAndCreateEvent(dto as any);
  }

  @Get('risk/events')
  @ApiOperation({ summary: '查询风险事件列表（分页+过滤）' })
  findAll(@Query() query: QueryRiskEventsDto, @CurrentUser() user: any) {
    return this.riskService.findAll(query as any, user);
  }

  @Get('risk/events/:id')
  @ApiOperation({ summary: '查看风险事件详情' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.riskService.findById(id, user);
  }

  @Post('risk/events/:id/review')
  @Roles(Role.ADMIN, Role.GRID_WORKER, Role.COMMUNITY_DOCTOR)
  @ApiOperation({ summary: '复核风险事件（确认/忽略）' })
  @Auditable('RISK', 'REVIEW', { resourceIdParam: 'id' })
  review(
    @Param('id') id: string,
    @Body() dto: ReviewRiskEventDto,
    @CurrentUser() user: any,
  ) {
    return this.riskService.reviewEvent(id, dto.status, user.sub, dto.note);
  }
}
