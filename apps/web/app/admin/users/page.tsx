'use client';
import { useEffect, useMemo, useState } from 'react';
import { api, post } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
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
  const { t, n, posTitle, err, unitName, personName } = useI18n();
  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [unit, setUnit] = useState('');
  const [position, setPosition] = useState('');

  const nameOf = (id: string | null) => personName(data.users.find((u) => u.id === id));

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
    return (u.name + ' ' + (u.nameBn ?? '') + ' ' + u.email).toLowerCase().includes(q.trim().toLowerCase());
  });

  const current = selected && selected !== 'new' ? data.users.find((u) => u.id === selected) : undefined;
  const filtered = q || unit || position || status !== 'active';

  return (
    <>
      <PageHead
        title={t('nav.users')}
        subtitle={t('ad.u.sub')}
        actions={<button className="primary" onClick={() => setSelected('new')}><Icon name="plus" /> {t('ad.u.new')}</button>}
      />
      <Err msg={data.error ? err(data.error) : ''} />

      <div className="stats">
        <StatCard label={t('ad.ov.people')} value={n(stats.active)} icon="users" tone="blue" />
        <StatCard label={t('ad.u.deactivated')} value={n(stats.inactive)} icon="user" tone="gray" />
        <StatCard label={t('ad.ov.noPos')} value={n(stats.noPosition)} icon="alert" tone={stats.noPosition ? 'amber' : 'green'} />
        <StatCard label={t('ad.u.noMgr')} value={n(stats.noManager)} icon="alert" tone={stats.noManager ? 'amber' : 'green'} />
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input type="search" placeholder={t('ad.u.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ad.u.searchLabel')} />
        </div>
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ width: 'auto' }} aria-label={t('ad.u.filterUnit')}>
          <option value="">{t('ad.u.allUnits')}</option>
          {data.units.map((u) => <option key={u.id} value={u.id}>{unitName(u)}</option>)}
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value)} style={{ width: 'auto' }} aria-label={t('ad.u.filterPos')}>
          <option value="">{t('ad.u.allPositions')}</option>
          {data.positions.map((p) => <option key={p.id} value={p.id}>{posTitle(p)}</option>)}
        </select>
        <div className="seg" role="radiogroup" aria-label={t('ad.u.statusLabel')}>
          {(['active', 'inactive', 'all'] as const).map((s) => (
            <button key={s} role="radio" aria-checked={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>
              {s === 'active' ? t('ad.u.fActive') : s === 'inactive' ? t('ad.u.fInactive') : t('ad.u.fAll')}
            </button>
          ))}
        </div>
      </div>

      {data.loading ? (
        <Skeleton rows={6} />
      ) : rows.length === 0 ? (
        <div className="list">
          <div className="empty">
            <b>{filtered ? t('ad.u.noMatch') : t('ad.u.none')}</b>
            {filtered && <button className="sm" style={{ marginTop: 10 }} onClick={() => { setQ(''); setUnit(''); setPosition(''); setStatus('active'); }}>{t('ad.u.clearFilters')}</button>}
          </div>
        </div>
      ) : (
        <div className="list">
          <div className="urow head" aria-hidden="true"><span>{t('ad.u.colUser')}</span><span>{t('ad.u.colPositions')}</span><span>{t('ad.u.colReports')}</span><span>{t('ad.u.colStatus')}</span><span /></div>
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
                  <Avatar name={personName(u)} large />
                  <div style={{ minWidth: 0 }}>
                    <div className="nm">{personName(u)}</div>
                    <div className="em">{u.email}</div>
                  </div>
                </div>
                <div className="tagrow">
                  {u.isAdmin && <span className="tagchip">{t('ad.u.adminAccount')}</span>}
                  {!u.isAdmin && u.positions.length === 0 && <span className="muted">{t('ad.u.noPosition')}</span>}
                  {u.positions.map((p) => (
                    <span key={p.id} className={`tagchip ${p.isPrimary && u.positions.length > 1 ? 'primary' : ''}`} title={p.isPrimary && u.positions.length > 1 ? t('ad.u.primaryTitle') : undefined}>
                      <b>{posTitle(p.position)}</b> {unitName(p.secretariat ?? p.unit)}
                    </span>
                  ))}
                </div>
                <div className="muted" style={{ fontSize: 13.5 }}>{bosses.length ? bosses.join(', ') : u.isAdmin ? '' : '—'}</div>
                <div>
                  {u.isAdmin ? <span className="pill purple">{t('ad.u.badgeAdmin')}</span> : u.isActive ? <span className="pill green">{t('ad.u.badgeActive')}</span> : <span className="pill gray">{t('ad.u.badgeInactive')}</span>}
                </div>
                <button className="ghost sm" aria-label={t('ad.u.edit', { name: personName(u) })} tabIndex={-1} style={{ padding: '0 8px' }}><Icon name="chevron" size={16} /></button>
              </div>
            );
          })}
          <div className="group-h" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
            {t('ad.u.count', { shown: rows.length, total: data.users.length })}
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
  const { t, err, personName } = useI18n();
  const toast = useToast();
  const creating = !user;
  const initialRows: Row[] = user ? rowsFromUser(user) : [{ ...emptyRow(data.units, data.positions), isPrimary: true }];

  const [name, setName] = useState(user?.name ?? '');
  const [nameBn, setNameBn] = useState(user?.nameBn ?? '');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [password, setPassword] = useState(creating ? generatePassword() : '');
  const [isAdmin, setIsAdmin] = useState(false);
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
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
    if (!name.trim()) return setError(t('ad.u.errName'));
    if (creating && !email.trim()) return setError(t('ad.u.errEmail'));
    if (showPositions && rows.length === 0) return setError(t('ad.u.errPos'));
    setBusy(true);
    try {
      if (creating) {
        const u = await post('/users', {
          name: name.trim(),
          nameBn: nameBn.trim() || undefined,
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          isAdmin,
          language,
          positions: isAdmin ? undefined : rowsToPayload(rows),
        });
        toast.ok(t('ad.u.added', { name: personName(u) }));
        await onSaved(u.id);
      } else {
        await api(`/users/${user!.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim(), nameBn: nameBn.trim(), phone: phone.trim() }) });
        if (showPositions) await api(`/users/${user!.id}/positions`, { method: 'PATCH', body: JSON.stringify({ positions: rowsToPayload(rows) }) });
        toast.ok(t('ad.u.saved'));
        await onSaved();
      }
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  const badge = !creating && (user!.isAdmin ? <span className="pill purple">{t('ad.u.badgeAdmin')}</span> : user!.isActive ? <span className="pill green">{t('ad.u.badgeActive')}</span> : <span className="pill gray">{t('ad.u.badgeInactive')}</span>);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={creating ? t('ad.u.newUser') : t('ad.u.edit', { name: user!.name })}>
        <div className="drawer-h">
          {creating ? <span className="cell-icon tone-blue" style={{ width: 40, height: 40 }}><Icon name="plus" size={20} /></span> : <Avatar name={user!.name} large />}
          <div className="grow">
            <h1 style={{ fontSize: 18 }}>{creating ? t('ad.u.newUser') : user!.name}</h1>
            <div className="muted">{creating ? t('ad.u.newUserSub') : user!.email}</div>
          </div>
          {badge}
          <button className="ghost" aria-label={t('c.close')} onClick={onClose} style={{ padding: '0 8px' }}><Icon name="close" size={18} /></button>
        </div>

        <div className="drawer-b">
          <section>
            <div className="sec-title">{t('ad.u.profile')}</div>
            <div className="two">
              <div><label htmlFor="u-name">{t('ad.u.fullNameEn')}</label><input id="u-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus={creating} /></div>
              <div><label htmlFor="u-name-bn">{t('ad.u.fullNameBn')} <span className="muted" style={{ fontWeight: 400 }}>{t('c.optional')}</span></label><input id="u-name-bn" value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder={t('ad.u.fullNameBnPh')} /></div>
              <div><label htmlFor="u-phone">{t('ad.u.phone')} <span className="muted" style={{ fontWeight: 400 }}>{t('c.optional')}</span></label><input id="u-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              {creating && (
                <>
                  <div style={{ gridColumn: '1 / -1' }}><label htmlFor="u-email">{t('ad.u.email')}</label><input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="u-pass">{t('ad.u.tempPass')}</label>
                    <div className="pw-row">
                      <input id="u-pass" className="mono" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="off" />
                      <button type="button" onClick={() => setPassword(generatePassword())}>{t('c.generate')}</button>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(password).then(() => toast.ok(t('ad.u.pwCopied')))}>{t('c.copy')}</button>
                    </div>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label>{t('c.langLabel')}</label>
                    <div className="seg" role="radiogroup" aria-label={t('c.langLabel')}>
                      {(['bn', 'en'] as const).map((l) => (
                        <button type="button" key={l} role="radio" aria-checked={language === l} className={language === l ? 'on' : ''} onClick={() => setLanguage(l)}>{l === 'bn' ? 'বাংলা' : 'English'}</button>
                      ))}
                    </div>
                    <div className="muted" style={{ marginTop: 4 }}>{t('ad.u.langHint')}</div>
                  </div>
                </>
              )}
            </div>
            {creating && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12 }}>
                <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
                {t('ad.u.adminCheck')}
              </label>
            )}
          </section>

          {showPositions ? (
            <section>
              <div className="sec-title">{t('ad.u.positions')}</div>
              <PositionsEditor rows={rows} onChange={setRows} units={data.units} positions={data.positions} users={data.users} secretariats={data.secretariats} selfId={user?.id} />
            </section>
          ) : (
            <section>
              <div className="sec-title">{t('ad.u.positions')}</div>
              <p className="muted">{t('ad.u.adminNoPos')}</p>
            </section>
          )}

          {!creating && (
            <section>
              <div className="sec-title">{t('ad.u.account')}</div>
              <div className="danger-zone stack">
                <div className="row between">
                  <div>
                    <b>{t('ad.u.resetTitle')}</b>
                    <div className="muted">{t('ad.u.resetText')}</div>
                  </div>
                  <button onClick={() => setModal('reset')}><Icon name="key" /> {t('ad.u.resetBtn')}</button>
                </div>
                {user!.id !== me?.id && (
                  <div className="row between" style={{ borderTop: '1px solid var(--red-bg)', paddingTop: 12 }}>
                    <div>
                      <b>{user!.isActive ? t('ad.u.deactTitle') : t('ad.u.reactTitle')}</b>
                      <div className="muted">{user!.isActive ? t('ad.u.deactText') : t('ad.u.reactText')}</div>
                    </div>
                    <button className={user!.isActive ? 'danger' : ''} onClick={() => setModal('deactivate')}>{user!.isActive ? t('ad.u.deactBtn') : t('ad.u.reactBtn')}</button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div className="drawer-f">
          <Err msg={error} />
          <span className="grow" />
          {!creating && !dirty && <span className="muted">{t('c.noChanges')}</span>}
          <button onClick={onClose}>{dirty && !creating ? t('c.discard') : t('c.close')}</button>
          <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? t('c.saving') : creating ? t('ad.u.createBtn') : t('c.saveChanges')}</button>
        </div>
      </aside>

      {modal === 'reset' && user && <ResetModal user={user} onClose={() => setModal(null)} />}
      {modal === 'deactivate' && user && (
        <Modal title={user.isActive ? t('ad.u.deactModal', { name: personName(user) }) : t('ad.u.reactModal', { name: personName(user) })} onClose={() => setModal(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{user.isActive ? t('ad.u.deactModalText') : t('ad.u.reactModalText')}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)}>{t('c.cancel')}</button>
            <button
              className={user.isActive ? 'danger' : 'primary'}
              onClick={async () => {
                try {
                  await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user.isActive }) });
                  toast.ok(user.isActive ? t('ad.u.deactivatedToast') : t('ad.u.reactivatedToast'));
                  setModal(null);
                  await onSaved();
                } catch (e: any) {
                  toast.error(err(e.message));
                }
              }}
            >
              {user.isActive ? t('ad.u.deactBtn').replace('…', '') : t('ad.u.reactBtn')}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ResetModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const toast = useToast();
  const { t, err, personName } = useI18n();
  const [pw, setPw] = useState(generatePassword());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await post(`/users/${user.id}/reset-password`, { password: pw });
      setDone(true);
    } catch (e: any) {
      toast.error(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('ad.u.resetModal', { name: personName(user) })} onClose={onClose}>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>{done ? t('ad.u.resetDoneText') : t('ad.u.resetModalText')}</p>
      <label htmlFor="r-pass">{t('ad.u.tempPass')}</label>
      <div className="pw-row">
        <input id="r-pass" className="mono" value={pw} onChange={(e) => setPw(e.target.value)} readOnly={done} minLength={8} />
        {!done && <button type="button" onClick={() => setPw(generatePassword())}>{t('c.generate')}</button>}
        <button type="button" onClick={() => navigator.clipboard?.writeText(pw).then(() => toast.ok(t('ad.u.pwCopied')))}>{t('c.copy')}</button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        {done ? (
          <button className="primary" onClick={onClose}>{t('ad.u.done')}</button>
        ) : (
          <>
            <button onClick={onClose}>{t('c.cancel')}</button>
            <button className="primary" disabled={busy || pw.length < 8} onClick={go}>{busy ? t('ad.u.resetting') : t('ad.u.resetDo')}</button>
          </>
        )}
      </div>
    </Modal>
  );
}
