'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, post } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useOrgData, type AdminUser } from '../../../lib/orgdata';
import { Avatar, Err, PageHead, Skeleton, StatCard } from '../../../components/bits';
import { Icon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { useToast } from '../../../components/toast';
import PositionsEditor, { emptyRow, rowsFromUser, rowsToPayload, type Row } from '../../../components/PositionsEditor';

type OrgData = ReturnType<typeof useOrgData>;
type StatusFilter = 'active' | 'inactive' | 'all';

/** 12 readable characters, no look-alikes (0/O, 1/l/I). */
function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export default function Users() {
  const data = useOrgData();
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [unit, setUnit] = useState('');
  const [position, setPosition] = useState('');

  const nameOf = (id: string | null) => data.users.find((u) => u.id === id)?.name;

  const stats = useMemo(() => {
    const people = data.users.filter((u) => !u.isAdmin);
    const active = people.filter((u) => u.isActive);
    return {
      active: active.length,
      inactive: people.length - active.length,
      noPosition: active.filter((u) => u.positions.length === 0).length,
      noManager: active.filter((u) => u.positions.some((p) => !p.reportsToUserId && p.position.level > 1)).length,
    };
  }, [data.users]);

  const rows = data.users.filter((u) => {
    if (status === 'active' && !u.isActive) return false;
    if (status === 'inactive' && u.isActive) return false;
    if (unit && !u.positions.some((p) => p.unit.id === unit)) return false;
    if (position && !u.positions.some((p) => p.position.id === position)) return false;
    return (u.name + ' ' + u.email).toLowerCase().includes(q.trim().toLowerCase());
  });

  const current = selected && selected !== 'new' ? data.users.find((u) => u.id === selected) : undefined;
  const filtered = q || unit || position || status !== 'active';

  return (
    <>
      <PageHead
        title="Users"
        subtitle="People in the organization, their positions and who they report to."
        actions={<button className="primary" onClick={() => setSelected('new')}><Icon name="plus" /> New user</button>}
      />
      <Err msg={data.error} />

      <div className="stats">
        <StatCard label="Active people" value={stats.active} icon="users" tone="blue" />
        <StatCard label="Deactivated" value={stats.inactive} icon="user" tone="gray" />
        <StatCard label="No position" value={stats.noPosition} icon="alert" tone={stats.noPosition ? 'amber' : 'green'} />
        <StatCard label="No manager set" value={stats.noManager} icon="alert" tone={stats.noManager ? 'amber' : 'green'} />
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input type="search" placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        </div>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 'auto' }} aria-label="Filter by unit">
          <option value="">All units</option>
          {data.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: 'auto' }} aria-label="Filter by position">
          <option value="">All positions</option>
          {data.positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <div className="seg" role="radiogroup" aria-label="Status">
          {(['active', 'inactive', 'all'] as const).map((s) => (
            <button key={s} role="radio" aria-checked={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
              {s === 'active' ? 'Active' : s === 'inactive' ? 'Deactivated' : 'All'}
            </button>
          ))}
        </div>
      </div>

      {data.loading ? (
        <Skeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="list">
          <div className="empty">
            <b>{filtered ? 'No users match these filters.' : 'No users yet.'}</b>
            {filtered && <button className="sm" style={{ marginTop: 10 }} onClick={() => { setQ(''); setUnit(''); setPosition(''); setStatus('active'); }}>Clear filters</button>}
          </div>
        </div>
      ) : (
        <div className="list">
          <div className="urow head" aria-hidden="true"><span>User</span><span>Positions</span><span>Reports to</span><span>Status</span><span /></div>
          {rows.map((u) => {
            const bosses = [...new Set(u.positions.map((p) => nameOf(p.reportsToUserId)).filter(Boolean))] as string[];
            return (
              <div
                key={u.id}
                className={`urow ${u.isActive ? '' : 'off'} ${selected === u.id ? 'sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelected(u.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(u.id))}
              >
                <div className="ucell-user">
                  <Avatar name={u.name} large />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{u.name}</div>
                    <div className="em">{u.email}</div>
                  </div>
                </div>
                <div className="tagrow">
                  {u.isAdmin && <span className="tagchip">Administrator account</span>}
                  {!u.isAdmin && u.positions.length === 0 && <span className="muted">No position</span>}
                  {u.positions.map((p) => (
                    <span key={p.id} className={`tagchip ${p.isPrimary && u.positions.length > 1 ? 'primary' : ''}`} title={p.isPrimary && u.positions.length > 1 ? 'Primary position' : undefined}>
                      <b>{p.position.title}</b> {p.unit.name}
                    </span>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 13.5 }}>{bosses.length ? bosses.join(', ') : u.isAdmin ? '' : '—'}</div>
                <div>
                  {u.isAdmin ? <span className="pill purple">Admin</span> : u.isActive ? <span className="pill green">Active</span> : <span className="pill gray">Deactivated</span>}
                </div>
                <button className="ghost sm" aria-label={`Edit ${u.name}`} tabIndex={-1} style={{ padding: '0 8px' }}><Icon name="chevron" size={16} /></button>
              </div>
            );
          })}
          <div className="group-h" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            {rows.length} of {data.users.length} users
          </div>
        </div>
      )}

      {selected && (
        <UserDrawer
          key={selected}
          user={current}
          data={data}
          onClose={() => setSelected(null)}
          onSaved={async (id) => {
            await data.reload();
            if (id) setSelected(id);
          }}
        />
      )}
    </>
  );
}

// ---------- drawer: create / edit ----------

function UserDrawer({ user, data, onClose, onSaved }: { user?: AdminUser; data: OrgData; onClose: () => void; onSaved: (newId?: string) => Promise<void> }) {
  const { me } = useAuth();
  const toast = useToast();
  const creating = !user;
  const initialRows: Row[] = user ? rowsFromUser(user) : [{ ...emptyRow(data.units, data.positions), isPrimary: true }];

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [password, setPassword] = useState(creating ? generatePassword() : '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | 'reset' | 'deactivate'>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.modal') && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showPositions = creating ? !isAdmin : !user!.isAdmin;
  const dirty = creating
    ? true
    : name !== user!.name || phone !== (user!.phone ?? '') || (showPositions && JSON.stringify(rows) !== JSON.stringify(initialRows));

  async function save() {
    setError('');
    if (!name.trim()) return setError('Enter the full name.');
    if (creating && !email.trim()) return setError('Enter an email address.');
    if (showPositions && rows.length === 0) return setError('Add at least one position, or the person cannot give or receive tasks.');
    setBusy(true);
    try {
      if (creating) {
        const u = await post('/users', {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          isAdmin,
          positions: isAdmin ? undefined : rowsToPayload(rows),
        });
        toast.ok(`${u.name} was added. Share the temporary password with them.`);
        await onSaved(u.id);
      } else {
        await api(`/users/${user!.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim(), phone: phone.trim() }) });
        if (showPositions) await api(`/users/${user!.id}/positions`, { method: 'PATCH', body: JSON.stringify({ positions: rowsToPayload(rows) }) });
        toast.ok('Changes saved');
        await onSaved();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={creating ? 'New user' : `Edit ${user!.name}`}>
        <div className="drawer-h">
          {creating ? <span className="cell-icon tone-blue" style={{ width: 40, height: 40 }}><Icon name="plus" size={20} /></span> : <Avatar name={user!.name} large />}
          <div className="grow">
            <h1 style={{ fontSize: 18 }}>{creating ? 'New user' : user!.name}</h1>
            <div className="muted">
              {creating ? 'They will be asked to choose their own password at first sign-in.' : user!.email}
            </div>
          </div>
          {!creating && (user!.isAdmin ? <span className="pill purple">Admin</span> : user!.isActive ? <span className="pill green">Active</span> : <span className="pill gray">Deactivated</span>)}
          <button className="ghost" aria-label="Close" onClick={onClose} style={{ padding: '0 8px' }}><Icon name="close" size={18} /></button>
        </div>

        <div className="drawer-b">
          <section>
            <div className="sec-title">Profile</div>
            <div className="two">
              <div><label htmlFor="u-name">Full name</label><input id="u-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={creating} /></div>
              <div><label htmlFor="u-phone">Phone <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><input id="u-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              {creating && (
                <>
                  <div style={{ gridColumn: '1 / -1' }}><label htmlFor="u-email">Email (used to sign in)</label><input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="u-pass">Temporary password</label>
                    <div className="pw-row">
                      <input id="u-pass" className="mono" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="off" />
                      <button type="button" onClick={() => setPassword(generatePassword())}>Generate</button>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(password).then(() => toast.ok('Password copied'))}>Copy</button>
                    </div>
                  </div>
                </>
              )}
            </div>
            {creating && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12 }}>
                <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
                Administrator account (outside the org chart, cannot give or receive tasks)
              </label>
            )}
          </section>

          {showPositions ? (
            <section>
              <div className="sec-title">Positions</div>
              <PositionsEditor rows={rows} onChange={setRows} units={data.units} positions={data.positions} users={data.users} secretariats={data.secretariats} selfId={user?.id} />
            </section>
          ) : (
            <section>
              <div className="sec-title">Positions</div>
              <p className="muted">Administrator accounts are not part of the org chart, so they have no positions.</p>
            </section>
          )}

          {!creating && (
            <section>
              <div className="sec-title">Account</div>
              <div className="danger-zone stack">
                <div className="row between">
                  <div>
                    <b>Reset password</b>
                    <div className="muted">Sets a new temporary password and signs them out everywhere.</div>
                  </div>
                  <button onClick={() => setModal('reset')}><Icon name="key" /> Reset…</button>
                </div>
                {user!.id !== me?.id && (
                  <div className="row between" style={{ borderTop: '1px solid #fecaca', paddingTop: 12 }}>
                    <div>
                      <b>{user!.isActive ? 'Deactivate account' : 'Reactivate account'}</b>
                      <div className="muted">{user!.isActive ? 'They can no longer sign in. Their open tasks stay as they are.' : 'They will be able to sign in again.'}</div>
                    </div>
                    <button className={user!.isActive ? 'danger' : ''} onClick={() => setModal('deactivate')}>{user!.isActive ? 'Deactivate…' : 'Reactivate'}</button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="drawer-f">
          <Err msg={error} />
          <span className="grow" />
          {!creating && !dirty && <span className="muted">No changes</span>}
          <button onClick={onClose}>{dirty && !creating ? 'Discard' : 'Close'}</button>
          <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : creating ? 'Create user' : 'Save changes'}</button>
        </div>
      </aside>

      {modal === 'reset' && user && <ResetModal user={user} onClose={() => setModal(null)} />}
      {modal === 'deactivate' && user && (
        <Modal title={user.isActive ? `Deactivate ${user.name}?` : `Reactivate ${user.name}?`} onClose={() => setModal(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>
            {user.isActive ? 'They will be signed out and will no longer be able to use the system. Tasks they hold stay as they are, so reassign them if needed.' : 'They will be able to sign in again with their current password.'}
          </p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)}>Cancel</button>
            <button
              className={user.isActive ? 'danger' : 'primary'}
              onClick={async () => {
                try {
                  await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) });
                  toast.ok(user.isActive ? 'User deactivated' : 'User reactivated');
                  setModal(null);
                  await onSaved();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              {user.isActive ? 'Deactivate' : 'Reactivate'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ResetModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState(generatePassword());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await post(`/users/${user.id}/reset-password`, { password: pw });
      setDone(true);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reset password for ${user.name}`} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>
        {done ? 'Password reset. Copy it now and give it to them. It will not be shown again.' : 'They will be signed out everywhere and must choose their own password at the next sign-in.'}
      </p>
      <label htmlFor="r-pass">Temporary password</label>
      <div className="pw-row">
        <input id="r-pass" className="mono" value={pw} onChange={(e) => setPw(e.target.value)} readOnly={done} minLength={8} />
        {!done && <button type="button" onClick={() => setPw(generatePassword())}>Generate</button>}
        <button type="button" onClick={() => navigator.clipboard?.writeText(pw).then(() => toast.ok('Password copied'))}>Copy</button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        {done ? (
          <button className="primary" onClick={onClose}>Done</button>
        ) : (
          <>
            <button onClick={onClose}>Cancel</button>
            <button className="primary" disabled={busy || pw.length < 8} onClick={go}>{busy ? 'Resetting…' : 'Reset password'}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
