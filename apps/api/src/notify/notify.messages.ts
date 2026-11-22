import { Lang, reminderText } from '../reminders/messages';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const num = (lang: Lang, n: number | string) => (lang === 'bn' ? String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : String(n));

const STATUS: Record<Lang, Record<string, string>> = {
  en: { PENDING_ACCEPTANCE: 'Not accepted yet', ACCEPTED: 'Accepted', IN_PROGRESS: 'In progress', BLOCKED: 'Blocked', SUBMITTED: 'Awaiting approval', APPROVED: 'Approved', DECLINED: 'Declined', CANCELLED: 'Cancelled' },
  bn: { PENDING_ACCEPTANCE: 'গ্রহণ করা হয়নি', ACCEPTED: 'গ্রহণ করা হয়েছে', IN_PROGRESS: 'চলছে', BLOCKED: 'আটকে আছে', SUBMITTED: 'অনুমোদনের অপেক্ষায়', APPROVED: 'অনুমোদিত', DECLINED: 'প্রত্যাখ্যাত', CANCELLED: 'বাতিল' },
};

export const appName = (lang: Lang) => (lang === 'bn' ? 'টাস্ক ম্যানেজার' : 'Task Manager');

/** One line of text for a notification, in the reader's language (used for push and email). */
export function notificationText(lang: Lang, type: string, payload: Record<string, any>): string {
  const title = payload.title ?? '';
  if (type.startsWith('REMINDER_') && payload.key) return reminderText(lang, payload.key, payload.params ?? {});
  const bn = lang === 'bn';
  switch (type) {
    case 'TASK_ASSIGNED':
      return bn ? `নতুন কাজ: "${title}"` : `New task: "${title}"`;
    case 'STATUS_CHANGED': {
      const s = STATUS[lang][payload.to] ?? payload.to;
      return bn ? `"${title}" এখন: ${s}` : `"${title}" is now: ${s}`;
    }
    case 'UPDATE_POSTED':
      return payload.progressPercent != null
        ? bn
          ? `"${title}" কাজের অগ্রগতি: ${num(lang, payload.progressPercent)}%`
          : `Progress on "${title}": ${payload.progressPercent}%`
        : bn
          ? `"${title}" কাজে নতুন মন্তব্য`
          : `New comment on "${title}"`;
    case 'ATTACHMENT_ADDED':
      return bn ? `"${title}" কাজে ${num(lang, payload.count)}টি ফাইল যোগ হয়েছে` : `${payload.count} file(s) added to "${title}"`;
    default:
      return payload.message ?? type;
  }
}
