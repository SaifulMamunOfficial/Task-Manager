export type ReminderKind =
  | 'GLOBAL'
  | 'ACCEPT_PENDING'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'STALE'
  | 'AWAITING_APPROVAL'
  | 'DAILY_DIGEST'
  | 'GIVER_DIGEST';

export const DEFAULT_RULES: Record<ReminderKind, { enabled: boolean; config: Record<string, number> }> = {
  // tzOffsetMinutes: 360 = UTC+6 (Bangladesh, no DST). Reminders are only sent inside the send window.
  GLOBAL: { enabled: true, config: { tzOffsetMinutes: 360, windowStartHour: 8, windowEndHour: 20 } },
  ACCEPT_PENDING: { enabled: true, config: { afterHours: 24, escalateAfterHours: 48 } },
  DUE_SOON: { enabled: true, config: { beforeHours: 24 } },
  DUE_TODAY: { enabled: true, config: {} },
  OVERDUE: { enabled: true, config: {} },
  STALE: { enabled: true, config: { afterDays: 3 } },
  AWAITING_APPROVAL: { enabled: true, config: { afterHours: 24 } },
  DAILY_DIGEST: { enabled: true, config: { hour: 8 } },
  // weekday: 0 = Sunday ... 4 = Thursday
  GIVER_DIGEST: { enabled: true, config: { hour: 8, weekday: 4 } },
};

export const REMINDER_KINDS = Object.keys(DEFAULT_RULES) as ReminderKind[];
