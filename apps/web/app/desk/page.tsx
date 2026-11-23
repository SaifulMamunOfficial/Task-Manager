'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { WORKING, isOverdue } from '../../lib/ui';
import { Empty, Err, GroupHead, PageHead, Skeleton, StatCard, TaskRow } from '../../components/bits';
import { Icon } from '../../components/icons';

const STATUS_COLOR: Record<string, string> = {
  PENDING_ACCEPTANCE: '#f59e0b', ACCEPTED: '#60a5fa', IN_PROGRESS: '#4f46e5', BLOCKED: '#ef4444', SUBMITTED: '#8b5cf6',
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export default function Dashboard() {
  const { me, canGive } = useAuth();
  const { t, n, date, weekday, statusLabel, notifText, timeAgo, err, personName } = useI18n();
  const [mine, setMine] = useState<any[] | null>(null);
  const [given, setGiven] = useState<any[] | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api('/tasks/mine?bucket=open'), api('/tasks/given?bucket=open'), api('/notifications')])
      .then(([m, g, nn]) => {
        setMine(m);
        setGiven(g);
        setNotes(nn.slice(0, 6));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const d = useMemo(() => {
    const sod = startOfDay(new Date());
    const eod = new Date(sod.getTime() + 86400_000);
    const week = new Date(sod.getTime() + 8 * 86400_000);
    const open = mine ?? [];
    const respond = open.filter((a) => a.status === 'PENDING_ACCEPTANCE');
    const rest = open.filter((a) => WORKING.includes(a.status) && a.status !== 'PENDING_ACCEPTANCE');
    const overdue = rest.filter((a) => isOverdue(a.task.dueDate, a.status));
    const today = rest.filter((a) => a.task.dueDate && !isOverdue(a.task.dueDate, a.status) && new Date(a.task.dueDate) < eod);
    const soon = rest.filter((a) => a.task.dueDate && new Date(a.task.dueDate) >= eod && new Date(a.task.dueDate) < week);
    const shown = new Set([...respond, ...overdue, ...today, ...soon].map((a) => a.id));
    const other = open.filter((a) => !shown.has(a.id) && a.status !== 'SUBMITTED');
    const approve = (given ?? []).filter((a) => a.status === 'SUBMITTED');
    const days = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(sod.getTime() + i * 86400_000);
      const next = new Date(day.getTime() + 86400_000);
      return { day, n: rest.concat(respond).filter((a) => a.task.dueDate && new Date(a.task.dueDate) >= day && new Date(a.task.dueDate) < next).length };
    });
    const byStatus = Object.keys(STATUS_COLOR).map((s) => ({ s, n: open.filter((a) => a.status === s).length })).filter((x) => x.n > 0);
    return { open, respond, approve, overdue, today, soon, other, days, byStatus, maxDay: Math.max(1, ...days.map((x) => x.n)) };
  }, [mine, given]);

  const loading = mine === null || given === null;
  const nothing = !loading && d.respond.length + d.approve.length + d.overdue.length + d.today.length + d.soon.length === 0;
  const first = (me ? personName(me) : '').split(' ')[0];
  const h = new Date().getHours();
  const greeting = t(h < 12 ? 'dk.morning' : h < 17 ? 'dk.afternoon' : 'dk.evening', { name: first });

  return (
    <>
      <PageHead
        title={greeting}
        subtitle={date(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={canGive ? <Link href="/new" className="btn primary"><Icon name="plus" /> {t('nav.newTask')}</Link> : undefined}
      />
      <Err msg={error ? err(error) : ''} />

      <div className="stats">
        <StatCard label={t('dk.open')} value={loading ? '–' : n(d.open.length)} icon="tasks" tone="blue" href="/tasks" />
        <StatCard label={t('dk.overdue')} value={loading ? '–' : n(d.overdue.length)} icon="alert" tone="red" href="/tasks?f=overdue" />
        <StatCard label={t('dk.toAccept')} value={loading ? '–' : n(d.respond.length)} icon="inbox" tone="amber" href="/tasks" />
        <StatCard label={t('dk.toApprove')} value={loading ? '–' : n(d.approve.length)} icon="check" tone="purple" href="/given" />
      </div>

      <div className="cols">
        <div>
          {loading && <Skeleton rows={5} />}
          {nothing && <Empty title={t('dk.caughtUp', { name: first })}>{t('dk.caughtUpText')}</Empty>}

          {d.respond.length > 0 && (
            <div className="list">
              <GroupHead title={t('dk.gAccept')} count={d.respond.length} />
              {d.respond.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.approve.length > 0 && (
            <div className="list">
              <GroupHead title={t('dk.gApprove')} count={d.approve.length} />
              {d.approve.map((a) => <TaskRow key={a.id} a={a} who="given" onChanged={load} />)}
            </div>
          )}
          {d.overdue.length > 0 && (
            <div className="list">
              <GroupHead title={t('dk.gOverdue')} count={d.overdue.length} tone="late" />
              {d.overdue.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.today.length > 0 && (
            <div className="list">
              <GroupHead title={t('dk.gToday')} count={d.today.length} />
              {d.today.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.soon.length > 0 && (
            <div className="list">
              <GroupHead title={t('dk.gSoon')} count={d.soon.length} />
              {d.soon.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.other.length > 0 && (
            <p className="muted">
              {t('dk.more', { n: d.other.length })} <Link href="/tasks">{t('dk.seeAll')}</Link>
            </p>
          )}
        </div>

        <aside>
          <div className="panel">
            <div className="panel-h">{t('dk.byStatus')}</div>
            <div className="panel-b">
              {d.byStatus.length === 0 ? (
                <div className="muted">{loading ? t('c.loading') : t('dk.noOpen')}</div>
              ) : (
                <>
                  <div className="stackbar" role="img" aria-label={d.byStatus.map((x) => `${statusLabel(x.s)}: ${n(x.n)}`).join(', ')}>
                    {d.byStatus.map((x) => <div key={x.s} style={{ flex: x.n, background: STATUS_COLOR[x.s] }} />)}
                  </div>
                  <div className="legend">
                    {d.byStatus.map((x) => (
                      <div key={x.s} className="legend-row">
                        <span className="dot" style={{ background: STATUS_COLOR[x.s] }} />
                        {statusLabel(x.s)}
                        <b>{n(x.n)}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">{t('dk.next7')}</div>
            <div className="panel-b">
              <div className="bars" role="img" aria-label={d.days.map((x) => t('dk.chartDay', { day: weekday(x.day, 'long'), n: x.n })).join(', ')}>
                {d.days.map((x, i) => (
                  <div key={i} className="col">
                    <span className="n">{n(x.n)}</span>
                    <div className={`b ${i === 0 ? 'today' : ''} ${x.n === 0 ? 'zero' : ''}`} style={{ height: `${Math.max(3, (x.n / d.maxDay) * 80)}px` }} />
                    <span className="d">{i === 0 ? t('dk.today') : weekday(x.day, 'short')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">
              {t('dk.recent')}
              <Link href="/notifications" className="section-link">{t('dk.seeAllLink')}</Link>
            </div>
            <div className="panel-b">
              {notes.length === 0 && <span className="muted">{t('dk.nothing')}</span>}
              <div className="feed">
                {notes.map((x) => (
                  <div key={x.id} className={`feed-item ${x.readAt ? '' : 'new'}`}>
                    <i />
                    <div>
                      {notifText(x)}
                      <div className="muted" style={{ fontSize: 12 }}>{timeAgo(x.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
