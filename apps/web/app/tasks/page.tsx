'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { OPEN, isOverdue } from '../../lib/ui';
import { Empty, Err, GroupHead, ListHead, PageHead, Skeleton, TaskRow } from '../../components/bits';
import { Icon } from '../../components/icons';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'week', label: 'This week' },
  { key: 'closed', label: 'Closed' },
];

const EMPTY_TEXT: Record<string, { title: string; text: string }> = {
  open: { title: 'No open tasks', text: 'You are all caught up. New tasks will appear here.' },
  overdue: { title: 'Nothing is overdue', text: 'Every open task is within its deadline.' },
  today: { title: 'Nothing due today', text: 'No open task has a deadline today.' },
  week: { title: 'Nothing due this week', text: 'No open task has a deadline in the next 7 days.' },
  closed: { title: 'No closed tasks yet', text: 'Tasks you finish, decline or that are cancelled will be listed here.' },
};

const endOfDay = (offset: number) => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime() + offset * 86400_000;
};

function matches(a: any, f: string) {
  const open = OPEN.includes(a.status);
  const due = a.task.dueDate ? new Date(a.task.dueDate).getTime() : null;
  if (f === 'closed') return !open;
  if (!open) return false;
  if (f === 'overdue') return isOverdue(a.task.dueDate, a.status);
  if (f === 'today') return due !== null && due <= endOfDay(0);
  if (f === 'week') return due !== null && due <= endOfDay(6);
  return true;
}

/** Which deadline section a task belongs to. */
function bucket(a: any): string {
  if (a.status === 'PENDING_ACCEPTANCE') return 'accept';
  if (a.status === 'SUBMITTED') return 'submitted';
  const due = a.task.dueDate ? new Date(a.task.dueDate).getTime() : null;
  if (isOverdue(a.task.dueDate, a.status)) return 'overdue';
  if (due === null) return 'none';
  if (due <= endOfDay(0)) return 'today';
  if (due <= endOfDay(6)) return 'week';
  return 'later';
}

const SECTIONS: { key: string; title: string; tone?: 'late' }[] = [
  { key: 'accept', title: 'Waiting for you to accept' },
  { key: 'overdue', title: 'Overdue', tone: 'late' },
  { key: 'today', title: 'Due today' },
  { key: 'week', title: 'This week' },
  { key: 'later', title: 'Later' },
  { key: 'none', title: 'No deadline' },
  { key: 'submitted', title: 'Submitted, waiting for approval' },
];

export default function MyTasks() {
  const { canGive } = useAuth();
  const [all, setAll] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'due' | 'newest'>('due');
  const [error, setError] = useState('');

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('f');
    if (f && FILTERS.some((x) => x.key === f)) setFilter(f);
  }, []);

  const load = useCallback(() => {
    api('/tasks/mine').then(setAll).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (all ?? []).filter((a) => matches(a, f.key)).length])), [all]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (all ?? []).filter((a) => matches(a, filter) && (!needle || (a.task.title + ' ' + (a.assignedBy?.name ?? '')).toLowerCase().includes(needle)));
    const due = (a: any) => (a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity);
    return rows.sort((a, b) => (sort === 'newest' || filter === 'closed' ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : due(a) - due(b)));
  }, [all, filter, q, sort]);

  // Grouped by deadline when sorted by deadline; flat for "newest" and for closed tasks.
  const grouped = sort === 'due' && filter !== 'closed';
  const sections = grouped ? SECTIONS.map((s) => ({ ...s, rows: list.filter((a) => bucket(a) === s.key) })).filter((s) => s.rows.length > 0) : [];

  const subtitle = all === null ? 'Everything that has been given to you.' : counts.open === 0 ? 'Everything that has been given to you.' : `${counts.open} open${counts.overdue ? ` · ${counts.overdue} overdue` : ''}${counts.today ? ` · ${counts.today} due today` : ''}`;
  const neverHadTasks = all !== null && all.length === 0;

  return (
    <>
      <PageHead title="My tasks" subtitle={subtitle} />
      <Err msg={error} />

      {all === null && !error && <Skeleton />}

      {neverHadTasks && (
        <Empty
          title="No tasks yet"
          icon="inbox"
          actions={canGive ? <Link href="/new" className="btn primary"><Icon name="plus" /> Give someone a task</Link> : <Link href="/notifications" className="btn">View notifications</Link>}
        >
          When someone gives you a task it will appear here, and you will get a notification. You can accept it straight from the list.
        </Empty>
      )}

      {all !== null && !neverHadTasks && (
        <>
          <div className="tabs" role="tablist">
            {FILTERS.map((f) => (
              <button key={f.key} role="tab" aria-selected={filter === f.key} className={`tab ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
                <span className={`n ${f.key === 'overdue' && counts.overdue > 0 ? 'alert' : ''}`}>{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" />
              <input type="search" placeholder="Search by title or person" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tasks" />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} style={{ width: 'auto' }} aria-label="Sort and group">
              <option value="due">Group by deadline</option>
              <option value="newest">Newest first</option>
            </select>
            {(q || filter !== 'open') && (
              <button className="ghost" onClick={() => { setQ(''); setFilter('open'); }}>Reset</button>
            )}
          </div>

          {list.length === 0 ? (
            q ? (
              <Empty title="No tasks match your search" icon="search" actions={<button onClick={() => setQ('')}>Clear search</button>}>
                Try a different word, or check another tab.
              </Empty>
            ) : (
              <Empty title={EMPTY_TEXT[filter].title} icon={filter === 'closed' ? 'history' : 'check'} actions={filter !== 'open' ? <button onClick={() => setFilter('open')}>Show open tasks</button> : undefined}>
                {EMPTY_TEXT[filter].text}
              </Empty>
            )
          ) : grouped ? (
            sections.map((s) => (
              <div className="list" key={s.key}>
                <GroupHead title={s.title} count={s.rows.length} tone={s.tone} />
                {s.rows.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
              </div>
            ))
          ) : (
            <div className="list">
              <ListHead />
              {list.map((a) => <TaskRow key={a.id} a={a} who="mine" onChanged={load} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
