'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { OPEN, isOverdue } from '../../lib/ui';
import { Empty, Err, GroupHead, ListHead, PageHead, Skeleton, TaskRow } from '../../components/bits';
import { Icon } from '../../components/icons';
import { useAuth } from '../../lib/auth';

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'approve', label: 'To approve' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'closed', label: 'Closed' },
];

const EMPTY: Record<string, { title: string; text: string }> = {
  open: { title: 'No open tasks', text: 'Everything you gave has been finished.' },
  approve: { title: 'Nothing to approve', text: 'No one is waiting for your approval right now.' },
  overdue: { title: 'Nothing is overdue', text: 'All the tasks you gave are within their deadlines.' },
  closed: { title: 'No closed tasks yet', text: 'Approved, declined and cancelled tasks will be listed here.' },
};

function matches(a: any, f: string) {
  const open = OPEN.includes(a.status);
  if (f === 'closed') return !open;
  if (!open) return false;
  if (f === 'approve') return a.status === 'SUBMITTED';
  if (f === 'overdue') return isOverdue(a.task.dueDate, a.status);
  return true;
}

export default function Given() {
  const { canGive } = useAuth();
  const [all, setAll] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/tasks/given').then(setAll).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (all ?? []).filter((a) => matches(a, f.key)).length])), [all]);

  // Group rows that belong to the same task (one task given to several people).
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (all ?? []).filter((a) => matches(a, filter) && (!needle || (a.task.title + ' ' + a.assignee.name).toLowerCase().includes(needle)));
    const map = new Map<string, any[]>();
    rows.forEach((a) => map.set(a.taskId, [...(map.get(a.taskId) ?? []), a]));
    const out = [...map.values()];
    const key = (g: any[]) => (g.some((a) => a.status === 'SUBMITTED') ? 0 : 1);
    return out.sort((x, y) => key(x) - key(y) || (x[0].task.dueDate ? new Date(x[0].task.dueDate).getTime() : Infinity) - (y[0].task.dueDate ? new Date(y[0].task.dueDate).getTime() : Infinity));
  }, [all, filter, q]);

  const neverGave = all !== null && all.length === 0;
  const subtitle =
    all === null || counts.open === 0
      ? 'Tasks you gave to others, and where each person stands.'
      : `${counts.open} open${counts.approve ? ` · ${counts.approve} waiting for your approval` : ''}${counts.overdue ? ` · ${counts.overdue} overdue` : ''}`;

  return (
    <>
      <PageHead
        title="Assigned by me"
        subtitle={subtitle}
        actions={canGive && !neverGave ? <Link href="/new" className="btn primary"><Icon name="plus" /> New task</Link> : undefined}
      />
      <Err msg={error} />

      {all === null && !error && <Skeleton />}

      {neverGave && (canGive ? (
        <Empty
          title="You have not given any tasks yet"
          icon="send"
          actions={<Link href="/new" className="btn primary"><Icon name="plus" /> Give a task</Link>}
        >
          Tasks you give to others appear here, so you can follow each person&apos;s progress and approve their work.
        </Empty>
      ) : (
        <Empty title="Your position cannot give tasks" icon="send" actions={<Link href="/tasks" className="btn">Go to my tasks</Link>}>
          Nothing will appear here. If this should change, ask your administrator to update the task permissions.
        </Empty>
      ))}

      {all !== null && !neverGave && (
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
            {(q || filter !== 'open') && <button className="ghost" onClick={() => { setQ(''); setFilter('open'); }}>Reset</button>}
          </div>

          {groups.length === 0 ? (
            q ? (
              <Empty title="No tasks match your search" icon="search" actions={<button onClick={() => setQ('')}>Clear search</button>}>
                Try a different word, or check another tab.
              </Empty>
            ) : (
              <Empty title={EMPTY[filter].title} icon={filter === 'closed' ? 'history' : 'check'} actions={filter !== 'open' ? <button onClick={() => setFilter('open')}>Show open tasks</button> : undefined}>
                {EMPTY[filter].text}
              </Empty>
            )
          ) : (
            <div className="list">
              <ListHead />
              {groups.map((g) =>
                g.length === 1 ? (
                  <TaskRow key={g[0].id} a={g[0]} who="given" onChanged={load} />
                ) : (
                  <div key={g[0].taskId}>
                    <GroupHead title={g[0].task.title} count={g.length} />
                    {g.map((a) => <TaskRow key={a.id} a={a} who="given" onChanged={load} child />)}
                  </div>
                ),
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
