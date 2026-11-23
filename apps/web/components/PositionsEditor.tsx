'use client';
import type { AdminUser, Pos, Secretariat, Unit } from '../lib/orgdata';
import { useI18n } from '../lib/i18n';

export type Row = { unitId: string; positionId: string; reportsToUserId: string; secretariatId: string; isPrimary: boolean };

export const emptyRow = (units: Unit[], positions: Pos[]): Row => ({
  unitId: (units.find((u) => u.type === 'HEAD_OFFICE') ?? units[0])?.id ?? '',
  positionId: positions[positions.length - 1]?.id ?? '',
  reportsToUserId: '',
  secretariatId: '',
  isPrimary: false,
});

export const rowsFromUser = (u: AdminUser): Row[] =>
  u.positions.map((p) => ({ unitId: p.unit.id, positionId: p.position.id, reportsToUserId: p.reportsToUserId ?? '', secretariatId: p.secretariatId ?? '', isPrimary: p.isPrimary }));

/** Payload the API expects: empty strings become undefined, exactly one primary. */
export const rowsToPayload = (rows: Row[]) => {
  const primary = Math.max(0, rows.findIndex((r) => r.isPrimary));
  return rows.map((r, i) => ({
    unitId: r.unitId,
    positionId: r.positionId,
    reportsToUserId: r.reportsToUserId || undefined,
    secretariatId: r.secretariatId || undefined,
    isPrimary: i === primary,
  }));
};

type Props = {
  rows: Row[];
  onChange: (rows: Row[]) => void;
  units: Unit[];
  positions: Pos[];
  users: AdminUser[];
  secretariats: Secretariat[];
  selfId?: string;
};

/**
 * One card per position the person holds (Secretary + Unit Head, etc.).
 * A person works either in a UNIT or in a SECRETARIAT (division): the two are separate groups.
 * (A secretariat still belongs to one unit, which is filled in automatically.)
 */
export default function PositionsEditor({ rows, onChange, units, positions, users, secretariats, selfId }: Props) {
  const { t, posTitle, unitName, personName } = useI18n();
  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const makePrimary = (i: number) => onChange(rows.map((r, j) => ({ ...r, isPrimary: j === i })));
  const bosses = users.filter((u) => u.isActive && !u.isAdmin && u.id !== selfId);
  const unitOf = (id: string) => units.find((u) => u.id === id);
  const headId = (units.find((u) => u.type === 'HEAD_OFFICE') ?? units[0])?.id ?? '';
  const isWide = (positionId: string) => !!positions.find((p) => p.id === positionId)?.orgWide;
  const pickPosition = (i: number, positionId: string) => set(i, isWide(positionId) ? { positionId, secretariatId: '', unitId: headId } : { positionId });

  const toSecretariat = (i: number) => {
    const first = secretariats[0];
    if (first) set(i, { secretariatId: first.id, unitId: first.unitId });
  };

  return (
    <div className="stack">
      {rows.length === 0 && <div className="muted">{t('pe.noPositions')}</div>}
      {rows.map((r, i) => {
        const inSec = !!r.secretariatId;
        const wide = isWide(r.positionId);
        return (
          <div key={i} className="pos-card">
            <div style={{ marginBottom: 10 }}>
              <label>{t('pe.position')}</label>
              <select value={r.positionId} onChange={(e) => pickPosition(i, e.target.value)}>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>{posTitle(p)}</option>
                ))}
              </select>
              {wide && <div className="muted" style={{ marginTop: 4 }}>{t('pe.wideNote')}</div>}
            </div>
            {!wide && <div style={{ marginBottom: 10 }}>
              <label>{t('pe.worksIn')}</label>
              <div className="seg" role="radiogroup" aria-label={t('pe.worksIn')}>
                <button type="button" role="radio" aria-checked={!inSec} className={!inSec ? 'on' : ''} onClick={() => set(i, { secretariatId: '' })}>{t('pe.modeUnit')}</button>
                <button type="button" role="radio" aria-checked={inSec} className={inSec ? 'on' : ''} disabled={secretariats.length === 0} onClick={() => !inSec && toSecretariat(i)}>{t('pe.modeSec')}</button>
              </div>
              {secretariats.length === 0 && <div className="muted" style={{ marginTop: 4 }}>{t('pe.noDivisions')}</div>}
            </div>}
            <div className="two">
              {!wide && <div>
                <label>{inSec ? t('pe.secretariat') : t('pe.unit')}</label>
                {inSec ? (
                  <select value={r.secretariatId} onChange={(e) => { const s = secretariats.find((x) => x.id === e.target.value); set(i, { secretariatId: e.target.value, unitId: s?.unitId ?? r.unitId }); }}>
                    {secretariats.map((s) => {
                      const u = unitOf(s.unitId);
                      return <option key={s.id} value={s.id}>{unitName(s)}{u ? ` · ${unitName(u)}` : ''}</option>;
                    })}
                  </select>
                ) : (
                  <select value={r.unitId} onChange={(e) => set(i, { unitId: e.target.value })}>
                    {units.filter((u) => u.isActive || u.id === r.unitId).map((u) => (
                      <option key={u.id} value={u.id}>{unitName(u)}</option>
                    ))}
                  </select>
                )}
              </div>}
              <div>
                <label>{t('pe.reportsTo')}</label>
                <select value={r.reportsToUserId} onChange={(e) => set(i, { reportsToUserId: e.target.value })}>
                  <option value="">{t('pe.nobody')}</option>
                  {bosses.map((u) => (
                    <option key={u.id} value={u.id}>{personName(u)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row between" style={{ marginTop: 8 }}>
              <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                <input type="radio" name="primary" checked={r.isPrimary || (rows.every((x) => !x.isPrimary) && i === 0)} onChange={() => makePrimary(i)} /> {t('pe.primary')}
              </label>
              <button type="button" className="danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>{t('c.remove')}</button>
            </div>
          </div>
        );
      })}
      <div>
        <button type="button" onClick={() => onChange([...rows, emptyRow(units, positions)])}>{t('pe.add')}</button>
      </div>
    </div>
  );
}
