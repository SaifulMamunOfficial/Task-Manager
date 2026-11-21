'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { post } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Err } from '../../components/bits';

export default function ChangePassword() {
  const { me, logout } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const f = new FormData(e.currentTarget);
    const next = String(f.get('next'));
    if (next !== String(f.get('again'))) return setError('The new passwords do not match.');
    if (next === String(f.get('current'))) return setError('Choose a password different from the current one.');
    setBusy(true);
    try {
      await post('/auth/change-password', { currentPassword: String(f.get('current')), newPassword: next });
      // The server signs the user out everywhere after a password change.
      // Flag survives the redirect to /login that the page shell performs once we are signed out.
      sessionStorage.setItem('pwchanged', '1');
      await logout();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card stack" style={{ maxWidth: 420, margin: '8vh auto 0' }} onSubmit={submit}>
      <h1>{me?.mustChangePassword ? 'Choose your own password' : 'Change password'}</h1>
      {me?.mustChangePassword && <p className="muted" style={{ margin: 0 }}>You are using a temporary password. Set a new one to continue.</p>}
      <div><label>Current password</label><input name="current" type="password" autoComplete="current-password" required /></div>
      <div><label>New password (at least 8 characters)</label><input name="next" type="password" minLength={8} autoComplete="new-password" required /></div>
      <div><label>New password again</label><input name="again" type="password" minLength={8} autoComplete="new-password" required /></div>
      <Err msg={error} />
      <div className="row">
        <button className="primary" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
        {!me?.mustChangePassword && <button type="button" onClick={() => router.back()}>Cancel</button>}
      </div>
    </form>
  );
}
