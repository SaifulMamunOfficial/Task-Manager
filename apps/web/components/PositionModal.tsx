'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useOrgData, type Pos } from '../lib/orgdata';
import { Err } from './bits';
import { Icon } from './icons';
import { Modal } from './Modal';
import { useToast } from './toast';

type OrgData = ReturnType<typeof useOrgData>;

/**
 * Add or edit a position. Who this position may give tasks to is set here too, so it is decided
 * together with the position instead of living in a big table that is always on screen.
 */
export function PositionModal({ position, d, onClose }: { position?: Pos; d: OrgData; onClose: () => void }) {
  const toast = useToast();
  const { t, n, posTitle, err } = useI18n();
  const [title, setTitle] = useState(position?.title ?? '');
  const [titleBn, setTitleBn] = useState(position?.titleBn ?? '');
  const [level, setLevel] = useState(String(position?.level ?? 10));
  const [ownTeam, setOwnTeam] = useState(!!position?.ownTeamOnly);
  const [orgWide, setOrgWide] = useState(!!position?.orgWide);
  const [targets, setTargets] = useState<string[] | null>(position ? null : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // The current permission of this position (a new position starts with none).
  useEffect(() => {
    if (!position) return;
    api<{ fromPositionId: string; toPositionId: string }[]>('/settings/delegation')
      .then((rules) => setTargets(rules.filter((r) => r.fromPositionId === position.id).map((r) => r.toPositionId)))
      .catch((e) => setError(err(e.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.id]);

  const options = useMemo(() => [...d.positions].sort((a, b) => a.level - b.level || a.title.localeCompare(b.title)), [d.positions]);
  const chosen = targets ?? [];
  const toggle = (id: string) => setTargets(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const lvl = Number(level) || 10;
  const holders = (pid: string) => d.users.filter((u) => u.isActive && !u.isAdmin && u.positions.some((p) => p.position.id === pid)).length;

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = JSON.stringify({ title: title.trim(), titleBn: titleBn.trim(), level: lvl, ownTeamOnly: ownTeam, orgWide });
      const saved = position ? await api<Pos>(`/positions/${position.id}`, { method: 'PATCH', body }) : await api<Pos>('/positions', { method: 'POST', body });
      // Only write the permission when it was loaded (or the position is new), so a slow load can never wipe it.
      if (targets !== null) await api('/settings/delegation', { method: 'PUT', body: JSON.stringify({ fromPositionId: saved.id, toPositionIds: chosen }) });
      toast.ok(position ? t('ad.o.posUpdated') : t('ad.o.posAdded'));
      await d.reload();
      onClose();
    } catch (e2: any) {
      setError(err(e2.message));
      setBusy(false);
    }
  }

  return (
    <Modal title={position ? t('ad.o.posEdit', { title: posTitle(position) }) : t('ad.o.posNew')} onClose={onClose}>
      <form className="stack" onSubmit={go}>
        <div className="two">
          <div><label htmlFor="pt">{t('ad.o.posTitleEn')}</label><input id="pt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ad.o.posPhEn')} required /></div>
          <div><label htmlFor="ptb">{t('ad.o.posTitleBn')}</label><input id="ptb" value={titleBn} onChange={(e) => setTitleBn(e.target.value)} placeholder={t('ad.o.posPhBn')} /></div>
        </div>
        <p className="muted" style={{ marginTop: -4 }}>{t('ad.o.posTitleHint')}</p>
        <div>
          <label htmlFor="pl">{t('ad.o.level')}</label>
          <input id="pl" type="number" min={1} value={level} onChange={(e) => setLevel(e.target.value)} />
          <p className="muted" style={{ marginTop: 4 }}>{t('ad.o.levelHint')}</p>
        </div>

        <div className="perm-box">
          <div className="row between" style={{ marginBottom: 6 }}>
            <label style={{ margin: 0 }}>{t('ad.r.canGive')}</label>
            <span className="perm-acts">
              <button type="button" className="ghost sm" disabled={targets === null} onClick={() => setTargets(options.filter((o) => o.level > lvl).map((o) => o.id))}>{t('ad.r.below')}</button>
              <button type="button" className="ghost sm" disabled={targets === null} onClick={() => setTargets(options.map((o) => o.id))}>{t('ad.r.selectAll')}</button>
              <button type="button" className="ghost sm" disabled={targets === null} onClick={() => setTargets([])}>{t('ad.r.selectNone')}</button>
            </span>
          </div>
          {targets === null ? (
            <p className="muted">{t('c.loading')}</p>
          ) : options.length === 0 ? (
            <p className="muted">{t('ad.r.noOtherPositions')}</p>
          ) : (
            <div className="pchips">
              {options.map((o) => {
                const on = chosen.includes(o.id);
                return (
                  <button key={o.id} type="button" role="switch" aria-checked={on} className={`pchip ${on ? 'on' : ''}`} onClick={() => toggle(o.id)}>
                    {on && <Icon name="check" size={14} />} {posTitle(o)} <small>{n(holders(o.id))}</small>
                  </button>
                );
              })}
            </div>
          )}
          {targets !== null && chosen.length === 0 && <div className="perm-warn">{t('ad.r.cannotGive')}</div>}
          <label className="own-team">
            <input type="checkbox" checked={orgWide} onChange={(e) => setOrgWide(e.target.checked)} />
            <span>{t('ad.r.orgWide')}<small className="muted">{t('ad.r.orgWideHint')}</small></span>
          </label>
          <label className="own-team" style={{ marginTop: 10, paddingTop: 0, borderTop: 0 }}>
            <input type="checkbox" checked={ownTeam} onChange={(e) => setOwnTeam(e.target.checked)} />
            <span>{t('ad.r.ownTeam')}<small className="muted">{t('ad.r.ownTeamHint')}</small></span>
          </label>
        </div>

        <Err msg={error} />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>{t('c.cancel')}</button>
          <button className="primary" disabled={busy || !title.trim()}>{busy ? t('c.saving') : position ? t('c.save') : t('ad.o.addPosition')}</button>
        </div>
      </form>
    </Modal>
  );
}
