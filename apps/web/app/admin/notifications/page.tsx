'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, post } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { useI18n } from '../../../lib/i18n';
import { Err, PageHead } from '../../../components/bits';
import { Icon } from '../../../components/icons';
import { useToast } from '../../../components/toast';

type Events = { reminders: boolean; tasks: boolean };
type EmailCfg = { enabled: boolean; host: string; port: number; secure: boolean; user: string; from: string; events: Events; hasPassword: boolean; source: 'database' | 'environment' | 'none' };
type PushCfg = { webEnabled: boolean; vapidPublic: string; subject: string; mobileEnabled: boolean; events: Events; hasPrivateKey: boolean; hasExpoToken: boolean; subscriptions: number; devices: number };

const PRESETS = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, secure: false },
  { name: 'Outlook / Microsoft 365', host: 'smtp.office365.com', port: 587, secure: false },
  { name: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 465, secure: true },
];

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, margin: '4px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 2 }} /> <span>{children}</span>
    </label>
  );
}

export default function NotificationSettings() {
  const { t, err } = useI18n();
  const [data, setData] = useState<{ email: EmailCfg; push: PushCfg } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/settings/notifications').then(setData).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  return (
    <>
      <PageHead title={t('nav.notifSettings')} subtitle={t('an.sub')} />
      <Err msg={error ? err(error) : ''} />
      {!data ? (
        <div className="list"><div className="skel" /><div className="skel" /></div>
      ) : (
        <>
          <div className="tab-intro" style={{ marginTop: 0 }}>
            <Icon name="key" size={17} />
            <p>{t('an.secretNote')}</p>
          </div>
          <div className="notif-grid">
            <EmailPanel cfg={data.email} onSaved={load} />
            <PushPanel cfg={data.push} onSaved={load} />
          </div>
        </>
      )}
    </>
  );
}

// ---------- email ----------

