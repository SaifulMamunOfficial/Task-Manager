import { Injectable, Logger } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { reminderSubject, Lang } from '../reminders/messages';
import { EmailService } from './email.service';
import { appName, notificationText } from './notify.messages';
import { PushService } from './push.service';
import { SystemSettingsService } from './system-settings.service';

/**
 * The one place that creates notifications. Every notification is saved for the in-app list, then, according to
 * the admin settings and the person's own preferences, also sent as push and/or email in the person's language.
 */
@Injectable()
export class NotifyService {
  private log = new Logger('Notify');

  constructor(
    private prisma: PrismaService,
    private settings: SystemSettingsService,
    private email: EmailService,
    private push: PushService,
  ) {}

  /** Save only. Use inside a database transaction, then call dispatch() after it commits. */
  create(userId: string, type: string, payload: Prisma.InputJsonValue, tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    return tx.notification.create({ data: { userId, type, payload } });
  }

  /** Save and send in one go. */
  async notify(userId: string, type: string, payload: Prisma.InputJsonValue) {
    const n = await this.create(userId, type, payload);
    void this.dispatch(n);
    return n;
  }

  dispatchAll(list: Notification[]) {
    list.forEach((n) => void this.dispatch(n));
  }

  /** Push and email delivery. Runs in the background and never throws. */
  async dispatch(n: Notification) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: n.userId },
        select: { email: true, language: true, isActive: true, notifyEmail: true, notifyPush: true },
      });
      if (!user?.isActive) return;
      const lang: Lang = user.language === 'en' ? 'en' : 'bn';
      const payload = (n.payload ?? {}) as Record<string, any>;
      const group = n.type.startsWith('REMINDER_') ? 'reminders' : 'tasks';
      const text = notificationText(lang, n.type, payload);
      const url = payload.assignmentId ? `/tasks/${payload.assignmentId}` : '/notifications';

      const push = await this.settings.push();
      if (user.notifyPush && (push.webEnabled || push.mobileEnabled) && push.events[group]) {
        await this.push.sendToUser(n.userId, { title: appName(lang), body: text, url, tag: n.type });
      }

      const mail = await this.settings.email();
      if (user.notifyEmail && mail.enabled && mail.events[group]) {
        const subject = group === 'reminders' ? reminderSubject(lang, payload.key ?? '') : appName(lang);
        if (await this.email.send(user.email, subject, text)) {
          await this.prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
        }
      }
    } catch (e) {
      this.log.warn(`Could not deliver notification ${n.id}: ${(e as Error).message}`);
    }
  }
}
