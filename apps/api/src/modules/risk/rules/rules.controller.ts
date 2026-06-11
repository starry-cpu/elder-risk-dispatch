// apps/api/src/modules/risk/rules/rules.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { RulesService } from './rules.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Risk Rules')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller()
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get('risk/rules')
  @ApiOperation({ summary: '获取风险规则列表' })
  findAll(@Query() query: any) {
    return this.rulesService.findAll(query);
  }

  @Get('risk/rules/:id')
  @ApiOperation({ summary: '获取单个风险规则详情' })
  findById(@Param('id') id: string) {
    return this.rulesService.findById(id);
  }

  @Post('risk/rules')
  @ApiOperation({ summary: '创建风险规则' })
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.rulesService.create(body, user.sub);
  }

  @Patch('risk/rules/:id')
  @ApiOperation({ summary: '更新风险规则（version 自增）' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.rulesService.update(id, body);
  }

  @Delete('risk/rules/:id')
  @ApiOperation({ summary: '禁用风险规则（软删除）' })
  disable(@Param('id') id: string) {
    return this.rulesService.disable(id);
  }
}
