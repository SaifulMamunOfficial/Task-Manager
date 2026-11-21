import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AssignmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { EmailService } from './email.service';
import { DEFAULT_RULES, ReminderKind, REMINDER_KINDS } from './reminders.config';

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const OPEN: AssignmentStatus[] = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'];
const WORKING: AssignmentStatus[] = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED'];

type Rules = Record<ReminderKind, { enabled: boolean; config: Record<string, number> }>;
export interface RunResult {
  skipped?: string;
  created: number;
  byKind: Record<string, number>;
}

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger('Reminders');
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  onModuleInit() {
    if (process.env.REMINDERS_ENABLED === 'false') {
      this.log.warn('Reminder scheduler disabled (REMINDERS_ENABLED=false)');
      return;
    }
    const seconds = Number(process.env.REMINDER_TICK_SECONDS ?? 300);
    this.timer = setInterval(() => void this.run().catch((e) => this.log.error(e)), seconds * 1000);
    setTimeout(() => void this.run().catch((e) => this.log.error(e)), 15_000); // first pass shortly after boot
    this.log.log(`Scheduler running every ${seconds}s`);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---------- rules ----------

  async getRules(): Promise<Rules> {
    const rows = await this.prisma.reminderRule.findMany();
    const rules = JSON.parse(JSON.stringify(DEFAULT_RULES)) as Rules;
    for (const r of rows) {
      if ((REMINDER_KINDS as string[]).includes(r.key)) {
        const k = r.key as ReminderKind;
        rules[k] = { enabled: r.enabled, config: { ...rules[k].config, ...(r.config as Record<string, number>) } };
      }
    }
    return rules;
  }

  async setRule(kind: ReminderKind, enabled?: boolean, config?: Record<string, number>) {
    const current = (await this.getRules())[kind];
    return this.prisma.reminderRule.upsert({
      where: { key: kind },
      create: { key: kind, enabled: enabled ?? current.enabled, config: { ...current.config, ...(config ?? {}) } },
      update: { enabled: enabled ?? current.enabled, config: { ...current.config, ...(config ?? {}) } },
    });
  }

  // ---------- core ----------

  /**
   * One scheduler pass. `now` and `force` exist so tests and admins can run it at a chosen time.
   * Safe to call repeatedly: each reminder has a unique key in ReminderLog and fires only once.
   */
  async run(now: Date = new Date(), force = false): Promise<RunResult> {
    if (this.running) return { skipped: 'already running', created: 0, byKind: {} };
    this.running = true;
    try {
      const rules = await this.getRules();
      const g = rules.GLOBAL.config;
      const local = new Date(now.getTime() + g.tzOffsetMinutes * 60_000); // "wall clock" in UTC fields
      const hour = local.getUTCHours();
      const day = local.toISOString().slice(0, 10);
      if (!force && (hour < g.windowStartHour || hour >= g.windowEndHour)) {
        return { skipped: `outside send window (${g.windowStartHour}:00-${g.windowEndHour}:00)`, created: 0, byKind: {} };
      }

      const res: RunResult = { created: 0, byKind: {} };
      const fire = async (kind: ReminderKind, logKey: string, userId: string, message: string, payload: Record<string, unknown>) => {
        const ok = await this.fireOnce(kind, logKey, userId, message, payload);
        if (ok) {
          res.created++;
          res.byKind[kind] = (res.byKind[kind] ?? 0) + 1;
        }
      };

      const assignments = await this.prisma.taskAssignment.findMany({
        where: { status: { in: OPEN }, task: { closedAt: null } },
        include: {
          task: true,
          assignee: { select: { id: true, name: true, isActive: true } },
          assignedBy: { select: { id: true, name: true, isActive: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        },
      });

      for (const a of assignments) {
        if (!a.assignee.isActive) continue;
        const title = a.task.title;
        const base = { assignmentId: a.id, taskId: a.taskId, title };
        const due = a.task.dueDate;
        const working = WORKING.includes(a.status);

        // 1) Not accepted yet
        if (rules.ACCEPT_PENDING.enabled && a.status === 'PENDING_ACCEPTANCE') {
          const age = now.getTime() - a.createdAt.getTime();
          if (age >= rules.ACCEPT_PENDING.config.afterHours * HOUR) {
            await fire('ACCEPT_PENDING', `ACCEPT:${a.id}:${day}`, a.assigneeId, `You have not accepted "${title}" yet (from ${a.assignedBy.name}).`, base);
          }
          if (age >= rules.ACCEPT_PENDING.config.escalateAfterHours * HOUR && a.assignedBy.isActive) {
            await fire('ACCEPT_PENDING', `ACCEPT_ESC:${a.id}`, a.assignedById, `${a.assignee.name} has not accepted "${title}" for over ${rules.ACCEPT_PENDING.config.escalateAfterHours} hours.`, { ...base, escalation: true });
          }
        }

        // 2) Due dates (only for work still with the assignee)
        if (due && working) {
          const untilDue = due.getTime() - now.getTime();
          if (rules.DUE_SOON.enabled && untilDue > 0 && untilDue <= rules.DUE_SOON.config.beforeHours * HOUR) {
            await fire('DUE_SOON', `DUE_SOON:${a.id}`, a.assigneeId, `"${title}" is due within ${rules.DUE_SOON.config.beforeHours} hours.`, { ...base, dueDate: due });
          }
          const dueDay = new Date(due.getTime() + g.tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
          if (rules.DUE_TODAY.enabled && untilDue > 0 && dueDay === day) {
            await fire('DUE_TODAY', `DUE_TODAY:${a.id}:${day}`, a.assigneeId, `"${title}" is due today.`, { ...base, dueDate: due });
          }
          if (rules.OVERDUE.enabled && untilDue <= 0) {
            const days = Math.max(1, Math.floor(-untilDue / DAY));
            await fire('OVERDUE', `OVERDUE:${a.id}:${day}`, a.assigneeId, `"${title}" is overdue by ${days} day(s).`, { ...base, dueDate: due });
            if (a.assignedBy.isActive) {
              await fire('OVERDUE', `OVERDUE_G:${a.id}:${day}`, a.assignedById, `${a.assignee.name}'s task "${title}" is overdue by ${days} day(s).`, { ...base, dueDate: due, asGiver: true });
            }
          }
        }

        // 3) No update for a while
        if (rules.STALE.enabled && (a.status === 'ACCEPTED' || a.status === 'IN_PROGRESS')) {
          const last = Math.max(a.updates[0]?.createdAt.getTime() ?? 0, a.acceptedAt?.getTime() ?? 0, a.createdAt.getTime());
          const idleDays = (now.getTime() - last) / DAY;
          if (idleDays >= rules.STALE.config.afterDays) {
            const bucket = Math.floor(now.getTime() / DAY / rules.STALE.config.afterDays);
            await fire('STALE', `STALE:${a.id}:${bucket}`, a.assigneeId, `No update on "${title}" for ${Math.floor(idleDays)} days. Please post a progress update.`, base);
          }
        }

        // 4) Submitted but the giver has not approved
        if (rules.AWAITING_APPROVAL.enabled && a.status === 'SUBMITTED' && a.submittedAt && a.assignedBy.isActive) {
          if (now.getTime() - a.submittedAt.getTime() >= rules.AWAITING_APPROVAL.config.afterHours * HOUR) {
            await fire('AWAITING_APPROVAL', `APPROVAL:${a.id}:${day}`, a.assignedById, `${a.assignee.name} submitted "${title}". It is waiting for your approval.`, base);
          }
        }
      }

      if (rules.DAILY_DIGEST.enabled && hour >= rules.DAILY_DIGEST.config.hour) await this.dailyDigests(assignments, day, now, g.tzOffsetMinutes, fire);
      if (rules.GIVER_DIGEST.enabled && hour >= rules.GIVER_DIGEST.config.hour && local.getUTCDay() === rules.GIVER_DIGEST.config.weekday) {
        await this.giverDigests(assignments, day, now, fire);
      }

      if (res.created) this.log.log(`Created ${res.created} reminder(s): ${JSON.stringify(res.byKind)}`);
      return res;
    } finally {
      this.running = false;
    }
  }

  // ---------- digests ----------

  private async dailyDigests(assignments: Awaited<ReturnType<RemindersService['loadShape']>>, day: string, now: Date, tz: number, fire: FireFn) {
    const endOfToday = new Date(Math.floor((now.getTime() + tz * 60_000) / DAY) * DAY + DAY - tz * 60_000);
    const byUser = new Map<string, typeof assignments>();
    for (const a of assignments) if (a.assignee.isActive && WORKING.includes(a.status)) byUser.set(a.assigneeId, [...(byUser.get(a.assigneeId) ?? []), a]);
    for (const [userId, list] of byUser) {
      const overdue = list.filter((a) => a.task.dueDate && a.task.dueDate < now);
      const today = list.filter((a) => a.task.dueDate && a.task.dueDate >= now && a.task.dueDate <= endOfToday);
      const pending = list.filter((a) => a.status === 'PENDING_ACCEPTANCE');
      const rank = (a: (typeof list)[number]) => (a.task.priority === 'URGENT' ? 0 : 1);
      const top = [...list]
        .sort((x, y) => rank(x) - rank(y) || (x.task.dueDate?.getTime() ?? Infinity) - (y.task.dueDate?.getTime() ?? Infinity))
        .slice(0, 5)
        .map((a) => ({ assignmentId: a.id, title: a.task.title, priority: a.task.priority, dueDate: a.task.dueDate, status: a.status }));
      const counts = { open: list.length, overdue: overdue.length, dueToday: today.length, needsAccept: pending.length };
      const lines = [`Good morning. You have ${counts.open} open task(s).`];
      if (counts.overdue) lines.push(`${counts.overdue} overdue`);
      if (counts.dueToday) lines.push(`${counts.dueToday} due today`);
      if (counts.needsAccept) lines.push(`${counts.needsAccept} waiting for you to accept`);
      await fire('DAILY_DIGEST', `DIGEST:${userId}:${day}`, userId, lines.join(', ').replace(/open task\(s\), /, 'open task(s): '), { counts, top });
    }
  }

  private async giverDigests(assignments: Awaited<ReturnType<RemindersService['loadShape']>>, day: string, now: Date, fire: FireFn) {
    const byUser = new Map<string, typeof assignments>();
    for (const a of assignments) if (a.assignedBy.isActive) byUser.set(a.assignedById, [...(byUser.get(a.assignedById) ?? []), a]);
    for (const [userId, list] of byUser) {
      const counts = {
        open: list.length,
        overdue: list.filter((a) => WORKING.includes(a.status) && a.task.dueDate && a.task.dueDate < now).length,
        awaitingApproval: list.filter((a) => a.status === 'SUBMITTED').length,
        blocked: list.filter((a) => a.status === 'BLOCKED').length,
        notAccepted: list.filter((a) => a.status === 'PENDING_ACCEPTANCE').length,
      };
      const msg = `Weekly summary of tasks you gave: ${counts.open} open, ${counts.overdue} overdue, ${counts.awaitingApproval} awaiting your approval, ${counts.blocked} blocked, ${counts.notAccepted} not accepted yet.`;
      await fire('GIVER_DIGEST', `GDIGEST:${userId}:${day}`, userId, msg, { counts });
    }
  }

  // Helper only used for its return type.
  private loadShape() {
    return this.prisma.taskAssignment.findMany({
      include: {
        task: true,
        assignee: { select: { id: true, name: true, isActive: true } },
        assignedBy: { select: { id: true, name: true, isActive: true } },
        updates: { select: { createdAt: true } },
      },
    });
  }

  // ---------- delivery ----------

  /** Insert the dedup key first; only if that succeeds create the notification and email. */
  private async fireOnce(kind: ReminderKind, logKey: string, userId: string, message: string, payload: Record<string, unknown>): Promise<boolean> {
    try {
      await this.prisma.reminderLog.create({ data: { key: logKey } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false; // already sent
      throw e;
    }
    const n = await this.prisma.notification.create({
      data: { userId, type: `REMINDER_${kind}`, payload: { message, ...payload } as Prisma.InputJsonValue },
    });
    if (this.email.enabled) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, notifyEmail: true, isActive: true } });
      if (user?.isActive && user.notifyEmail && (await this.email.send(user.email, `Task Manager: ${kind.replace(/_/g, ' ').toLowerCase()}`, message))) {
        await this.prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
      }
    }
    return true;
  }

  /** Housekeeping: drop dedup keys older than 90 days. */
  async purgeOldLogs() {
    return this.prisma.reminderLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 90 * DAY) } } });
  }
}

type FireFn = (kind: ReminderKind, logKey: string, userId: string, message: string, payload: Record<string, unknown>) => Promise<void>;
