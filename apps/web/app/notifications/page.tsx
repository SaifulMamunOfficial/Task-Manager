'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { Err, PageHead } from '../../components/bits';
import { Icon } from '../../components/icons';

export default function Notifications() {
  const { t, dateTime, notifText, err } = useI18n();
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const load = () => api('/notifications').then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const unread = list?.filter((x) => !x.readAt).length ?? 0;

  async function markAll() {
    await post('/notifications/read', {});
    window.dispatchEvent(new Event('tm:refresh'));
    load();
  }

  return (
    <>
      <PageHead
        title={t('nt.title')}
        subtitle={unread > 0 ? t('nt.unread', { n: unread }) : t('nt.caughtUp')}
        actions={<button onClick={markAll} disabled={unread === 0}><Icon name="check" /> {t('nt.markAll')}</button>}
      />
      <Err msg={error ? err(error) : ''} />
      {list === null ? (
        <div className="empty">{t('c.loading')}</div>
      ) : list.length === 0 ? (
        <div className="card empty">{t('nt.empty')}</div>
      ) : (
        list.map((x) => {
          const id = x.payload?.assignmentId;
          const cls = `item ${x.readAt ? '' : 'unread'}`;
          const body = (
            <>
              <div style={{ fontWeight: x.readAt ? 400 : 650 }}>{notifText(x)}</div>
              <div className="muted">{dateTime(x.createdAt)}</div>
            </>
          );
          return id ? (
            <Link key={x.id} href={`/tasks/${id}`} className={cls} onClick={() => post('/notifications/read', { ids: [x.id] })}>
              {body}
            </Link>
          ) : (
            <div key={x.id} className={cls}>
              {body}
            </div>
          );
        })
      )}
    </>
  );
}
