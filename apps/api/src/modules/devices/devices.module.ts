import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { HmacService } from './hmac/hmac.service';
import { HmacGuard } from './hmac/hmac.guard';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, HmacService, HmacGuard],
  exports: [DevicesService],
})
export class DevicesModule {}
