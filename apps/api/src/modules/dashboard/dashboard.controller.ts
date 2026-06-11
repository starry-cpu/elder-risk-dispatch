import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('risk-overview')
  @ApiOperation({ summary: '风险概览 — 等级/来源分布 + 趋势' })
  getRiskOverview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getRiskOverview(query, user);
  }

  @Get('work-order-efficiency')
  @ApiOperation({ summary: '工单效率 — 状态/类型分布 + 平均时长' })
  getWorkOrderEfficiency(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getWorkOrderEfficiency(query, user);
  }

  @Get('elder-coverage')
  @ApiOperation({ summary: '老人覆盖 — 片区覆盖率 + 重点关注' })
  getElderCoverage(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getElderCoverage(query, user);
  }

  @Get('grid-worker-performance')
  @ApiOperation({ summary: '网格员效能' })
  getGridWorkerPerformance(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getGridWorkerPerformance(query, user);
  }
}
