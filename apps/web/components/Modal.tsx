'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Err } from './bits';
import { useI18n } from '../lib/i18n';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('textarea,input,button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/** Ask for a required written reason (declining a task, sending work back). */
export function ReasonModal({ title, hint, confirmLabel, danger, onConfirm, onClose }: { title: string; hint?: string; confirmLabel: string; danger?: boolean; onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const { t, err } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function go() {
    setBusy(true);
    setError('');
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e: any) {
      setError(err(e.message));
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose}>
      {hint && <p className="muted" style={{ marginBottom: 10 }}>{hint}</p>}
      <label htmlFor="reason">{t('c.reason')}</label>
      <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && reason.trim() && go()} />
      <Err msg={error} />
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button onClick={onClose}>{t('c.cancel')}</button>
        <button className={danger ? 'danger' : 'primary'} disabled={busy || !reason.trim()} onClick={go}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
