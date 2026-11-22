import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { decryptSecret, encryptSecret } from '../common/crypto';

export interface EventToggles {
  reminders: boolean; // overdue, due soon, digests ...
  tasks: boolean; // new task, status change, comments, files
}

export interface EmailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string; // decrypted, server side only
  from: string;
  events: EventToggles;
}

export interface PushSettings {
  webEnabled: boolean;
  vapidPublic: string;
  vapidPrivate?: string; // decrypted, server side only
  subject: string; // mailto: or https: contact for push services
  mobileEnabled: boolean;
  expoToken?: string; // optional Expo access token, decrypted
  events: EventToggles;
}

type Stored<T> = Omit<T, 'pass' | 'vapidPrivate' | 'expoToken'> & { passEnc?: string; vapidPrivateEnc?: string; expoTokenEnc?: string };

/** Admin editable settings, kept in the database. Secrets are encrypted and never sent back to the browser. */
@Injectable()
export class SystemSettingsService {
  constructor(private prisma: PrismaService) {}

  private async raw<T>(key: string): Promise<T | null> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    return (row?.value as unknown as T) ?? null;
  }
  private async write(key: string, value: unknown, adminId: string) {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy: adminId },
      update: { value: value as Prisma.InputJsonValue, updatedBy: adminId },
    });
  }

  // ---------- email ----------

  /** Database settings win; if none were saved yet we fall back to the SMTP_* environment variables. */
  async email(): Promise<EmailSettings & { source: 'database' | 'environment' | 'none' }> {
    const s = await this.raw<Stored<EmailSettings>>('email');
    if (s) {
      return { ...s, pass: decryptSecret(s.passEnc), events: { reminders: s.events?.reminders ?? true, tasks: s.events?.tasks ?? false }, source: 'database' };
    }
    const host = process.env.SMTP_HOST ?? '';
    return {
      enabled: !!host,
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS || undefined,
      from: process.env.SMTP_FROM ?? 'Task Manager <no-reply@localhost>',
      events: { reminders: true, tasks: false },
      source: host ? 'environment' : 'none',
    };
  }

  async emailPublic() {
    const { pass, ...rest } = await this.email();
    return { ...rest, hasPassword: !!pass };
  }

  /** `pass`: undefined keeps the saved password, '' clears it, any other text replaces it. */
  async saveEmail(input: Partial<Omit<EmailSettings, 'pass' | 'events'>> & { pass?: string; events?: Partial<EventToggles> }, adminId: string) {
    const cur = await this.email();
    const next: Stored<EmailSettings> = {
      enabled: input.enabled ?? cur.enabled,
      host: (input.host ?? cur.host).trim(),
      port: input.port ?? cur.port,
      secure: input.secure ?? cur.secure,
      user: (input.user ?? cur.user).trim(),
      from: (input.from ?? cur.from).trim(),
      events: { ...cur.events, ...(input.events ?? {}) },
      passEnc: input.pass === undefined ? (cur.pass ? encryptSecret(cur.pass) : undefined) : input.pass === '' ? undefined : encryptSecret(input.pass),
    };
    await this.write('email', next, adminId);
  }

  // ---------- push ----------

  async push(): Promise<PushSettings> {
    const s = await this.raw<Stored<PushSettings>>('push');
    if (s) {
      return { ...s, vapidPrivate: decryptSecret(s.vapidPrivateEnc), expoToken: decryptSecret(s.expoTokenEnc), events: { reminders: s.events?.reminders ?? true, tasks: s.events?.tasks ?? true } };
    }
    return { webEnabled: false, vapidPublic: '', subject: 'mailto:admin@example.com', mobileEnabled: false, events: { reminders: true, tasks: true } };
  }

  async pushPublic() {
    const { vapidPrivate, expoToken, ...rest } = await this.push();
    return { ...rest, hasPrivateKey: !!vapidPrivate, hasExpoToken: !!expoToken };
  }

  async savePush(input: Partial<Omit<PushSettings, 'vapidPrivate' | 'expoToken' | 'events'>> & { vapidPrivate?: string; expoToken?: string; events?: Partial<EventToggles> }, adminId: string) {
    const cur = await this.push();
    const priv = input.vapidPrivate !== undefined ? input.vapidPrivate : cur.vapidPrivate;
    const expo = input.expoToken !== undefined ? input.expoToken : cur.expoToken;
    const next: Stored<PushSettings> = {
      webEnabled: input.webEnabled ?? cur.webEnabled,
      vapidPublic: input.vapidPublic ?? cur.vapidPublic,
      subject: (input.subject ?? cur.subject).trim(),
      mobileEnabled: input.mobileEnabled ?? cur.mobileEnabled,
      events: { ...cur.events, ...(input.events ?? {}) },
      vapidPrivateEnc: priv ? encryptSecret(priv) : undefined,
      expoTokenEnc: expo ? encryptSecret(expo) : undefined,
    };
    await this.write('push', next, adminId);
  }
}
