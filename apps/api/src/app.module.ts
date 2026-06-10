import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EldersModule } from './modules/elders/elders.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { VisitsModule } from './modules/visits/visits.module';
import { DevicesModule } from './modules/devices/devices.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EldersModule,
    HealthModule,
    UploadsModule,
    CheckInsModule,
    VisitsModule,
    DevicesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
