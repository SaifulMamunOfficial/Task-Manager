'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { Avatar } from './bits';
import { Icon } from './icons';

type U = { id: string; name: string; nameBn?: string | null; positions: { position: { id: string; title: string; titleBn?: string | null }; unit: { name: string; nameBn?: string | null } }[] };
type Rule = { fromPositionId: string; toPositionId: string };

/**
 * Pick one or more colleagues. Selected people appear as removable chips; people your chosen position
 * may not give tasks to are dimmed (a hint only, the server enforces the real rule).
 */
export default function PersonPicker({ value, onChange, fromPositionId }: { value: string[]; onChange: (ids: string[]) => void; fromPositionId?: string }) {
  const { me } = useAuth();
  const { t, posTitle, personName } = useI18n();
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
    .filter((u) => u.id !== me?.id && (u.name + ' ' + (u.nameBn ?? '') + ' ' + u.positions.map((p) => p.position.title + (p.position.titleBn ?? '') + p.unit.name + (p.unit.nameBn ?? '')).join(' ')).toLowerCase().includes(q.toLowerCase()))
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
            <button type="button" key={u.id} className="chip on" onClick={() => toggle(u)} aria-label={t('pp.remove', { name: personName(u) })}>
              {personName(u)} <Icon name="close" size={12} />
            </button>
          ))}
        </div>
      )}
      <div className="search" style={{ maxWidth: 'none', marginBottom: 6 }}>
        <Icon name="search" />
        <input placeholder={t('pp.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('pp.searchLabel')} />
      </div>
      <div className="people">
        {list.length === 0 && <div className="muted" style={{ padding: 10 }}>{t('pp.none')}</div>}
        {list.map((u) => {
          const ok = allowed(u);
          const on = value.includes(u.id);
          return (
            <label key={u.id} className={`person ${ok ? '' : 'disabled'} ${on ? 'picked' : ''}`} title={ok ? '' : t('pp.blocked')}>
              <input type="checkbox" checked={on} disabled={!ok} onChange={() => toggle(u)} />
              <Avatar name={personName(u)} />
              <span className="grow">{personName(u)}</span>
              <span className="muted" style={{ fontSize: 12 }}>{u.positions.map((p) => posTitle(p.position)).join(', ')}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
