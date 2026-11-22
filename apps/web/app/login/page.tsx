'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { LangSwitch, useI18n } from '../../lib/i18n';
import { Err } from '../../components/bits';
import { Icon } from '../../components/icons';

export default function Login() {
  const { login } = useAuth();
  const { t, err } = useI18n();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (sessionStorage.getItem('pwchanged')) {
      sessionStorage.removeItem('pwchanged');
      setChanged(true);
    }
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await login(String(f.get('email')), String(f.get('password')));
    } catch (e2: any) {
      setError(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth" style={{ position: 'relative' }}>
      <div className="auth-lang"><LangSwitch /></div>
      <section className="auth-brand">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><Icon name="check" size={18} /></span> {t('app.name')}
        </div>
        <div>
          <h2>{t('login.tag')}</h2>
          <ul>
            {['login.p1', 'login.p2', 'login.p3'].map((k) => (
              <li key={k}><span className="tick"><Icon name="check" size={13} /></span>{t(k)}</li>
            ))}
          </ul>
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>{t('login.internal')}</div>
      </section>
      <main className="auth-form">
        <form className="auth-card stack" style={{ gap: 16 }} onSubmit={submit}>
          <div>
            <h1>{t('login.title')}</h1>
            <p className="muted" style={{ marginTop: 4 }}>{t('login.sub')}</p>
          </div>
          {changed && !error && <div className="ok" style={{ margin: 0 }}>{t('login.changed')}</div>}
          <div>
            <label htmlFor="email">{t('login.email')}</label>
            <input id="email" name="email" type="email" autoComplete="username" autoFocus required />
          </div>
          <div>
            <label htmlFor="password">{t('login.password')}</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Err msg={error ? err(error) : ''} />
          <button className="primary lg" disabled={busy}>{busy ? t('login.busy') : t('login.btn')}</button>
          <p className="muted">{t('login.forgot')}</p>
        </form>
      </main>
    </div>
  );
}
