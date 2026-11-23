'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, post } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { currentSubscription, disablePush, enablePush, pushPermission } from '../lib/push';
import { Err } from './bits';
import { Icon } from './icons';
import { useToast } from './toast';

type Prefs = {
  notifyEmail: boolean;
  notifyPush: boolean;
  email: string;
  emailAvailable: boolean;
  webPushAvailable: boolean;
  mobilePushAvailable: boolean;
  publicKey: string | null;
  browsers: { id: string; endpoint: string }[];
  phones: number;
};

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export default function NotificationSettings() {
  const { t, err } = useI18n();
  const toast = useToast();
  const [p, setP] = useState<Prefs | null>(null);
  const [error, setError] = useState('');
  const [here, setHere] = useState<boolean | null>(null); // is THIS browser subscribed?
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setP(await api('/notify/preferences'));
      setPerm(pushPermission());
      setHere(!!(await currentSubscription()));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function pref(patch: Partial<Pick<Prefs, 'notifyEmail' | 'notifyPush'>>) {
    try {
      setP(await api('/notify/preferences', { method: 'PUT', body: JSON.stringify(patch) }));
      toast.ok(t('c.saved'));
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }

  async function turnOn() {
    if (!p?.publicKey) return;
    setBusy(true);
    try {
      const r = await enablePush(p.publicKey);
      if (r === 'ok') toast.ok(t('ac.enabledToast'));
      else toast.error(r === 'denied' ? t('ac.denied') : t('ac.unsupported'));
    } catch (e: any) {
      toast.error(err(e.message));
    } finally {
      setBusy(false);
      load();
    }
  }
  async function turnOff() {
    setBusy(true);
    try {
      await disablePush();
      toast.ok(t('ac.disabledToast'));
    } catch (e: any) {
      toast.error(err(e.message));
    } finally {
      setBusy(false);
      load();
    }
  }
  async function sendTest() {
    try {
      const r = await post('/push/test');
      const n = r.web + r.mobile;
      n > 0 ? toast.ok(t('ac.testSent', { n })) : toast.error(t('ac.testNone'));
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }

  if (!p) return error ? <Err msg={err(error)} /> : <div className="empty">{t('c.loading')}</div>;

  const status =
    perm === 'unsupported' ? t('ac.unsupported') : perm === 'denied' ? t('ac.statusBlocked') : here ? t('ac.statusOn') : t('ac.statusOff');

  return (
    <div className="pf-tabbody">
      <p className="muted" style={{ margin: '0 0 4px' }}>{t('ac.sub')}</p>
      <div className="panel">
        <div className="panel-h">
          <span className="row" style={{ gap: 8 }}><Icon name="inbox" size={16} /> {t('ac.email')}</span>
          <Switch on={p.notifyEmail && p.emailAvailable} disabled={!p.emailAvailable} onChange={(v) => pref({ notifyEmail: v })} label={t('ac.email')} />
        </div>
        <div className="panel-b">
          <p className="muted" style={{ fontSize: 14 }}>{p.emailAvailable ? t('ac.emailText', { email: p.email }) : t('ac.emailOff')}</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <span className="row" style={{ gap: 8 }}><Icon name="bell" size={16} /> {t('ac.push')}</span>
          <Switch on={p.notifyPush && (p.webPushAvailable || p.mobilePushAvailable)} disabled={!p.webPushAvailable && !p.mobilePushAvailable} onChange={(v) => pref({ notifyPush: v })} label={t('ac.master')} />
        </div>
        <div className="panel-b stack">
          {!p.webPushAvailable && !p.mobilePushAvailable ? (
            <p className="muted" style={{ fontSize: 14 }}>{t('ac.pushOff')}</p>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 14 }}>{t('ac.pushText')}</p>
              {p.webPushAvailable && (
                <div className="card" style={{ margin: 0, background: 'var(--surface-2)' }}>
                  <div style={{ fontWeight: 650, marginBottom: 4 }}>{t('ac.thisBrowser')}</div>
                  <p className={perm === 'denied' ? 'late' : 'muted'} style={{ fontSize: 14, marginBottom: 12 }}>{status}</p>
                  <div className="row">
                    {perm !== 'unsupported' && perm !== 'denied' && (here ? (
                      <>
                        <button onClick={sendTest}>{t('ac.test')}</button>
                        <button onClick={turnOff} disabled={busy}>{t('ac.disable')}</button>
                      </>
                    ) : (
                      <button className="primary" onClick={turnOn} disabled={busy}>{t('ac.enable')}</button>
                    ))}
                  </div>
                </div>
              )}
              <p className="muted">{t('ac.devices', { browsers: p.browsers.length, phones: p.phones })}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
