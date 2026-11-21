'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { STATUS_LABEL, WORKING, isOverdue, notificationText, timeAgo } from '../../lib/ui';
import { Empty, Err, GroupHead, PageHead, Skeleton, StatCard, TaskRow } from '../../components/bits';
import { Icon } from '../../components/icons';

const STATUS_COLOR: Record<string, string> = {
  PENDING_ACCEPTANCE: '#f59e0b', ACCEPTED: '#60a5fa', IN_PROGRESS: '#4f46e5', BLOCKED: '#ef4444', SUBMITTED: '#8b5cf6',
};
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export default function Dashboard() {
  const { me, canGive } = useAuth();
  const [mine, setMine] = useState<any[] | null>(null);
  const [given, setGiven] = useState<any[] | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([api('/tasks/mine?bucket=open'), api('/tasks/given?bucket=open'), api('/notifications')])
      .then(([m, g, n]) => {
        setMine(m);
        setGiven(g);
        setNotes(n.slice(0, 6));
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
  const first = me?.name.split(' ')[0] ?? '';

  return (
    <>
      <PageHead
        title={`${greeting()}, ${first}`}
        subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={canGive ? <Link href="/new" className="btn primary"><Icon name="plus" /> New task</Link> : undefined}
      />
      <Err msg={error} />

      <div className="stats">
        <StatCard label="Open tasks" value={loading ? '–' : d.open.length} icon="tasks" tone="blue" href="/tasks" />
        <StatCard label="Overdue" value={loading ? '–' : d.overdue.length} icon="alert" tone="red" href="/tasks?f=overdue" />
        <StatCard label="To accept" value={loading ? '–' : d.respond.length} icon="inbox" tone="amber" href="/tasks" />
        <StatCard label="To approve" value={loading ? '–' : d.approve.length} icon="check" tone="purple" href="/given" />
      </div>

      <div className="cols">
        <div>
          {loading && <Skeleton rows={5} />}
          {nothing && (
            <Empty title={`You are all caught up, ${first}.`}>
              New work and anything due soon will show up here.
            </Empty>
          )}

          {d.respond.length > 0 && (
            <div className="list">
              <GroupHead title="Waiting for you to accept" count={d.respond.length} />
              {d.respond.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.approve.length > 0 && (
            <div className="list">
              <GroupHead title="Submitted, waiting for your approval" count={d.approve.length} />
              {d.approve.map((a) => <TaskRow key={a.id} a={a} who="given" onChanged={load} />)}
            </div>
          )}
          {d.overdue.length > 0 && (
            <div className="list">
              <GroupHead title="Overdue" count={d.overdue.length} tone="late" />
              {d.overdue.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.today.length > 0 && (
            <div className="list">
              <GroupHead title="Due today" count={d.today.length} />
              {d.today.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.soon.length > 0 && (
            <div className="list">
              <GroupHead title="Coming up this week" count={d.soon.length} />
              {d.soon.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
          {d.other.length > 0 && (
            <p className="muted">
              {d.other.length} more open task(s) with no deadline this week. <Link href="/tasks">See all my tasks</Link>
            </p>
          )}
        </div>

        <aside>
          <div className="panel">
            <div className="panel-h">My open tasks by status</div>
            <div className="panel-b">
              {d.byStatus.length === 0 ? (
                <div className="muted">{loading ? 'Loading…' : 'No open tasks.'}</div>
              ) : (
                <>
                  <div className="stackbar" role="img" aria-label={d.byStatus.map((x) => `${STATUS_LABEL[x.s]}: ${x.n}`).join(', ')}>
                    {d.byStatus.map((x) => <div key={x.s} style={{ flex: x.n, background: STATUS_COLOR[x.s] }} />)}
                  </div>
                  <div className="legend">
                    {d.byStatus.map((x) => (
                      <div key={x.s} className="legend-row">
                        <span className="dot" style={{ background: STATUS_COLOR[x.s] }} />
                        {STATUS_LABEL[x.s]}
                        <b>{x.n}</b>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">Due in the next 7 days</div>
            <div className="panel-b">
              <div className="bars" role="img" aria-label={d.days.map((x) => `${x.day.toLocaleDateString(undefined, { weekday: 'long' })}: ${x.n}`).join(', ')}>
                {d.days.map((x, i) => (
                  <div key={i} className="col">
                    <span className="n">{x.n}</span>
                    <div className={`b ${i === 0 ? 'today' : ''} ${x.n === 0 ? 'zero' : ''}`} style={{ height: `${Math.max(3, (x.n / d.maxDay) * 80)}px` }} />
                    <span className="d">{i === 0 ? 'Today' : x.day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">
              Recent activity
              <Link href="/notifications" className="section-link">See all</Link>
            </div>
            <div className="panel-b">
              {notes.length === 0 && <span className="muted">Nothing yet.</span>}
              <div className="feed">
                {notes.map((n) => (
                  <div key={n.id} className={`feed-item ${n.readAt ? '' : 'new'}`}>
                    <i />
                    <div>
                      {notificationText(n)}
                      <div className="muted" style={{ fontSize: 12 }}>{timeAgo(n.createdAt)}</div>
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
