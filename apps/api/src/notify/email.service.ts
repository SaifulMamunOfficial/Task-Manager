import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailSettings, SystemSettingsService } from './system-settings.service';

@Injectable()
export class EmailService {
  private log = new Logger('Email');
  private cache?: { key: string; transport: nodemailer.Transporter };

  constructor(private settings: SystemSettingsService) {}

  private transportFor(cfg: EmailSettings) {
    const key = JSON.stringify([cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass]);
    if (this.cache?.key !== key) {
      this.cache = {
        key,
        transport: nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        }),
      };
    }
    return this.cache.transport;
  }

  /** Sends one email using the current admin settings. Returns false (never throws) if email is off or fails. */
  async send(to: string, subject: string, text: string): Promise<boolean> {
    const cfg = await this.settings.email();
    if (!cfg.enabled || !cfg.host) return false;
    try {
      await this.transportFor(cfg).sendMail({ from: cfg.from, to, subject, text });
      return true;
    } catch (e) {
      this.log.error(`Failed to email ${to}: ${(e as Error).message}`);
      return false;
    }
  }

  /** For the admin "send test email" button: works even while email is switched off, and reports the real error. */
  async test(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const cfg = await this.settings.email();
    if (!cfg.host) return { ok: false, error: 'No mail server (host) is set' };
    try {
      await this.transportFor(cfg).sendMail({ from: cfg.from, to, subject, text });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
}
