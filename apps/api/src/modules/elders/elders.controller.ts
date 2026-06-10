import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, ServiceLevel } from '@prisma/client';
import { EldersService } from './elders.service';
import { CreateElderDto } from './dto/create-elder.dto';
import { UpdateElderDto } from './dto/update-elder.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Elders')
@ApiBearerAuth()
@Controller('elders')
export class EldersController {
  constructor(private readonly eldersService: EldersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '创建老人档案' })
  create(@Body() dto: CreateElderDto, @CurrentUser() user: any) {
    return this.eldersService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: '老人列表（分页+片区+服务等级筛选）' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('district') district?: string,
    @Query('serviceLevel') serviceLevel?: ServiceLevel,
  ) {
    return this.eldersService.findAll({ page, limit, district, serviceLevel });
  }

  @Get(':id')
  @ApiOperation({ summary: '老人详情（敏感字段按角色解密）' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eldersService.findById(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '更新老人档案' })
  update(@Param('id') id: string, @Body() dto: UpdateElderDto) {
    return this.eldersService.update(id, dto);
  }

  @Post(':id/contacts')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '添加紧急联系人' })
  addContact(@Param('id') elderId: string, @Body() dto: CreateContactDto) {
    return this.eldersService.addContact(elderId, dto);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: '查看紧急联系人' })
  getContacts(@Param('id') elderId: string) {
    return this.eldersService.getContacts(elderId);
  }

  @Get(':id/risk-profile')
  @ApiOperation({ summary: '风险画像聚合' })
  getRiskProfile(@Param('id') elderId: string) {
    return this.eldersService.getRiskProfile(elderId);
  }

  @Post(':id/link-family')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '绑定家属账号' })
  linkFamily(
    @Param('id') elderId: string,
    @Body('userId') userId: string,
    @Body('relation') relation: string,
  ) {
    return this.eldersService.linkFamily(elderId, userId, relation);
  }
}
