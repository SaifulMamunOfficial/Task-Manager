'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api';
import { useOrgData, type Pos } from '../../../lib/orgdata';
import { Err, PageHead } from '../../../components/bits';
import { Icon } from '../../../components/icons';
import { useToast } from '../../../components/toast';

type OrgData = ReturnType<typeof useOrgData>;
const TABS = [
  { key: 'delegation', label: 'Task permissions', icon: 'send' as const },
  { key: 'visibility', label: 'Visibility', icon: 'users' as const },
  { key: 'reminders', label: 'Reminders', icon: 'bell' as const },
];

export default function Rules() {
  const d = useOrgData();
  const [tab, setTab] = useState('delegation');

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t && TABS.some((x) => x.key === t)) setTab(t);
  }, []);
  const pick = (t: string) => {
    setTab(t);
    window.history.replaceState(null, '', `?tab=${t}`);
  };

  return (
    <>
      <PageHead title="Rules & settings" subtitle="Control how tasks move between people, what task givers can see, and when people are reminded." />
      <Err msg={d.error} />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => pick(t.key)}>
            <span className="row" style={{ gap: 7, flexWrap: 'nowrap' }}><Icon name={t.icon} size={15} /> {t.label}</span>
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
  const [rules, setRules] = useState<{ fromPositionId: string; toPositionId: string }[] | null>(null);
  const [hover, setHover] = useState<{ r: string; c: string } | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const positions = useMemo(() => [...d.positions].sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)), [d.positions]);

  useEffect(() => {
    api('/settings/delegation').then(setRules).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allowed = (from: string, to: string) => (rules ?? []).some((r) => r.fromPositionId === from && r.toPositionId === to);
  const holders = (pid: string) => d.users.filter((u) => u.isActive && !u.isAdmin && u.positions.some((p) => p.position.id === pid)).length;

  async function setRow(from: Pos, next: string[]) {
    const before = rules ?? [];
    setRules([...before.filter((r) => r.fromPositionId !== from.id), ...next.map((t) => ({ fromPositionId: from.id, toPositionId: t }))]);
    setState('saving');
    try {
      await api('/settings/delegation', { method: 'PUT', body: JSON.stringify({ fromPositionId: from.id, toPositionIds: next }) });
      setState('saved');
    } catch (e: any) {
      setRules(before);
      setState('error');
      toast.error(e.message);
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
        <Intro title="Who can give tasks to whom">
          Tick a box to let the position in that row give tasks to the position in that column. If someone holds more than one position, any of them counts.
        </Intro>
        <span className={`savestate ${state}`} role="status" aria-live="polite">
          {state === 'saving' ? 'Saving…' : state === 'saved' ? <><Icon name="check" size={14} /> All changes saved</> : state === 'error' ? 'Could not save' : 'Changes save automatically'}
        </span>
      </div>

      {positions.length === 0 ? (
        <div className="list"><div className="empty"><b>No positions yet</b>Add positions under Organization first.</div></div>
      ) : (
        <div className="mx-wrap">
          <table className="mx" onMouseLeave={() => setHover(null)}>
            <thead>
              <tr>
                <th className="rowh corner"><span>From</span><span className="arrow">gives tasks to →</span></th>
                {positions.map((c) => (
                  <th key={c.id} className={hover?.c === c.id ? 'hl' : ''}>
                    {c.title}
                    <small>{holders(c.id)} {holders(c.id) === 1 ? 'person' : 'people'}</small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((r) => (
                <tr key={r.id} className={hover?.r === r.id ? 'hl' : ''}>
                  <th scope="row" className="rowh">
                    <span className="lvl">{r.level}</span>
                    <span>
                      {r.title}
                      <small>{holders(r.id)} {holders(r.id) === 1 ? 'person' : 'people'}</small>
                    </span>
                  </th>
                  {positions.map((c) => (
                    <td key={c.id} className={hover?.c === c.id ? 'hl' : ''} onMouseEnter={() => setHover({ r: r.id, c: c.id })}>
                      <input
                        type="checkbox"
                        className="cb"
                        checked={allowed(r.id, c.id)}
                        onChange={() => toggle(r, c)}
                        aria-label={`${r.title} can give tasks to ${c.title}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ marginTop: 10 }}>
        A position with no ticks in its row cannot give tasks. Nobody can give a task to themselves.
      </p>
    </>
  );
}

// ---------- 2. visibility ----------

type Mode = 'DIRECT' | 'SUMMARY' | 'FULL';
type Vis = { id: string; scope: 'GLOBAL' | 'POSITION' | 'USER'; scopeRefId: string; mode: Mode };

const MODES: { v: Mode; label: string; text: string }[] = [
  { v: 'DIRECT', label: 'Direct only', text: 'The giver sees only the person they gave the task to.' },
  { v: 'SUMMARY', label: 'Summary', text: 'Plus counts of what happened further down, with no names or comments.' },
  { v: 'FULL', label: 'Full chain', text: 'Plus every person and status further down the chain.' },
];

function ChainDiagram({ mode }: { mode: Mode }) {
  const third = mode === 'FULL' ? 'seen' : mode === 'SUMMARY' ? 'count' : 'hidden';
  return (
    <div className="chain" aria-hidden="true">
      <div className="cnode"><span className="cdot seen"><Icon name="user" size={14} /></span><small>Giver</small></div>
      <span className="cline seen" />
      <div className="cnode"><span className="cdot seen"><Icon name="user" size={14} /></span><small>Receiver</small></div>
      <span className={`cline ${third === 'hidden' ? '' : third === 'count' ? 'dash' : 'seen'}`} />
      <div className="cnode">
        <span className={`cdot ${third}`}>{third === 'count' ? '3' : third === 'seen' ? <Icon name="users" size={14} /> : <Icon name="close" size={13} />}</span>
        <small>{third === 'seen' ? 'Names' : third === 'count' ? 'Counts' : 'Hidden'}</small>
      </div>
    </div>
  );
}

function Visibility({ d }: { d: OrgData }) {
  const toast = useToast();
  const [rows, setRows] = useState<Vis[] | null>(null);
  const load = () => api('/settings/visibility').then(setRows).catch((e) => toast.error(e.message));
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
      toast.error(e.message);
    }
  }
  async function clear(scope: string, ref: string) {
    try {
      await api(`/settings/visibility?scope=${scope}&scopeRefId=${encodeURIComponent(ref)}`, { method: 'DELETE' });
      toast.ok('Exception removed');
      await load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (!rows) return <div className="list"><div className="skel" /><div className="skel" /></div>;
  const global = rows.find((r) => r.scope === 'GLOBAL')?.mode ?? 'DIRECT';

  return (
    <>
      <Intro title="How much of the chain a task giver can see">
        This is about the person who <b>gave</b> a task and what they can see after the receiver passes it on to others. People not involved in a task never see it.
      </Intro>

      <h2>Default for everyone</h2>
      <div className="vgrid" role="radiogroup" aria-label="Default visibility">
        {MODES.map((m) => (
          <button key={m.v} role="radio" aria-checked={global === m.v} className={`vcard ${global === m.v ? 'on' : ''}`} onClick={() => global !== m.v && put('GLOBAL', undefined, m.v, `Default set to "${m.label}"`)}>
            <span className="vcheck">{global === m.v && <Icon name="check" size={13} />}</span>
            <ChainDiagram mode={m.v} />
            <b>{m.label}</b>
            <span className="muted">{m.text}</span>
          </button>
        ))}
      </div>

      <div className="two" style={{ marginTop: 24, alignItems: 'start' }}>
        {(['POSITION', 'USER'] as const).map((scope) => {
          const list = rows.filter((r) => r.scope === scope);
          const options = scope === 'POSITION' ? d.positions.map((p) => ({ id: p.id, name: p.title })) : d.users.filter((u) => u.isActive && !u.isAdmin).map((u) => ({ id: u.id, name: u.name }));
          const nameOf = (id: string) => options.find((o) => o.id === id)?.name ?? id;
          return (
            <div key={scope} className="panel" style={{ marginBottom: 0 }}>
              <div className="panel-h">{scope === 'POSITION' ? 'Exceptions by position' : 'Exceptions by person'}</div>
              <div className="panel-b">
                <p className="muted" style={{ marginBottom: 10 }}>{scope === 'POSITION' ? 'Everyone holding this position follows it.' : 'Overrides the position setting for one person.'}</p>
                {list.length === 0 && <p className="muted" style={{ marginBottom: 10 }}>No exceptions. Everyone follows the default.</p>}
                {list.map((r) => (
                  <div key={r.id} className="file" style={{ background: 'var(--surface)' }}>
                    <span className="grow" style={{ fontWeight: 600 }}>{nameOf(r.scopeRefId)}</span>
                    <div className="seg">
                      {MODES.map((m) => (
                        <button key={m.v} className={r.mode === m.v ? 'on' : ''} style={{ height: 28, padding: '0 9px', fontSize: 12.5 }} onClick={() => r.mode !== m.v && put(scope, r.scopeRefId, m.v, 'Exception updated')}>
                          {m.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                    <button className="ghost sm" aria-label={`Remove exception for ${nameOf(r.scopeRefId)}`} onClick={() => clear(scope, r.scopeRefId)}><Icon name="close" size={14} /></button>
                  </div>
                ))}
                <AddException options={options} taken={list.map((r) => r.scopeRefId)} onAdd={(id, mode) => put(scope, id, mode, 'Exception added')} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function AddException({ options, taken, onAdd }: { options: { id: string; name: string }[]; taken: string[]; onAdd: (id: string, mode: Mode) => void }) {
  const free = options.filter((o) => !taken.includes(o.id));
  const [id, setId] = useState('');
  const [mode, setMode] = useState<Mode>('SUMMARY');
  if (free.length === 0) return null;
  return (
    <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
      <select className="grow" value={id} onChange={(e) => setId(e.target.value)} aria-label="Choose who">
        <option value="">Choose…</option>
        {free.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} style={{ width: 130 }} aria-label="Visibility mode">
        {MODES.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
      </select>
      <button disabled={!id} onClick={() => { onAdd(id, mode); setId(''); }}>Add</button>
    </div>
  );
}

// ---------- 3. reminders ----------

type Rule = { enabled: boolean; config: Record<string, number> };
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00 ${h < 12 ? 'AM' : 'PM'}`;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ZONES = [
  { v: 360, l: 'Bangladesh (UTC+6)' }, { v: 330, l: 'India (UTC+5:30)' }, { v: 300, l: 'Pakistan (UTC+5)' }, { v: 240, l: 'Gulf (UTC+4)' },
  { v: 180, l: 'Saudi Arabia (UTC+3)' }, { v: 0, l: 'UTC' }, { v: 480, l: 'Singapore (UTC+8)' },
];

type Field = { key: string; label: string; kind: 'number' | 'hour' | 'weekday' | 'zone'; unit?: string };
const META: Record<string, { title: string; text: string; fields: Field[] }> = {
  GLOBAL: { title: 'Sending window and time zone', text: 'Reminders are only sent between these hours, in this time zone.', fields: [
    { key: 'tzOffsetMinutes', label: 'Time zone', kind: 'zone' }, { key: 'windowStartHour', label: 'Send from', kind: 'hour' }, { key: 'windowEndHour', label: 'Send until', kind: 'hour' } ] },
  ACCEPT_PENDING: { title: 'Task not accepted yet', text: 'Remind the assignee daily, and tell the giver if it takes too long.', fields: [
    { key: 'afterHours', label: 'Remind assignee after', kind: 'number', unit: 'hours' }, { key: 'escalateAfterHours', label: 'Tell the giver after', kind: 'number', unit: 'hours' } ] },
  DUE_SOON: { title: 'Deadline coming up', text: 'Remind the assignee before the deadline.', fields: [{ key: 'beforeHours', label: 'Remind', kind: 'number', unit: 'hours before' }] },
  DUE_TODAY: { title: 'Due today', text: 'Remind the assignee on the morning of the deadline.', fields: [] },
  OVERDUE: { title: 'Overdue', text: 'Remind the assignee and the giver every day after the deadline.', fields: [] },
  STALE: { title: 'No update for a while', text: 'Nudge the assignee to post a progress update.', fields: [{ key: 'afterDays', label: 'After', kind: 'number', unit: 'days without update' }] },
  AWAITING_APPROVAL: { title: 'Waiting for approval', text: 'Nudge the giver when a submitted task has not been approved.', fields: [{ key: 'afterHours', label: 'After', kind: 'number', unit: 'hours' }] },
  DAILY_DIGEST: { title: 'Daily summary', text: 'A morning summary for everyone with open tasks.', fields: [{ key: 'hour', label: 'Send at', kind: 'hour' }] },
  GIVER_DIGEST: { title: 'Weekly summary for task givers', text: 'Where the tasks someone gave stand.', fields: [{ key: 'weekday', label: 'Day', kind: 'weekday' }, { key: 'hour', label: 'Send at', kind: 'hour' }] },
};
const GROUPS = [
  { title: 'Timing', kinds: ['GLOBAL'] },
  { title: 'Task reminders', kinds: ['ACCEPT_PENDING', 'DUE_SOON', 'DUE_TODAY', 'OVERDUE', 'STALE', 'AWAITING_APPROVAL'] },
  { title: 'Summaries', kinds: ['DAILY_DIGEST', 'GIVER_DIGEST'] },
];

function Reminders() {
  const toast = useToast();
  const [rules, setRules] = useState<Record<string, Rule> | null>(null);
  useEffect(() => {
    api('/settings/reminders').then(setRules).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(kind: string, enabled: boolean, config: Record<string, number>, msg: string) {
    try {
      setRules(await api(`/settings/reminders/${kind}`, { method: 'PUT', body: JSON.stringify({ enabled, config }) }));
      toast.ok(msg);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  if (!rules) return <div className="list"><div className="skel" /><div className="skel" /><div className="skel" /></div>;

  return (
    <>
      <Intro title="Reminders">
        Reminders stop tasks being forgotten. People see them in the app; if email is set up on the server they get an email too.
      </Intro>
      {GROUPS.map((g) => (
        <div key={g.title} style={{ marginBottom: 22 }}>
          <h2>{g.title}</h2>
          <div className="list" style={{ maxWidth: 980, marginBottom: 0 }}>
            {g.kinds.map((k) => rules[k] && <RuleRow key={k} kind={k} rule={rules[k]} onSave={save} />)}
          </div>
        </div>
      ))}
    </>
  );
}

function RuleRow({ kind, rule, onSave }: { kind: string; rule: Rule; onSave: (k: string, enabled: boolean, c: Record<string, number>, msg: string) => void }) {
  const meta = META[kind] ?? { title: kind, text: '', fields: [] };
  const [cfg, setCfg] = useState<Record<string, number>>(rule.config);
  useEffect(() => setCfg(rule.config), [rule.config]);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(rule.config);
  const off = kind !== 'GLOBAL' && !rule.enabled;

  return (
    <div className={`rrow ${off ? 'off' : ''}`}>
      <div className="rhead">
        <div className="grow">
          <div style={{ fontWeight: 650 }}>{meta.title}</div>
          <div className="muted">{meta.text}</div>
        </div>
        {kind !== 'GLOBAL' && (
          <button
            role="switch"
            aria-checked={rule.enabled}
            aria-label={`${meta.title} enabled`}
            className={`switch ${rule.enabled ? 'on' : ''}`}
            onClick={() => onSave(kind, !rule.enabled, rule.config, `${meta.title}: ${rule.enabled ? 'turned off' : 'turned on'}`)}
          />
        )}
      </div>
      {meta.fields.length > 0 && (
        <div className="rfields">
          {meta.fields.map((f) => (
            <div key={f.key} className="rfield">
              <label htmlFor={`${kind}-${f.key}`}>{f.label}</label>
              <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                {f.kind === 'number' && <input id={`${kind}-${f.key}`} type="number" min={0} value={cfg[f.key] ?? 0} onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })} style={{ width: 84 }} />}
                {f.kind === 'hour' && (
                  <select id={`${kind}-${f.key}`} value={cfg[f.key] ?? 8} onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })} style={{ width: 120 }}>
                    {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
                  </select>
                )}
                {f.kind === 'weekday' && (
                  <select id={`${kind}-${f.key}`} value={cfg[f.key] ?? 4} onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })} style={{ width: 130 }}>
                    {DAYS.map((n, i) => <option key={n} value={i}>{n}</option>)}
                  </select>
                )}
                {f.kind === 'zone' && (
                  <select id={`${kind}-${f.key}`} value={cfg[f.key] ?? 360} onChange={(e) => setCfg({ ...cfg, [f.key]: Number(e.target.value) })} style={{ width: 200 }}>
                    {ZONES.some((z) => z.v === cfg[f.key]) ? null : <option value={cfg[f.key]}>UTC offset {cfg[f.key]} min</option>}
                    {ZONES.map((z) => <option key={z.v} value={z.v}>{z.l}</option>)}
                  </select>
                )}
                {f.unit && <span className="muted">{f.unit}</span>}
              </div>
            </div>
          ))}
          {dirty && (
            <div className="row" style={{ gap: 8, alignSelf: 'flex-end' }}>
              <button className="sm" onClick={() => setCfg(rule.config)}>Reset</button>
              <button className="primary sm" onClick={() => onSave(kind, rule.enabled, cfg, `${meta.title} saved`)}>Save</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
