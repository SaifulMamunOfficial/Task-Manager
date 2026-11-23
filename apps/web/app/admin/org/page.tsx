'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, post } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { useOrgData, type Pos, type Unit } from '../../../lib/orgdata';
import { Avatar, Err, PageHead, Skeleton, StatCard } from '../../../components/bits';
import { Icon } from '../../../components/icons';
import { Modal } from '../../../components/Modal';
import { PositionModal } from '../../../components/PositionModal';
import { useToast } from '../../../components/toast';

type OrgData = ReturnType<typeof useOrgData>;

export default function Org() {
  const d = useOrgData();
  const { t, n, posTitle, err, lang, unitName, personName } = useI18n();
  const [openUnit, setOpenUnit] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { kind: 'unit' } | { kind: 'position'; position?: Pos }>(null);
  const [showInactive, setShowInactive] = useState(false);

  const activeUsers = d.users.filter((u) => u.isActive && !u.isAdmin);
  // People who work directly in a unit. People who work in one of its secretariats (divisions) are counted there instead.
  const membersOf = (unitId: string) => activeUsers.filter((u) => u.positions.some((p) => p.unit.id === unitId && !p.secretariatId));
  const divisionMembers = (secId: string) => activeUsers.filter((u) => u.positions.some((p) => p.secretariatId === secId));
  const holders = (positionId: string) => activeUsers.filter((u) => u.positions.some((p) => p.position.id === positionId)).length;

  const units = useMemo(
    () => [...d.units].filter((u) => showInactive || u.isActive).sort((a, b) => Number(b.type === 'HEAD_OFFICE') - Number(a.type === 'HEAD_OFFICE') || a.name.localeCompare(b.name)),
    [d.units, showInactive],
  );
  const hiddenCount = d.units.filter((u) => !u.isActive).length;
  const unit = d.units.find((u) => u.id === openUnit);

  return (
    <>
      <PageHead title={t('nav.organization')} subtitle={t('ad.o.sub')} />
      <Err msg={d.error ? err(d.error) : ''} />

      <div className="stats">
        <StatCard label={t('ad.ov.units')} value={n(d.units.filter((u) => u.isActive).length)} icon="building" tone="purple" />
        <StatCard label={t('ad.o.statSecretariats')} value={n(d.secretariats.length)} icon="inbox" tone="blue" />
        <StatCard label={t('ad.o.statPositions')} value={n(d.positions.length)} icon="tasks" tone="amber" />
        <StatCard label={t('ad.ov.people')} value={n(activeUsers.length)} icon="users" tone="green" href="/admin/users" />
      </div>

      <div className="org-stack">
        <div className="panel org-card">
          <div className="panel-h">
            <span className="row" style={{ gap: 8 }}>
              {t('ad.o.unitsTitle')} <span className="count-pill">{n(d.units.filter((u) => u.isActive).length)}</span>
            </span>
            <span className="row" style={{ gap: 12 }}>
              {hiddenCount > 0 && (
                <label className="check-inline">
                  <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> {t('ad.o.showInactive', { n: hiddenCount })}
                </label>
              )}
              <button className="primary sm" onClick={() => setModal({ kind: 'unit' })}><Icon name="plus" size={14} /> {t('ad.o.newUnit')}</button>
            </span>
          </div>
          {d.loading ? (
            <div style={{ padding: 16 }}><Skeleton rows={3} /></div>
          ) : (
            <div className="list flush">
              <div className="orow head" aria-hidden="true"><span>{t('ad.o.colUnit')}</span><span>{t('ad.o.colMembers')}</span><span>{t('ad.o.colSecs')}</span><span>{t('ad.o.colStatus')}</span><span /></div>
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
                        <div className="nm">{unitName(u)}</div>
                        <div className="em">{u.type === 'HEAD_OFFICE' ? t('ad.o.headOffice') : parent ? t('ad.o.under', { name: unitName(parent) }) : t('ad.o.unitBranch')}</div>
                      </div>
                    </div>
                    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      {members.length === 0 ? (
                        <span className="muted">{t('c.none')}</span>
                      ) : (
                        <>
                          <span className="avstack">{members.slice(0, 4).map((m) => <Avatar key={m.id} name={personName(m)} />)}</span>
                          <span className="muted">{n(members.length)}</span>
                        </>
                      )}
                    </div>
                    <div className="tagrow">
                      {secs.length === 0 && <span className="muted">{t('c.none')}</span>}
                      {secs.map((s) => <span key={s.id} className="tagchip">{unitName(s)} <b>{n(divisionMembers(s.id).length)}</b></span>)}
                    </div>
                    <div>{u.isActive ? <span className="pill green">{t('ad.o.active')}</span> : <span className="pill gray">{t('ad.o.inactive')}</span>}</div>
                    <button className="ghost sm" tabIndex={-1} aria-label={t('ad.o.open', { name: unitName(u) })} style={{ padding: '0 8px' }}><Icon name="chevron" size={16} /></button>
                  </div>
                );
              })}
              {units.length === 0 && <div className="empty"><b>{t('ad.o.noUnits')}</b></div>}
            </div>
          )}
        </div>

        <div className="panel org-card">
          <div className="panel-h">
            <span className="row" style={{ gap: 8 }}>
              {t('ad.o.positions')} <span className="count-pill">{n(d.positions.length)}</span>
            </span>
            <button className="primary sm" onClick={() => setModal({ kind: 'position' })} aria-label={t('ad.o.newPosition')}><Icon name="plus" size={14} /> {t('ad.o.newPosition')}</button>
          </div>
          <div className="list flush">
            <div className="orow prow2 head" aria-hidden="true"><span>{t('ad.o.colLevel')}</span><span>{t('ad.o.colPosition')}</span><span>{t('ad.o.colOther')}</span><span>{t('ad.o.colPeople')}</span><span /></div>
            {[...d.positions].sort((x, y) => x.level - y.level).map((p) => {
              const other = lang === 'bn' ? p.title : p.titleBn;
              const count = holders(p.id);
              return (
                <div
                  key={p.id}
                  className="orow prow2"
                  role="button"
                  tabIndex={0}
                  onClick={() => setModal({ kind: 'position', position: p })}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setModal({ kind: 'position', position: p }))}
                >
                  <span className="lvl" title={t('ad.o.levelTitle')}>{n(p.level)}</span>
                  <div className="nm">{posTitle(p)}</div>
                  <div className="muted">{other && other !== posTitle(p) ? other : '—'}</div>
                  <div><span className={`pill ${count ? 'blue' : 'gray'}`}>{t(count === 1 ? 'c.person' : 'c.people', { n: count })}</span></div>
                  <button className="ghost sm" tabIndex={-1} aria-label={t('ad.u.edit', { name: posTitle(p) })} style={{ padding: '0 8px' }}><Icon name="chevron" size={16} /></button>
                </div>
              );
            })}
          </div>
          <p className="muted org-note" style={{ margin: 0, padding: '12px 18px' }}>
            {t('ad.o.levelNote')} <Link href="/admin/rules">{t('nav.rules')}</Link>.
          </p>
        </div>
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
  const { t, n, posTitle, err, unitName, personName } = useI18n();
  const [name, setName] = useState(unit.name);
  const [nameBn, setNameBn] = useState(unit.nameBn ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<null | 'toggle' | { sec: string; name: string }>(null);
  const [secName, setSecName] = useState('');
  const [secNameBn, setSecNameBn] = useState('');
  const [secUser, setSecUser] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.modal') && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const secs = d.secretariats.filter((s) => s.unitId === unit.id);
  // Everyone who belongs to this unit or to one of its secretariats (used to pick a secretary); the unit's own members are only those not in a secretariat.
  const allPeople = d.users.filter((u) => u.isActive && !u.isAdmin && u.positions.some((p) => p.unit.id === unit.id));
  const members = allPeople.filter((u) => u.positions.some((p) => p.unit.id === unit.id && !p.secretariatId));
  const peopleOf = (secId: string) => allPeople.filter((u) => u.positions.some((p) => p.secretariatId === secId));
  const parent = d.units.find((u) => u.id === unit.parentId);
  const dirty = name.trim() !== unit.name || nameBn.trim() !== (unit.nameBn ?? '');
  const sub = unit.type === 'HEAD_OFFICE' ? t('ad.o.headOffice') : parent ? t('ad.o.under', { name: unitName(parent) }) : t('ad.o.unitBranch');

  async function run(fn: () => Promise<unknown>, ok: string) {
    setError('');
    setBusy(true);
    try {
      await fn();
      toast.ok(ok);
      await d.reload();
      return true;
    } catch (e: any) {
      setError(err(e.message));
      toast.error(err(e.message));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={t('ad.o.unitAria', { name: unitName(unit) })}>
        <div className="drawer-h">
          <span className={`cell-icon ${unit.type === 'HEAD_OFFICE' ? 'tone-blue' : 'tone-purple'}`} style={{ width: 42, height: 42 }}><Icon name="building" size={20} /></span>
          <div className="grow">
            <h1 style={{ fontSize: 18 }}>{unitName(unit)}</h1>
            <div className="muted">{sub}</div>
          </div>
          {unit.isActive ? <span className="pill green">{t('ad.o.active')}</span> : <span className="pill gray">{t('ad.o.inactive')}</span>}
          <button className="ghost" aria-label={t('c.close')} onClick={onClose} style={{ padding: '0 8px' }}><Icon name="close" size={18} /></button>
        </div>

        <div className="drawer-b">
          <section>
            <div className="sec-title">{t('ad.o.details')}</div>
            <div className="two">
              <div><label htmlFor="un">{t('ad.o.nameEn')}</label><input id="un" value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><label htmlFor="unb">{t('ad.o.nameBn')}</label><input id="unb" value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder={t('ad.o.nameBnPh')} /></div>
            </div>
            <p className="muted" style={{ marginTop: 6 }}>{t('ad.o.nameHint')}</p>
          </section>

          <section>
            <div className="sec-title">{t('ad.o.secs')} <span>{n(secs.length)}</span></div>
            {secs.length === 0 && <p className="muted" style={{ marginBottom: 10 }}>{t('ad.o.noSecs')}</p>}
            {secs.map((s) => {
              const sec = d.users.find((u) => u.id === s.secretaryUserId);
              return (
                <div key={s.id} className="file" style={{ background: 'var(--surface)' }}>
                  <span className="grow">
                    <b>{unitName(s)}</b>
                    <div className="muted" style={{ fontSize: 12.5 }}>{t('ad.o.secretaryIs', { name: personName(sec) ?? t('ad.o.notSet') })} · {t('ad.o.divMembers', { n: peopleOf(s.id).length })}</div>
                    {peopleOf(s.id).length === 0 ? (
                      <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{t('ad.o.noDivMembers')}</div>
                    ) : (
                      <div className="tagrow" style={{ marginTop: 6 }}>{peopleOf(s.id).map((m) => <span key={m.id} className="tagchip">{personName(m)}</span>)}</div>
                    )}
                  </span>
                  <button className="danger sm" onClick={() => setConfirm({ sec: s.id, name: unitName(s) })}>{t('c.delete')}</button>
                </div>
              );
            })}
            <form
              className="row"
              style={{ marginTop: 10, flexWrap: 'nowrap', alignItems: 'flex-end' }}
              onSubmit={async (e) => {
                e.preventDefault();
                if (!secName.trim()) return;
                const ok = await run(() => post('/secretariats', { name: secName.trim(), nameBn: secNameBn.trim() || undefined, unitId: unit.id, secretaryUserId: secUser || undefined }), t('ad.o.secAdded'));
                if (ok) { setSecName(''); setSecNameBn(''); setSecUser(''); }
              }}
            >
              <div className="grow"><label htmlFor="sn">{t('ad.o.newSec')}</label><input id="sn" placeholder={t('ad.o.nameEn')} value={secName} onChange={(e) => setSecName(e.target.value)} /></div>
              <div className="grow"><label htmlFor="snb">{t('ad.o.nameBn')}</label><input id="snb" placeholder={t('ad.o.nameBnPh')} value={secNameBn} onChange={(e) => setSecNameBn(e.target.value)} /></div>
              <div style={{ width: 170 }}>
                <label htmlFor="ss">{t('ad.o.secretary')}</label>
                <select id="ss" value={secUser} onChange={(e) => setSecUser(e.target.value)}>
                  <option value="">{t('ad.o.notSetCap')}</option>
                  {allPeople.map((m) => <option key={m.id} value={m.id}>{personName(m)}</option>)}
                </select>
              </div>
              <button disabled={busy || !secName.trim()}>{t('c.add')}</button>
            </form>
          </section>

          <section>
            <div className="sec-title">{t('ad.o.unitMembers')} <span>{n(members.length)}</span></div>
            {members.length === 0 && <p className="muted">{t('ad.o.noMembers')}</p>}
            {members.map((m) => (
              <div key={m.id} className="file" style={{ background: 'var(--surface)' }}>
                <Avatar name={personName(m)} />
                <span className="grow">{personName(m)}</span>
                <span className="tagrow" style={{ justifyContent: 'flex-end' }}>
                  {m.positions.filter((p) => p.unit.id === unit.id && !p.secretariatId).map((p) => <span key={p.id} className="tagchip">{posTitle(p.position)}</span>)}
                </span>
              </div>
            ))}
            <Link href="/admin/users" className="section-link" style={{ display: 'inline-block', marginTop: 6 }}>{t('ad.o.managePeople')}</Link>
          </section>

          {unit.type !== 'HEAD_OFFICE' && (
            <section>
              <div className="sec-title">{t('ad.o.statusTitle')}</div>
              <div className="danger-zone">
                <div className="row between">
                  <div>
                    <b>{unit.isActive ? t('ad.o.deactUnit') : t('ad.o.reactUnit')}</b>
                    <div className="muted">{unit.isActive ? t('ad.o.deactUnitText') : t('ad.o.reactUnitText')}</div>
                  </div>
                  <button className={unit.isActive ? 'danger' : ''} onClick={() => setConfirm('toggle')}>{unit.isActive ? t('ad.o.deactBtn') : t('ad.o.reactBtn')}</button>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="drawer-f">
          <Err msg={error} />
          <span className="grow" />
          {!dirty && <span className="muted">{t('c.noChanges')}</span>}
          <button onClick={onClose}>{dirty ? t('c.discard') : t('c.close')}</button>
          <button className="primary" disabled={busy || !dirty || !name.trim()} onClick={() => run(() => api(`/units/${unit.id}`, { method: 'PATCH', body: JSON.stringify({ name: name.trim(), nameBn: nameBn.trim() }) }), t('ad.o.renamed'))}>
            {t('c.saveChanges')}
          </button>
        </div>
      </aside>

      {confirm === 'toggle' && (
        <Modal title={unit.isActive ? t('ad.o.deactModal', { name: unit.name }) : t('ad.o.reactModal', { name: unit.name })} onClose={() => setConfirm(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{unit.isActive ? t('ad.o.deactModalText') : t('ad.o.reactModalText')}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirm(null)}>{t('c.cancel')}</button>
            <button className={unit.isActive ? 'danger' : 'primary'} onClick={async () => { await run(() => api(`/units/${unit.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !unit.isActive }) }), unit.isActive ? t('ad.o.unitDeact') : t('ad.o.unitReact')); setConfirm(null); }}>
              {unit.isActive ? t('ad.o.deactBtn').replace('…', '') : t('ad.o.reactBtn')}
            </button>
          </div>
        </Modal>
      )}
      {confirm && typeof confirm === 'object' && (
        <Modal title={t('ad.o.delSecTitle', { name: confirm.name })} onClose={() => setConfirm(null)}>
          <p className="muted" style={{ fontSize: 14, marginBottom: 14 }}>{t('ad.o.delSecText')}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirm(null)}>{t('c.cancel')}</button>
            <button className="danger" onClick={async () => { await run(() => api(`/secretariats/${confirm.sec}`, { method: 'DELETE' }), t('ad.o.secDeleted')); setConfirm(null); }}>{t('c.delete')}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ---------- modals ----------

function NewUnitModal({ d, onClose, onCreated }: { d: OrgData; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const { t, err, unitName } = useI18n();
  const [name, setName] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [parentId, setParentId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = await post('/units', { name: name.trim(), nameBn: nameBn.trim() || undefined, type: 'UNIT', parentId: parentId || undefined });
      toast.ok(t('ad.o.unitCreated'));
      await d.reload();
      onCreated(u.id);
    } catch (e2: any) {
      setError(err(e2.message));
      setBusy(false);
    }
  }

  return (
    <Modal title={t('ad.o.newUnitTitle')} onClose={onClose}>
      <form className="stack" onSubmit={go}>
        <div className="two">
          <div><label htmlFor="nu">{t('ad.o.nameEn')}</label><input id="nu" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ad.o.newUnitPh')} required /></div>
          <div><label htmlFor="nub">{t('ad.o.nameBn')}</label><input id="nub" value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder={t('ad.o.nameBnPh')} /></div>
        </div>
        <p className="muted" style={{ marginTop: -4 }}>{t('ad.o.nameHint')}</p>
        <div>
          <label htmlFor="np">{t('ad.o.belongsUnder')} <span className="muted" style={{ fontWeight: 400 }}>{t('c.optional')}</span></label>
          <select id="np" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t('ad.o.topLevel')}</option>
            {d.units.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{unitName(u)}</option>)}
          </select>
        </div>
        <Err msg={error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>{t('c.cancel')}</button>
          <button className="primary" disabled={busy || !name.trim()}>{busy ? t('ad.o.creating') : t('ad.o.createUnit')}</button>
        </div>
      </form>
    </Modal>
  );
}

