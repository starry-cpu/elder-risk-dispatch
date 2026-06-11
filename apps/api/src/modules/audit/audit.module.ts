import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditInterceptor,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
