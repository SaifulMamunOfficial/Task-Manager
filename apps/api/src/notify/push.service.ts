import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.module';
import { SystemSettingsService } from './system-settings.service';

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

@Injectable()
export class PushService {
  private log = new Logger('Push');

  constructor(
    private prisma: PrismaService,
    private settings: SystemSettingsService,
  ) {}

  /** New VAPID key pair for browser push. The private key never leaves the server. */
  generateKeys() {
    return webpush.generateVAPIDKeys();
  }

  /** Send to every browser and phone the person registered. Never throws. */
  async sendToUser(userId: string, msg: PushMessage): Promise<{ web: number; mobile: number; failed: number }> {
    const res = { web: 0, mobile: 0, failed: 0 };
    const cfg = await this.settings.push();

    if (cfg.webEnabled && cfg.vapidPublic && cfg.vapidPrivate) {
      const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
      const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? '/notifications', tag: msg.tag });
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
              vapidDetails: { subject: cfg.subject, publicKey: cfg.vapidPublic, privateKey: cfg.vapidPrivate! },
              TTL: 3600,
            });
            res.web++;
          } catch (e: any) {
            res.failed++;
            // The browser unsubscribed or the subscription expired: forget it.
            if (e?.statusCode === 404 || e?.statusCode === 410) await this.prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
            else this.log.warn(`Web push failed (${e?.statusCode ?? 'error'}): ${e?.body ?? e?.message}`);
          }
        }),
      );
    }

    if (cfg.mobileEnabled) {
      const tokens = await this.prisma.deviceToken.findMany({ where: { userId } });
      if (tokens.length) {
        try {
          const r = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(cfg.expoToken ? { Authorization: `Bearer ${cfg.expoToken}` } : {}) },
            body: JSON.stringify(tokens.map((t) => ({ to: t.pushToken, title: msg.title, body: msg.body, data: { url: msg.url }, sound: 'default' }))),
          });
          const json: any = await r.json().catch(() => ({}));
          (json.data ?? []).forEach((d: any, i: number) => {
            if (d.status === 'ok') res.mobile++;
            else {
              res.failed++;
              if (d.details?.error === 'DeviceNotRegistered') void this.prisma.deviceToken.delete({ where: { id: tokens[i].id } }).catch(() => {});
            }
          });
        } catch (e) {
          res.failed += tokens.length;
          this.log.warn(`Mobile push failed: ${(e as Error).message}`);
        }
      }
    }
    return res;
  }
}
