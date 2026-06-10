import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FieldEncryptionService],
  exports: [UsersService],
})
export class UsersModule {}
