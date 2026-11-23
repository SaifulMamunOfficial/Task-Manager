'use client';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { Avatar, Err, PageHead, Skeleton } from '../../../components/bits';
import { Icon } from '../../../components/icons';

type Row = { id: string; action: string; entity: string; entityId: string | null; before: any; after: any; createdAt: string; actor: { id: string; name: string } | null };

const SKIP = new Set(['id', 'createdAt', 'updatedAt', 'passwordHash']);
const SECRET = /secret|token|pass|key|hash/i;

/** What changed: only the fields whose value is different (or, for a new item, the fields it started with). */
function changes(r: Row): { k: string; from: unknown; to: unknown }[] {
  const b = (r.before && typeof r.before === 'object' ? r.before : {}) as Record<string, unknown>;
  const a = (r.after && typeof r.after === 'object' ? r.after : {}) as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !SKIP.has(k));
  return keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k])).map((k) => ({ k, from: b[k], to: a[k] }));
}

function show(k: string, v: unknown): string {
  if (SECRET.test(k)) return '••••';
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 70 ? `${s.slice(0, 70)}…` : s;
  }
  return String(v);
}

const tone = (action: string) => (/DELETE|REMOVE|CLEAR|DEACTIV/i.test(action) ? 'red' : /CREATE|ADD|GENERATE|ACTIVATE/i.test(action) ? 'green' : 'blue');

export default function Audit() {
  const { t, has, dateTime, date, time, err, personName } = useI18n();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [limit, setLimit] = useState(200);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [what, setWhat] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api(`/settings/audit?limit=${limit}`).then(setRows).catch((e) => setError(e.message));
  }, [limit]);

  // Known action / entity codes are translated; anything else is shown as stored.
  const label = (prefix: string, code: string) => (has(`${prefix}${code}`) ? t(`${prefix}${code}`) : code);

  const people = useMemo(() => {
    const m = new Map<string, string>();
    (rows ?? []).forEach((r) => m.set(r.actor?.id ?? '', personName(r.actor) ?? t('ad.a.system')));
    return [...m.entries()];
  }, [rows, t]);
  const things = useMemo(() => [...new Set((rows ?? []).map((r) => r.entity))], [rows]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (who !== '' && (r.actor?.id ?? '') !== who) return false;
      if (what && r.entity !== what) return false;
      if (!needle) return true;
      return `${personName(r.actor) ?? ''} ${label('ad.a.act.', r.action)} ${label('ad.a.ent.', r.entity)}`.toLowerCase().includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, who, what]);

  // Group by day, newest first.
  const days = useMemo(() => {
    const out: { key: string; day: Date; list: Row[] }[] = [];
    shown.forEach((r) => {
      const d = new Date(r.createdAt);
      const key = d.toDateString();
      const last = out[out.length - 1];
      if (last && last.key === key) last.list.push(r);
      else out.push({ key, day: d, list: [r] });
    });
    return out;
  }, [shown]);

  const dayLabel = (d: Date) => {
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return t('dk.today');
    if (d.toDateString() === yest.toDateString()) return t('ad.a.yesterday');
    return date(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  const filtered = q || who !== '' || what;

  return (
    <>
      <PageHead title={t('nav.audit')} subtitle={t('ad.a.sub')} />
      <Err msg={error ? err(error) : ''} />

      {rows === null ? (
        <Skeleton rows={6} />
      ) : (
        <>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" />
              <input type="search" placeholder={t('ad.a.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ad.a.search')} />
            </div>
            <select value={who} onChange={(e) => setWho(e.target.value)} style={{ width: 'auto' }} aria-label={t('ad.a.who')}>
              <option value="">{t('ad.a.allPeople')}</option>
              {people.map(([id, name]) => <option key={id || 'sys'} value={id}>{name}</option>)}
            </select>
            <select value={what} onChange={(e) => setWhat(e.target.value)} style={{ width: 'auto' }} aria-label={t('ad.a.on')}>
              <option value="">{t('ad.a.allThings')}</option>
              {things.map((e) => <option key={e} value={e}>{label('ad.a.ent.', e)}</option>)}
            </select>
            {filtered && <button className="ghost" onClick={() => { setQ(''); setWho(''); setWhat(''); }}>{t('c.reset')}</button>}
          </div>

          {shown.length === 0 ? (
            <div className="list"><div className="empty"><b>{t('ad.a.none')}</b></div></div>
          ) : (
            days.map((g) => (
              <section key={g.key} className="audit-day">
                <h2 className="audit-day-h">{dayLabel(g.day)} <span className="count-pill">{g.list.length}</span></h2>
                <div className="list">
                  {g.list.map((r) => {
                    const diff = changes(r);
                    const isOpen = open === r.id;
                    return (
                      <Fragment key={r.id}>
                        <div
                          className={`arow ${isOpen ? 'sel' : ''}`}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isOpen}
                          onClick={() => setOpen(isOpen ? null : r.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(isOpen ? null : r.id))}
                        >
                          <span className="muted" title={dateTime(r.createdAt)}>{time(r.createdAt)}</span>
                          <div className="awho">
                            <Avatar name={personName(r.actor) ?? t('ad.a.system')} />
                            <span>{personName(r.actor) ?? t('ad.a.system')}</span>
                          </div>
                          <div className="awhat">
                            <span className={`pill ${tone(r.action)}`}>{label('ad.a.act.', r.action)}</span>
                            <span className="muted">{label('ad.a.ent.', r.entity)}</span>
                          </div>
                          <Icon name="chevron" size={16} />
                        </div>
                        {isOpen && (
                          <div className="adetail">
                            {diff.length === 0 ? (
                              <span className="muted">{t('ad.a.noDetails')}</span>
                            ) : (
                              diff.slice(0, 10).map((c) => (
                                <div key={c.k} className="adl">
                                  <span className="adk">{c.k}</span>
                                  {r.before ? (
                                    <span>
                                      <span className="muted">{show(c.k, c.from)}</span> → <b>{show(c.k, c.to)}</b>
                                    </span>
                                  ) : (
                                    <b>{show(c.k, c.to)}</b>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </section>
            ))
          )}

          {!filtered && rows.length >= limit && limit < 500 && (
            <div className="row" style={{ justifyContent: 'center', margin: '8px 0 24px' }}>
              <button onClick={() => setLimit(Math.min(limit + 200, 500))}>{t('ad.a.more')}</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
