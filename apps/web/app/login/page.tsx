'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Err } from '../../components/bits';
import { Icon } from '../../components/icons';

const POINTS = [
  'Give a task once and follow it all the way down the chain',
  'Reminders so nothing is forgotten, even when many tasks are given at once',
  'Every hand-over is accepted, tracked and approved',
];

export default function Login() {
  const { login } = useAuth();
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
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-brand">
        <div className="brand" style={{ padding: 0 }}>
          <span className="brand-mark"><Icon name="check" size={18} /></span> Task Manager
        </div>
        <div>
          <h2>Know who is doing what, and never lose a task.</h2>
          <ul>
            {POINTS.map((p) => (
              <li key={p}><span className="tick"><Icon name="check" size={13} /></span>{p}</li>
            ))}
          </ul>
        </div>
        <div style={{ fontSize: 13, opacity: 0.7 }}>Internal use only</div>
      </section>
      <main className="auth-form">
        <form className="auth-card stack" style={{ gap: 16 }} onSubmit={submit}>
          <div>
            <h1>Sign in</h1>
            <p className="muted" style={{ marginTop: 4 }}>Use the email and password given to you by your administrator.</p>
          </div>
          {changed && !error && <div className="ok" style={{ margin: 0 }}>Password changed. Sign in with your new password.</div>}
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" autoFocus required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <Err msg={error} />
          <button className="primary lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p className="muted">Forgot your password? Ask your administrator to reset it.</p>
        </form>
      </main>
    </div>
  );
}
