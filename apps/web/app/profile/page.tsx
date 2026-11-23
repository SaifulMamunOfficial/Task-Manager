'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useRef, useState } from 'react';
import { api, BASE } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import { Avatar, Err, PageHead } from '../../components/bits';
import { Icon } from '../../components/icons';
import { useToast } from '../../components/toast';
import NotificationSettings from '../../components/NotificationSettings';
import PasswordForm from '../../components/PasswordForm';

type Tab = 'profile' | 'password' | 'notifications';

const SIZE = 320;

/** Crop the middle square and shrink it, so the upload is small whatever the camera produced. */
async function squarePhoto(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('image'))), 'image/jpeg', 0.88));
}

function ProfileInner() {
  const { me, reload } = useAuth();
  const { t, err, posTitle, unitName, personName } = useI18n();
  const toast = useToast();
  const q = useSearchParams();
  const initial = q.get('tab');
  const [tab, setTab] = useState<Tab>(initial === 'password' || initial === 'notifications' ? initial : 'profile');
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(me?.name ?? '');
  const [nameBn, setNameBn] = useState(me?.nameBn ?? '');
  const [phone, setPhone] = useState(me?.phone ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  if (!me) return null;
  const dirty = name.trim() !== me.name || nameBn.trim() !== (me.nameBn ?? '') || phone.trim() !== (me.phone ?? '');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError(t('pf.nameRequired'));
    setBusy(true);
    try {
      await api('/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: name.trim(), nameBn: nameBn.trim(), phone: phone.trim() }) });
      await reload();
      toast.ok(t('c.saved'));
    } catch (e2: any) {
      setError(err(e2.message));
    } finally {
      setBusy(false);
    }
  }

  async function pick(file?: File) {
    if (!file) return;
    if (!/^image\//.test(file.type)) return toast.error(t('pf.notImage'));
    setPhotoBusy(true);
    try {
      const blob = await squarePhoto(file);
      const form = new FormData();
      form.append('file', blob, 'photo.jpg');
      await api('/avatar', { method: 'POST', body: form, json: false } as RequestInit);
      await reload();
      toast.ok(t('pf.photoSaved'));
    } catch (e: any) {
      toast.error(err(e.message) || t('pf.photoFailed'));
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }
  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await api('/avatar', { method: 'DELETE' });
      await reload();
      toast.ok(t('pf.photoRemoved'));
    } catch (e: any) {
      toast.error(err(e.message));
    } finally {
      setPhotoBusy(false);
    }
  }

  const roles = me.positions.map((p) => `${posTitle(p.position)} · ${unitName(p.secretariat ?? p.unit)}`);

  return (
    <div className="profile">
      <PageHead title={t('pf.title')} subtitle={t('pf.sub')} />

      <div className="pf-layout">
        <aside className="pf-card">
          <div className="pf-banner" />
          <div className="pf-card-body">
            <div className="pf-avatar"><Avatar name={me.name} id={me.id} ver={me.avatarVer} size={112} /></div>
            <h2>{personName(me)}</h2>
            <div className="muted pf-mail">{me.email}</div>
            <div className="pf-tags">
              {me.isAdmin ? <span className="pill purple">{t('nav.admin')}</span> : roles.map((r) => <span key={r} className="pill blue">{r}</span>)}
            </div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <div className="pf-actions">
              <button className="primary" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={16} /> {photoBusy ? t('c.saving') : me.avatarVer ? t('pf.change') : t('pf.upload')}
              </button>
              {!!me.avatarVer && <button disabled={photoBusy} onClick={removePhoto}>{t('pf.remove')}</button>}
            </div>
            <p className="muted pf-hint">{t('pf.photoHint')}</p>
          </div>
        </aside>

        <div className="pf-main">
          <div className="pf-tabs" role="tablist">
            {(['profile', 'password', 'notifications'] as Tab[]).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`pf-tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {t(`pf.tab.${k}`)}
              </button>
            ))}
          </div>

          {tab === 'profile' && (
            <>
              <form className="panel" onSubmit={save}>
                <div className="panel-h"><span>{t('pf.details')}</span></div>
                <div className="panel-b stack">
                  <div className="pf-grid">
                    <div><label>{t('pf.nameEn')}</label><input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required /></div>
                    <div><label>{t('pf.nameBn')}</label><input value={nameBn} onChange={(e) => setNameBn(e.target.value)} maxLength={100} placeholder="যেমন: রহিম উদ্দিন" /></div>
                    <div><label>{t('pf.phone')}</label><input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} inputMode="tel" /></div>
                    <div><label>{t('pf.email')}</label><input value={me.email} disabled /><small className="muted">{t('pf.emailHint')}</small></div>
                  </div>
                  <Err msg={error} />
                  <div className="row">
                    <button className="primary" disabled={busy || !dirty}>{busy ? t('c.saving') : t('c.save')}</button>
                    {dirty && <button type="button" onClick={() => { setName(me.name); setNameBn(me.nameBn ?? ''); setPhone(me.phone ?? ''); setError(''); }}>{t('pf.reset')}</button>}
                  </div>
                </div>
              </form>

              {!me.isAdmin && (
                <div className="panel">
                  <div className="panel-h"><span>{t('pf.roles')}</span></div>
                  <div className="panel-b stack">
                    {roles.length ? roles.map((r) => <div key={r} className="pf-role">{r}</div>) : <span className="muted">{t('nav.noPosition')}</span>}
                    <small className="muted">{t('pf.rolesHint')}</small>
                  </div>
                </div>
              )}

            </>
          )}

          {tab === 'password' && (
            <div className="panel">
              <div className="panel-h"><span>{t('nav.changePassword')}</span></div>
              <div className="panel-b"><PasswordForm /></div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="panel">
              <div className="panel-h"><span>{t('ac.title')}</span></div>
              <div className="panel-b"><NotificationSettings /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  return (
    <Suspense fallback={null}>
      <ProfileInner />
    </Suspense>
  );
}
