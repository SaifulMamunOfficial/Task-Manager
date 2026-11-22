import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';
import { appName } from './notify.messages';
import { PushService } from './push.service';
import { SystemSettingsService } from './system-settings.service';

class KeysDto {
  @IsString() @MinLength(1) p256dh: string;
  @IsString() @MinLength(1) auth: string;
}
class SubscribeDto {
  @IsString() @MinLength(10) endpoint: string;
  @ValidateNested() @Type(() => KeysDto) keys: KeysDto;
  @IsOptional() @IsString() userAgent?: string;
}
class UnsubscribeDto {
  @IsString() endpoint: string;
}
class PreferencesDto {
  @IsOptional() @IsBoolean() notifyEmail?: boolean;
  @IsOptional() @IsBoolean() notifyPush?: boolean;
}
class DeviceDto {
  @IsString() @MinLength(5) token: string;
  @IsIn(['IOS', 'ANDROID']) platform: 'IOS' | 'ANDROID';
}

/** Per-person notification choices and the places (browsers, phones) a person can be reached. */
@Controller()
export class NotifyController {
  constructor(
    private prisma: PrismaService,
    private settings: SystemSettingsService,
    private push: PushService,
  ) {}

  /** What the admin has switched on, plus this person's own choices. Drives the "Notification settings" page. */
  @Get('notify/preferences')
  async preferences(@CurrentUser() me: AuthUser) {
    const [user, mail, push, subs, devices] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { notifyEmail: true, notifyPush: true, email: true } }),
      this.settings.email(),
      this.settings.push(),
      this.prisma.pushSubscription.findMany({ where: { userId: me.id }, select: { id: true, endpoint: true, userAgent: true, createdAt: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.deviceToken.count({ where: { userId: me.id } }),
    ]);
    return {
      notifyEmail: user.notifyEmail,
      notifyPush: user.notifyPush,
      email: user.email,
      emailAvailable: mail.enabled && !!mail.host,
      webPushAvailable: push.webEnabled && !!push.vapidPublic && !!push.vapidPrivate,
      mobilePushAvailable: push.mobileEnabled,
      publicKey: push.webEnabled ? push.vapidPublic : null,
      browsers: subs,
      phones: devices,
    };
  }

  @Put('notify/preferences')
  async savePreferences(@CurrentUser() me: AuthUser, @Body() dto: PreferencesDto) {
    await this.prisma.user.update({ where: { id: me.id }, data: { notifyEmail: dto.notifyEmail, notifyPush: dto.notifyPush } });
    return this.preferences(me);
  }

  @Post('push/subscribe')
  async subscribe(@CurrentUser() me: AuthUser, @Body() dto: SubscribeDto) {
    // A browser belongs to whoever is signed in on it now.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId: me.id, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: dto.userAgent?.slice(0, 250) },
      update: { userId: me.id, p256dh: dto.keys.p256dh, auth: dto.keys.auth, userAgent: dto.userAgent?.slice(0, 250) },
    });
    return { ok: true };
  }

  @Post('push/unsubscribe')
  async unsubscribe(@CurrentUser() me: AuthUser, @Body() dto: UnsubscribeDto) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: dto.endpoint, userId: me.id } });
    return { ok: true };
  }

  @Delete('push/subscriptions/:id')
  async removeSubscription(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { id, userId: me.id } });
    return { ok: true };
  }

  /** Sends a test message to this person's own browsers and phones. */
  @Post('push/test')
  async test(@CurrentUser() me: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { language: true } });
    const bn = user.language !== 'en';
    return this.push.sendToUser(me.id, {
      title: appName(bn ? 'bn' : 'en'),
      body: bn ? 'পুশ বিজ্ঞপ্তি ঠিকমতো কাজ করছে।' : 'Push notifications are working.',
      url: '/notifications',
      tag: 'test',
    });
  }

  // ---- phones (Expo push token from the mobile app) ----

  @Post('devices/register')
  async registerDevice(@CurrentUser() me: AuthUser, @Body() dto: DeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { pushToken: dto.token },
      create: { userId: me.id, platform: dto.platform, pushToken: dto.token },
      update: { userId: me.id, platform: dto.platform },
    });
    return { ok: true };
  }

  @Post('devices/unregister')
  async unregisterDevice(@CurrentUser() me: AuthUser, @Body() dto: { token: string }) {
    await this.prisma.deviceToken.deleteMany({ where: { pushToken: dto.token, userId: me.id } });
    return { ok: true };
  }
}
