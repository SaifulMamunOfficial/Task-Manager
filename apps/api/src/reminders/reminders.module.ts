import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({ controllers: [RemindersController], providers: [RemindersService, EmailService], exports: [RemindersService] })
export class RemindersModule {}
