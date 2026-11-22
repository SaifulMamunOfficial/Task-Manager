'use client';
import { useCallback, useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { Icon } from '../components/icons';

export type Theme = 'system' | 'light' | 'dark';

/** Runs before the page paints (see layout.tsx) so there is no flash of the wrong theme. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('tm:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;

function apply(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tm:theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') setThemeState(saved);
    } catch {}
  }, []);

  // In "Auto" the page follows the device when it switches between light and dark.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => apply('system');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('tm:theme', t);
    } catch {}
    apply(t);
  }, []);

  return { theme, setTheme };
}

/** Auto / Light / Dark switch. */
export function ThemeSwitch() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <div className="seg langsw" role="radiogroup" aria-label={t('th.label')}>
      {(['system', 'light', 'dark'] as const).map((v) => (
        <button key={v} role="radio" aria-checked={theme === v} className={theme === v ? 'on' : ''} onClick={() => setTheme(v)} style={{ height: 28, padding: '0 10px', fontSize: 12.5 }}>
          {t(`th.${v}`)}
        </button>
      ))}
    </div>
  );
}

/** One-tap sun / moon button, always visible. Switches between Light and Dark (Auto stays available in the account menu). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { t } = useI18n();
  const { setTheme } = useTheme();
  const [dark, setDark] = useState(false);

  // Follow the real theme on the page (it may come from "Auto" or the device).
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme === 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);

  return (
    <button type="button" className={`theme-btn ${className}`} aria-label={t(dark ? 'th.toLight' : 'th.toDark')} title={t(dark ? 'th.toLight' : 'th.toDark')} onClick={() => setTheme(dark ? 'light' : 'dark')}>
      <Icon name={dark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
