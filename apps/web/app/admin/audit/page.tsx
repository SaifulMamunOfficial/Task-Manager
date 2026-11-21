'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { fmtDate } from '../../../lib/ui';
import { Err } from '../../../components/bits';

export default function Audit() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/settings/audit?limit=200').then(setRows).catch((e) => setError(e.message)); }, []);

  return (
    <>
      <h1>Audit log</h1>
      <p className="muted">Every change made through the admin and task actions. Newest first.</p>
      <Err msg={error} />
      {rows === null ? (
        <div className="empty">Loading…</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#fafbfc' }}>
                <th style={{ padding: 8 }}>When</th>
                <th style={{ padding: 8 }}>Who</th>
                <th style={{ padding: 8 }}>Action</th>
                <th style={{ padding: 8 }}>On</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <td style={{ padding: 8, whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ padding: 8 }}>{r.actor?.name ?? 'System'}</td>
                  <td style={{ padding: 8 }}>{r.action}</td>
                  <td style={{ padding: 8 }}>{r.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
