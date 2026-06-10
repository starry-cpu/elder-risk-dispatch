import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { QueryVisitDto } from './dto/query-visit.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @Roles(Role.GRID_WORKER)
  @ApiOperation({ summary: '提交巡访记录（含定位、照片）' })
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: any) {
    return this.visitsService.create(dto, user);
  }

  @Get()
  @Roles(Role.GRID_WORKER, Role.ADMIN)
  @ApiOperation({ summary: '查询巡访记录（按老人/时间范围筛选）' })
  findAll(@Query() query: QueryVisitDto, @CurrentUser() user: any) {
    const { page = 1, limit = 20, ...rest } = query;
    return this.visitsService.findAll({ page, limit, ...rest }, user);
  }
}
