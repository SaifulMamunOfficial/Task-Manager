'use client';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { Err, PageHead } from '../../../components/bits';

export default function Audit() {
  const { t, has, dateTime, err } = useI18n();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/settings/audit?limit=200').then(setRows).catch((e) => setError(e.message)); }, []);

  // Known action / entity codes are translated; anything else is shown as stored.
  const label = (prefix: string, code: string) => (has(`${prefix}${code}`) ? t(`${prefix}${code}`) : code);

  return (
    <>
      <PageHead title={t('nav.audit')} subtitle={t('ad.a.sub')} />
      <Err msg={error ? err(error) : ''} />
      {rows === null ? (
        <div className="empty">{t('c.loading')}</div>
      ) : (
        <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', background: 'var(--surface-2)' }}>
                <th style={{ padding: 10 }}>{t('ad.a.when')}</th>
                <th style={{ padding: 10 }}>{t('ad.a.who')}</th>
                <th style={{ padding: 10 }}>{t('ad.a.action')}</th>
                <th style={{ padding: 10 }}>{t('ad.a.on')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10, whiteSpace: 'nowrap' }}>{dateTime(r.createdAt)}</td>
                  <td style={{ padding: 10 }}>{r.actor?.name ?? t('ad.a.system')}</td>
                  <td style={{ padding: 10 }}>{label('ad.a.act.', r.action)}</td>
                  <td style={{ padding: 10 }}>{label('ad.a.ent.', r.entity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
