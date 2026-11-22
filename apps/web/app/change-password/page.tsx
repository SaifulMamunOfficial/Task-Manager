'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { Err } from '../../components/bits';

export default function ChangePassword() {
  const { me, logout } = useAuth();
  const { t, err } = useI18n();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const f = new FormData(e.currentTarget);
    const next = String(f.get('next'));
    if (next !== String(f.get('again'))) return setError(t('pw.mismatch'));
    if (next === String(f.get('current'))) return setError(t('pw.same'));
    setBusy(true);
    try {
      await post('/auth/change-password', { currentPassword: String(f.get('current')), newPassword: next });
      // The server signs the user out everywhere after a password change.
      sessionStorage.setItem('pwchanged', '1');
      await logout();
    } catch (e2: any) {
      setError(err(e2.message));
      setBusy(false);
    }
  }

  return (
    <form className="card stack" style={{ maxWidth: 420, margin: '8vh auto 0' }} onSubmit={submit}>
      <h1>{me?.mustChangePassword ? t('pw.titleForce') : t('pw.title')}</h1>
      {me?.mustChangePassword && <p className="muted" style={{ margin: 0 }}>{t('pw.temp')}</p>}
      <div><label>{t('pw.current')}</label><input name="current" type="password" autoComplete="current-password" required /></div>
      <div><label>{t('pw.next')}</label><input name="next" type="password" minLength={8} autoComplete="new-password" required /></div>
      <div><label>{t('pw.again')}</label><input name="again" type="password" minLength={8} autoComplete="new-password" required /></div>
      <Err msg={error} />
      <div className="row">
        <button className="primary" disabled={busy}>{busy ? t('c.saving') : t('pw.btn')}</button>
        {!me?.mustChangePassword && <button type="button" onClick={() => router.back()}>{t('c.cancel')}</button>}
      </div>
    </form>
  );
}
