import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { DICT } from './locales';
import { translateError } from './locales/errors';
import { post } from './api';
import { useAuth } from './auth';
import type { Lang } from './types';

const IDX: Record<Lang, number> = { en: 0, bn: 1 };
export const DEFAULT_LANG: Lang = 'bn';

type Params = Record<string, string | number | null | undefined>;
type TitleLike = { title: string; titleBn?: string | null };

function build(lang: Lang) {
  const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
  let nf: Intl.NumberFormat;
  try {
    nf = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { maximumFractionDigits: 1 });
  } catch {
    nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
  }
  const n = (x: number) => nf.format(x);

  const t = (key: string, params?: Params): string => {
    const entry = DICT[key];
    let s = entry ? entry[IDX[lang]] || entry[0] : key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, (_, k) => {
        const v = params[k];
        return v === undefined || v === null ? '' : typeof v === 'number' ? n(v) : String(v);
      });
    }
    return s;
  };
  const has = (key: string) => key in DICT;

  const safe = <T,>(f: () => T, fallback: T) => {
    try {
      return f();
    } catch {
      return fallback;
    }
  };
  const date = (iso: string | Date, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => safe(() => new Date(iso).toLocaleDateString(locale, o), String(iso));
  const time = (iso: string | Date) => safe(() => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' }), '');
  const dateTime = (iso?: string | null) => (iso ? safe(() => new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }), iso) : t('due.none'));

  const statusLabel = (s: string) => t(`status.${s}`);
  const posTitle = (p: TitleLike) => (lang === 'bn' && p.titleBn ? p.titleBn : p.title);
  const unitName = (u: { name: string; nameBn?: string | null }) => (lang === 'bn' && u.nameBn ? u.nameBn : u.name);

  const dueInfo = (due?: string | null, status?: string): { text: string; tone: 'late' | 'soon' | 'ok' | 'none' } => {
    if (!due) return { text: t('due.none'), tone: 'none' };
    const d = new Date(due);
    const now = new Date();
    if (['APPROVED', 'CANCELLED', 'DECLINED'].includes(status ?? '')) return { text: date(d), tone: 'ok' };
    if (status !== 'SUBMITTED' && d < now) {
      const h = Math.floor((now.getTime() - d.getTime()) / 3600_000);
      return { text: h < 24 ? t('due.overdueHours', { n: Math.max(h, 1) }) : t('due.overdueDays', { n: Math.floor(h / 24) }), tone: 'late' };
    }
    const startToday = new Date(now);
    startToday.setHours(0, 0, 0, 0);
    const startDue = new Date(d);
    startDue.setHours(0, 0, 0, 0);
    const days = Math.round((startDue.getTime() - startToday.getTime()) / 86400_000);
    if (days === 0) return { text: t('due.today', { time: time(d) }), tone: 'soon' };
    if (days === 1) return { text: t('due.tomorrow'), tone: 'soon' };
    if (days > 1 && days < 7) return { text: date(d, { weekday: 'short', day: 'numeric', month: 'short' }), tone: 'ok' };
    return { text: date(d), tone: 'ok' };
  };

  const timeAgo = (iso: string): string => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return t('ago.now');
    if (s < 3600) return t('ago.m', { n: Math.floor(s / 60) });
    if (s < 86400) return t('ago.h', { n: Math.floor(s / 3600) });
    if (s < 7 * 86400) return t('ago.d', { n: Math.floor(s / 86400) });
    return date(iso);
  };

  const fmtSize = (b: number) => (b < 1024 ? `${n(b)} B` : b < 1048576 ? `${n(b / 1024)} KB` : `${n(b / 1048576)} MB`);

  const notifText = (x: { type: string; payload: any }): string => {
    const p = x.payload ?? {};
    if (x.type.startsWith('REMINDER_') && p.key) {
      if (p.key === 'DAILY_DIGEST' || p.key === 'GIVER_DIGEST') {
        const c = p.params?.counts ?? p.counts ?? {};
        const parts =
          p.key === 'DAILY_DIGEST'
            ? [t('rem.d.open', { n: c.open ?? 0 }), c.overdue && t('rem.d.overdue', { n: c.overdue }), c.dueToday && t('rem.d.today', { n: c.dueToday }), c.needsAccept && t('rem.d.accept', { n: c.needsAccept })]
            : [t('rem.g.open', { n: c.open ?? 0 }), t('rem.g.overdue', { n: c.overdue ?? 0 }), t('rem.g.approve', { n: c.awaitingApproval ?? 0 }), t('rem.g.blocked', { n: c.blocked ?? 0 }), t('rem.g.accept', { n: c.notAccepted ?? 0 })];
        return t(`rem.${p.key}`, { parts: parts.filter(Boolean).join(', ') });
      }
      if (has(`rem.${p.key}`)) return t(`rem.${p.key}`, p.params);
    }
    if (p.message) return p.message;
    const title = p.title ?? '';
    switch (x.type) {
      case 'TASK_ASSIGNED':
        return t('notif.assigned', { title });
      case 'STATUS_CHANGED':
        return t('notif.status', { title, status: statusLabel(p.to) });
      case 'UPDATE_POSTED':
        return p.progressPercent != null ? t('notif.progress', { title, n: p.progressPercent }) : t('notif.comment', { title });
      case 'ATTACHMENT_ADDED':
        return t('notif.files', { title, count: p.count });
      default:
        return x.type;
    }
  };

  const err = (m: string) => translateError(m, lang);
  return { lang, locale, n, t, has, date, dateTime, time, statusLabel, posTitle, unitName, dueInfo, timeAgo, fmtSize, notifText, err };
}

type Ctx = ReturnType<typeof build> & { setLang: (l: Lang) => Promise<void> };
const I18nCtx = createContext<Ctx>(null as unknown as Ctx);
export const useI18n = () => useContext(I18nCtx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { me, reload } = useAuth();
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Signed-in people get their saved language; before sign-in we use the last one chosen on this phone.
  useEffect(() => {
    if (me?.language === 'bn' || me?.language === 'en') {
      setLangState(me.language);
      return;
    }
    SecureStore.getItemAsync('lang')
      .then((s) => (s === 'bn' || s === 'en') && setLangState(s))
      .catch(() => {});
  }, [me?.language]);

  const setLang = useCallback(
    async (l: Lang) => {
      setLangState(l);
      SecureStore.setItemAsync('lang', l).catch(() => {});
      if (me) {
        try {
          await post('/auth/language', { language: l });
          await reload();
        } catch {}
      }
    },
    [me, reload],
  );

  const built = useMemo(() => build(lang), [lang]);
  const value = useMemo(() => ({ ...built, setLang }), [built, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}
