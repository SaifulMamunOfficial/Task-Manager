import { BadRequestException, Body, Controller, Get, Post, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { AdminOnly, AuthUser, CurrentUser } from '../auth/decorators';
import { AuditService } from '../common/audit.module';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from './email.service';
import { appName } from './notify.messages';
import { PushService } from './push.service';
import { SystemSettingsService } from './system-settings.service';

class EventsDto {
  @IsOptional() @IsBoolean() reminders?: boolean;
  @IsOptional() @IsBoolean() tasks?: boolean;
}

class EmailDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsBoolean() secure?: boolean;
  @IsOptional() @IsString() user?: string;
  /** undefined keeps the saved password, '' removes it */
  @IsOptional() @IsString() pass?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @ValidateNested() @Type(() => EventsDto) events?: EventsDto;
}

class PushDto {
  @IsOptional() @IsBoolean() webEnabled?: boolean;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsBoolean() mobileEnabled?: boolean;
  /** undefined keeps the saved token, '' removes it */
  @IsOptional() @IsString() expoToken?: string;
  @IsOptional() @ValidateNested() @Type(() => EventsDto) events?: EventsDto;
}

class TestEmailDto {
  @IsEmail() to: string;
}

/** Admin: where notifications go (email server, browser push, mobile push). Secrets are write-only. */
@Controller('settings/notifications')
export class NotifySettingsController {
  constructor(
    private settings: SystemSettingsService,
    private email: EmailService,
    private push: PushService,
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  @AdminOnly()
  @Get()
  async get() {
    const [email, push, subs, devices] = await Promise.all([
      this.settings.emailPublic(),
      this.settings.pushPublic(),
      this.prisma.pushSubscription.count(),
      this.prisma.deviceToken.count(),
    ]);
    return { email, push: { ...push, subscriptions: subs, devices } };
  }

  @AdminOnly()
  @Put('email')
  async saveEmail(@CurrentUser() me: AuthUser, @Body() dto: EmailDto) {
    if (dto.enabled && !(dto.host ?? (await this.settings.email()).host)?.trim()) {
      throw new BadRequestException('Enter the mail server (host) before turning email on');
    }
    await this.settings.saveEmail(dto, me.id);
    // Never write secrets to the audit log: only which fields changed.
    await this.audit.log(me.id, 'SET_EMAIL_SETTINGS', 'SystemSetting', 'email', undefined, { fields: Object.keys(dto).map((k) => (k === 'pass' ? 'pass (changed)' : k)) });
    return this.settings.emailPublic();
  }

  @AdminOnly()
  @Post('email/test')
  async testEmail(@CurrentUser() me: AuthUser, @Body() dto: TestEmailDto) {
    const user = await this.prisma.user.findUnique({ where: { id: me.id }, select: { language: true } });
    const bn = user?.language !== 'en';
    const subject = `${appName(bn ? 'bn' : 'en')}: ${bn ? 'পরীক্ষামূলক ইমেইল' : 'test email'}`;
    const text = bn ? 'এই ইমেইলটি এসেছে মানে আপনার ইমেইল সেটিং ঠিক আছে।' : 'If you can read this, your email settings work.';
    return this.email.test(dto.to, subject, text);
  }

  @AdminOnly()
  @Put('push')
  async savePush(@CurrentUser() me: AuthUser, @Body() dto: PushDto) {
    if (dto.webEnabled) {
      const cur = await this.settings.push();
      if (!cur.vapidPublic || !cur.vapidPrivate) throw new BadRequestException('Generate the push keys before turning browser push on');
    }
    if (dto.subject && !/^(mailto:|https:\/\/)/.test(dto.subject.trim())) {
      throw new BadRequestException('The contact must start with mailto: or https://');
    }
    await this.settings.savePush(dto, me.id);
    await this.audit.log(me.id, 'SET_PUSH_SETTINGS', 'SystemSetting', 'push', undefined, { fields: Object.keys(dto).map((k) => (k === 'expoToken' ? 'expoToken (changed)' : k)) });
    return this.settings.pushPublic();
  }

  /** Creates a new VAPID key pair. Browsers that subscribed with the old key must subscribe again, so they are cleared. */
  @AdminOnly()
  @Post('push/keys')
  async generateKeys(@CurrentUser() me: AuthUser) {
    const keys = this.push.generateKeys();
    await this.settings.savePush({ vapidPublic: keys.publicKey, vapidPrivate: keys.privateKey }, me.id);
    const cleared = await this.prisma.pushSubscription.deleteMany({});
    await this.audit.log(me.id, 'GENERATE_PUSH_KEYS', 'SystemSetting', 'push', undefined, { clearedSubscriptions: cleared.count });
    return { publicKey: keys.publicKey, clearedSubscriptions: cleared.count };
  }

  /** Sends a test message to the admin's own browsers and phones. */
  @AdminOnly()
  @Post('push/test')
  async testPush(@CurrentUser() me: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id: me.id }, select: { language: true } });
    const bn = user?.language !== 'en';
    return this.push.sendToUser(me.id, {
      title: appName(bn ? 'bn' : 'en'),
      body: bn ? 'পুশ বিজ্ঞপ্তি ঠিকমতো কাজ করছে।' : 'Push notifications are working.',
      url: '/notifications',
      tag: 'test',
    });
  }
}
