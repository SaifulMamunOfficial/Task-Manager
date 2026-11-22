'use client';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { post } from '../lib/api';
import { STATUS_TONE } from '../lib/ui';
import { useI18n } from '../lib/i18n';
import { Icon, StatusGlyph, type IconName } from './icons';
import { ReasonModal } from './Modal';
import { useToast } from './toast';

export const Err = ({ msg }: { msg?: string }) => (msg ? <div className="err" role="alert">{msg}</div> : null);

/** Status as a small glyph plus text (no coloured pill). */
export function Status({ status, textless }: { status: string; textless?: boolean }) {
  const { statusLabel } = useI18n();
  return (
    <span className={`st st-${status}`} title={statusLabel(status)}>
      <StatusGlyph status={status} />
      {!textless && <span className="st-text">{statusLabel(status)}</span>}
    </span>
  );
}
/** Coloured status pill with a dot (table rows, headers). */
export function StatusPill({ status }: { status: string }) {
  const { statusLabel } = useI18n();
  return <span className={`pill ${STATUS_TONE[status] ?? "gray"}`}>{statusLabel(status)}</span>;
}

const AVATAR_COLORS = ['#5b6b8c', '#7a6a58', '#4f7a6c', '#8a5f6c', '#6a6f9a', '#7f7a4f', '#5a7d8a', '#8b6a4a'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Initials in a muted, stable colour per person. */
export function Avatar({ name, large }: { name: string; large?: boolean; small?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';
  return (
    <span className={`avatar ${large ? 'lg' : ''}`} style={{ background: AVATAR_COLORS[hash(name) % AVATAR_COLORS.length] }} aria-hidden="true">
      {initials}
    </span>
  );
}

export function PageHead({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}

/** Summary card: tinted icon tile, big number, label. */
export function StatCard({ label, value, icon, tone = "blue", href }: { label: string; value: number | string; icon?: IconName; tone?: string; href?: string; hint?: string }) {
  const inner = (
    <>
      <span className={`cell-icon tone-${tone}`}><Icon name={icon ?? "tasks"} size={22} /></span>
      <div>
        <div className="cell-num">{value}</div>
        <div className="cell-label">{label}</div>
      </div>
    </>
  );
  return href ? <Link href={href} className="cell">{inner}</Link> : <div className="cell">{inner}</div>;
}

/** Column headings for a task list (hidden when the list is narrow). */
export function ListHead() {
  const { t } = useI18n();
  return (
    <div className="lhead" aria-hidden="true">
      <span className="h-main">{t("tl.task")}</span><span className="h-due">{t("tl.deadline")}</span><span className="h-prog">{t("tl.progress")}</span><span className="h-stat">{t("tl.status")}</span><span className="h-acts" />
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="list" aria-busy="true" aria-label={t("c.loading")}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skel" />)}
    </div>
  );
}

export function Empty({ title, children, icon = "inbox", actions }: { title: string; children?: ReactNode; icon?: IconName; actions?: ReactNode }) {
  return (
    <div className="list">
      <div className="empty">
        <span className="eicon"><Icon name={icon} size={26} /></span>
        <b>{title}</b>
        {children && <div className="etext">{children}</div>}
        {actions && <div className="eact">{actions}</div>}
      </div>
    </div>
  );
}

export function DueText({ due, status }: { due?: string | null; status: string }) {
  const { dueInfo } = useI18n();
  const d = dueInfo(due, status);
  return <span className={d.tone === "late" ? "late" : d.tone === "soon" ? "soon" : d.tone === "none" ? "none" : ""}>{d.text}</span>;
}

/**
 * One row in any task list. The title link covers the whole row; the buttons sit above it,
 * so a pending task can be accepted (or a submitted one approved) without opening it.
 */
export function TaskRow({ a, who, onChanged, child }: { a: any; who: "mine" | "given"; onChanged: () => void; child?: boolean }) {
  const toast = useToast();
  const { t, n, err } = useI18n();
  const [modal, setModal] = useState<null | "decline" | "sendback">(null);
  const [busy, setBusy] = useState(false);
  const person = who === "mine" ? a.assignedBy?.name : a.assignee?.name;

  async function move(status: string, comment?: string, done?: string) {
    setBusy(true);
    try {
      await post(`/assignments/${a.id}/transition`, { status, comment });
      toast.ok(t(done ?? "c.confirm"));
      window.dispatchEvent(new Event("tm:refresh"));
      onChanged();
    } catch (e: any) {
      toast.error(err(e.message));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`lrow ${child ? "child" : ""}`}>
      <div className="main">
        <div className="title-line">
          <Link href={`/tasks/${a.id}`} className="stretch">{a.task.title}</Link>
          {a.task.priority === "URGENT" && <span className="tag urgent">{t("prio.URGENT")}</span>}
        </div>
        <div className="sub">
          {person && <><Avatar name={person} /><span>{t(who === "mine" ? "tl.from" : "tl.to", { name: person })}</span></>}
        </div>
      </div>
      <div className="due"><DueText due={a.task.dueDate} status={a.status} /></div>
      <div className="prog">
        <div className="bar" aria-label={t("tl.pct", { n: a.progressPercent })}><div style={{ width: `${a.progressPercent}%` }} /></div>
        <span>{n(a.progressPercent)}%</span>
      </div>
      <div className="stat"><StatusPill status={a.status} /></div>
      <div className="acts">
        {who === "mine" && a.status === "PENDING_ACCEPTANCE" && (
          <>
            <button className="sm primary" disabled={busy} onClick={() => move("ACCEPTED", undefined, "tl.accepted").catch(() => {})}>{t("act.ACCEPTED")}</button>
            <button className="sm" disabled={busy} onClick={() => setModal("decline")}>{t("act.DECLINED")}</button>
          </>
        )}
        {who === "given" && a.status === "SUBMITTED" && (
          <>
            <button className="sm primary" disabled={busy} onClick={() => move("APPROVED", undefined, "tl.approved").catch(() => {})}>{t("act.APPROVED")}</button>
            <button className="sm" disabled={busy} onClick={() => setModal("sendback")}>{t("act.sendBack")}</button>
          </>
        )}
      </div>
      {modal === "decline" && (
        <ReasonModal title={t("tl.declineTitle")} hint={t("tl.declineHint", { title: a.task.title })} confirmLabel={t("tl.declineBtn")} danger onConfirm={(r) => move("DECLINED", r, "tl.declined")} onClose={() => setModal(null)} />
      )}
      {modal === "sendback" && (
        <ReasonModal title={t("tl.sendBackTitle")} hint={t("tl.sendBackHint", { title: a.task.title, name: person })} confirmLabel={t("act.sendBack")} onConfirm={(r) => move("IN_PROGRESS", r, "tl.sentBack")} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

export function GroupHead({ title, count, tone }: { title: string; count: number; tone?: "late" }) {
  const { n } = useI18n();
  return (
    <div className={`group-h ${tone ?? ""}`}>
      {title} <span className="count">{n(count)}</span>
    </div>
  );
}
