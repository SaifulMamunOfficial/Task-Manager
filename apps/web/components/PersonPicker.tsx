'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Avatar } from './bits';
import { Icon } from './icons';

type U = { id: string; name: string; positions: { position: { id: string; title: string }; unit: { name: string } }[] };
type Rule = { fromPositionId: string; toPositionId: string };

/**
 * Pick one or more colleagues. Selected people appear as removable chips; people your chosen position
 * may not give tasks to are dimmed (a hint only, the server enforces the real rule).
 */
export default function PersonPicker({ value, onChange, fromPositionId }: { value: string[]; onChange: (ids: string[]) => void; fromPositionId?: string }) {
  const { me } = useAuth();
  const [users, setUsers] = useState<U[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/users').then(setUsers).catch(() => {});
    api('/settings/delegation').then(setRules).catch(() => {});
  }, []);

  const myPositionIds = useMemo(() => (fromPositionId ? [fromPositionId] : me?.positions.map((p) => p.position.id) ?? []), [me, fromPositionId]);
  const allowed = (u: U) => rules.some((r) => myPositionIds.includes(r.fromPositionId) && u.positions.some((p) => p.position.id === r.toPositionId));

  const list = users
    .filter((u) => u.id !== me?.id && (u.name + ' ' + u.positions.map((p) => p.position.title + p.unit.name).join(' ')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(allowed(b)) - Number(allowed(a)) || a.name.localeCompare(b.name));

  const toggle = (u: U) => {
    if (!allowed(u)) return;
    onChange(value.includes(u.id) ? value.filter((x) => x !== u.id) : [...value, u.id]);
  };

  // Drop selected people who become not allowed when the "give as" position changes.
  useEffect(() => {
    const ok = value.filter((id) => {
      const u = users.find((x) => x.id === id);
      return u && allowed(u);
    });
    if (ok.length !== value.length && users.length && rules.length) onChange(ok);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromPositionId, rules, users]);

  const picked = value.map((id) => users.find((u) => u.id === id)).filter(Boolean) as U[];

  return (
    <div>
      {picked.length > 0 && (
        <div className="chips">
          {picked.map((u) => (
            <button type="button" key={u.id} className="chip on" onClick={() => toggle(u)} aria-label={`Remove ${u.name}`}>
              {u.name} <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="search" style={{ maxWidth: 'none', marginBottom: 6 }}>
        <Icon name="search" />
        <input placeholder="Search by name or position" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search people" />
      </div>
      <div className="people">
        {list.length === 0 && <div className="muted" style={{ padding: 10 }}>No one found.</div>}
        {list.map((u) => {
          const ok = allowed(u);
          const on = value.includes(u.id);
          return (
            <label key={u.id} className={`person ${ok ? '' : 'disabled'} ${on ? 'picked' : ''}`} title={ok ? '' : 'Your position cannot give tasks to this person'}>
              <input type="checkbox" checked={on} disabled={!ok} onChange={() => toggle(u)} />
              <Avatar name={u.name} />
              <span className="grow">{u.name}</span>
              <span className="muted" style={{ fontSize: 12 }}>{u.positions.map((p) => p.position.title).join(', ')}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
