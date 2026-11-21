'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ASSIGNEE_TRANSITIONS, GIVER_TRANSITIONS } from '@tm/shared';
import { api, download, post, upload } from '../../../lib/api';
import { ACTION_LABEL, STATUS_LABEL, WORKING, fmtDate, fmtSize, timeAgo } from '../../../lib/ui';
import { Avatar, DueText, Err, Skeleton, Status, StatusPill } from '../../../components/bits';
import { Icon, StatusGlyph } from '../../../components/icons';
import { Modal, ReasonModal } from '../../../components/Modal';
import PersonPicker from '../../../components/PersonPicker';
import { useToast } from '../../../components/toast';

const CLOSED = ['APPROVED', 'CANCELLED'];
const STEPS = [
  { key: 'PENDING_ACCEPTANCE', label: 'Given' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'APPROVED', label: 'Approved' },
];
const stepIndex = (s: string) => (s === 'BLOCKED' ? 2 : Math.max(0, STEPS.findIndex((x) => x.key === s)));

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      setD(await api(`/assignments/${id}`));
      setError('');
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

  if (notFound) return <div className="list"><div className="empty"><b>Task not found</b>It does not exist, or you do not have access to it.</div></div>;
  if (!d) return error ? <Err msg={error} /> : <Skeleton rows={6} />;

  const a = d.assignment;
  const isAssignee = d.role === 'assignee';
  const closed = CLOSED.includes(a.status);
  const idx = stepIndex(a.status);
  const off = a.status === 'DECLINED' || a.status === 'CANCELLED';
  const lastReason = [...d.updates].reverse().find((u: any) => u.type === 'STATUS_CHANGE' && u.body);

  return (
    <>
      <Link href={isAssignee ? '/tasks' : '/given'} className="crumb">
        <Icon name="back" size={14} /> {isAssignee ? 'My tasks' : 'Assigned by me'}
      </Link>

      <div className="page-head" style={{ marginBottom: 6 }}>
        <div className="grow">
          <div className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <h1>{a.task.title}</h1>
            {a.task.priority === 'URGENT' && <span className="flag" title="Urgent" style={{ marginTop: 3 }}><Icon name="flag" size={17} /></span>}
          </div>
          <p>
            {isAssignee ? <>Given to you by <b>{a.assignedBy.name}</b></> : <>Given to <b>{a.assignee.name}</b></>} on {new Date(a.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <Actions d={d} onChange={refresh} />
      </div>

      {!off ? (
        <div className="steps" aria-label={`Progress: ${STATUS_LABEL[a.status]}`}>
          {STEPS.map((s, i) => (
            <span key={s.key} className="row" style={{ gap: 0, flexWrap: 'nowrap' }}>
              {i > 0 && <span className={`step-line ${i <= idx ? 'done' : ''}`} />}
              <span className={`step ${i < idx || a.status === 'APPROVED' ? 'done' : ''} ${i === idx && a.status !== 'APPROVED' ? 'now' : ''} ${i === idx && a.status === 'BLOCKED' ? 'blocked' : ''}`}>
                <span className="dot">{i < idx || a.status === 'APPROVED' ? <Icon name="check" size={11} /> : null}</span>
                <span className="lbl">{i === idx && a.status === 'BLOCKED' ? 'Blocked' : s.label}</span>
              </span>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ margin: '12px 0' }}><StatusPill status={a.status} /></div>
      )}

      <div style={{ height: 14 }} />
      <Err msg={error} />
      {a.status === 'DECLINED' && (
        <div className="banner red"><Icon name="alert" /><div><b>{a.assignee.name} declined this task.</b>{lastReason && <div>"{lastReason.body}"</div>}{!isAssignee && <div className="muted">Clarify it and send it again, or cancel the task.</div>}</div></div>
      )}
      {a.status === 'BLOCKED' && lastReason && (
        <div className="banner amber"><Icon name="alert" /><div><b>Blocked.</b> "{lastReason.body}"</div></div>
      )}
      {a.status === 'SUBMITTED' && !isAssignee && (
        <div className="banner amber"><Icon name="clock" /><div><b>{a.assignee.name} submitted this task.</b> Review it, then approve it or send it back with a reason.</div></div>
      )}
      {a.status === 'SUBMITTED' && isAssignee && (
        <div className="banner"><Icon name="clock" /><div>Submitted. Waiting for {a.assignedBy.name} to approve it.</div></div>
      )}

      <div className="cols">
        <div>
          {a.task.description && (
            <div style={{ marginBottom: 22 }}>
              <h2>Description</h2>
              <p style={{ whiteSpace: 'pre-wrap' }}>{a.task.description}</p>
            </div>
          )}
          <Activity d={d} canPost={!closed && !off} onChange={refresh} />
        </div>

        <aside>
          <div className="panel">
            <div className="panel-h">Details</div>
            <div className="panel-b">
              <dl className="props">
                <dt>Status</dt><dd><StatusPill status={a.status} /></dd>
                <dt>Given by</dt><dd className="row" style={{ gap: 7, flexWrap: 'nowrap' }}><Avatar name={a.assignedBy.name} />{a.assignedBy.name}</dd>
                <dt>Assigned to</dt><dd className="row" style={{ gap: 7, flexWrap: 'nowrap' }}><Avatar name={a.assignee.name} />{a.assignee.name}</dd>
                <dt>Deadline</dt><dd><DueText due={a.task.dueDate} status={a.status} />{a.task.dueDate && <div className="muted" style={{ fontSize: 12 }}>{fmtDate(a.task.dueDate)}</div>}</dd>
                <dt>Priority</dt><dd>{a.task.priority === 'URGENT' ? <span className="late">Urgent</span> : a.task.priority === 'LOW' ? 'Low' : 'Normal'}</dd>
              </dl>
              <Progress d={d} onChange={refresh} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-h">Files <span className="muted">{d.taskAttachments.length || ''}</span></div>
            <div className="panel-b">
              {d.taskAttachments.length === 0 && <div className="muted">No files attached.</div>}
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
  const map = d.role === 'assignee' ? ASSIGNEE_TRANSITIONS : GIVER_TRANSITIONS;
  const options: string[] = (map as Record<string, string[]>)[a.status] ?? [];
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (options.length === 0) return null;

  const needsReason = (to: string) => (d.role === 'assignee' && to === 'DECLINED') || (d.role === 'giver' && a.status === 'SUBMITTED' && to === 'IN_PROGRESS');
  const label = (to: string) => (d.role === 'giver' && a.status === 'SUBMITTED' && to === 'IN_PROGRESS' ? 'Send back' : ACTION_LABEL[to] ?? to);
  const primary = (to: string) => to === 'ACCEPTED' || to === 'APPROVED' || to === 'SUBMITTED' || (to === 'PENDING_ACCEPTANCE');
  // Primary action first, then neutral ones, then destructive.
  const order = (to: string) => (primary(to) ? 0 : to === 'DECLINED' || to === 'CANCELLED' ? 2 : 1);
  const sorted = [...options].sort((x, y) => order(x) - order(y));

  async function run(to: string, comment?: string) {
    if (to === 'CANCELLED' && !confirm('Cancel this task?')) return;
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/transition`, { status: to, comment });
      toast.ok(to === 'ACCEPTED' ? 'Task accepted' : to === 'APPROVED' ? 'Approved' : to === 'SUBMITTED' ? 'Submitted for approval' : 'Updated');
      onChange();
    } catch (e: any) {
      toast.error(e.message);
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
          hint={reasonFor === 'DECLINED' ? 'The person who gave you this task will see your reason.' : `Tell ${a.assignee.name} what is still missing.`}
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
  const [busy, setBusy] = useState(false);
  const canEdit = d.role === 'assignee' && ['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'].includes(a.status);

  async function set(n: number) {
    if (n === a.progressPercent) return;
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/updates`, { progressPercent: n });
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="row between" style={{ marginBottom: 6 }}>
        <span className="muted">Progress</span>
        <b>{a.progressPercent}%</b>
      </div>
      <div className="bar big"><div style={{ width: `${a.progressPercent}%` }} /></div>
      {canEdit && (
        <div className="row" style={{ gap: 6, marginTop: 10 }}>
          {[0, 25, 50, 75, 100].map((n) => (
            <button key={n} className={`chip ${a.progressPercent === n ? 'on' : ''}`} disabled={busy} onClick={() => set(n)}>{n}%</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- files ----------

function Files({ files }: { files: { id: string; fileName: string; sizeBytes: number }[] }) {
  const toast = useToast();
  if (!files?.length) return null;
  return (
    <div>
      {files.map((f) => (
        <div key={f.id} className="file">
          <Icon name="paperclip" />
          <span className="grow" style={{ overflowWrap: 'anywhere' }}>{f.fileName}</span>
          <span className="muted">{fmtSize(f.sizeBytes)}</span>
          <button className="ghost sm" aria-label={`Download ${f.fileName}`} onClick={() => download(f.id, f.fileName).catch((e) => toast.error(e.message))}>
            <Icon name="download" />
          </button>
        </div>
      ))}
    </div>
  );
}

function BriefUpload({ taskId, onDone }: { taskId: string; onDone: () => void }) {
  const toast = useToast();
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
            toast.ok(`${files.length} file(s) added`);
            onDone();
          } catch (err: any) {
            toast.error(err.message);
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      <button className="sm" disabled={busy} onClick={() => ref.current?.click()} style={{ marginTop: 4 }}>
        <Icon name="plus" size={14} /> {busy ? 'Uploading…' : 'Add files'}
      </button>
    </>
  );
}

// ---------- delegate ----------

function Delegate({ d, onChange }: { d: any; onChange: () => void }) {
  const a = d.assignment;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!people.length) return setError('Choose at least one person.');
    const f = new FormData(e.currentTarget);
    const due = String(f.get('due') ?? '');
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/delegate`, {
        description: String(f.get('description') ?? '') || undefined,
        dueDate: due ? new Date(due).toISOString() : undefined,
        assigneeIds: people,
      });
      toast.ok('Passed on. Follow it under "Assigned by me".');
      setPeople([]);
      setOpen(false);
      onChange();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-h">Pass it on</div>
      <div className="panel-b">
        <p className="muted" style={{ marginBottom: 10 }}>Need someone else to do part of this? Create a sub-task for them. You can submit once their part is done.</p>
        <button onClick={() => setOpen(true)}><Icon name="share" /> Delegate…</button>
      </div>
      {open && (
        <Modal title="Pass this task on" onClose={() => setOpen(false)}>
          <form className="stack" onSubmit={submit}>
            <PersonPicker value={people} onChange={setPeople} />
            <div>
              <label htmlFor="ddesc">Instructions for them</label>
              <textarea id="ddesc" name="description" />
            </div>
            <div>
              <label htmlFor="ddue">Their deadline</label>
              <input id="ddue" name="due" type="datetime-local" />
            </div>
            <Err msg={error} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setOpen(false)}>Cancel</button>
              <button className="primary" disabled={busy}>{busy ? 'Sending…' : 'Delegate'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ---------- chain (depends on the admin's visibility mode) ----------

function Chain({ chain, mode }: { chain: any; mode: string }) {
  const s = chain.summary;
  return (
    <div className="panel">
      <div className="panel-h">Passed on further</div>
      <div className="panel-b">
        <div className="muted">
          {s.total === 0 ? 'Nothing has been delegated further.' : `${s.total} sub-task(s): ${s.approved} approved, ${s.open} open${s.overdue ? `, ${s.overdue} overdue` : ''}`}
        </div>
        {mode === 'FULL' && chain.items?.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {chain.items.map((i: any) => (
              <div key={i.id} className="file" style={{ marginLeft: (i.depth - 1) * 14 }}>
                <Status status={i.status} textless />
                <span className="grow"><b>{i.assignee}</b> <span className="muted">from {i.givenBy}</span></span>
                <span className="muted">{i.progress}%</span>
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
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2>Activity</h2>
      {canPost && (
        <div className="composer">
          <textarea
            placeholder="Write an update or comment…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && submit()}
            aria-label="Write an update or comment"
          />
          <div className="bar-row">
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <button className="ghost sm" onClick={() => fileRef.current?.click()}><Icon name="paperclip" size={14} /> Attach</button>
            {files.length > 0 && <span className="muted">{files.length} file(s) · <a href="#" onClick={(e) => { e.preventDefault(); setFiles([]); }}>clear</a></span>}
            <span className="grow" />
            <span className="muted" style={{ fontSize: 12 }}>Ctrl+Enter</span>
            <button className="primary sm" disabled={busy || (!body.trim() && files.length === 0)} onClick={submit}>{busy ? 'Posting…' : 'Post'}</button>
          </div>
        </div>
      )}

      {d.updates.length === 0 && <p className="muted">No activity yet.</p>}
      <div>
        {[...d.updates].reverse().map((u: any) => (
          <div key={u.id} className="act">
            {u.type === 'STATUS_CHANGE' ? <span style={{ display: 'grid', placeItems: 'center' }} className={`st st-${u.meta?.to}`}><StatusGlyph status={u.meta?.to} size={18} /></span> : <Avatar name={u.user.name} />}
            <div>
              <div>
                <span className="who">{u.user.name}</span>
                {u.type === 'STATUS_CHANGE' && <span className="evt"> marked this {STATUS_LABEL[u.meta?.to]?.toLowerCase() ?? u.meta?.to}</span>}
                {u.type === 'PROGRESS' && <span className="evt"> set progress to {u.meta?.progressPercent}%</span>}
                <span className="when" title={fmtDate(u.createdAt)}>{timeAgo(u.createdAt)}</span>
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
  const [body, setBody] = useState('');
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await post(`/tasks/${d.assignment.taskId}/notes`, { body });
      setBody('');
      onChange();
    } catch (err: any) {
      toast.error(err.message);
    }
  }
  return (
    <div className="panel">
      <div className="panel-h">Private notes</div>
      <div className="panel-b">
        <p className="muted" style={{ marginBottom: 8 }}>Only you and the person who created the task can see these.</p>
        {d.notes.map((n: any) => (
          <div key={n.id} style={{ marginBottom: 10 }}>
            <div><b>{n.user.name}</b> <span className="muted">{timeAgo(n.createdAt)}</span></div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{n.body}</div>
          </div>
        ))}
        <form className="row" onSubmit={add} style={{ flexWrap: 'nowrap' }}>
          <input className="grow" placeholder="Add a note…" value={body} onChange={(e) => setBody(e.target.value)} aria-label="Add a private note" />
          <button disabled={!body.trim()}>Add</button>
        </form>
      </div>
    </div>
  );
}

