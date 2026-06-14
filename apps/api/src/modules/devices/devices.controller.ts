import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { DeviceDataDto } from './dto/device-data.dto';
import { QueryDeviceDto } from './dto/query-device.dto';
import { HmacGuard } from './hmac/hmac.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Devices')
@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('devices/data')
  @Public()
  @UseGuards(HmacGuard)
  @ApiOperation({ summary: '设备/网关数据上报（HMAC 签名校验）' })
  ingest(@Body() dto: DeviceDataDto) {
    return this.devicesService.ingest(dto);
  }

  @Get('elders/:id/devices')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询老人设备数据' })
  findByElder(
    @Param('id') elderId: string,
    @Query() query: QueryDeviceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.devicesService.findByElder(elderId, query, user);
  }
}
