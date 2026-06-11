import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { ReassignWorkOrderDto } from './dto/reassign-work-order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('WorkOrders')
@ApiBearerAuth()
@Controller()
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post('work-orders')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '创建工单，返回派单推荐作为建议' })
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: any) {
    return this.workOrdersService.create(dto, user);
  }

  @Get('work-orders')
  @ApiOperation({ summary: '分页查询工单列表' })
  findAll(@Query() query: QueryWorkOrdersDto, @CurrentUser() user: any) {
    return this.workOrdersService.findAll(query as any, user);
  }

  @Get('work-orders/:id')
  @ApiOperation({ summary: '查看工单详情（含时间线+评价）' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workOrdersService.findById(id, user);
  }

  @Post('work-orders/:id/assign')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '指定接单人员' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.assign(id, dto.assigneeId, user);
  }

  @Post('work-orders/:id/start')
  @ApiOperation({ summary: '接单者标记开始处理' })
  start(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workOrdersService.start(id, user);
  }

  @Post('work-orders/:id/complete')
  @ApiOperation({ summary: '接单者提交处理结果' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.complete(id, dto, user);
  }

  @Post('work-orders/:id/cancel')
  @ApiOperation({ summary: '取消工单' })
  cancel(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.cancel(id, dto.reason, user);
  }

  @Post('work-orders/:id/reassign')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '改派工单（须填原因）' })
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.reassign(id, dto.newAssigneeId, dto.reason, user);
  }

  @Get('work-orders/:id/timeline')
  @ApiOperation({ summary: '查看工单时间线' })
  getTimeline(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workOrdersService.getTimeline(id, user);
  }
}
