'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar } from './bits';
import { Icon, type IconName } from './icons';

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; count?: 'mine' | 'approve' | 'unread' };

const USER_NAV: NavItem[] = [
  { href: '/desk', label: 'Today', icon: 'today' },
  { href: '/tasks', label: 'My tasks', icon: 'tasks', count: 'mine' },
  { href: '/given', label: 'Assigned by me', icon: 'send', count: 'approve' },
  { href: '/notifications', label: 'Notifications', icon: 'bell', count: 'unread' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', icon: 'dashboard', exact: true },
  { href: '/admin/users', label: 'Users', icon: 'users' },
  { href: '/admin/org', label: 'Organization', icon: 'building' },
  { href: '/admin/rules', label: 'Rules & settings', icon: 'sliders' },
  { href: '/admin/audit', label: 'Audit log', icon: 'history' },
];

/** App frame: light sidebar on desktop, slide-over drawer on phones. Also guards signed-out and temp-password users. */
export default function Shell({ children }: { children: ReactNode }) {
  const { me, ready, logout, canGive } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState({ mine: 0, approve: 0, unread: 0 });
  const [open, setOpen] = useState(false);

  const isLogin = path === '/login';

  useEffect(() => {
    if (!ready) return;
    if (!me && !isLogin) router.replace('/login');
    // Temporary passwords (new users, resets, first admin login) must be replaced before anything else.
    if (me?.mustChangePassword && path !== '/change-password') router.replace('/change-password');
    else if (me && isLogin) router.replace(me.isAdmin ? '/admin' : '/desk');
  }, [ready, me, isLogin, path, router]);

  useEffect(() => setOpen(false), [path]);

  // Sidebar numbers: refreshed on navigation, every minute, and after any task action.
  useEffect(() => {
    if (!me || me.isAdmin || me.mustChangePassword) return;
    const load = () =>
      Promise.all([api('/tasks/mine?bucket=open'), api('/tasks/given?bucket=open'), api('/notifications?unread=true')])
        .then(([m, g, n]) => setCounts({ mine: m.length, approve: g.filter((a: any) => a.status === 'SUBMITTED').length, unread: n.length }))
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    window.addEventListener('tm:refresh', load);
    return () => {
      clearInterval(t);
      window.removeEventListener('tm:refresh', load);
    };
  }, [me, path]);

  // "N" opens the new-task form from anywhere (not while typing).
  useEffect(() => {
    if (!me || me.isAdmin || !canGive) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable || document.querySelector('.modal')) return;
      e.preventDefault();
      router.push('/new');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [me, router, canGive]);

  if (!ready) return null;
  if (isLogin || !me) return <>{children}</>;

  const nav = me.isAdmin ? ADMIN_NAV : USER_NAV;
  const locked = me.mustChangePassword;
  const role = me.isAdmin ? 'Administrator' : me.positions.map((p) => p.position.title).join(', ') || 'No position yet';
  const active = (n: NavItem) => (n.exact ? path === n.href : path.startsWith(n.href));

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark"><Icon name="check" size={18} /></span>
          Task Manager
        </div>
        {!locked && !me.isAdmin && canGive && (
          <Link href="/new" className="btn primary side-new">
            <Icon name="plus" /> New task <kbd>N</kbd>
          </Link>
        )}
        {!locked && (
          <nav>
            <div className="nav-label">{me.isAdmin ? "Administration" : "Workspace"}</div>
            {nav.map((n) => {
              const c = n.count ? counts[n.count] : 0;
              return (
                <Link key={n.href} href={n.href} className={`nav-item ${active(n) ? 'active' : ''}`} aria-current={active(n) ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  {n.label}
                  {c > 0 && <span className={`nav-count ${n.count === 'unread' || n.count === 'approve' ? 'alert' : ''}`}>{c}</span>}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="sidebar-foot">
          <div className="me">
            <Avatar name={me.name} large />
            <div style={{ minWidth: 0 }}>
              <div className="me-name">{me.name}</div>
              <div className="me-role">{role}</div>
            </div>
          </div>
          {!locked && (
            <Link href="/change-password" className="side-btn">
              <Icon name="key" /> Change password
            </Link>
          )}
          <button className="side-btn" onClick={() => logout()}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className="content">
        <div className="mobilebar">
          <button className="ghost" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)} style={{ padding: '0 8px' }}>
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
          <strong>Task Manager</strong>
          {!locked && !me.isAdmin && canGive ? (
            <Link href="/new" className="btn primary" aria-label="New task" style={{ padding: '0 10px' }}>
              <Icon name="plus" size={18} />
            </Link>
          ) : (
            <span style={{ width: 38 }} />
          )}
        </div>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
