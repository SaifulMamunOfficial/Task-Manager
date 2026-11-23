'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { useOrgData, type Pos } from '../../../lib/orgdata';
import { Err, PageHead } from '../../../components/bits';
import { Icon } from '../../../components/icons';
import { useToast } from '../../../components/toast';

type OrgData = ReturnType<typeof useOrgData>;
const TABS = [
  { key: 'delegation', label: 'ad.r.tabDeleg', icon: 'send' as const },
  { key: 'visibility', label: 'ad.r.tabVis', icon: 'users' as const },
  { key: 'reminders', label: 'ad.r.tabRem', icon: 'bell' as const },
];

export default function Rules() {
  const d = useOrgData();
  const { t, err } = useI18n();
  const [tab, setTab] = useState('delegation');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    if (q && TABS.some((x) => x.key === q)) setTab(q);
  }, []);
  const pick = (k: string) => {
    setTab(k);
    window.history.replaceState(null, '', `?tab=${k}`);
  };

  return (
    <>
      <PageHead title={t('nav.rules')} subtitle={t('ad.r.sub')} />
      <Err msg={d.error ? err(d.error) : ''} />
      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button key={x.key} role="tab" aria-selected={tab === x.key} className={`tab ${tab === x.key ? 'on' : ''}`} onClick={() => pick(x.key)}>
            <span className="row" style={{ gap: 7, flexWrap: 'nowrap' }}><Icon name={x.icon} size={15} /> {t(x.label)}</span>
          </button>
        ))}
      </div>
      {tab === 'delegation' && <Delegation d={d} />}
      {tab === 'visibility' && <Visibility d={d} />}
      {tab === 'reminders' && <Reminders />}
    </>
  );
}

function Intro({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 17, marginBottom: 4 }}>{title}</h2>
      <p className="muted" style={{ fontSize: 14, maxWidth: 760 }}>{children}</p>
    </div>
  );
}

