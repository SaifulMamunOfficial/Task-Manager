'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../../lib/api';
import { fmtDate, notificationText } from '../../lib/ui';
import { Err, PageHead } from '../../components/bits';
import { Icon } from '../../components/icons';

export default function Notifications() {
  const [list, setList] = useState<any[] | null>(null);
  const [error, setError] = useState('');

  const load = () => api('/notifications').then(setList).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const unread = list?.filter((n) => !n.readAt).length ?? 0;

  async function markAll() {
    await post('/notifications/read', {});
    load();
  }

  return (
    <>
      <PageHead
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up.'}
        actions={<button onClick={markAll} disabled={unread === 0}><Icon name="check" /> Mark all as read</button>}
      />
      <Err msg={error} />
      {list === null ? (
        <div className="empty">Loading…</div>
      ) : list.length === 0 ? (
        <div className="card empty">No notifications yet.</div>
      ) : (
        list.map((n) => {
          const id = n.payload?.assignmentId;
          const cls = `item ${n.readAt ? '' : 'unread'}`;
          const body = (
            <>
              <div style={{ fontWeight: n.readAt ? 400 : 650 }}>{notificationText(n)}</div>
              <div className="muted">{fmtDate(n.createdAt)}</div>
            </>
          );
          return id ? (
            <Link key={n.id} href={`/tasks/${id}`} className={cls} onClick={() => post('/notifications/read', { ids: [n.id] })}>
              {body}
            </Link>
          ) : (
            <div key={n.id} className={cls}>
              {body}
            </div>
          );
        })
      )}
    </>
  );
}
