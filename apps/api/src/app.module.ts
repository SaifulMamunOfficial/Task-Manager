import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { OrgModule } from './org/org.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { RemindersModule } from './reminders/reminders.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditModule } from './common/audit.module';
import { HealthController } from './common/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AuthModule,
    OrgModule,
    UsersModule,
    SettingsModule,
    TasksModule,
    RemindersModule,
    AttachmentsModule,
  ],
  controllers: [HealthController],
  // Every route requires a valid JWT unless marked @Public().
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
