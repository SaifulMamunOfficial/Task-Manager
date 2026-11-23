'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { OPEN, isOverdue } from '../../lib/ui';
import { Empty, Err, GroupHead, ListHead, PageHead, Skeleton, TaskRow } from '../../components/bits';
import { Icon } from '../../components/icons';
import Board, { ViewSwitch } from '../../components/Board';

const FILTERS = ['open', 'approve', 'overdue', 'closed'];

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
  const { t, n, err, personName } = useI18n();
  const [all, setAll] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [view, setViewState] = useState<'list' | 'board'>('list');
  useEffect(() => {
    try {
      if (localStorage.getItem('tm:view') === 'board') setViewState('board');
    } catch {}
  }, []);
  const setView = (v: 'list' | 'board') => {
    setViewState(v);
    try {
      localStorage.setItem('tm:view', v);
    } catch {}
  };

  const load = useCallback(() => {
    api('/tasks/given').then(setAll).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, (all ?? []).filter((a) => matches(a, f)).length])), [all]);

  // Group rows that belong to the same task (one task given to several people).
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (all ?? []).filter((a) => matches(a, filter) && (!needle || (a.task.title + ' ' + personName(a.assignee)).toLowerCase().includes(needle)));
    const map = new Map<string, any[]>();
    rows.forEach((a) => map.set(a.taskId, [...(map.get(a.taskId) ?? []), a]));
    const out = [...map.values()];
    const key = (g: any[]) => (g.some((a) => a.status === 'SUBMITTED') ? 0 : 1);
    return out.sort((x, y) => key(x) - key(y) || (x[0].task.dueDate ? new Date(x[0].task.dueDate).getTime() : Infinity) - (y[0].task.dueDate ? new Date(y[0].task.dueDate).getTime() : Infinity));
  }, [all, filter, q]);

  const neverGave = all !== null && all.length === 0;
  const subtitle =
    all === null || counts.open === 0
      ? t('gv.sub')
      : [t('mt.open', { n: counts.open }), counts.approve ? t('gv.waiting', { n: counts.approve }) : '', counts.overdue ? t('mt.overdue', { n: counts.overdue }) : ''].filter(Boolean).join(' · ');

  return (
    <>
      <PageHead
        title={t('gv.title')}
        subtitle={subtitle}
        actions={canGive && !neverGave ? <Link href="/new" className="btn primary"><Icon name="plus" /> {t('nav.newTask')}</Link> : undefined}
      />
      <Err msg={error ? err(error) : ''} />

      {all === null && !error && <Skeleton />}

      {neverGave && (canGive ? (
        <Empty title={t('gv.never')} icon="send" actions={<Link href="/new" className="btn primary"><Icon name="plus" /> {t('gv.giveTask')}</Link>}>
          {t('gv.never.t')}
        </Empty>
      ) : (
        <Empty title={t('gv.cannot')} icon="send" actions={<Link href="/tasks" className="btn">{t('gv.toMyTasks')}</Link>}>
          {t('gv.cannot.t')}
        </Empty>
      ))}

      {all !== null && !neverGave && (
        <>
          {view === 'list' && <div className="tabs" role="tablist">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={`tab ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {t(`f.${f}`)}
                <span className={`n ${f === 'overdue' && counts.overdue > 0 ? 'alert' : ''}`}>{n(counts[f])}</span>
              </button>
            ))}
          </div>}
          <div className="toolbar">
            <div className="search">
              <Icon name="search" />
              <input type="search" placeholder={t('mt.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('mt.searchLabel')} />
            </div>
            {view === 'list' && (q || filter !== 'open') && <button className="ghost" onClick={() => { setQ(''); setFilter('open'); }}>{t('c.reset')}</button>}
            <ViewSwitch value={view} onChange={setView} />
          </div>

          {view === 'board' ? (
            <Board who="given" rows={(all ?? []).filter((a) => !['DECLINED', 'CANCELLED'].includes(a.status) && (!q.trim() || (a.task.title + ' ' + personName(a.assignee)).toLowerCase().includes(q.trim().toLowerCase())))} />
          ) : groups.length === 0 ? (
            q ? (
              <Empty title={t('mt.noMatch')} icon="search" actions={<button onClick={() => setQ('')}>{t('c.clearSearch')}</button>}>
                {t('mt.tryOther')}
              </Empty>
            ) : (
              <Empty title={t(`gv.e.${filter}`)} icon={filter === 'closed' ? 'history' : 'check'} actions={filter !== 'open' ? <button onClick={() => setFilter('open')}>{t('mt.showOpen')}</button> : undefined}>
                {t(`gv.e.${filter}.t`)}
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
