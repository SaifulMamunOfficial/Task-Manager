'use client';
import Link from 'next/link';
import { useI18n } from '../lib/i18n';
import { Avatar, DueText } from './bits';

// Columns follow the life of a task. "In progress" holds both accepted and in-progress work.
const COLUMNS: { key: string; statuses: string[]; tone: string }[] = [
  { key: 'PENDING_ACCEPTANCE', statuses: ['PENDING_ACCEPTANCE'], tone: 'amber' },
  { key: 'IN_PROGRESS', statuses: ['ACCEPTED', 'IN_PROGRESS'], tone: 'blue' },
  { key: 'BLOCKED', statuses: ['BLOCKED'], tone: 'red' },
  { key: 'SUBMITTED', statuses: ['SUBMITTED'], tone: 'amber' },
  { key: 'APPROVED', statuses: ['APPROVED'], tone: 'green' },
];

/** Kanban view: one column per stage, one card per assignment. Cards open the task. */
export default function Board({ rows, who }: { rows: any[]; who: 'mine' | 'given' }) {
  const { t, n } = useI18n();
  return (
    <div className="board" role="list">
      {COLUMNS.map((c) => {
        const cards = rows.filter((a) => c.statuses.includes(a.status));
        return (
          <section key={c.key} className={`bcol ${c.tone}`} role="listitem" aria-label={t(`status.${c.key}`)}>
            <header className="bcol-h">
              <span className="dot" /> {t(`status.${c.key}`)} <span className="count">{n(cards.length)}</span>
            </header>
            <div className="bcol-b">
              {cards.length === 0 && <div className="bempty">{t('bd.empty')}</div>}
              {cards.map((a) => {
                const person = who === 'mine' ? a.assignedBy?.name : a.assignee?.name;
                return (
                  <Link key={a.id} href={`/tasks/${a.id}`} className="bcard">
                    <div className="bt">{a.task.title}</div>
                    <div className="bm">
                      <DueText due={a.task.dueDate} status={a.status} />
                      {a.task.priority === 'URGENT' && <span className="tag urgent">{t('prio.URGENT')}</span>}
                    </div>
                    <div className="bf">
                      {person ? (
                        <span className="who">
                          <Avatar name={person} /> <span>{person}</span>
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="pct">{n(a.progressPercent)}%</span>
                    </div>
                    <div className="bar" aria-label={t('tl.pct', { n: a.progressPercent })}>
                      <div style={{ width: `${a.progressPercent}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** List / Board switch, remembered per device. */
export function ViewSwitch({ value, onChange }: { value: 'list' | 'board'; onChange: (v: 'list' | 'board') => void }) {
  const { t } = useI18n();
  return (
    <div className="seg" role="radiogroup" aria-label={t('bd.view')}>
      {(['list', 'board'] as const).map((v) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {t(`bd.${v}`)}
        </button>
      ))}
    </div>
  );
}
