import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { EldersModule } from './modules/elders/elders.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { VisitsModule } from './modules/visits/visits.module';
import { DevicesModule } from './modules/devices/devices.module';
import { RiskModule } from './modules/risk/risk.module';
import { AiModule } from './modules/ai/ai.module';
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6383',
      },
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    EldersModule,
    HealthModule,
    UploadsModule,
    CheckInsModule,
    VisitsModule,
    DevicesModule,
    RiskModule,
    AiModule,
    WorkOrdersModule,
    NotificationsModule,
    DashboardModule,
    SchedulerModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
