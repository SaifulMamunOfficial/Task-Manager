export type Lang = 'en' | 'bn';
export type ReminderKey =
  | 'ACCEPT_PENDING'
  | 'ACCEPT_ESCALATION'
  | 'DUE_SOON'
  | 'DUE_TODAY'
  | 'OVERDUE'
  | 'OVERDUE_GIVER'
  | 'STALE'
  | 'AWAITING_APPROVAL'
  | 'DAILY_DIGEST'
  | 'GIVER_DIGEST';

export type Params = Record<string, any>;

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const num = (lang: Lang, n: number | string) => (lang === 'bn' ? String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]) : String(n));

type Tpl = (p: Params, n: (x: number | string) => string) => string;

const EN: Record<ReminderKey, Tpl> = {
  ACCEPT_PENDING: (p) => `You have not accepted "${p.title}" yet (from ${p.from}).`,
  ACCEPT_ESCALATION: (p, n) => `${p.name} has not accepted "${p.title}" for over ${n(p.hours)} hours.`,
  DUE_SOON: (p, n) => `"${p.title}" is due within ${n(p.hours)} hours.`,
  DUE_TODAY: (p) => `"${p.title}" is due today.`,
  OVERDUE: (p, n) => `"${p.title}" is overdue by ${n(p.days)} day(s).`,
  OVERDUE_GIVER: (p, n) => `${p.name}'s task "${p.title}" is overdue by ${n(p.days)} day(s).`,
  STALE: (p, n) => `No update on "${p.title}" for ${n(p.days)} days. Please post a progress update.`,
  AWAITING_APPROVAL: (p) => `${p.name} submitted "${p.title}". It is waiting for your approval.`,
  DAILY_DIGEST: (p, n) => {
    const c = p.counts;
    const parts = [`${n(c.open)} open task(s)`];
    if (c.overdue) parts.push(`${n(c.overdue)} overdue`);
    if (c.dueToday) parts.push(`${n(c.dueToday)} due today`);
    if (c.needsAccept) parts.push(`${n(c.needsAccept)} waiting for you to accept`);
    return `Good morning. You have ${parts.join(', ')}.`;
  },
  GIVER_DIGEST: (p, n) => {
    const c = p.counts;
    return `Weekly summary of tasks you gave: ${n(c.open)} open, ${n(c.overdue)} overdue, ${n(c.awaitingApproval)} awaiting your approval, ${n(c.blocked)} blocked, ${n(c.notAccepted)} not accepted yet.`;
  },
};

const BN: Record<ReminderKey, Tpl> = {
  ACCEPT_PENDING: (p) => `"${p.title}" কাজটি আপনি এখনো গ্রহণ করেননি (${p.from}-এর কাছ থেকে)।`,
  ACCEPT_ESCALATION: (p, n) => `"${p.title}" কাজটি ${p.name} ${n(p.hours)} ঘণ্টার বেশি সময় ধরে গ্রহণ করেননি।`,
  DUE_SOON: (p, n) => `"${p.title}" কাজের শেষ তারিখ ${n(p.hours)} ঘণ্টার মধ্যে শেষ হচ্ছে।`,
  DUE_TODAY: (p) => `"${p.title}" কাজের শেষ তারিখ আজ।`,
  OVERDUE: (p, n) => `"${p.title}" কাজটি ${n(p.days)} দিন দেরি হয়ে গেছে।`,
  OVERDUE_GIVER: (p, n) => `${p.name}-এর "${p.title}" কাজটি ${n(p.days)} দিন দেরি হয়ে গেছে।`,
  STALE: (p, n) => `"${p.title}" কাজে ${n(p.days)} দিন ধরে কোনো আপডেট নেই। অনুগ্রহ করে অগ্রগতি জানান।`,
  AWAITING_APPROVAL: (p) => `${p.name} "${p.title}" কাজটি জমা দিয়েছেন। আপনার অনুমোদনের অপেক্ষায় আছে।`,
  DAILY_DIGEST: (p, n) => {
    const c = p.counts;
    const parts = [`${n(c.open)}টি চলমান কাজ`];
    if (c.overdue) parts.push(`${n(c.overdue)}টি দেরি`);
    if (c.dueToday) parts.push(`${n(c.dueToday)}টির শেষ তারিখ আজ`);
    if (c.needsAccept) parts.push(`${n(c.needsAccept)}টি গ্রহণের অপেক্ষায়`);
    return `শুভ সকাল। আপনার ${parts.join(', ')}।`;
  },
  GIVER_DIGEST: (p, n) => {
    const c = p.counts;
    return `আপনার দেওয়া কাজের সাপ্তাহিক সারাংশ: ${n(c.open)}টি চলমান, ${n(c.overdue)}টি দেরি, ${n(c.awaitingApproval)}টি অনুমোদনের অপেক্ষায়, ${n(c.blocked)}টি আটকে আছে, ${n(c.notAccepted)}টি এখনো গ্রহণ করা হয়নি।`;
  },
};

export function reminderText(lang: Lang, key: ReminderKey, params: Params): string {
  const n = (x: number | string) => num(lang, x);
  return (lang === 'bn' ? BN : EN)[key](params, n);
}

const SUBJECT: Record<Lang, Record<string, string>> = {
  en: { default: 'Task Manager reminder', DAILY_DIGEST: 'Task Manager: your day', GIVER_DIGEST: 'Task Manager: weekly summary' },
  bn: { default: 'টাস্ক ম্যানেজার: রিমাইন্ডার', DAILY_DIGEST: 'টাস্ক ম্যানেজার: আজকের কাজ', GIVER_DIGEST: 'টাস্ক ম্যানেজার: সাপ্তাহিক সারাংশ' },
};
export const reminderSubject = (lang: Lang, key: string) => SUBJECT[lang][key] ?? SUBJECT[lang].default;
