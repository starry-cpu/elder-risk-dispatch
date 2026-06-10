import { Module } from '@nestjs/common';
import { EldersController } from './elders.controller';
import { EldersService } from './elders.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';

@Module({
  controllers: [EldersController],
  providers: [EldersService, FieldEncryptionService],
  exports: [EldersService],
})
export class EldersModule {}
