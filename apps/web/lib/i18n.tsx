'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { post } from './api';
import { useAuth } from './auth';
import { DICT } from '../locales';
import { translateError } from '../locales/errors';

export type Lang = 'bn' | 'en';
const IDX: Record<Lang, number> = { en: 0, bn: 1 };
export const DEFAULT_LANG: Lang = 'bn';

type Params = Record<string, string | number | null | undefined>;
type TitleLike = { title: string; titleBn?: string | null };

function useBuild(lang: Lang) {
  return useMemo(() => {
    const locale = lang === 'bn' ? 'bn-BD' : 'en-GB';
    const nf = new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { maximumFractionDigits: 1 });
    const n = (x: number) => nf.format(x);

    /** Translate a key. Numbers in params are written with the language's digits; strings (names, titles) are left alone. */
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

    const date = (iso: string | Date, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Date(iso).toLocaleDateString(locale, o);
    const dateTime = (iso?: string | null) =>
      iso ? new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : t('due.none');
    const time = (iso: string | Date) => new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
    const weekday = (d: Date, style: 'long' | 'short' | 'narrow' = 'short') => d.toLocaleDateString(locale, { weekday: style });

    const statusLabel = (s: string) => t(`status.${s}`);
    const posTitle = (p: TitleLike) => (lang === 'bn' && p.titleBn ? p.titleBn : p.title);

    /** Human deadline: "3 days overdue", "Today, 5:00 PM", "Tomorrow", "Wed 26 Nov". */
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

    /** Text for a notification, built from its type and data in the reader's language. */
    const notifText = (x: { type: string; payload: any }): string => {
      const p = x.payload ?? {};
      if (x.type.startsWith('REMINDER_') && p.key) {
        if (p.key === 'DAILY_DIGEST' || p.key === 'GIVER_DIGEST') {
          const c = p.params?.counts ?? p.counts ?? {};
          const parts =
            p.key === 'DAILY_DIGEST'
              ? [t('rem.d.open', { n: c.open ?? 0 }), c.overdue && t('rem.d.overdue', { n: c.overdue }), c.dueToday && t('rem.d.today', { n: c.dueToday }), c.needsAccept && t('rem.d.accept', { n: c.needsAccept })]
              : [t('rem.g.open', { n: c.open ?? 0 }), t('rem.g.overdue', { n: c.overdue ?? 0 }), t('rem.g.approve', { n: c.awaitingApproval ?? 0 }), t('rem.g.blocked', { n: c.blocked ?? 0 }), t('rem.g.accept', { n: c.notAccepted ?? 0 })];
          return t(`rem.${p.key}`, { parts: parts.filter(Boolean).join(lang === 'bn' ? ', ' : ', ') });
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

    return { lang, locale, n, t, has, date, dateTime, time, weekday, statusLabel, posTitle, dueInfo, timeAgo, fmtSize, notifText, err };
  }, [lang]);
}

type Ctx = ReturnType<typeof useBuild> & { setLang: (l: Lang) => Promise<void> };
const I18nCtx = createContext<Ctx>(null as unknown as Ctx);
export const useI18n = () => useContext(I18nCtx);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { me, reload } = useAuth();
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  // Signed-in users get their saved language; visitors get the last one they chose on this device.
  useEffect(() => {
    if (me?.language === 'bn' || me?.language === 'en') {
      setLangState(me.language);
      return;
    }
    try {
      const saved = localStorage.getItem('lang');
      if (saved === 'bn' || saved === 'en') setLangState(saved);
    } catch {}
  }, [me?.language]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback(
    async (l: Lang) => {
      setLangState(l);
      try {
        localStorage.setItem('lang', l);
      } catch {}
      if (me) {
        try {
          await post('/auth/language', { language: l });
          await reload();
        } catch {}
      }
    },
    [me, reload],
  );

  const built = useBuild(lang);
  const value = useMemo(() => ({ ...built, setLang }), [built, setLang]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

/** Small English / বাংলা switch. */
export function LangSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang } = useI18n();
  return (
    <div className="seg langsw" role="radiogroup" aria-label="Language">
      {(['bn', 'en'] as const).map((l) => (
        <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => lang !== l && setLang(l)} style={compact ? { height: 28, padding: '0 10px', fontSize: 12.5 } : undefined}>
          {l === 'bn' ? 'বাংলা' : 'English'}
        </button>
      ))}
    </div>
  );
}

/** One-tap language button: shows the language you would switch TO ("EN" while in Bangla, "বাং" while in English). */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const next = lang === 'bn' ? 'en' : 'bn';
  return (
    <button type="button" className={`theme-btn lang-btn ${className}`} aria-label={t('c.langToggle')} title={t('c.langToggle')} onClick={() => setLang(next)}>
      {next === 'en' ? 'EN' : 'বাং'}
    </button>
  );
}
