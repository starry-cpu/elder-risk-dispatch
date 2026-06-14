import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { QueryCheckInDto } from './dto/query-check-in.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('CheckIns')
@ApiBearerAuth()
@Controller()
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post('check-ins')
  @Roles(Role.FAMILY, Role.GRID_WORKER, Role.ADMIN)
  @ApiOperation({ summary: '提交报平安（一键/语音/文本/代填）' })
  create(@Body() dto: CreateCheckInDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checkInsService.create(dto, user);
  }

  @Get('elders/:id/check-ins')
  @ApiOperation({ summary: '查询老人报平安记录' })
  findByElder(
    @Param('id') elderId: string,
    @Query() query: QueryCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkInsService.findByElder(elderId, query, user);
  }
}
