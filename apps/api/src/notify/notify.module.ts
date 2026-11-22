import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotifyController } from './notify.controller';
import { NotifyService } from './notify.service';
import { NotifySettingsController } from './notify-settings.controller';
import { PushService } from './push.service';
import { SystemSettingsService } from './system-settings.service';

@Global()
@Module({
  controllers: [NotifyController, NotifySettingsController],
  providers: [SystemSettingsService, EmailService, PushService, NotifyService],
  exports: [NotifyService, SystemSettingsService, EmailService, PushService],
})
export class NotifyModule {}
