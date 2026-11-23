'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSIGNEE_TRANSITIONS, GIVER_TRANSITIONS } from '@tm/shared';
import { api, download, post, upload } from '../../../lib/api';
import { useI18n } from '../../../lib/i18n';
import { WORKING } from '../../../lib/ui';
import { Avatar, DueText, Err, Skeleton, Status, StatusPill } from '../../../components/bits';
import { Icon, StatusGlyph } from '../../../components/icons';
import { Modal, ReasonModal } from '../../../components/Modal';
import PersonPicker from '../../../components/PersonPicker';
import { useToast } from '../../../components/toast';

const CLOSED = ['APPROVED', 'CANCELLED'];
const STEPS = [
  { key: 'PENDING_ACCEPTANCE', label: 'step.given' },
  { key: 'ACCEPTED', label: 'step.accepted' },
  { key: 'IN_PROGRESS', label: 'step.progress' },
  { key: 'SUBMITTED', label: 'step.submitted' },
  { key: 'APPROVED', label: 'step.approved' },
];
const stepIndex = (s: string) => (s === 'BLOCKED' ? 2 : Math.max(0, STEPS.findIndex((x) => x.key === s)));

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, n, date, dateTime, statusLabel, err, personName } = useI18n();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = await api(`/assignments/${id}`);
      setD(detail);
      setError('');
      // Tell the sidebar which section this task belongs to ("Assigned by me" or "My tasks").
      window.dispatchEvent(new CustomEvent('tm:section', { detail: detail.role === 'giver' ? '/given' : '/tasks' }));
    } catch (e: any) {
      if (/not found/i.test(e.message)) setNotFound(true);
      else setError(e.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
    window.dispatchEvent(new Event('tm:refresh'));
  }, [load]);

  if (notFound) return <div className="list"><div className="empty"><b>{t('td.nf')}</b>{t('td.nfText')}</div></div>;
  if (!d) return error ? <Err msg={err(error)} /> : <Skeleton rows={6} />;

  const a = d.assignment;
  const isAssignee = d.role === 'assignee';
  const closed = CLOSED.includes(a.status);
  const idx = stepIndex(a.status);
  const off = a.status === 'DECLINED' || a.status === 'CANCELLED';
  const lastReason = [...d.updates].reverse().find((u: any) => u.type === 'STATUS_CHANGE' && u.body);
  const given = date(a.createdAt, { day: 'numeric', month: 'short' });

  return (
    <>
      <Link href={isAssignee ? '/tasks' : '/given'} className="crumb">
        <Icon name="back" size={14} /> {t(isAssignee ? 'nav.myTasks' : 'nav.given')}
      </Link>

      <div className="page-head" style={{ marginBottom: 6 }}>
        <div className="grow">
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <h1>{a.task.title}</h1>
            {a.task.priority === 'URGENT' && <span className="flag" title={t('prio.URGENT')} style={{ marginTop: 3 }}><Icon name="flag" size={17} /></span>}
          </div>
          <p>{isAssignee ? t('td.givenToYou', { name: personName(a.assignedBy), date: given }) : t('td.givenTo', { name: personName(a.assignee), date: given })}</p>
        </div>
        <Actions d={d} onChange={refresh} />
      </div>

      {!off ? (
        <div className="steps" aria-label={t('td.stepsLabel', { status: statusLabel(a.status) })}>
          {STEPS.map((s, i) => (
            <span key={s.key} className="row" style={{ gap: 0, flexWrap: 'nowrap' }}>
              {i > 0 && <span className={`step-line ${i <= idx ? 'done' : ''}`} />}
              <span className={`step ${i < idx || a.status === 'APPROVED' ? 'done' : ''} ${i === idx && a.status !== 'APPROVED' ? 'now' : ''} ${i === idx && a.status === 'BLOCKED' ? 'blocked' : ''}`}>
                <span className="dot">{i < idx || a.status === 'APPROVED' ? <Icon name="check" size={11} /> : null}</span>
                <span className="lbl">{i === idx && a.status === 'BLOCKED' ? t('status.BLOCKED') : t(s.label)}</span>
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ margin: '12px 0' }}><StatusPill status={a.status} /></div>
      )}

      <div style={{ height: 14 }} />
      <Err msg={error ? err(error) : ''} />
      {a.status === 'DECLINED' && (
        <div className="banner red"><Icon name="alert" /><div><b>{t('td.declinedBy', { name: personName(a.assignee) })}</b>{lastReason && <div>&quot;{lastReason.body}&quot;</div>}{!isAssignee && <div className="muted">{t('td.clarify')}</div>}</div></div>
      )}
      {a.status === 'BLOCKED' && lastReason && (
        <div className="banner amber"><Icon name="alert" /><div><b>{t('td.blockedBanner')}</b> &quot;{lastReason.body}&quot;</div></div>
      )}
      {a.status === 'SUBMITTED' && !isAssignee && (
        <div className="banner amber"><Icon name="clock" /><div><b>{t('td.submittedBy', { name: personName(a.assignee) })}</b> {t('td.reviewIt')}</div></div>
      )}
      {a.status === 'SUBMITTED' && isAssignee && (
        <div className="banner"><Icon name="clock" /><div>{t('td.waitingFor', { name: personName(a.assignedBy) })}</div></div>
      )}

      <div className="cols">
        <div>
          {a.task.description && (
            <div style={{ marginBottom: 22 }}>
              <h2>{t('td.description')}</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.task.description}</p>
            </div>
          )}
          <Activity d={d} canPost={!closed && !off} onChange={refresh} />
        </div>

        <aside>
          <div className="panel">
            <div className="panel-h">{t('td.details')}</div>
            <div className="panel-b">
              <dl className="props">
                <dt>{t('td.status')}</dt><dd><StatusPill status={a.status} /></dd>
                <dt>{t('td.givenBy')}</dt><dd className="row" style={{ gap: 7, flexWrap: 'nowrap' }}><Avatar name={personName(a.assignedBy)} />{personName(a.assignedBy)}</dd>
                <dt>{t('td.assignedTo')}</dt><dd className="row" style={{ gap: 7, flexWrap: 'nowrap' }}><Avatar name={personName(a.assignee)} />{personName(a.assignee)}</dd>
                <dt>{t('td.deadline')}</dt><dd><DueText due={a.task.dueDate} status={a.status} />{a.task.dueDate && <div className="muted" style={{ fontSize: 12 }}>{dateTime(a.task.dueDate)}</div>}</dd>
                <dt>{t('td.priority')}</dt><dd>{a.task.priority === 'URGENT' ? <span className="late">{t('prio.URGENT')}</span> : t(`prio.${a.task.priority}`)}</dd>
              </dl>
              <Progress d={d} onChange={refresh} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">{t('td.files')} <span className="muted">{d.taskAttachments.length ? n(d.taskAttachments.length) : ''}</span></div>
            <div className="panel-b">
              {d.taskAttachments.length === 0 && <div className="muted">{t('td.noFiles')}</div>}
              <Files files={d.taskAttachments} />
              {!isAssignee && !closed && <BriefUpload taskId={a.taskId} onDone={refresh} />}
            </div>
          </div>

          {isAssignee && WORKING.includes(a.status) && a.status !== 'PENDING_ACCEPTANCE' && <Delegate d={d} onChange={refresh} />}
          {d.chain && <Chain chain={d.chain} mode={d.visibilityMode} />}
          <Notes d={d} onChange={refresh} />
        </aside>
      </div>
    </>
  );
}

