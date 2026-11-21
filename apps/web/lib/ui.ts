export type Position = { id: string; isPrimary: boolean; unit: { id: string; name: string }; position: { id: string; title: string; level: number } };
export type Me = { id: string; name: string; email: string; isAdmin: boolean; mustChangePassword: boolean; positions: Position[] };
export type Brief = { id: string; name: string };

export const STATUS_LABEL: Record<string, string> = {
  PENDING_ACCEPTANCE: 'Not accepted yet',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  SUBMITTED: 'Awaiting approval',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

// Kept for pages that still use coloured pills.
export const STATUS_TONE: Record<string, string> = {
  PENDING_ACCEPTANCE: 'amber', ACCEPTED: 'blue', IN_PROGRESS: 'blue', BLOCKED: 'red', SUBMITTED: 'amber', APPROVED: 'green', DECLINED: 'red', CANCELLED: 'gray',
};

export const ACTION_LABEL: Record<string, string> = {
  ACCEPTED: 'Accept',
  DECLINED: 'Decline',
  IN_PROGRESS: 'Start working',
  BLOCKED: 'Mark as blocked',
  SUBMITTED: 'Submit for approval',
  APPROVED: 'Approve',
  CANCELLED: 'Cancel task',
  PENDING_ACCEPTANCE: 'Send again',
};

export const OPEN = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'];
export const WORKING = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED'];

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No deadline';

export const isOverdue = (due?: string | null, status?: string) =>
  !!due && new Date(due) < new Date() && !['APPROVED', 'CANCELLED', 'DECLINED', 'SUBMITTED'].includes(status ?? '');

export const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** Human deadline: "3d overdue", "Today, 5:00 PM", "Tomorrow", "Wed, 26 Nov". */
export function dueInfo(due?: string | null, status?: string): { text: string; tone: 'late' | 'soon' | 'ok' | 'none' } {
  if (!due) return { text: 'No deadline', tone: 'none' };
  const d = new Date(due);
  const now = new Date();
  if (['APPROVED', 'CANCELLED', 'DECLINED'].includes(status ?? '')) return { text: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), tone: 'ok' };
  const waiting = status === 'SUBMITTED';
  if (!waiting && d < now) {
    const h = Math.floor((now.getTime() - d.getTime()) / 3600_000);
    return { text: h < 24 ? `${Math.max(h, 1)}h overdue` : `${Math.floor(h / 24)}d overdue`, tone: 'late' };
  }
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startDue = new Date(d);
  startDue.setHours(0, 0, 0, 0);
  const days = Math.round((startDue.getTime() - startToday.getTime()) / 86400_000);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return { text: `Today, ${time}`, tone: 'soon' };
  if (days === 1) return { text: 'Tomorrow', tone: 'soon' };
  if (days > 1 && days < 7) return { text: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }), tone: 'ok' };
  return { text: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), tone: 'ok' };
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function notificationText(n: { type: string; payload: any }): string {
  const p = n.payload ?? {};
  if (p.message) return p.message;
  const t = p.title ? `"${p.title}"` : 'a task';
  switch (n.type) {
    case 'TASK_ASSIGNED':
      return `New task: ${t}`;
    case 'STATUS_CHANGED':
      return `${t} is now ${STATUS_LABEL[p.to]?.toLowerCase() ?? p.to}`;
    case 'UPDATE_POSTED':
      return p.progressPercent != null ? `Progress on ${t}: ${p.progressPercent}%` : `New comment on ${t}`;
    case 'ATTACHMENT_ADDED':
      return `${p.count} file(s) added to ${t}`;
    default:
      return n.type;
  }
}
