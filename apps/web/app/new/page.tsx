'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { post, upload } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useI18n } from '../../lib/i18n';
import PersonPicker from '../../components/PersonPicker';
import { Err } from '../../components/bits';
import { Icon } from '../../components/icons';
import { useToast } from '../../components/toast';

// Local "yyyy-mm-ddThh:mm" for <input type=datetime-local>
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const at = (days: number, hour = 17) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return local(d);
};

const QUICK = [
  { label: 'nw.q.today', value: () => at(0) },
  { label: 'nw.q.tomorrow', value: () => at(1) },
  { label: 'nw.q.3d', value: () => at(3) },
  { label: 'nw.q.week', value: () => at(7) },
];

export default function NewTask() {
  const { me } = useAuth();
  const { t, fmtSize, posTitle, err, unitName } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const [assignees, setAssignees] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fromPosition, setFromPosition] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'URGENT'>('NORMAL');
  const [due, setDue] = useState('');
  const [over, setOver] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // A person holding several positions chooses which hat they wear for this task.
  const myPositions = me?.positions ?? [];

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError('');
    if (assignees.length === 0) return setError(t('nw.choose'));
    const f = new FormData(formRef.current!);
    setBusy(true);
    try {
      const task = await post('/tasks', {
        title: String(f.get('title')),
        description: String(f.get('description') ?? '') || undefined,
        priority,
        dueDate: due ? new Date(due).toISOString() : undefined,
        assigneeIds: assignees,
        fromPositionId: fromPosition || undefined,
      });
      if (files.length) {
        try {
          await upload(`/tasks/${task.id}/attachments`, files);
        } catch (e2: any) {
          // The task exists already; do not lose it because a file failed.
          toast.error(t('nw.fileFail', { msg: err(e2.message) }));
        }
      }
      toast.ok(assignees.length > 1 ? t('nw.givenN', { n: assignees.length }) : t('nw.given1'));
      window.dispatchEvent(new Event('tm:refresh'));
      router.push('/given');
    } catch (e2: any) {
      setError(err(e2.message));
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Link href="/desk" className="crumb"><Icon name="back" size={14} /> {t('c.back')}</Link>
      <h1 style={{ marginBottom: 16 }}>{t('nw.title')}</h1>

      <form ref={formRef} className="stack" style={{ gap: 18 }} onSubmit={submit} onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit()}>
        <div>
          <label htmlFor="title">{t('nw.what')}</label>
          <input id="title" name="title" required maxLength={200} autoFocus placeholder={t('nw.titlePh')} style={{ fontSize: 16, minHeight: 42 }} />
        </div>

        <div>
          <label htmlFor="description">{t('nw.details')} <span className="muted" style={{ fontWeight: 400 }}>{t('c.optional')}</span></label>
          <textarea id="description" name="description" placeholder={t('nw.detailsPh')} />
        </div>

        <div>
          <label>{t('nw.who')}</label>
          {myPositions.length > 1 && (
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="muted">{t('nw.givingAs')}</span>
              <select value={fromPosition} onChange={(e) => setFromPosition(e.target.value)} style={{ width: 'auto' }} aria-label={t('nw.givingAsLabel')}>
                <option value="">{t('nw.anyPos')}</option>
                {myPositions.map((p) => (
                  <option key={p.id} value={p.position.id}>{posTitle(p.position)}, {unitName(p.unit)}</option>
                ))}
              </select>
            </div>
          )}
          <PersonPicker value={assignees} onChange={setAssignees} fromPositionId={fromPosition || undefined} />
          <p className="muted" style={{ marginTop: 6 }}>{t('nw.multi')}</p>
        </div>

        <div className="two">
          <div>
            <label>{t('nw.deadline')}</label>
            <div className="row" style={{ gap: 6, marginBottom: 8 }}>
              {QUICK.map((qk) => {
                const v = qk.value();
                return <button type="button" key={qk.label} className={`chip ${due === v ? 'on' : ''}`} onClick={() => setDue(due === v ? '' : v)}>{t(qk.label)}</button>;
              })}
            </div>
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t('nw.deadline')} />
          </div>
          <div>
            <label>{t('nw.priority')}</label>
            <div className="seg" role="radiogroup" aria-label={t('nw.priority')}>
              {(['LOW', 'NORMAL', 'URGENT'] as const).map((p) => (
                <button type="button" key={p} role="radio" aria-checked={priority === p} className={priority === p ? 'on' : ''} onClick={() => setPriority(p)}>
                  {t(`prio.${p}`)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label>{t('nw.attach')} <span className="muted" style={{ fontWeight: 400 }}>{t('c.optional')}</span></label>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
          <div
            className={`drop ${over ? 'over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileRef.current?.click())}
          >
            {t('nw.drop')}
          </div>
          {files.map((f, i) => (
            <div key={i} className="file" style={{ marginTop: 6 }}>
              <Icon name="paperclip" />
              <span className="grow">{f.name}</span>
              <span className="muted">{fmtSize(f.size)}</span>
              <button type="button" className="ghost sm" aria-label={t('nw.removeFile', { name: f.name })} onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>

        <Err msg={error} />
        <div className="row" style={{ paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <button className="primary lg" disabled={busy}>{busy ? t('nw.giving') : t('nw.btn')}</button>
          <Link href="/desk" className="btn lg">{t('c.cancel')}</Link>
          <span className="muted">{t('nw.submitHint')}</span>
        </div>
      </form>
    </div>
  );
}
