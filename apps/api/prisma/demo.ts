// Fills a LOCAL database with sample tasks so every screen has something to show.
//   npx ts-node prisma/demo.ts            add the demo data (for the people in DEMO_USERS below)
//   npx ts-node prisma/demo.ts --clear    remove it again
// Everything it creates has a title starting with "[Demo]", so it never touches real work.
import { PrismaClient, AssignmentStatus, Priority } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();
const TAG = '[Demo] ';

const H = 3600_000;
const D = 24 * H;
const at = (ms: number) => new Date(Date.now() + ms);
const todayAt = (hour: number) => {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d;
};

type Spec = {
  title: string;
  description?: string;
  priority?: Priority;
  due: Date | null;
  /** [giver, assignee, status, progress] per person; "me" is the person the demo is built around. */
  people: [string, string, AssignmentStatus, number][];
  note?: string;
};

const ME = 'rahim@example.com';
const K = 'karim@example.com';
const M = 'mina@example.com';
const O = 'omar@example.com';
const Z = 'zed@example.com';
const S = AssignmentStatus;

const SPECS: Spec[] = [
  // ---- given to me, waiting for me to accept (5) ----
  { title: 'Review Q3 audit findings', priority: 'URGENT', due: at(1 * D), people: [[K, ME, S.PENDING_ACCEPTANCE, 0]], description: 'Go through the audit memo and list the points we must answer.' },
  { title: 'Approve venue booking quote', due: at(3 * D), people: [[M, ME, S.PENDING_ACCEPTANCE, 0]] },
  { title: 'Confirm training budget for December', due: at(5 * D), people: [[O, ME, S.PENDING_ACCEPTANCE, 0]] },
  { title: 'Sign off the new visitor policy', priority: 'URGENT', due: at(2 * D), people: [[K, ME, S.PENDING_ACCEPTANCE, 0]] },
  { title: 'Share the quarterly newsletter draft', due: null, people: [[Z, ME, S.PENDING_ACCEPTANCE, 0]] },

  // ---- given to me, overdue (5) ----
  { title: 'Send vendor payment list', priority: 'URGENT', due: at(-2 * D), people: [[Z, ME, S.IN_PROGRESS, 20]], note: 'Waiting on two invoices.' },
  { title: 'Update the emergency contact sheet', due: at(-1 * D), people: [[K, ME, S.ACCEPTED, 0]] },
  { title: 'Prepare handover note for Dhaka unit', due: at(-4 * H), people: [[M, ME, S.IN_PROGRESS, 55]] },
  { title: 'Collect attendance reports', due: at(-3 * D), people: [[O, ME, S.IN_PROGRESS, 70]] },
  { title: 'Reply to the regional office letter', priority: 'URGENT', due: at(-6 * H), people: [[K, ME, S.ACCEPTED, 0]] },

  // ---- given to me, due today (5) ----
  { title: 'Prepare board meeting notes', due: todayAt(17), people: [[K, ME, S.IN_PROGRESS, 40]], note: 'Agenda is ready, minutes next.' },
  { title: 'Finalise the leave roster', due: todayAt(15), people: [[M, ME, S.IN_PROGRESS, 80]] },
  { title: 'Check the printer contract renewal', due: todayAt(18), people: [[O, ME, S.ACCEPTED, 0]] },
  { title: 'Approve travel requests', priority: 'URGENT', due: todayAt(23), people: [[K, ME, S.IN_PROGRESS, 10]] },
  { title: 'Upload signed forms to the shared drive', due: todayAt(21), people: [[Z, ME, S.ACCEPTED, 0]] },

  // ---- given to me, coming up (5) ----
  { title: 'Draft staff handbook update', due: at(5 * D), people: [[K, ME, S.BLOCKED, 30]], note: 'Blocked: need the legal team\'s wording first.' },
  { title: 'Plan the annual picnic', due: at(4 * D), people: [[M, ME, S.ACCEPTED, 0]] },
  { title: 'Review vendor shortlist', due: at(2 * D), people: [[O, ME, S.IN_PROGRESS, 25]] },
  { title: 'Prepare presentation for partners', priority: 'URGENT', due: at(6 * D), people: [[K, ME, S.IN_PROGRESS, 15]] },
  { title: 'Order new ID cards', due: at(3 * D), people: [[Z, ME, S.ACCEPTED, 0]] },

  // ---- given to me, finished (5) ----
  { title: 'Annual leave roster 2026', due: at(-8 * D), people: [[K, ME, S.APPROVED, 100]] },
  { title: 'Office supply request', due: at(-10 * D), people: [[O, ME, S.APPROVED, 100]] },
  { title: 'Update the website contact page', due: at(-7 * D), people: [[M, ME, S.APPROVED, 100]] },
  { title: 'Translate the welcome leaflet', due: at(-5 * D), people: [[Z, ME, S.DECLINED, 0]], note: 'I do not have the source file, please resend.' },
  { title: 'Book the conference room', due: at(-6 * D), people: [[K, ME, S.CANCELLED, 0]] },

  // ---- given by me, submitted and waiting for my approval (5) ----
  { title: 'Compile the monthly expense report', priority: 'URGENT', due: at(-1 * D), people: [[ME, M, S.SUBMITTED, 100]], note: 'All figures checked against receipts.' },
  { title: 'Prepare the donor update letter', due: at(1 * D), people: [[ME, K, S.SUBMITTED, 100]] },
  { title: 'Update the volunteer register', due: at(2 * D), people: [[ME, O, S.SUBMITTED, 100]] },
  { title: 'Draft the press statement', priority: 'URGENT', due: at(0), people: [[ME, Z, S.SUBMITTED, 100]] },
  { title: 'Design the event poster', due: at(3 * D), people: [[ME, M, S.SUBMITTED, 100]] },

  // ---- given by me, to several people at once (5) ----
  { title: 'Submit your self-assessment form', due: at(3 * D), people: [[ME, K, S.IN_PROGRESS, 60], [ME, M, S.PENDING_ACCEPTANCE, 0], [ME, O, S.SUBMITTED, 100]] },
  { title: 'Complete the safety training module', priority: 'URGENT', due: at(-1 * D), people: [[ME, K, S.IN_PROGRESS, 30], [ME, Z, S.BLOCKED, 10]] },
  { title: 'Send in your monthly timesheet', due: at(2 * D), people: [[ME, M, S.APPROVED, 100], [ME, O, S.IN_PROGRESS, 50], [ME, Z, S.ACCEPTED, 0]] },
  { title: 'Review the draft annual plan', due: at(7 * D), people: [[ME, K, S.ACCEPTED, 0], [ME, M, S.ACCEPTED, 0]] },
  { title: 'Return your office keys', due: at(1 * D), people: [[ME, K, S.PENDING_ACCEPTANCE, 0], [ME, M, S.PENDING_ACCEPTANCE, 0], [ME, O, S.PENDING_ACCEPTANCE, 0], [ME, Z, S.IN_PROGRESS, 90]] },

  // ---- given by me, one person, still running (5) ----
  { title: 'Prepare the grant application', priority: 'URGENT', due: at(-2 * D), people: [[ME, K, S.IN_PROGRESS, 60]] },
  { title: 'Organise the staff training day', due: at(4 * D), people: [[ME, M, S.ACCEPTED, 0]] },
  { title: 'Audit the inventory list', due: at(-1 * H), people: [[ME, O, S.IN_PROGRESS, 35]] },
  { title: 'Draft the volunteer handbook', due: null, people: [[ME, Z, S.PENDING_ACCEPTANCE, 0]] },
  { title: 'Renew the software licences', due: at(8 * D), people: [[ME, K, S.BLOCKED, 20]], note: 'Blocked: waiting for the finance code.' },

  // ---- given by me, finished (5) ----
  { title: 'Collect last quarter feedback forms', due: at(-9 * D), people: [[ME, M, S.APPROVED, 100]] },
  { title: 'Clean up the shared folder', due: at(-12 * D), people: [[ME, O, S.APPROVED, 100]] },
  { title: 'Print the annual calendar', due: at(-6 * D), people: [[ME, Z, S.APPROVED, 100]] },
  { title: 'Arrange the welcome lunch', due: at(-4 * D), people: [[ME, K, S.DECLINED, 0]], note: 'Not possible with the current budget.' },
  { title: 'Order stationery', due: at(-3 * D), people: [[ME, M, S.CANCELLED, 0]] },
];

