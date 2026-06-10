import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { HmacService } from './hmac/hmac.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, HmacService],
  exports: [DevicesService],
})
export class DevicesModule {}