// ---------- header actions ----------

function Actions({ d, onChange }: { d: any; onChange: () => void }) {
  const a = d.assignment;
  const toast = useToast();
  const { t, err, personName } = useI18n();
  const map = d.role === 'assignee' ? ASSIGNEE_TRANSITIONS : GIVER_TRANSITIONS;
  const options: string[] = (map as Record<string, string[]>)[a.status] ?? [];
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (options.length === 0) return null;

  const needsReason = (to: string) => (d.role === 'assignee' && to === 'DECLINED') || (d.role === 'giver' && a.status === 'SUBMITTED' && to === 'IN_PROGRESS');
  const label = (to: string) => (d.role === 'giver' && a.status === 'SUBMITTED' && to === 'IN_PROGRESS' ? t('act.sendBack') : t(`act.${to}`));
  const primary = (to: string) => to === 'ACCEPTED' || to === 'APPROVED' || to === 'SUBMITTED' || to === 'PENDING_ACCEPTANCE';
  // Primary action first, then neutral ones, then destructive.
  const order = (to: string) => (primary(to) ? 0 : to === 'DECLINED' || to === 'CANCELLED' ? 2 : 1);
  const sorted = [...options].sort((x, y) => order(x) - order(y));

  async function run(to: string, comment?: string) {
    if (to === 'CANCELLED' && !confirm(t('td.confirmCancel'))) return;
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/transition`, { status: to, comment });
      toast.ok(to === 'ACCEPTED' ? t('tl.accepted') : to === 'APPROVED' ? t('tl.approved') : to === 'SUBMITTED' ? t('td.t.submitted') : t('td.t.updated'));
      onChange();
    } catch (e: any) {
      toast.error(err(e.message));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      {sorted.map((to) => (
        <button
          key={to}
          className={primary(to) ? 'primary' : to === 'DECLINED' || to === 'CANCELLED' ? 'danger' : ''}
          disabled={busy}
          onClick={() => (needsReason(to) ? setReasonFor(to) : run(to).catch(() => {}))}
        >
          {label(to)}
        </button>
      ))}
      {reasonFor && (
        <ReasonModal
          title={label(reasonFor)}
          hint={reasonFor === 'DECLINED' ? t('td.declineHint') : t('td.sendBackHint', { name: personName(a.assignee) })}
          confirmLabel={label(reasonFor)}
          danger={reasonFor === 'DECLINED'}
          onConfirm={(r) => run(reasonFor, r)}
          onClose={() => setReasonFor(null)}
        />
      )}
    </div>
  );
}

// ---------- progress ----------

function Progress({ d, onChange }: { d: any; onChange: () => void }) {
  const a = d.assignment;
  const toast = useToast();
  const { t, n, err, personName } = useI18n();
  const [busy, setBusy] = useState(false);
  const canEdit = d.role === 'assignee' && ['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status);

  async function set(v: number) {
    if (v === a.progressPercent) return;
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/updates`, { progressPercent: v });
      onChange();
    } catch (e: any) {
      toast.error(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="muted">{t('td.progress')}</span>
        <b>{n(a.progressPercent)}%</b>
      </div>
      <div className="bar big"><div style={{ width: `${a.progressPercent}%` }} /></div>
      {canEdit && (
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          {[0, 25, 50, 75, 100].map((v) => (
            <button key={v} className={`chip ${a.progressPercent === v ? 'on' : ''}`} disabled={busy} onClick={() => set(v)}>{n(v)}%</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- files ----------

function Files({ files }: { files: { id: string; fileName: string; sizeBytes: number }[] }) {
  const toast = useToast();
  const { t, fmtSize, err, personName } = useI18n();
  if (!files?.length) return null;
  return (
    <div>
      {files.map((f) => (
        <div key={f.id} className="file">
          <Icon name="paperclip" />
          <span className="grow" style={{ overflowWrap: 'anywhere' }}>{f.fileName}</span>
          <span className="muted">{fmtSize(f.sizeBytes)}</span>
          <button className="ghost sm" aria-label={t('td.download', { name: f.fileName })} onClick={() => download(f.id, f.fileName).catch((e) => toast.error(err(e.message)))}>
            <Icon name="download" />
          </button>
        </div>
      ))}
    </div>
  );
}

function BriefUpload({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const toast = useToast();
  const { t, err, personName } = useI18n();
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          setBusy(true);
          try {
            await upload(`/tasks/${taskId}/attachments`, files);
            toast.ok(t('td.filesAdded', { n: files.length }));
            onDone();
          } catch (e2: any) {
            toast.error(err(e2.message));
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      <button className="sm" disabled={busy} onClick={() => ref.current?.click()} style={{ marginTop: 4 }}>
        <Icon name="plus" size={14} /> {busy ? t('td.uploading') : t('td.addFiles')}
      </button>
    </>
  );
}

// ---------- delegate ----------

function Delegate({ d, onChange }: { d: any; onChange: () => void }) {
  const a = d.assignment;
  const toast = useToast();
  const { t, err, personName } = useI18n();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!people.length) return setError(t('td.chooseOne'));
    const f = new FormData(e.currentTarget);
    const due = String(f.get('due') ?? '');
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/delegate`, {
        description: String(f.get('description') ?? '') || undefined,
        dueDate: due ? new Date(due).toISOString() : undefined,
        assigneeIds: people,
      });
      toast.ok(t('td.passedOn'));
      setPeople([]);
      setOpen(false);
      onChange();
    } catch (e2: any) {
      setError(err(e2.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">{t('td.passOn')}</div>
      <div className="panel-b">
        <p className="muted" style={{ marginBottom: 10 }}>{t('td.passOnText')}</p>
        <button onClick={() => setOpen(true)}><Icon name="share" /> {t('td.delegate')}</button>
      </div>
      {open && (
        <Modal title={t('td.delegateTitle')} onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={submit}>
            <PersonPicker value={people} onChange={setPeople} />
            <div>
              <label htmlFor="ddesc">{t('td.instr')}</label>
              <textarea id="ddesc" name="description" />
            </div>
            <div>
              <label htmlFor="ddue">{t('td.theirDeadline')}</label>
              <input id="ddue" name="due" type="datetime-local" />
            </div>
            <Err msg={error} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)}>{t('c.cancel')}</button>
              <button className="primary" disabled={busy}>{busy ? t('td.sending') : t('td.delegateBtn')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- chain (depends on the admin's visibility mode) ----------

function Chain({ chain, mode }: { chain: any; mode: string }) {
  const { t, n, personName } = useI18n();
  const s = chain.summary;
  return (
    <div className="panel">
      <div className="panel-h">{t('td.chain')}</div>
      <div className="panel-b">
        <div className="muted">
          {s.total === 0 ? t('td.chainNone') : t('td.chainSummary', { total: s.total, approved: s.approved, open: s.open }) + (s.overdue ? t('td.chainOverdue', { n: s.overdue }) : '')}
        </div>
        {mode === 'FULL' && chain.items?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {chain.items.map((i: any) => (
              <div key={i.id} className="file" style={{ marginLeft: (i.depth - 1) * 14 }}>
                <Status status={i.status} textless />
                <span className="grow"><b>{i.assignee}</b> <span className="muted">{t('td.chainFrom', { name: i.givenBy })}</span></span>
                <span className="muted">{n(i.progress)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- activity: composer + history ----------

function Activity({ d, canPost, onChange }: { d: any; canPost: boolean; onChange: () => void }) {
  const a = d.assignment;
  const toast = useToast();
  const { t, n, statusLabel, timeAgo, dateTime, err, personName } = useI18n();
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!body.trim() && files.length === 0) return;
    setBusy(true);
    try {
      if (files.length) await upload(`/assignments/${a.id}/attachments`, files, { body: body.trim() });
      else await post(`/assignments/${a.id}/updates`, { body: body.trim() });
      setBody('');
      setFiles([]);
      onChange();
    } catch (e: any) {
      toast.error(err(e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>{t('td.activity')}</h2>
      {canPost && (
        <div className="composer">
          <textarea
            placeholder={t('td.writeUpdate')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit()}
            aria-label={t('td.writeUpdate')}
          />
          <div className="bar-row">
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <button className="ghost sm" onClick={() => fileRef.current?.click()}><Icon name="paperclip" size={14} /> {t('td.attach')}</button>
            {files.length > 0 && <span className="muted">{t('td.nFiles', { n: files.length })} · <a href="#" onClick={(e) => { e.preventDefault(); setFiles([]); }}>{t('td.clearFiles')}</a></span>}
            <span className="grow" />
            <span className="muted" style={{ fontSize: 12 }}>Ctrl+Enter</span>
            <button className="primary sm" disabled={busy || (!body.trim() && files.length === 0)} onClick={submit}>{busy ? t('td.posting') : t('td.post')}</button>
          </div>
        </div>
      )}

      {d.updates.length === 0 && <p className="muted">{t('td.noActivity')}</p>}
      <div>
        {[...d.updates].reverse().map((u: any) => (
          <div key={u.id} className="act">
            {u.type === 'STATUS_CHANGE' ? <span style={{ display: 'grid', placeItems: 'center' }} className={`st st-${u.meta?.to}`}><StatusGlyph status={u.meta?.to} size={18} /></span> : <Avatar name={personName(u.user)} />}
            <div>
              <div>
                <span className="who">{personName(u.user)}</span>
                {u.type === 'STATUS_CHANGE' && <span className="evt"> {t('td.ev.status', { status: statusLabel(u.meta?.to) })}</span>}
                {u.type === 'PROGRESS' && <span className="evt"> {t('td.ev.progress', { n: u.meta?.progressPercent })}</span>}
                <span className="when" title={dateTime(u.createdAt)}>{timeAgo(u.createdAt)}</span>
              </div>
              {u.body && <div className="body">{u.body}</div>}
              <Files files={u.attachments} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Notes({ d, onChange }: { d: any; onChange: () => void }) {
  const toast = useToast();
  const { t, timeAgo, err, personName } = useI18n();
  const [body, setBody] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await post(`/tasks/${d.assignment.taskId}/notes`, { body });
      setBody('');
      onChange();
    } catch (e2: any) {
      toast.error(err(e2.message));
    }
  }
  return (
    <div className="panel">
      <div className="panel-h">{t('td.notes')}</div>
      <div className="panel-b">
        <p className="muted" style={{ marginBottom: 8 }}>{t('td.notesHint')}</p>
        {d.notes.map((x: any) => (
          <div key={x.id} style={{ marginBottom: 10 }}>
            <div><b>{personName(x.user)}</b> <span className="muted">{timeAgo(x.createdAt)}</span></div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{x.body}</div>
          </div>
        ))}
        <form className="row" onSubmit={add} style={{ flexWrap: 'nowrap' }}>
          <input className="grow" placeholder={t('td.addNote')} value={body} onChange={(e) => setBody(e.target.value)} aria-label={t('td.addNote')} />
          <button disabled={!body.trim()}>{t('c.add')}</button>
        </form>
      </div>
    </div>
  );
}