async function clear() {
  const tasks = await prisma.task.findMany({ where: { title: { startsWith: TAG } }, select: { id: true } });
  const ids = tasks.map((t) => t.id);
  const ass = await prisma.taskAssignment.findMany({ where: { taskId: { in: ids } }, select: { id: true } });
  await prisma.taskUpdate.deleteMany({ where: { assignmentId: { in: ass.map((a) => a.id) } } });
  await prisma.taskNote.deleteMany({ where: { taskId: { in: ids } } });
  await prisma.taskAssignment.deleteMany({ where: { taskId: { in: ids } } });
  await prisma.task.deleteMany({ where: { id: { in: ids } } });
  const n = await prisma.notification.deleteMany({ where: { payload: { path: ['demo'], equals: true } } });
  console.log(`Removed ${ids.length} demo tasks and ${n.count} demo notifications.`);
}

async function add() {
  const users = await prisma.user.findMany({ where: { email: { in: [ME, K, M, O, Z] } } });
  const id = (email: string) => {
    const u = users.find((x) => x.email === email);
    if (!u) throw new Error(`User ${email} not found. Create the demo users first.`);
    return u.id;
  };
  await clear();

  let made = 0;
  const notifs: { userId: string; type: string; payload: any; readAt: Date | null; createdAt: Date }[] = [];

  for (const [i, spec] of SPECS.entries()) {
    const createdAt = at(-(2 + (i % 9)) * D);
    const giver = id(spec.people[0][0]);
    const task = await prisma.task.create({
      data: { title: TAG + spec.title, description: spec.description, priority: spec.priority ?? 'NORMAL', dueDate: spec.due, createdById: giver, createdAt },
    });
    for (const [g, a, status, progress] of spec.people) {
      const when = (h: number) => new Date(createdAt.getTime() + h * H);
      const asg = await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          assigneeId: id(a),
          assignedById: id(g),
          status,
          progressPercent: progress,
          createdAt,
          acceptedAt: status === 'PENDING_ACCEPTANCE' ? null : when(3),
          submittedAt: ['SUBMITTED', 'APPROVED'].includes(status) ? when(40) : null,
          completedAt: status === 'APPROVED' ? when(46) : null,
        },
      });

      // A short history so the detail screen is not empty.
      const rows: { type: 'STATUS_CHANGE' | 'PROGRESS' | 'COMMENT'; userId: string; body?: string; meta?: any; createdAt: Date }[] = [];
      const reached = (s: AssignmentStatus) => ['ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED', 'APPROVED'].includes(status) || s === status;
      if (status !== 'PENDING_ACCEPTANCE' && status !== 'DECLINED') rows.push({ type: 'STATUS_CHANGE', userId: id(a), meta: { from: 'PENDING_ACCEPTANCE', to: 'ACCEPTED' }, createdAt: when(3) });
      if (status === 'DECLINED') rows.push({ type: 'STATUS_CHANGE', userId: id(a), body: spec.note, meta: { from: 'PENDING_ACCEPTANCE', to: 'DECLINED' }, createdAt: when(5) });
      if (progress > 0 && progress < 100) rows.push({ type: 'PROGRESS', userId: id(a), meta: { progressPercent: progress }, body: spec.note && status !== 'BLOCKED' ? spec.note : undefined, createdAt: when(20) });
      if (status === 'BLOCKED') rows.push({ type: 'STATUS_CHANGE', userId: id(a), body: spec.note, meta: { from: 'IN_PROGRESS', to: 'BLOCKED' }, createdAt: when(22) });
      if (reached(S.SUBMITTED) && ['SUBMITTED', 'APPROVED'].includes(status)) rows.push({ type: 'STATUS_CHANGE', userId: id(a), body: spec.note, meta: { from: 'IN_PROGRESS', to: 'SUBMITTED' }, createdAt: when(40) });
      if (status === 'APPROVED') rows.push({ type: 'STATUS_CHANGE', userId: id(g), meta: { from: 'SUBMITTED', to: 'APPROVED' }, createdAt: when(46) });
      if (status === 'CANCELLED') rows.push({ type: 'STATUS_CHANGE', userId: id(g), meta: { from: 'PENDING_ACCEPTANCE', to: 'CANCELLED' }, createdAt: when(8) });
      for (const r of rows) await prisma.taskUpdate.create({ data: { assignmentId: asg.id, userId: r.userId, type: r.type, body: r.body, meta: r.meta, createdAt: r.createdAt } });
      made++;

      // Notifications for me: tasks that came to me, and changes on tasks I gave.
      if (id(a) === id(ME) && status === 'PENDING_ACCEPTANCE') notifs.push({ userId: id(ME), type: 'TASK_ASSIGNED', payload: { assignmentId: asg.id, title: task.title, demo: true }, readAt: null, createdAt: at(-(1 + (i % 5)) * H) });
      if (id(g) === id(ME) && ['SUBMITTED', 'APPROVED', 'BLOCKED', 'DECLINED'].includes(status)) notifs.push({ userId: id(ME), type: 'STATUS_CHANGED', payload: { assignmentId: asg.id, title: task.title, to: status, demo: true }, readAt: i % 3 === 0 ? at(-1 * H) : null, createdAt: at(-(2 + (i % 7)) * H) });
      if (id(g) === id(ME) && status === 'IN_PROGRESS') notifs.push({ userId: id(ME), type: 'UPDATE_POSTED', payload: { assignmentId: asg.id, title: task.title, progressPercent: progress, demo: true }, readAt: i % 2 === 0 ? at(-3 * H) : null, createdAt: at(-(3 + (i % 6)) * H) });
    }
  }

  // Keep it to about five of each kind so the list is readable, newest first.
  const pick = (type: string, n: number) => notifs.filter((x) => x.type === type).slice(0, n);
  const chosen = [...pick('TASK_ASSIGNED', 5), ...pick('STATUS_CHANGED', 5), ...pick('UPDATE_POSTED', 5)];
  await prisma.notification.createMany({ data: chosen });
  console.log(`Added ${SPECS.length} demo tasks (${made} assignments) and ${chosen.length} notifications for ${ME}.`);
}

(process.argv.includes('--clear') ? clear() : add())
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
