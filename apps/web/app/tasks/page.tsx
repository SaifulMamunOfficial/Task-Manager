'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { OPEN, isOverdue } from '../../lib/ui';
import { Empty, Err, GroupHead, ListHead, PageHead, Skeleton, TaskRow } from '../../components/bits';
import { Icon } from '../../components/icons';

const FILTERS = ['open', 'overdue', 'today', 'week', 'closed'];

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
  { key: 'accept', title: 'dk.gAccept' },
  { key: 'overdue', title: 'dk.gOverdue', tone: 'late' },
  { key: 'today', title: 'dk.gToday' },
  { key: 'week', title: 'f.week' },
  { key: 'later', title: 'mt.s.later' },
  { key: 'none', title: 'due.none' },
  { key: 'submitted', title: 'mt.s.submitted' },
];

export default function MyTasks() {
  const { canGive } = useAuth();
  const { t, n, err } = useI18n();
  const [all, setAll] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'due' | 'newest'>('due');
  const [error, setError] = useState('');

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('f');
    if (f && FILTERS.includes(f)) setFilter(f);
  }, []);

  const load = useCallback(() => {
    api('/tasks/mine').then(setAll).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, (all ?? []).filter((a) => matches(a, f)).length])), [all]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = (all ?? []).filter((a) => matches(a, filter) && (!needle || (a.task.title + ' ' + (a.assignedBy?.name ?? '')).toLowerCase().includes(needle)));
    const due = (a: any) => (a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity);
    return rows.sort((a, b) => (sort === 'newest' || filter === 'closed' ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : due(a) - due(b)));
  }, [all, filter, q, sort]);

  // Grouped by deadline when sorted by deadline; flat for "newest" and for closed tasks.
  const grouped = sort === 'due' && filter !== 'closed';
  const sections = grouped ? SECTIONS.map((s) => ({ ...s, rows: list.filter((a) => bucket(a) === s.key) })).filter((s) => s.rows.length > 0) : [];

  const subtitle =
    all === null || counts.open === 0
      ? t('mt.sub')
      : [t('mt.open', { n: counts.open }), counts.overdue ? t('mt.overdue', { n: counts.overdue }) : '', counts.today ? t('mt.dueToday', { n: counts.today }) : ''].filter(Boolean).join(' · ');
  const neverHadTasks = all !== null && all.length === 0;

  return (
    <>
      <PageHead title={t('mt.title')} subtitle={subtitle} />
      <Err msg={error ? err(error) : ''} />

      {all === null && !error && <Skeleton />}

      {neverHadTasks && (
        <Empty
          title={t('mt.never')}
          icon="inbox"
          actions={canGive ? <Link href="/new" className="btn primary"><Icon name="plus" /> {t('mt.giveSomeone')}</Link> : <Link href="/notifications" className="btn">{t('mt.viewNotif')}</Link>}
        >
          {t('mt.never.t')}
        </Empty>
      )}

      {all !== null && !neverHadTasks && (
        <>
          <div className="tabs" role="tablist">
            {FILTERS.map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={`tab ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
                {t(`f.${f}`)}
                <span className={`n ${f === 'overdue' && counts.overdue > 0 ? 'alert' : ''}`}>{n(counts[f])}</span>
              </button>
            ))}
          </div>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" />
              <input type="search" placeholder={t('mt.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('mt.searchLabel')} />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as any)} style={{ width: 'auto' }} aria-label={t('mt.sortLabel')}>
              <option value="due">{t('mt.groupBy')}</option>
              <option value="newest">{t('mt.newest')}</option>
            </select>
            {(q || filter !== 'open') && <button className="ghost" onClick={() => { setQ(''); setFilter('open'); }}>{t('c.reset')}</button>}
          </div>

          {list.length === 0 ? (
            q ? (
              <Empty title={t('mt.noMatch')} icon="search" actions={<button onClick={() => setQ('')}>{t('c.clearSearch')}</button>}>
                {t('mt.tryOther')}
              </Empty>
            ) : (
              <Empty title={t(`mt.e.${filter}`)} icon={filter === 'closed' ? 'history' : 'check'} actions={filter !== 'open' ? <button onClick={() => setFilter('open')}>{t('mt.showOpen')}</button> : undefined}>
                {t(`mt.e.${filter}.t`)}
              </Empty>
            )
          ) : grouped ? (
            sections.map((s) => (
              <div className="list" key={s.key}>
                <GroupHead title={t(s.title)} count={s.rows.length} tone={s.tone} />
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
