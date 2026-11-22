'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { LangSwitch, useI18n } from '../lib/i18n';
import { Avatar } from './bits';
import { Icon, type IconName } from './icons';

type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; count?: 'mine' | 'approve' | 'unread' };

const USER_NAV: NavItem[] = [
  { href: '/desk', label: 'nav.today', icon: 'today' },
  { href: '/tasks', label: 'nav.myTasks', icon: 'tasks', count: 'mine' },
  { href: '/given', label: 'nav.given', icon: 'send', count: 'approve' },
  { href: '/notifications', label: 'nav.notifications', icon: 'bell', count: 'unread' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin', label: 'nav.overview', icon: 'dashboard', exact: true },
  { href: '/admin/users', label: 'nav.users', icon: 'users' },
  { href: '/admin/org', label: 'nav.organization', icon: 'building' },
  { href: '/admin/rules', label: 'nav.rules', icon: 'sliders' },
  { href: '/admin/notifications', label: 'nav.notifSettings', icon: 'bell' },
  { href: '/admin/audit', label: 'nav.audit', icon: 'history' },
];

/** App frame: dark sidebar on desktop, slide-over drawer on phones. Also guards signed-out and temp-password users. */
export default function Shell({ children }: { children: ReactNode }) {
  const { me, ready, logout, canGive } = useAuth();
  const { t, n, posTitle } = useI18n();
  const path = usePathname();
  const router = useRouter();
  const [counts, setCounts] = useState({ mine: 0, approve: 0, unread: 0 });
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<string | null>(null);

  useEffect(() => {
    const on = (e: Event) => setSection((e as CustomEvent<string>).detail);
    window.addEventListener('tm:section', on);
    return () => window.removeEventListener('tm:section', on);
  }, []);
  useEffect(() => setSection(null), [path]);

  const isLogin = path === '/login';

  useEffect(() => {
    if (!ready) return;
    if (!me && !isLogin) router.replace('/login');
    // Temporary passwords (new users, resets, first admin login) must be replaced before anything else.
    if (me?.mustChangePassword && path !== '/change-password') router.replace('/change-password');
    else if (me && isLogin) router.replace(me.isAdmin ? '/admin' : '/desk');
  }, [ready, me, isLogin, path, router]);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [path]);

  // The account menu closes on outside click and Escape.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Sidebar numbers: refreshed on navigation, every minute, and after any task action.
  useEffect(() => {
    if (!me || me.isAdmin || me.mustChangePassword) return;
    const load = () =>
      Promise.all([api('/tasks/mine?bucket=open'), api('/tasks/given?bucket=open'), api('/notifications?unread=true')])
        .then(([m, g, nn]) => setCounts({ mine: m.length, approve: g.filter((a: any) => a.status === 'SUBMITTED').length, unread: nn.length }))
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    window.addEventListener('tm:refresh', load);
    return () => {
      clearInterval(timer);
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
  const role = me.isAdmin ? t('nav.admin') : me.positions.map((p) => posTitle(p.position)).join(', ') || t('nav.noPosition');
  // A task page highlights the section the task belongs to, not always "My tasks".
  const inTask = /^\/tasks\/[^/]+/.test(path);
  const active = (item: NavItem) => (inTask && section ? item.href === section : item.exact ? path === item.href : path.startsWith(item.href));

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label={t('nav.main')}>
        <div className="brand">
          <span className="brand-mark"><Icon name="check" size={18} /></span>
          {t('app.name')}
        </div>
        {!locked && !me.isAdmin && canGive && (
          <Link href="/new" className="btn primary side-new">
            <Icon name="plus" /> {t('nav.newTask')} <kbd>N</kbd>
          </Link>
        )}
        {!locked && (
          <nav>
            <div className="nav-label">{me.isAdmin ? t('nav.administration') : t('nav.workspace')}</div>
            {nav.map((item) => {
              const c = item.count ? counts[item.count] : 0;
              return (
                <Link key={item.href} href={item.href} className={`nav-item ${active(item) ? 'active' : ''}`} aria-current={active(item) ? 'page' : undefined}>
                  <Icon name={item.icon} />
                  {t(item.label)}
                  {c > 0 && <span className={`nav-count ${item.count === 'unread' || item.count === 'approve' ? 'alert' : ''}`}>{n(c)}</span>}
                </Link>
              );
            })}
          </nav>
        )}
        <div className="sidebar-foot" ref={menuRef}>
          {menu && (
            <div className="acct-menu" role="menu" aria-label={me.name}>
              <div className="acct-lang">
                <span>{t('c.langLabel')}</span>
                <LangSwitch compact />
              </div>
              {!locked && (
                <Link href="/account" className="acct-item" role="menuitem">
                  <Icon name="bell" /> {t('nav.account')}
                </Link>
              )}
              {!locked && (
                <Link href="/change-password" className="acct-item" role="menuitem">
                  <Icon name="key" /> {t('nav.changePassword')}
                </Link>
              )}
              <button className="acct-item" role="menuitem" onClick={() => logout()}>
                <Icon name="logout" /> {t('nav.signOut')}
              </button>
            </div>
          )}
          <button className="acct-trigger" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <Avatar name={me.name} large />
            <span style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <span className="me-name" style={{ display: "block" }}>{me.name}</span>
              <span className="me-role" style={{ display: "block" }}>{role}</span>
            </span>
            <span className={`ch ${menu ? "up" : ""}`}><Icon name="chevron" size={16} /></span>
          </button>
        </div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className="content">
        <div className="mobilebar">
          <button className="ghost" aria-label={open ? t('nav.menuClose') : t('nav.menuOpen')} onClick={() => setOpen(!open)} style={{ padding: '0 8px' }}>
            <Icon name={open ? 'close' : 'menu'} size={20} />
          </button>
          <strong>{t('app.name')}</strong>
          {!locked && !me.isAdmin && canGive ? (
            <Link href="/new" className="btn primary" aria-label={t('nav.newTask')} style={{ padding: '0 10px' }}>
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
