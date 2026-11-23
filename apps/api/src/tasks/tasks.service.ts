import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AssignmentStatus, Notification, Prisma, Priority, UpdateType } from '@prisma/client';
import { NotifyService } from '../notify/notify.service';
import { ASSIGNEE_TRANSITIONS, GIVER_TRANSITIONS, resolveVisibilityMode } from '@tm/shared';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';
import { AuthUser } from '../auth/decorators';

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  assigneeIds: string[];
  fromPositionId?: string; // which of my positions I am giving this under
}

const userBrief = { select: { id: true, name: true, nameBn: true } } as const;
const OPEN: AssignmentStatus[] = ['PENDING_ACCEPTANCE', 'ACCEPTED', 'IN_PROGRESS', 'BLOCKED', 'SUBMITTED'];

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private notifier: NotifyService,
  ) {}

  // ---------- helpers ----------

  /** Saves the notification inside the transaction; it is sent (push/email) after the transaction commits. */
  private async notify(userId: string, type: string, payload: Prisma.InputJsonValue, tx: Prisma.TransactionClient, out: Notification[]) {
    out.push(await this.notifier.create(userId, type, payload, tx));
  }

  private async assertNotAdmin(me: AuthUser) {
    if (me.isAdmin) throw new ForbiddenException('The admin account cannot give or receive tasks');
  }

  /** Find a (giverPosition, assigneePosition) pair allowed by the delegation matrix. */
  private async findAllowedPair(giverId: string, assigneeId: string, fromPositionId?: string) {
    const [giverPos, assigneePos] = await Promise.all([
      this.prisma.userPosition.findMany({ where: { userId: giverId, ...(fromPositionId ? { positionId: fromPositionId } : {}) } }),
      this.prisma.userPosition.findMany({ where: { userId: assigneeId } }),
    ]);
    if (fromPositionId && giverPos.length === 0) throw new BadRequestException('You do not hold that position');
    if (!giverPos.length) throw new ForbiddenException('You have no position, so you cannot give tasks');
    if (!assigneePos.length) throw new BadRequestException('Assignee has no position');
    const rules = await this.prisma.delegationPermission.findMany({
      where: { fromPositionId: { in: giverPos.map((p) => p.positionId) }, toPositionId: { in: assigneePos.map((p) => p.positionId) } },
    });
    if (!rules.length) return null;

    // A head (secretary, divisional director) may only give to people of their own division:
    //  - head of a secretariat -> people in that same secretariat
    //  - head of a unit/department (no secretariat) -> people directly in that same unit
    const limited = new Set((await this.prisma.position.findMany({ where: { id: { in: giverPos.map((p) => p.positionId) }, ownTeamOnly: true }, select: { id: true } })).map((p) => p.id));
    const sameTeam = (g: (typeof giverPos)[number], a: (typeof assigneePos)[number]) => (g.secretariatId ? a.secretariatId === g.secretariatId : a.unitId === g.unitId && !a.secretariatId);
    const ok = rules.filter((r) => {
      if (!limited.has(r.fromPositionId)) return true;
      const gs = giverPos.filter((g) => g.positionId === r.fromPositionId);
      const as = assigneePos.filter((a) => a.positionId === r.toPositionId);
      return gs.some((g) => as.some((a) => sameTeam(g, a)));
    });
    if (!ok.length) return 'NOT_YOUR_TEAM' as const;
    // Prefer the assignee's primary position when several match.
    const rule = ok.find((r) => assigneePos.find((a) => a.positionId === r.toPositionId)?.isPrimary) ?? ok[0];
    return { from: rule.fromPositionId, to: rule.toPositionId };
  }

  // ---------- create / delegate ----------

  /**
   * Create a task and assign it. If parentAssignmentId is given this is a delegation:
   * the actor must be the accepted assignee of that assignment, and the new task becomes its sub-task.
   */
  async create(me: AuthUser, input: CreateTaskInput, parentAssignmentId?: string) {
    await this.assertNotAdmin(me);
    const ids = [...new Set(input.assigneeIds)];
    if (!ids.length) throw new BadRequestException('At least one assignee is required');
    if (ids.includes(me.id)) throw new BadRequestException('You cannot assign a task to yourself');
    if (input.dueDate && isNaN(Date.parse(input.dueDate))) throw new BadRequestException('Invalid dueDate');

    let parent: { taskId: string; rootTaskId: string | null; title: string; description: string | null; dueDate: Date | null } | null = null;
    if (parentAssignmentId) {
      const pa = await this.prisma.taskAssignment.findUnique({ where: { id: parentAssignmentId }, include: { task: true } });
      if (!pa || pa.assigneeId !== me.id) throw new NotFoundException('Assignment not found');
      if (!(['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'] as AssignmentStatus[]).includes(pa.status)) {
        throw new BadRequestException('Accept the task first (and keep it open) before delegating it');
      }
      parent = { taskId: pa.taskId, rootTaskId: pa.task.rootTaskId, title: pa.task.title, description: pa.task.description, dueDate: pa.task.dueDate };
    }

    const users = await this.prisma.user.findMany({ where: { id: { in: ids }, isActive: true, isAdmin: false } });
    if (users.length !== ids.length) throw new BadRequestException('One or more assignees are invalid or inactive');

    const pairs = new Map<string, { from: string; to: string }>();
    for (const id of ids) {
      const pair = await this.findAllowedPair(me.id, id, input.fromPositionId);
      const name = users.find((u) => u.id === id)!.name;
      if (pair === 'NOT_YOUR_TEAM') throw new ForbiddenException(`${name} is not in your own division, so you cannot give them a task`);
      if (!pair) throw new ForbiddenException(`Your position is not allowed to give tasks to ${name}`);
      pairs.set(id, pair);
    }

    const title = input.title?.trim() || parent?.title;
    if (!title) throw new BadRequestException('Title is required');
    const dueDate = input.dueDate ? new Date(input.dueDate) : parent?.dueDate ?? null;

    const out: Notification[] = [];
    const task = await this.prisma.$transaction(async (tx) => {
      const t = await tx.task.create({
        data: {
          title,
          description: input.description ?? (parent ? undefined : undefined),
          priority: input.priority ?? 'NORMAL',
          dueDate,
          createdById: me.id,
          parentTaskId: parent?.taskId,
          rootTaskId: parent ? parent.rootTaskId ?? parent.taskId : null,
        },
      });
      // A root task is its own root, which keeps "whole tree" queries uniform.
      if (!parent) await tx.task.update({ where: { id: t.id }, data: { rootTaskId: t.id } });
      for (const id of ids) {
        const pair = pairs.get(id)!;
        const asg = await tx.taskAssignment.create({
          data: { taskId: t.id, assigneeId: id, assignedById: me.id, assignedByPositionId: pair.from, assigneePositionId: pair.to },
        });
        await this.notify(id, 'TASK_ASSIGNED', { assignmentId: asg.id, taskId: t.id, title, byUserId: me.id, priority: t.priority, dueDate }, tx, out);
      }
      return t;
    });
    this.notifier.dispatchAll(out);
    await this.audit.log(me.id, parent ? 'DELEGATE' : 'CREATE', 'Task', task.id, undefined, { title, assigneeIds: ids, parentTaskId: parent?.taskId });
    return this.prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { assignments: { include: { assignee: userBrief } } },
    });
  }

  // ---------- lists ----------

  private bucketWhere(bucket?: string): Prisma.TaskAssignmentWhereInput {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfWeek = new Date(endOfToday.getTime() + 6 * 86400_000);
    const open = { status: { in: OPEN } };
    switch (bucket) {
      case 'overdue':
        return { ...open, task: { dueDate: { lt: now } } };
      case 'today':
        return { ...open, task: { dueDate: { lte: endOfToday } } };
      case 'week':
        return { ...open, task: { dueDate: { lte: endOfWeek } } };
      case 'open':
        return open;
      case 'closed':
        return { status: { in: ['APPROVED', 'CANCELLED', 'DECLINED'] } };
      default:
        return {};
    }
  }

  /** Tasks that came to me. */
  mine(me: AuthUser, bucket?: string) {
    return this.prisma.taskAssignment.findMany({
      where: { assigneeId: me.id, ...this.bucketWhere(bucket) },
      orderBy: [{ task: { dueDate: { sort: 'asc', nulls: 'last' } } }, { createdAt: 'desc' }],
      include: { task: true, assignedBy: userBrief },
    });
  }

  /** Tasks I gave. Always only my DIRECT assignments here; deeper levels are in detail() per visibility mode. */
  given(me: AuthUser, bucket?: string) {
    return this.prisma.taskAssignment.findMany({
      where: { assignedById: me.id, ...this.bucketWhere(bucket) },
      orderBy: [{ task: { dueDate: { sort: 'asc', nulls: 'last' } } }, { createdAt: 'desc' }],
      include: { task: true, assignee: userBrief },
    });
  }

  // ---------- detail with visibility ----------

  private async loadForActor(id: string, me: AuthUser) {
    const a = await this.prisma.taskAssignment.findUnique({
      where: { id },
      include: { task: true, assignee: userBrief, assignedBy: userBrief },
    });
    // Anyone not directly involved gets 404, never 403 (do not reveal existence).
    if (!a || (a.assigneeId !== me.id && a.assignedById !== me.id)) throw new NotFoundException('Assignment not found');
    return { a, role: (a.assigneeId === me.id ? 'assignee' : 'giver') as 'assignee' | 'giver' };
  }

  async detail(id: string, me: AuthUser) {
    const { a, role } = await this.loadForActor(id, me);
    const fileMeta = { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedById: true, createdAt: true } } as const;
    const [updates, notes, taskAttachments] = await Promise.all([
      this.prisma.taskUpdate.findMany({ where: { assignmentId: id }, orderBy: { createdAt: 'asc' }, include: { user: userBrief, attachments: fileMeta } }),
      // Notes are private to their author and the task creator.
      this.prisma.taskNote.findMany({
        where: { taskId: a.taskId, OR: [{ userId: me.id }, { task: { createdById: me.id } }] },
        orderBy: { createdAt: 'asc' },
        include: { user: userBrief },
      }),
      // Brief files attached to this task (visible to its creator and its assignees).
      this.prisma.attachment.findMany({ where: { taskId: a.taskId }, orderBy: { createdAt: 'asc' }, ...fileMeta }),
    ]);

    let chain: unknown = null;
    let visibilityMode = 'DIRECT';
    if (role === 'giver') {
      const [settings, positions] = await Promise.all([
        this.prisma.visibilitySetting.findMany(),
        this.prisma.userPosition.findMany({ where: { userId: me.id }, select: { positionId: true } }),
      ]);
      visibilityMode = resolveVisibilityMode(
        settings.map((s) => ({ scope: s.scope, scopeRefId: s.scopeRefId || null, mode: s.mode })),
        me.id,
        positions.map((p) => p.positionId),
      );
      if (visibilityMode !== 'DIRECT') chain = await this.buildChain(a.taskId, a.assigneeId, visibilityMode as 'SUMMARY' | 'FULL');
    }
    return { role, visibilityMode, assignment: a, updates, notes, taskAttachments, chain };
  }

  /** Everything the assignee delegated further down from this task, shaped per visibility mode. */
  private async buildChain(taskId: string, ownerId: string, mode: 'SUMMARY' | 'FULL') {
    const rows: { id: string; depth: number; status: AssignmentStatus; progress: number; due: Date | null; title: string; assignee: string; givenBy: string }[] = [];
    let frontier = [{ taskId, ownerId, depth: 1 }];
    const seen = new Set<string>();
    while (frontier.length && rows.length < 500) {
      const next: typeof frontier = [];
      for (const f of frontier) {
        const subs = await this.prisma.task.findMany({
          where: { parentTaskId: f.taskId, createdById: f.ownerId },
          include: { assignments: { include: { assignee: userBrief, assignedBy: userBrief } } },
        });
        for (const s of subs) {
          for (const sa of s.assignments) {
            if (seen.has(sa.id)) continue;
            seen.add(sa.id);
            rows.push({ id: sa.id, depth: f.depth, status: sa.status, progress: sa.progressPercent, due: s.dueDate, title: s.title, assignee: sa.assignee.name, givenBy: sa.assignedBy.name });
            next.push({ taskId: s.id, ownerId: sa.assigneeId, depth: f.depth + 1 });
          }
        }
      }
      frontier = next;
    }
    const now = new Date();
    const summary = {
      total: rows.length,
      approved: rows.filter((r) => r.status === 'APPROVED').length,
      open: rows.filter((r) => OPEN.includes(r.status)).length,
      overdue: rows.filter((r) => OPEN.includes(r.status) && r.due && r.due < now).length,
    };
    // SUMMARY: counts only, no names, titles or comments.
    return mode === 'SUMMARY' ? { summary } : { summary, items: rows };
  }

  // ---------- status changes ----------

  async transition(id: string, me: AuthUser, to: AssignmentStatus, comment?: string) {
    const { a, role } = await this.loadForActor(id, me);
    const allowed = (role === 'assignee' ? ASSIGNEE_TRANSITIONS : GIVER_TRANSITIONS)[a.status] ?? [];
    if (!allowed.includes(to)) throw new BadRequestException(`A ${role} cannot move a task from ${a.status} to ${to}`);

    // Reasons are mandatory when pushing work back.
    const needsReason = (role === 'assignee' && to === 'DECLINED') || (role === 'giver' && a.status === 'SUBMITTED' && to === 'IN_PROGRESS');
    if (needsReason && !comment?.trim()) throw new BadRequestException('A reason is required');

    // Cannot submit while sub-tasks delegated from this assignment are still open.
    if (to === 'SUBMITTED') {
      const openSubs = await this.prisma.taskAssignment.count({
        where: { task: { parentTaskId: a.taskId, createdById: a.assigneeId }, status: { in: OPEN } },
      });
      if (openSubs > 0) throw new BadRequestException(`${openSubs} delegated sub-task(s) are still open`);
    }

    const now = new Date();
    const data: Prisma.TaskAssignmentUpdateInput = { status: to };
    if (to === 'ACCEPTED') data.acceptedAt = now;
    if (to === 'SUBMITTED') data.submittedAt = now;
    if (to === 'APPROVED') {
      data.completedAt = now;
      data.progressPercent = 100;
    }
    if (to === 'PENDING_ACCEPTANCE') {
      data.acceptedAt = null;
    }

    const other = role === 'assignee' ? a.assignedById : a.assigneeId;
    const out: Notification[] = [];
    await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignment.update({ where: { id }, data });
      await tx.taskUpdate.create({
        data: { assignmentId: id, userId: me.id, type: UpdateType.STATUS_CHANGE, body: comment?.trim() || null, meta: { from: a.status, to } },
      });
      await this.notify(other, 'STATUS_CHANGED', { assignmentId: id, taskId: a.taskId, title: a.task.title, from: a.status, to, byUserId: me.id }, tx, out);
      // Close the task when every assignment is finished.
      if (to === 'APPROVED' || to === 'CANCELLED') {
        const remaining = await tx.taskAssignment.count({ where: { taskId: a.taskId, status: { in: OPEN.concat('DECLINED') } } });
        if (remaining === 0) await tx.task.update({ where: { id: a.taskId }, data: { closedAt: now } });
      }
    });
    this.notifier.dispatchAll(out);
    await this.audit.log(me.id, 'STATUS', 'TaskAssignment', id, { status: a.status }, { status: to });
    return this.detail(id, me);
  }

  // ---------- progress / comments / notes ----------

  async postUpdate(id: string, me: AuthUser, body?: string, progressPercent?: number) {
    const { a, role } = await this.loadForActor(id, me);
    if (!body?.trim() && progressPercent === undefined) throw new BadRequestException('Nothing to post');
    if (progressPercent !== undefined) {
      if (role !== 'assignee') throw new ForbiddenException('Only the assignee can set progress');
      if (!(['ACCEPTED', 'IN_PROGRESS', 'BLOCKED'] as AssignmentStatus[]).includes(a.status)) {
        throw new BadRequestException('Progress can only be set on an accepted, open task');
      }
    }
    const other = role === 'assignee' ? a.assignedById : a.assigneeId;
    const out: Notification[] = [];
    await this.prisma.$transaction(async (tx) => {
      if (progressPercent !== undefined) {
        await tx.taskAssignment.update({
          where: { id },
          data: { progressPercent, ...(a.status === 'ACCEPTED' ? { status: 'IN_PROGRESS' } : {}) },
        });
      }
      await tx.taskUpdate.create({
        data: {
          assignmentId: id,
          userId: me.id,
          type: progressPercent !== undefined ? UpdateType.PROGRESS : UpdateType.COMMENT,
          body: body?.trim() || null,
          meta: progressPercent !== undefined ? { progressPercent } : undefined,
        },
      });
      await this.notify(other, 'UPDATE_POSTED', { assignmentId: id, taskId: a.taskId, title: a.task.title, byUserId: me.id, progressPercent: progressPercent ?? null }, tx, out);
    });
    this.notifier.dispatchAll(out);
    return this.detail(id, me);
  }

  async addNote(taskId: string, me: AuthUser, body: string) {
    const involved = await this.prisma.task.findFirst({
      where: { id: taskId, OR: [{ createdById: me.id }, { assignments: { some: { assigneeId: me.id } } }] },
      select: { id: true },
    });
    if (!involved) throw new NotFoundException('Task not found');
    return this.prisma.taskNote.create({ data: { taskId, userId: me.id, body: body.trim() } });
  }

  // ---------- notifications ----------

  notifications(me: AuthUser, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId: me.id, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(me: AuthUser, ids?: string[]) {
    await this.prisma.notification.updateMany({
      where: { userId: me.id, readAt: null, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }
}
