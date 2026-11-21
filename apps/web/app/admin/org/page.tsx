'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, post } from '../../../lib/api';
import { useOrgData, type Pos, type Unit } from '../../../lib/orgdata';
import { Avatar, Err, PageHead, Skeleton, StatCard } from '../../../components/bits';
import { Icon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/toast';

type OrgData = ReturnType<typeof useOrgData>;

export default function Org() {
  const d = useOrgData();
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { kind: 'unit' } | { kind: 'position'; position?: Pos }>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeUsers = d.users.filter((u) => u.isActive && !u.isAdmin);
  const membersOf = (unitId: string) => activeUsers.filter((u) => u.positions.some((p) => p.unit.id === unitId));
  const holders = (positionId: string) => activeUsers.filter((u) => u.positions.some((p) => p.position.id === positionId)).length;

  const units = useMemo(
    () => [...d.units].filter((u) => showInactive || u.isActive).sort((a, b) => Number(b.type === 'HEAD_OFFICE') - Number(a.type === 'HEAD_OFFICE') || a.name.localeCompare(b.name)),
    [d.units, showInactive],
  );
  const hiddenCount = d.units.filter((u) => !u.isActive).length;
  const unit = d.units.find((u) => u.id === openUnit);

  return (
    <>
      <PageHead
        title="Organization"
        subtitle="Units and branches, their secretariats, and the positions people can hold."
        actions={
          <>
            <button onClick={() => setModal({ kind: 'position' })}><Icon name="plus" /> New position</button>
            <button className="primary" onClick={() => setModal({ kind: 'unit' })}><Icon name="plus" /> New unit</button>
          </>
        }
      />
      <Err msg={d.error} />

      <div className="stats">
        <StatCard label="Units and branches" value={d.units.filter((u) => u.isActive).length} icon="building" tone="purple" />
        <StatCard label="Secretariats" value={d.secretariats.length} icon="inbox" tone="blue" />
        <StatCard label="Positions" value={d.positions.length} icon="tasks" tone="amber" />
        <StatCard label="Active people" value={activeUsers.length} icon="users" tone="green" href="/admin/users" />
      </div>

      <div className="cols">
        <div>
          <div className="sec-bar">
            <h2>Units and branches</h2>
            {hiddenCount > 0 && (
              <label className="check-inline">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show {hiddenCount} inactive
              </label>
            )}
          </div>
          {d.loading ? (
            <Skeleton rows={3} />
          ) : (
            <div className="list">
              <div className="orow head" aria-hidden="true"><span>Unit</span><span>Members</span><span>Secretariats</span><span>Status</span><span /></div>
              {units.map((u) => {
                const members = membersOf(u.id);
                const secs = d.secretariats.filter((s) => s.unitId === u.id);
                const parent = d.units.find((x) => x.id === u.parentId);
                return (
                  <div
                    key={u.id}
                    className={`orow ${u.isActive ? '' : 'off'} ${openUnit === u.id ? 'sel' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenUnit(u.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenUnit(u.id))}
                  >
                    <div className="ucell-user">
                      <span className={`cell-icon ${u.type === 'HEAD_OFFICE' ? 'tone-blue' : 'tone-purple'}`} style={{ width: 38, height: 38, borderRadius: 10 }}><Icon name="building" size={18} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="nm">{u.name}</div>
                        <div className="em">{u.type === 'HEAD_OFFICE' ? 'Head office' : parent ? `Under ${parent.name}` : 'Unit / branch'}</div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      {members.length === 0 ? (
                        <span className="muted">None</span>
                      ) : (
                        <>
                          <span className="avstack">{members.slice(0, 4).map((m) => <Avatar key={m.id} name={m.name} />)}</span>
                          <span className="muted">{members.length}</span>
                        </>
                      )}
                    </div>
                    <div className="tagrow">
                      {secs.length === 0 && <span className="muted">None</span>}
                      {secs.map((s) => <span key={s.id} className="tagchip">{s.name}</span>)}
                    </div>
                    <div>{u.isActive ? <span className="pill green">Active</span> : <span className="pill gray">Inactive</span>}</div>
                    <button className="ghost sm" tabIndex={-1} aria-label={`Open ${u.name}`} style={{ padding: '0 8px' }}><Icon name="chevron" size={16} /></button>
                  </div>
                );
              })}
              {units.length === 0 && <div className="empty"><b>No units yet</b></div>}
            </div>
          )}
        </div>

        <aside>
          <div className="panel">
            <div className="panel-h">
              Positions
              <button className="ghost sm" onClick={() => setModal({ kind: 'position' })} aria-label="New position"><Icon name="plus" size={14} /> Add</button>
            </div>
            <div className="panel-b" style={{ paddingTop: 8 }}>
              {d.positions.map((p) => (
                <div key={p.id} className="prow">
                  <span className="lvl" title="Level (lower = more senior)">{p.level}</span>
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{p.title}</div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{holders(p.id)} {holders(p.id) === 1 ? 'person' : 'people'}</div>
                  </div>
                  <button className="ghost sm" aria-label={`Edit ${p.title}`} onClick={() => setModal({ kind: 'position', position: p })}>Edit</button>
                </div>
              ))}
              <p className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
                Level only orders positions (lower = more senior). Who may give tasks to whom is set under <Link href="/admin/rules">Rules &amp; settings</Link>.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {unit && <UnitDrawer key={unit.id} unit={unit} d={d} onClose={() => setOpenUnit(null)} />}
      {modal?.kind === 'unit' && <NewUnitModal d={d} onClose={() => setModal(null)} onCreated={(id) => { setModal(null); setOpenUnit(id); }} />}
      {modal?.kind === 'position' && <PositionModal position={modal.position} d={d} onClose={() => setModal(null)} />}
    </>
  );
}

// ---------- unit drawer ----------

function UnitDrawer({ unit, d, onClose }: { unit: Unit; d: OrgData; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(unit.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | 'toggle' | { sec: string; name: string }>(null);
  const [secName, setSecName] = useState('');
  const [secUser, setSecUser] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.modal') && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const secs = d.secretariats.filter((s) => s.unitId === unit.id);
  const members = d.users.filter((u) => u.isActive && !u.isAdmin && u.positions.some((p) => p.unit.id === unit.id));
  const parent = d.units.find((u) => u.id === unit.parentId);
  const dirty = name.trim() !== unit.name;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError('');
    setBusy(true);
    try {
      await fn();
      toast.ok(ok);
      await d.reload();
      return true;
    } catch (e: any) {
      setError(e.message);
      toast.error(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Unit ${unit.name}`}>
        <div className="drawer-h">
          <span className={`cell-icon ${unit.type === 'HEAD_OFFICE' ? 'tone-blue' : 'tone-purple'}`} style={{ width: 42, height: 42 }}><Icon name="building" size={20} /></span>
          <div className="grow">
            <h1 style={{ fontSize: 18 }}>{unit.name}</h1>
            <div className="muted">{unit.type === 'HEAD_OFFICE' ? 'Head office' : parent ? `Under ${parent.name}` : 'Unit / branch'}</div>
          </div>
          {unit.isActive ? <span className="pill green">Active</span> : <span className="pill gray">Inactive</span>}
          <button className="ghost" aria-label="Close" onClick={onClose} style={{ padding: '0 8px' }}><Icon name="close" size={18} /></button>
        </div>

        <div className="drawer-b">
          <section>
            <div className="sec-title">Details</div>
            <label htmlFor="un">Name</label>
            <input id="un" value={name} onChange={(e) => setName(e.target.value)} />
          </section>

          <section>
            <div className="sec-title">Secretariats <span>{secs.length}</span></div>
            {secs.length === 0 && <p className="muted" style={{ marginBottom: 10 }}>No secretariats yet. A secretariat is the team working under one Secretary.</p>}
            {secs.map((s) => {
              const sec = d.users.find((u) => u.id === s.secretaryUserId);
              return (
                <div key={s.id} className="file" style={{ background: 'var(--surface)' }}>
                  <span className="grow">
                    <b>{s.name}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>Secretary: {sec?.name ?? 'not set'}</div>
                  </span>
                  <button className="danger sm" onClick={() => setConfirm({ sec: s.id, name: s.name })}>Delete</button>
                </div>
              );
            })}
            <form
              className="row"
              style={{ marginTop: 10, flexWrap: 'nowrap', alignItems: 'flex-end' }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!secName.trim()) return;
                const ok = await run(() => post('/secretariats', { name: secName.trim(), unitId: unit.id, secretaryUserId: secUser || undefined }), 'Secretariat added');
                if (ok) { setSecName(''); setSecUser(''); }
              }}
            >
              <div className="grow"><label htmlFor="sn">New secretariat</label><input id="sn" placeholder="Name" value={secName} onChange={(e) => setSecName(e.target.value)} /></div>
              <div style={{ width: 170 }}>
                <label htmlFor="ss">Secretary</label>
                <select id="ss" value={secUser} onChange={(e) => setSecUser(e.target.value)}>
                  <option value="">Not set</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <button disabled={busy || !secName.trim()}>Add</button>
            </form>
          </section>

          <section>
            <div className="sec-title">Members <span>{members.length}</span></div>
            {members.length === 0 && <p className="muted">No one holds a position in this unit yet.</p>}
            {members.map((m) => (
              <div key={m.id} className="file" style={{ background: 'var(--surface)' }}>
                <Avatar name={m.name} />
                <span className="grow">{m.name}</span>
                <span className="tagrow" style={{ justifyContent: 'flex-end' }}>
                  {m.positions.filter((p) => p.unit.id === unit.id).map((p) => <span key={p.id} className="tagchip">{p.position.title}</span>)}
                </span>
              </div>
            ))}
            <Link href="/admin/users" className="section-link" style={{ display: 'inline-block', marginTop: 6 }}>Manage people</Link>
          </section>

          {unit.type !== 'HEAD_OFFICE' && (
            <section>
              <div className="sec-title">Status</div>
              <div className="danger-zone">
                <div className="row between">
                  <div>
                    <b>{unit.isActive ? 'Deactivate this unit' : 'Reactivate this unit'}</b>
                    <div className="muted">{unit.isActive ? 'Hides it from new assignments. People and tasks are not deleted.' : 'Makes it available again.'}</div>
                  </div>
                  <button className={unit.isActive ? 'danger' : ''} onClick={() => setConfirm('toggle')}>{unit.isActive ? 'Deactivate…' : 'Reactivate'}</button>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="drawer-f">
          <Err msg={error} />
          <span className="grow" />
          {!dirty && <span className="muted">No changes</span>}
          <button onClick={onClose}>{dirty ? 'Discard' : 'Close'}</button>
          <button className="primary" disabled={busy || !dirty || !name.trim()} onClick={() => run(() => api(`/units/${unit.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim() }) }), 'Unit renamed')}>
            Save changes
          </button>
        </div>
      </aside>

      {confirm === 'toggle' && (
        <Modal title={unit.isActive ? `Deactivate ${unit.name}?` : `Reactivate ${unit.name}?`} onClose={() => setConfirm(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{unit.isActive ? 'It will be hidden when choosing a unit for new positions. Existing people and tasks stay as they are.' : 'It will appear again when choosing a unit.'}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button className={unit.isActive ? 'danger' : 'primary'} onClick={async () => { await run(() => api(`/units/${unit.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !unit.isActive }) }), unit.isActive ? 'Unit deactivated' : 'Unit reactivated'); setConfirm(null); }}>
              {unit.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </Modal>
      )}
      {confirm && typeof confirm === 'object' && (
        <Modal title={`Delete "${confirm.name}"?`} onClose={() => setConfirm(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>A secretariat that still has members cannot be deleted. Move its members to another secretariat first.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button className="danger" onClick={async () => { await run(() => api(`/secretariats/${confirm.sec}`, { method: 'DELETE' }), 'Secretariat deleted'); setConfirm(null); }}>Delete</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------- modals ----------

function NewUnitModal({ d, onClose, onCreated }: { d: OrgData; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await post('/units', { name: name.trim(), type: 'UNIT', parentId: parentId || undefined });
      toast.ok('Unit created');
      await d.reload();
      onCreated(u.id);
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="New unit or branch" onClose={onClose}>
      <form className="stack" onSubmit={go}>
        <div><label htmlFor="nu">Name</label><input id="nu" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chattogram Branch" required /></div>
        <div>
          <label htmlFor="np">Belongs under <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <select id="np" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Top level</option>
            {d.units.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <Err msg={error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create unit'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PositionModal({ position, d, onClose }: { position?: Pos; d: OrgData; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(position?.title ?? '');
  const [level, setLevel] = useState(String(position?.level ?? 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = JSON.stringify({ title: title.trim(), level: Number(level) || 10 });
      if (position) await api(`/positions/${position.id}`, { method: 'PATCH', body });
      else await api('/positions', { method: 'POST', body });
      toast.ok(position ? 'Position updated' : 'Position added');
      await d.reload();
      onClose();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Modal title={position ? `Edit ${position.title}` : 'New position'} onClose={onClose}>
      <form className="stack" onSubmit={go}>
        <div><label htmlFor="pt">Title</label><input id="pt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deputy Director" required /></div>
        <div>
          <label htmlFor="pl">Level</label>
          <input id="pl" type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} />
          <p className="muted" style={{ marginTop: 4 }}>Only for ordering. 1 is the most senior.</p>
        </div>
        <Err msg={error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy || !title.trim()}>{busy ? 'Saving…' : position ? 'Save' : 'Add position'}</button>
        </div>
      </form>
    </Modal>
  );
}