function EmailPanel({ cfg, onSaved }: { cfg: EmailCfg; onSaved: () => void }) {
  const { t, err } = useI18n();
  const { me } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ enabled: cfg.enabled, host: cfg.host, port: String(cfg.port), secure: cfg.secure, user: cfg.user, pass: '', from: cfg.from, events: cfg.events });
  const [clearPass, setClearPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [testTo, setTestTo] = useState(me?.email ?? '');
  const [test, setTest] = useState<null | { ok: boolean; msg: string }>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setF({ enabled: cfg.enabled, host: cfg.host, port: String(cfg.port), secure: cfg.secure, user: cfg.user, pass: '', from: cfg.from, events: cfg.events });
    setClearPass(false);
  }, [cfg]);

  const dirty = f.enabled !== cfg.enabled || f.host !== cfg.host || Number(f.port) !== cfg.port || f.secure !== cfg.secure || f.user !== cfg.user || f.from !== cfg.from || f.pass !== '' || clearPass || f.events.reminders !== cfg.events.reminders || f.events.tasks !== cfg.events.tasks;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/settings/notifications/email', {
        method: 'PUT',
        body: JSON.stringify({ enabled: f.enabled, host: f.host, port: Number(f.port) || 587, secure: f.secure, user: f.user, from: f.from, events: f.events, pass: clearPass ? '' : f.pass === '' ? undefined : f.pass }),
      });
      toast.ok(t('an.savedEmail'));
      onSaved();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setTest(null);
    try {
      const r = await post('/settings/notifications/email/test', { to: testTo });
      setTest(r.ok ? { ok: true, msg: t('an.testOk') } : { ok: false, msg: t('an.testFail', { msg: r.error ?? '' }) });
    } catch (e: any) {
      setTest({ ok: false, msg: t('an.testFail', { msg: err(e.message) }) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="row" style={{ gap: 8 }}>
          <Icon name="inbox" size={16} /> {t('an.email')}
          <span className={`pill ${cfg.enabled ? 'green' : 'gray'}`}>{cfg.enabled ? t('an.on') : t('an.off')}</span>
          <span className="muted" style={{ fontWeight: 400 }}>{t(`an.src.${cfg.source}`)}</span>
        </span>
        <Switch on={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label={t('an.emailEnable')} />
      </div>
      <div className="panel-b stack" style={{ gap: 16 }}>
        <h3 className="nsec-h">{t('an.secServer')}</h3>
        <div>
          <label>{t('an.presets')}</label>
          <div className="row" style={{ gap: 6 }}>
            {PRESETS.map((p) => (
              <button type="button" key={p.name} className="chip" onClick={() => setF({ ...f, host: p.host, port: String(p.port), secure: p.secure })}>{p.name}</button>
            ))}
          </div>
          <div className="muted" style={{ marginTop: 4 }}>{t('an.presetNote')}</div>
        </div>

        <div className="two">
          <div><label htmlFor="e-host">{t('an.host')}</label><input id="e-host" value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} placeholder="smtp.example.com" autoComplete="off" /></div>
          <div><label htmlFor="e-port">{t('an.port')}</label><input id="e-port" type="number" min={1} max={65535} value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} /></div>
        </div>
        <div>
          <Check checked={f.secure} onChange={(v) => setF({ ...f, secure: v })}>{t('an.secure')}</Check>
          <div className="muted">{t('an.secureHint')}</div>
        </div>
        <div className="nsec-line" />
        <h3 className="nsec-h">{t('an.secLogin')}</h3>
        <div className="two">
          <div><label htmlFor="e-user">{t('an.user')}</label><input id="e-user" value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} autoComplete="off" /></div>
          <div>
            <label htmlFor="e-pass">{t('an.pass')}</label>
            <input id="e-pass" type="password" value={f.pass} onChange={(e) => { setF({ ...f, pass: e.target.value }); setClearPass(false); }} placeholder={cfg.hasPassword && !clearPass ? '••••••••' : ''} autoComplete="new-password" />
            {cfg.hasPassword && !clearPass && (
              <div className="muted" style={{ marginTop: 4 }}>
                {t('an.passSaved')} <a href="#" onClick={(e) => { e.preventDefault(); setClearPass(true); setF({ ...f, pass: '' }); }}>{t('an.passRemove')}</a>
              </div>
            )}
          </div>
        </div>
        <div><label htmlFor="e-from">{t('an.from')}</label><input id="e-from" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} placeholder="Task Manager <no-reply@example.com>" /></div>

        <div className="nsec-line" />
        <h3 className="nsec-h">{t('an.events')}</h3>
        <div>
          <Check checked={f.events.reminders} onChange={(v) => setF({ ...f, events: { ...f.events, reminders: v } })}>{t('an.evReminders')}</Check>
          <Check checked={f.events.tasks} onChange={(v) => setF({ ...f, events: { ...f.events, tasks: v } })}>{t('an.evTasks')}</Check>
        </div>

        <Err msg={error} />
        <div className="row">
          <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? t('c.saving') : t('c.saveChanges')}</button>
        </div>

        <div className="nsec-line" />
        <h3 className="nsec-h">{t('an.testEmailTitle')}</h3>
        <div>
          <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}>
            <div className="grow"><label htmlFor="e-to">{t('an.testTo')}</label><input id="e-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} /></div>
            <button onClick={sendTest} disabled={testing || !testTo || dirty}>{testing ? t('an.testing') : t('an.testBtn')}</button>
          </div>
          {dirty && <div className="muted" style={{ marginTop: 6 }}>{t('an.testSaveFirst')}</div>}
          {test && <div className={test.ok ? 'ok' : 'err'} role="status">{test.msg}</div>}
        </div>
      </div>
    </div>
  );
}

// ---------- push ----------