// ---------- 1. task permissions: a standard permission matrix ----------

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function Delegation({ d }: { d: OrgData }) {
  const toast = useToast();
  const { t, n, posTitle, err } = useI18n();
  const [rules, setRules] = useState<{ fromPositionId: string; toPositionId: string }[] | null>(null);
  const [hover, setHover] = useState<{ r: string; c: string } | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [view, setViewState] = useState<'cards' | 'matrix'>('cards');
  useEffect(() => {
    try {
      if (localStorage.getItem('tm:permView') === 'matrix') setViewState('matrix');
    } catch {}
  }, []);
  const setView = (v: 'cards' | 'matrix') => {
    setViewState(v);
    try {
      localStorage.setItem('tm:permView', v);
    } catch {}
  };
  const positions = useMemo(() => [...d.positions].sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)), [d.positions]);

  useEffect(() => {
    api('/settings/delegation').then(setRules).catch((e) => toast.error(err(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allowed = (from: string, to: string) => (rules ?? []).some((r) => r.fromPositionId === from && r.toPositionId === to);
  const holders = (pid: string) => d.users.filter((u) => u.isActive && !u.isAdmin && u.positions.some((p) => p.position.id === pid)).length;
  const people = (c: number) => t(c === 1 ? 'c.person' : 'c.people', { n: c });

  async function setRow(from: Pos, next: string[]) {
    const before = rules ?? [];
    setRules([...before.filter((r) => r.fromPositionId !== from.id), ...next.map((x) => ({ fromPositionId: from.id, toPositionId: x }))]);
    setState('saving');
    try {
      await api('/settings/delegation', { method: 'PUT', body: JSON.stringify({ fromPositionId: from.id, toPositionIds: next }) });
      setState('saved');
    } catch (e: any) {
      setRules(before);
      setState('error');
      toast.error(err(e.message));
    }
  }

  // Ready-made setups: one click sets every position (asks first, because it replaces what is there now).
  const levels = [...new Set(positions.map((p) => p.level))].sort((a, b) => a - b);
  const targets = (from: Pos, kind: string): string[] => {
    if (kind === 'none') return [];
    if (kind === 'all') return positions.map((p) => p.id);
    if (kind === 'below') return positions.filter((p) => p.level > from.level).map((p) => p.id);
    const next = levels.find((l) => l > from.level);
    return next === undefined ? [] : positions.filter((p) => p.level === next).map((p) => p.id);
  };
  async function applyPreset(kind: string) {
    if (!kind || !confirm(t('ad.r.pConfirm'))) return;
    const before = rules;
    setState('saving');
    try {
      await Promise.all(positions.map((p) => api('/settings/delegation', { method: 'PUT', body: JSON.stringify({ fromPositionId: p.id, toPositionIds: targets(p, kind) }) })));
      setRules(positions.flatMap((p) => targets(p, kind).map((x) => ({ fromPositionId: p.id, toPositionId: x }))));
      setState('saved');
    } catch (e: any) {
      setRules(before);
      setState('error');
      toast.error(err(e.message));
    }
  }

  const toggle = (from: Pos, to: Pos) => {
    const cur = positions.filter((p) => allowed(from.id, p.id)).map((p) => p.id);
    setRow(from, cur.includes(to.id) ? cur.filter((x) => x !== to.id) : [...cur, to.id]);
  };

  if (!rules) return <div className="list"><div className="skel" /><div className="skel" /><div className="skel" /></div>;

  return (
    <>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <Intro title={t('ad.r.delegTitle')}>{t('ad.r.delegText')}</Intro>
        <span className={`savestate ${state}`} role="status" aria-live="polite">
          {state === 'saving' ? t('c.saving') : state === 'saved' ? <><Icon name="check" size={14} /> {t('ad.r.saved')}</> : state === 'error' ? t('ad.r.saveFail') : t('ad.r.auto')}
        </span>
      </div>

      {positions.length > 0 && (
        <div className="toolbar" style={{ marginTop: 4 }}>
          <div className="seg" role="radiogroup" aria-label={t('bd.view')}>
            <button role="radio" aria-checked={view === 'cards'} className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>{t('ad.r.viewCards')}</button>
            <button role="radio" aria-checked={view === 'matrix'} className={view === 'matrix' ? 'on' : ''} onClick={() => setView('matrix')}>{t('ad.r.viewMatrix')}</button>
          </div>
          <select value="" onChange={(e) => applyPreset(e.target.value)} style={{ width: 'auto', marginLeft: 'auto' }} aria-label={t('ad.r.preset')}>
            <option value="">{t('ad.r.preset')}</option>
            <option value="next">{t('ad.r.pNext')}</option>
            <option value="below">{t('ad.r.pBelow')}</option>
            <option value="all">{t('ad.r.pAll')}</option>
            <option value="none">{t('ad.r.pNone')}</option>
          </select>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="list"><div className="empty"><b>{t('ad.r.noPositions')}</b>{t('ad.r.noPositionsText')}</div></div>
      ) : view === 'cards' ? (
        <div className="perm-list">
          {positions.map((r) => {
            const on = positions.filter((c) => allowed(r.id, c.id));
            return (
              <section key={r.id} className="perm-card" aria-label={posTitle(r)}>
                <div className="perm-head">
                  <span className="lvl">{n(r.level)}</span>
                  <div>
                    <b>{posTitle(r)}</b>
                    <small className="muted"> · {people(holders(r.id))}</small>
                  </div>
                  <span className="perm-count">{t('ad.r.summary', { a: on.length, b: positions.length })}</span>
                  <span className="perm-acts">
                    <button className="ghost sm" onClick={() => setRow(r, positions.map((p) => p.id))}>{t('ad.r.selectAll')}</button>
                    <button className="ghost sm" onClick={() => setRow(r, [])}>{t('ad.r.selectNone')}</button>
                  </span>
                </div>
                <div className="perm-label">{t('ad.r.canGive')}</div>
                <div className="pchips">
                  {positions.map((c) => {
                    const checked = allowed(r.id, c.id);
                    return (
                      <button key={c.id} type="button" role="switch" aria-checked={checked} className={`pchip ${checked ? 'on' : ''}`} onClick={() => toggle(r, c)} title={t('ad.r.cellAria', { from: posTitle(r), to: posTitle(c) })}>
                        {checked && <Icon name="check" size={14} />} {posTitle(c)} <small>{n(holders(c.id))}</small>
                      </button>
                    );
                  })}
                </div>
                {on.length === 0 && <div className="perm-warn">{t('ad.r.cannotGive')}</div>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mx-wrap">
          <table className="mx" onMouseLeave={() => setHover(null)}>
            <thead>
              <tr>
                <th className="rowh corner"><span>{t('ad.r.from')}</span><span className="arrow">{t('ad.r.givesTo')}</span></th>
                {positions.map((c) => (
                  <th key={c.id} className={hover?.c === c.id ? 'hl' : ''}>
                    {posTitle(c)}
                    <small>{people(holders(c.id))}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((r) => (
                <tr key={r.id} className={hover?.r === r.id ? 'hl' : ''}>
                  <th scope="row" className="rowh">
                    <span className="lvl">{n(r.level)}</span>
                    <span>
                      {posTitle(r)}
                      <small>{people(holders(r.id))}</small>
                    </span>
                  </th>
                  {positions.map((c) => (
                    <td key={c.id} className={hover?.c === c.id ? 'hl' : ''} onMouseEnter={() => setHover({ r: r.id, c: c.id })}>
                      <input
                        type="checkbox"
                        className="cb"
                        checked={allowed(r.id, c.id)}
                        onChange={() => toggle(r, c)}
                        aria-label={t('ad.r.cellAria', { from: posTitle(r), to: posTitle(c) })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>{t('ad.r.delegNote')}</p>
    </>
  );
}

// ---------- 2. visibility ----------

type Mode = 'DIRECT' | 'SUMMARY' | 'FULL';
type Vis = { id: string; scope: 'GLOBAL' | 'POSITION' | 'USER'; scopeRefId: string; mode: Mode };

const MODES: { v: Mode; label: string; text: string; short: string }[] = [
  { v: 'DIRECT', label: 'ad.r.mDirect', text: 'ad.r.mDirectT', short: 'ad.r.mDirectS' },
  { v: 'SUMMARY', label: 'ad.r.mSummary', text: 'ad.r.mSummaryT', short: 'ad.r.mSummaryS' },
  { v: 'FULL', label: 'ad.r.mFull', text: 'ad.r.mFullT', short: 'ad.r.mFullS' },
];

function ChainDiagram({ mode }: { mode: Mode }) {
  const { t, n } = useI18n();
  const third = mode === 'FULL' ? 'seen' : mode === 'SUMMARY' ? 'count' : 'hidden';
  return (
    <div className="chain" aria-hidden="true">
      <div className="cnode"><span className="cdot seen"><Icon name="user" size={14} /></span><small>{t('ad.r.giver')}</small></div>
      <span className="cline seen" />
      <div className="cnode"><span className="cdot seen"><Icon name="user" size={14} /></span><small>{t('ad.r.receiver')}</small></div>
      <span className={`cline ${third === 'hidden' ? '' : third === 'count' ? 'dash' : 'seen'}`} />
      <div className="cnode">
        <span className={`cdot ${third}`}>{third === 'count' ? n(3) : third === 'seen' ? <Icon name="users" size={14} /> : <Icon name="close" size={13} />}</span>
        <small>{third === 'seen' ? t('ad.r.names') : third === 'count' ? t('ad.r.counts') : t('ad.r.hidden')}</small>
      </div>
    </div>
  );
}

function Visibility({ d }: { d: OrgData }) {
  const toast = useToast();
  const { t, posTitle, err } = useI18n();
  const [rows, setRows] = useState<Vis[] | null>(null);
  const load = () => api('/settings/visibility').then(setRows).catch((e) => toast.error(err(e.message)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function put(scope: string, scopeRefId: string | undefined, mode: Mode, msg: string) {
    try {
      await api('/settings/visibility', { method: 'PUT', body: JSON.stringify({ scope, scopeRefId, mode }) });
      toast.ok(msg);
      await load();
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }
  async function clear(scope: string, ref: string) {
    try {
      await api(`/settings/visibility?scope=${scope}&scopeRefId=${encodeURIComponent(ref)}`, { method: 'DELETE' });
      toast.ok(t('ad.r.exRemoved'));
      await load();
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }

  if (!rows) return <div className="list"><div className="skel" /><div className="skel" /></div>;
  const global = rows.find((r) => r.scope === 'GLOBAL')?.mode ?? 'DIRECT';

  return (
    <>
      <Intro title={t('ad.r.visTitle')}>{t('ad.r.visText')}</Intro>

      <h2>{t('ad.r.defaultAll')}</h2>
      <div className="vgrid" role="radiogroup" aria-label={t('ad.r.defaultAll')}>
        {MODES.map((m) => (
          <button key={m.v} role="radio" aria-checked={global === m.v} className={`vcard ${global === m.v ? 'on' : ''}`} onClick={() => global !== m.v && put('GLOBAL', undefined, m.v, t('ad.r.defaultSet', { mode: t(m.label) }))}>
            <span className="vcheck">{global === m.v && <Icon name="check" size={13} />}</span>
            <ChainDiagram mode={m.v} />
            <b>{t(m.label)}</b>
            <span className="muted">{t(m.text)}</span>
          </button>
        ))}
      </div>

      <div className="two" style={{ marginTop: 24, alignItems: 'start' }}>
        {(['POSITION', 'USER'] as const).map((scope) => {
          const list = rows.filter((r) => r.scope === scope);
          const options = scope === 'POSITION' ? d.positions.map((p) => ({ id: p.id, name: posTitle(p) })) : d.users.filter((u) => u.isActive && !u.isAdmin).map((u) => ({ id: u.id, name: u.name }));
          const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? id;
          return (
            <div key={scope} className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-h">{scope === 'POSITION' ? t('ad.r.exPos') : t('ad.r.exUser')}</div>
              <div className="panel-b">
                <p className="muted" style={{ marginBottom: 10 }}>{scope === 'POSITION' ? t('ad.r.exPosText') : t('ad.r.exUserText')}</p>
                {list.length === 0 && <p className="muted" style={{ marginBottom: 10 }}>{t('ad.r.noEx')}</p>}
                {list.map((r) => (
                  <div key={r.id} className="file" style={{ background: 'var(--surface)' }}>
                    <span className="grow" style={{ fontWeight: 600 }}>{nameOf(r.scopeRefId)}</span>
                    <div className="seg">
                      {MODES.map((m) => (
                        <button key={m.v} className={r.mode === m.v ? 'on' : ''} style={{ height: 28, padding: '0 9px', fontSize: 12.5 }} onClick={() => r.mode !== m.v && put(scope, r.scopeRefId, m.v, t('ad.r.exUpdated'))}>
                          {t(m.short)}
                        </button>
                      ))}
                    </div>
                    <button className="ghost sm" aria-label={t('ad.r.exRemoveAria', { name: nameOf(r.scopeRefId) })} onClick={() => clear(scope, r.scopeRefId)}><Icon name="close" size={14} /></button>
                  </div>
                ))}
                <AddException options={options} taken={list.map((r) => r.scopeRefId)} onAdd={(id, mode) => put(scope, id, mode, t('ad.r.exAdded'))} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AddException({ options, taken, onAdd }: { options: { id: string; name: string }[]; taken: string[]; onAdd: (id: string, mode: Mode) => void }) {
  const { t } = useI18n();
  const free = options.filter((o) => !taken.includes(o.id));
  const [id, setId] = useState('');
  const [mode, setMode] = useState<Mode>('SUMMARY');
  if (free.length === 0) return null;
  return (
    <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
      <select className="grow" value={id} onChange={(e) => setId(e.target.value)} aria-label={t('ad.r.chooseWho')}>
        <option value="">{t('ad.r.choose')}</option>
        {free.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={{ width: 130 }} aria-label={t('ad.r.visMode')}>
        {MODES.map((m) => <option key={m.v} value={m.v}>{t(m.label)}</option>)}
      </select>
      <button disabled={!id} onClick={() => { onAdd(id, mode); setId(''); }}>{t('c.add')}</button>
    </div>
  );
}

// ---------- 3. reminders ----------

type Rule = { enabled: boolean; config: Record<string, number> };
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const ZONES = [360, 330, 300, 240, 180, 0, 480];

type Field = { key: string; label: string; kind: 'number' | 'hour' | 'weekday' | 'zone'; unit?: string };
const FIELDS: Record<string, Field[]> = {
  GLOBAL: [{ key: 'tzOffsetMinutes', label: 'ad.r.f.tz', kind: 'zone' }, { key: 'windowStartHour', label: 'ad.r.f.from', kind: 'hour' }, { key: 'windowEndHour', label: 'ad.r.f.until', kind: 'hour' }],
  ACCEPT_PENDING: [{ key: 'afterHours', label: 'ad.r.f.remindAfter', kind: 'number', unit: 'ad.r.unitHours' }, { key: 'escalateAfterHours', label: 'ad.r.f.tellGiver', kind: 'number', unit: 'ad.r.unitHours' }],
  DUE_SOON: [{ key: 'beforeHours', label: 'ad.r.f.remind', kind: 'number', unit: 'ad.r.unitHoursBefore' }],
  DUE_TODAY: [],
  OVERDUE: [],
  STALE: [{ key: 'afterDays', label: 'ad.r.f.after', kind: 'number', unit: 'ad.r.unitDays' }],
  AWAITING_APPROVAL: [{ key: 'afterHours', label: 'ad.r.f.after', kind: 'number', unit: 'ad.r.unitHours' }],
  DAILY_DIGEST: [{ key: 'hour', label: 'ad.r.f.sendAt', kind: 'hour' }],
  GIVER_DIGEST: [{ key: 'weekday', label: 'ad.r.f.day', kind: 'weekday' }, { key: 'hour', label: 'ad.r.f.sendAt', kind: 'hour' }],
};
const GROUPS = [
  { title: 'ad.r.gTiming', kinds: ['GLOBAL'] },
  { title: 'ad.r.gTasks', kinds: ['ACCEPT_PENDING', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'STALE', 'AWAITING_APPROVAL'] },
  { title: 'ad.r.gSummaries', kinds: ['DAILY_DIGEST', 'GIVER_DIGEST'] },
];

function Reminders() {
  const toast = useToast();
  const { t, err } = useI18n();
  const [rules, setRules] = useState<Record<string, Rule> | null>(null);
  useEffect(() => {
    api('/settings/reminders').then(setRules).catch((e) => toast.error(err(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(kind: string, enabled: boolean, config: Record<string, number>, msg: string) {
    try {
      setRules(await api(`/settings/reminders/${kind}`, { method: 'PUT', body: JSON.stringify({ enabled, config }) }));
      toast.ok(msg);
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }

  if (!rules) return <div className="list"><div className="skel" /><div className="skel" /><div className="skel" /></div>;

  return (
    <>
      <Intro title={t('ad.r.remTitle')}>{t('ad.r.remText')}</Intro>
      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 22 }}>
          <h2>{t(g.title)}</h2>
          <div className="list" style={{ maxWidth: 980, marginBottom: 0 }}>
            {g.kinds.map((k) => rules[k] && <RuleRow key={k} kind={k} rule={rules[k]} onSave={save} />)}
          </div>
        </div>
      ))}
    </>
  );
}

function RuleRow({ kind, rule, onSave }: { kind: string; rule: Rule; onSave: (k: string, enabled: boolean, c: Record<string, number>, msg: string) => void }) {
  const { t, n, time } = useI18n();
  const title = t(`ad.r.k.${kind}`);
  const fields = FIELDS[kind] ?? [];
  const [cfg, setCfg] = useState<Record<string, number>>(rule.config);
  useEffect(() => setCfg(rule.config), [rule.config]);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(rule.config);
  const off = kind !== 'GLOBAL' && !rule.enabled;
  const setNum = (key: string, v: number) => setCfg({ ...cfg, [key]: v });

  return (
    <div className={`rrow ${off ? 'off' : ''}`}>
      <div className="rhead">
        <div className="grow">
          <div style={{ fontWeight: 650 }}>{title}</div>
          <div className="muted">{t(`ad.r.k.${kind}.t`)}</div>
        </div>
        {kind !== 'GLOBAL' && (
          <button
            role="switch"
            aria-checked={rule.enabled}
            aria-label={t('ad.r.enabled', { title })}
            className={`switch ${rule.enabled ? 'on' : ''}`}
            onClick={() => onSave(kind, !rule.enabled, rule.config, t(rule.enabled ? 'ad.r.turnedOff' : 'ad.r.turnedOn', { title }))}
          />
        )}
      </div>
      {fields.length > 0 && (
        <div className="rfields">
          {fields.map((f) => (
            <div key={f.key} className="rfield">
              <label htmlFor={`${kind}-${f.key}`}>{t(f.label)}</label>
              <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                {f.kind === 'number' && <input id={`${kind}-${f.key}`} type="number" min={0} value={cfg[f.key] ?? 0} onChange={(e) => setNum(f.key, Number(e.target.value))} style={{ width: 84 }} />}
                {f.kind === 'hour' && (
                  <select id={`${kind}-${f.key}`} value={cfg[f.key] ?? 8} onChange={(e) => setNum(f.key, Number(e.target.value))} style={{ width: 130 }}>
                    {HOURS.map((h) => <option key={h} value={h}>{time(new Date(2000, 0, 1, h))}</option>)}
                  </select>
                )}
                {f.kind === 'weekday' && (
                  <select id={`${kind}-${f.key}`} value={cfg[f.key] ?? 4} onChange={(e) => setNum(f.key, Number(e.target.value))} style={{ width: 140 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => <option key={i} value={i}>{t(`ad.r.d${i}`)}</option>)}
                  </select>
                )}
                {f.kind === 'zone' && (
                  <select id={`${kind}-${f.key}`} value={cfg[f.key] ?? 360} onChange={(e) => setNum(f.key, Number(e.target.value))} style={{ width: 210 }}>
                    {ZONES.includes(cfg[f.key]) ? null : <option value={cfg[f.key]}>UTC {n(cfg[f.key])}</option>}
                    {ZONES.map((z) => <option key={z} value={z}>{t(`ad.r.z${z}`)}</option>)}
                  </select>
                )}
                {f.unit && <span className="muted">{t(f.unit)}</span>}
              </div>
            </div>
          ))}
          {dirty && (
            <div className="row" style={{ gap: 8, alignSelf: 'flex-end' }}>
              <button className="sm" onClick={() => setCfg(rule.config)}>{t('ad.r.reset')}</button>
              <button className="primary sm" onClick={() => onSave(kind, rule.enabled, cfg, t('ad.r.ruleSaved', { title }))}>{t('ad.r.save')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
