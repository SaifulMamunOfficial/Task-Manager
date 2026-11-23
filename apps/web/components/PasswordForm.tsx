'use client';
import { useState } from 'react';
import { post } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Err } from './bits';

/** Change the password. The server signs the person out everywhere afterwards, so they sign in again. */
export default function PasswordForm({ onCancel }: { onCancel?: () => void }) {
  const { logout } = useAuth();
  const { t, err } = useI18n();
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
      sessionStorage.setItem('pwchanged', '1');
      await logout();
    } catch (e2: any) {
      setError(err(e2.message));
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div><label>{t('pw.current')}</label><input name="current" type="password" autoComplete="current-password" required /></div>
      <div className="pf-grid">
        <div><label>{t('pw.next')}</label><input name="next" type="password" minLength={8} autoComplete="new-password" required /></div>
        <div><label>{t('pw.again')}</label><input name="again" type="password" minLength={8} autoComplete="new-password" required /></div>
      </div>
      <small className="muted">{t('pf.pwRule')}</small>
      <Err msg={error} />
      <div className="row">
        <button className="primary" disabled={busy}>{busy ? t('c.saving') : t('pw.btn')}</button>
        {onCancel && <button type="button" onClick={onCancel}>{t('c.cancel')}</button>}
      </div>
    </form>
  );
}