function PushPanel({ cfg, onSaved }: { cfg: PushCfg; onSaved: () => void }) {
  const { t, err } = useI18n();
  const toast = useToast();
  const [f, setF] = useState({ webEnabled: cfg.webEnabled, subject: cfg.subject, mobileEnabled: cfg.mobileEnabled, expoToken: '', events: cfg.events });
  const [clearExpo, setClearExpo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setF({ webEnabled: cfg.webEnabled, subject: cfg.subject, mobileEnabled: cfg.mobileEnabled, expoToken: '', events: cfg.events });
    setClearExpo(false);
  }, [cfg]);

  const dirty = f.webEnabled !== cfg.webEnabled || f.subject !== cfg.subject || f.mobileEnabled !== cfg.mobileEnabled || f.expoToken !== '' || clearExpo || f.events.reminders !== cfg.events.reminders || f.events.tasks !== cfg.events.tasks;
  const hasKeys = cfg.hasPrivateKey && !!cfg.vapidPublic;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await api('/settings/notifications/push', {
        method: 'PUT',
        body: JSON.stringify({ webEnabled: f.webEnabled, subject: f.subject, mobileEnabled: f.mobileEnabled, events: f.events, expoToken: clearExpo ? '' : f.expoToken === '' ? undefined : f.expoToken }),
      });
      toast.ok(t('an.savedPush'));
      onSaved();
    } catch (e: any) {
      setError(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  async function keys() {
    if (hasKeys && !confirm(t('an.regenWarn'))) return;
    try {
      const r = await post('/settings/notifications/push/keys');
      toast.ok(t('an.keysDone', { n: r.clearedSubscriptions }));
      onSaved();
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }

  async function sendTest() {
    try {
      const r = await post('/settings/notifications/push/test');
      const c = r.web + r.mobile;
      c > 0 ? toast.ok(t('an.pushTestSent', { n: c })) : toast.error(t('an.pushTestNone'));
    } catch (e: any) {
      toast.error(err(e.message));
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="row" style={{ gap: 8 }}>
          <Icon name="bell" size={16} /> {t('an.push')}
          <span className={`pill ${cfg.webEnabled || cfg.mobileEnabled ? 'green' : 'gray'}`}>{cfg.webEnabled || cfg.mobileEnabled ? t('an.on') : t('an.off')}</span>
        </span>
      </div>
      <div className="panel-b stack" style={{ gap: 18 }}>
        <section>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 className="nsec-h" style={{ margin: 0 }}>{t('an.webTitle')}</h3>
            <Switch on={f.webEnabled} disabled={!hasKeys} onChange={(v) => setF({ ...f, webEnabled: v })} label={t('an.webEnable')} />
          </div>
          <p className="muted" style={{ marginBottom: 10 }}>{t('an.webEnable')}</p>

          <div className="card" style={{ margin: 0, background: 'var(--surface-2)' }}>
            <div className="row between">
              <div>
                <div style={{ fontWeight: 650 }}>{t('an.keys')}</div>
                <div className="muted">{hasKeys ? t('an.keysHave') : t('an.keysNone')}</div>
              </div>
              <button onClick={keys}><Icon name="key" /> {hasKeys ? t('an.regen') : t('an.genKeys')}</button>
            </div>
            {hasKeys && (
              <div style={{ marginTop: 10 }}>
                <label>{t('an.publicKey')}</label>
                <input readOnly value={cfg.vapidPublic} style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }} aria-label={t('an.publicKey')} />
              </div>
            )}
          </div>
          {!hasKeys && <div className="muted" style={{ marginTop: 6 }}>{t('an.needKeys')}</div>}

          <div style={{ marginTop: 12 }}>
            <label htmlFor="p-subject">{t('an.subject')}</label>
            <input id="p-subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="mailto:admin@example.com" />
            <div className="muted" style={{ marginTop: 4 }}>{t('an.subjectHint')}</div>
          </div>
        </section>

        <section style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="row between" style={{ marginBottom: 8 }}>
            <h3 className="nsec-h" style={{ margin: 0 }}>{t('an.mobileTitle')}</h3>
            <Switch on={f.mobileEnabled} onChange={(v) => setF({ ...f, mobileEnabled: v })} label={t('an.mobileEnable')} />
          </div>
          <p className="muted" style={{ marginBottom: 10 }}>{t('an.mobileHint')}</p>
          <label htmlFor="p-expo">{t('an.expoToken')}</label>
          <input id="p-expo" type="password" value={f.expoToken} onChange={(e) => { setF({ ...f, expoToken: e.target.value }); setClearExpo(false); }} placeholder={cfg.hasExpoToken && !clearExpo ? '••••••••' : ''} autoComplete="new-password" />
          {cfg.hasExpoToken && !clearExpo && (
            <div className="muted" style={{ marginTop: 4 }}>
              {t('an.expoSaved')} <a href="#" onClick={(e) => { e.preventDefault(); setClearExpo(true); setF({ ...f, expoToken: '' }); }}>{t('an.passRemove')}</a>
            </div>
          )}
        </section>

        <section style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <label>{t('an.events')}</label>
          <Check checked={f.events.reminders} onChange={(v) => setF({ ...f, events: { ...f.events, reminders: v } })}>{t('an.evReminders')}</Check>
          <Check checked={f.events.tasks} onChange={(v) => setF({ ...f, events: { ...f.events, tasks: v } })}>{t('an.evTasks')}</Check>
        </section>

        <Err msg={error} />
        <div className="row">
          <button className="primary" disabled={busy || !dirty} onClick={save}>{busy ? t('c.saving') : t('c.saveChanges')}</button>
          <span className="grow" />
          <span className="muted">{t('an.counts', { browsers: cfg.subscriptions, phones: cfg.devices })}</span>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div className="row">
            <button onClick={sendTest} disabled={dirty || !(cfg.webEnabled || cfg.mobileEnabled)}>{t('an.pushTest')}</button>
            <span className="muted">{t('an.pushTestHint')} <Link href="/account">{t('nav.account')}</Link></span>
          </div>
        </div>
      </div>
    </div>
  );
}
