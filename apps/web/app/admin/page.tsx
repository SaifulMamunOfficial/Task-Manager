'use client';
import Link from 'next/link';
import { useOrgData } from '../../lib/orgdata';
import { Err, PageHead, StatCard } from '../../components/bits';

export default function Admin() {
  const d = useOrgData();
  const active = d.users.filter((u) => u.isActive && !u.isAdmin);
  const noPosition = active.filter((u) => u.positions.length === 0);
  const noBoss = active.flatMap((u) => u.positions.filter((p) => !p.reportsToUserId && p.position.level > 1).map((p) => ({ u, p })));

  return (
    <>
      <PageHead title="Overview" subtitle="People, structure and settings. The admin account does not give or receive tasks." />
      <Err msg={d.error} />
      <div className="stats">
        <StatCard label="Active people" value={active.length} icon="users" tone="blue" href="/admin/users" />
        <StatCard label="Units and branches" value={d.units.filter((u) => u.isActive).length} icon="building" tone="purple" href="/admin/org" />
        <StatCard label="Without a position" value={noPosition.length} icon="alert" tone={noPosition.length ? "amber" : "green"} href="/admin/users" />
        <StatCard label="Without a manager" value={noBoss.length} icon="alert" tone={noBoss.length ? "amber" : "green"} href="/admin/users" />
      </div>

      {(noPosition.length > 0 || noBoss.length > 0) && (
        <div className="card" style={{ background: '#fef0c7', borderColor: '#fedf89' }}>
          <h2>Needs attention</h2>
          {noPosition.map((u) => <div key={u.id}>{u.name} has no position, so cannot give or receive tasks. <Link href="/admin/users">Fix</Link></div>)}
          {noBoss.slice(0, 8).map(({ u, p }) => <div key={u.id + p.id}>{u.name} ({p.position.title}, {p.unit.name}) has no one set to report to. <Link href="/admin/users">Fix</Link></div>)}
        </div>
      )}

      {d.units.filter((u) => u.isActive).map((u) => (
        <div className="card" key={u.id}>
          <h2>{u.name}</h2>
          {d.users.filter((x) => x.isActive && x.positions.some((p) => p.unit.id === u.id)).length === 0 && <span className="muted">No members</span>}
          <ul style={{ margin: 0 }}>
            {d.users.filter((x) => x.isActive).flatMap((x) => x.positions.filter((p) => p.unit.id === u.id).map((p) => (
              <li key={x.id + p.id}>{x.name}, {p.position.title}{p.reportsToUserId ? <span className="muted"> → reports to {d.users.find((b) => b.id === p.reportsToUserId)?.name}</span> : null}</li>
            )))}
          </ul>
        </div>
      ))}
    </>
  );
}
