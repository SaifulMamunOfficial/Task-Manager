'use client';
import Link from 'next/link';
import { useOrgData } from '../../lib/orgdata';
import { useI18n } from '../../lib/i18n';
import { Err, PageHead, StatCard } from '../../components/bits';

export default function Admin() {
  const d = useOrgData();
  const { t, n, posTitle, err, unitName, personName } = useI18n();
  const active = d.users.filter((u) => u.isActive && !u.isAdmin);
  const noPosition = active.filter((u) => u.positions.length === 0);
  const noBoss = active.flatMap((u) => u.positions.filter((p) => !p.reportsToUserId && p.position.level > 1).map((p) => ({ u, p })));

  return (
    <>
      <PageHead title={t('nav.overview')} subtitle={t('ad.ov.sub')} />
      <Err msg={d.error ? err(d.error) : ''} />
      <div className="stats">
        <StatCard label={t('ad.ov.people')} value={n(active.length)} icon="users" tone="blue" href="/admin/users" />
        <StatCard label={t('ad.ov.units')} value={n(d.units.filter((u) => u.isActive).length)} icon="building" tone="purple" href="/admin/org" />
        <StatCard label={t('ad.ov.noPos')} value={n(noPosition.length)} icon="alert" tone={noPosition.length ? 'amber' : 'green'} href="/admin/users" />
        <StatCard label={t('ad.ov.noMgr')} value={n(noBoss.length)} icon="alert" tone={noBoss.length ? 'amber' : 'green'} href="/admin/users" />
      </div>

      {(noPosition.length > 0 || noBoss.length > 0) && (
        <div className="card attention-card">
          <h2>{t('ad.ov.attention')}</h2>
          {noPosition.map((u) => <div key={u.id}>{t('ad.ov.noPosLine', { name: personName(u) })} <Link href="/admin/users">{t('ad.ov.fix')}</Link></div>)}
          {noBoss.slice(0, 8).map(({ u, p }) => <div key={u.id + p.id}>{t('ad.ov.noMgrLine', { name: personName(u), pos: posTitle(p.position), unit: unitName(p.unit) })} <Link href="/admin/users">{t('ad.ov.fix')}</Link></div>)}
        </div>
      )}

      {d.units.filter((u) => u.isActive).map((u) => (
        <div className="card" key={u.id}>
          <h2>{unitName(u)}</h2>
          {d.users.filter((x) => x.isActive && x.positions.some((p) => p.unit.id === u.id)).length === 0 && <span className="muted">{t('ad.ov.noMembers')}</span>}
          <ul style={{ margin: 0 }}>
            {d.users.filter((x) => x.isActive).flatMap((x) => x.positions.filter((p) => p.unit.id === u.id).map((p) => (
              <li key={x.id + p.id}>{personName(x)}, {posTitle(p.position)}{p.reportsToUserId ? <span className="muted"> → {t('ad.ov.reportsTo', { name: personName(d.users.find((b) => b.id === p.reportsToUserId)) })}</span> : null}</li>
            )))}
          </ul>
        </div>
      ))}
    </>
  );
}
