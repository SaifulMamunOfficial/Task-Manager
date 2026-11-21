import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

/** Optional email delivery. If SMTP_HOST is not set, emails are skipped (in-app notifications still work). */
@Injectable()
export class EmailService {
  private log = new Logger('Email');
  private transport: nodemailer.Transporter | null = null;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    this.from = process.env.SMTP_FROM ?? 'Task Manager <no-reply@localhost>';
    if (host) {
      this.transport = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    } else {
      this.log.warn('SMTP_HOST not set: reminder emails are disabled');
    }
  }

  get enabled() {
    return !!this.transport;
  }

  async send(to: string, subject: string, text: string): Promise<boolean> {
    if (!this.transport) return false;
    try {
      await this.transport.sendMail({ from: this.from, to, subject, text });
      return true;
    } catch (e) {
      this.log.error(`Failed to email ${to}: ${(e as Error).message}`);
      return false;
    }
  }
}
