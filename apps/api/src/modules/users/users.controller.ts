import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, DutyStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Auditable } from '../audit/decorators/auditable.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建用户' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '用户列表' })
  findAll(@Query('page') page?: number, @Query('limit') limit?: number, @Query('role') role?: Role, @Query('district') district?: string) {
    return this.usersService.findAll({ page, limit, role, district });
  }

  @Get(':id')
  @ApiOperation({ summary: '用户详情' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.findById(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新用户信息' })
  @Auditable('USER', 'ROLE_CHANGE', { resourceIdParam: 'id', sensitiveFields: ['phone'] })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/duty')
  @ApiOperation({ summary: '切换在岗/离岗状态' })
  updateDutyStatus(@Param('id') id: string, @Body('dutyStatus') dutyStatus: DutyStatus, @CurrentUser() user: any) {
    return this.usersService.updateDutyStatus(id, dutyStatus, user);
  }
}
