import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AssignmentStatus, UpdateType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';
import { AuthUser } from '../auth/decorators';
import { StorageService } from './storage.service';
import { NotifyService } from '../notify/notify.service';

export const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 25) * 1024 * 1024;
const MAX_PER_TASK = 20;
const MAX_PER_UPDATE = 10;
// Files that can run code on a user's machine are not accepted.
const BLOCKED_EXT = new Set(['exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'ps1', 'sh', 'js', 'jar', 'vbs', 'apk', 'dll']);
const CLOSED: AssignmentStatus[] = ['APPROVED', 'CANCELLED'];

type Upload = Express.Multer.File;

const meta = { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedById: true, createdAt: true } } as const;

@Injectable()
export class AttachmentsService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
    private notifier: NotifyService,
  ) {}

  /** multer decodes names as latin1; restore UTF-8 (Bangla etc.), strip path parts and control chars. */
  private cleanName(raw: string) {
    const name = Buffer.from(raw, 'latin1').toString('utf8').split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, '').trim();
    return (name || 'file').slice(0, 200);
  }

  private validate(files: Upload[]) {
    if (!files?.length) throw new BadRequestException('No files received (use form field "files")');
    for (const f of files) {
      const name = this.cleanName(f.originalname);
      const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
      if (BLOCKED_EXT.has(ext)) throw new BadRequestException(`File type .${ext} is not allowed`);
      if (f.size === 0) throw new BadRequestException(`${name} is empty`);
    }
  }

  private async store(files: Upload[], uploaderId: string, link: { taskId?: string; updateId?: string }) {
    const saved: { key: string }[] = [];
    try {
      for (const f of files) {
        const key = `attachments/${new Date().getFullYear()}/${randomUUID()}`;
        await this.storage.put(key, f.buffer, f.mimetype || 'application/octet-stream');
        saved.push({ key });
      }
      return await this.prisma.$transaction(
        files.map((f, i) =>
          this.prisma.attachment.create({
            data: {
              ...link,
              fileKey: saved[i].key,
              fileName: this.cleanName(f.originalname),
              mimeType: f.mimetype || 'application/octet-stream',
              sizeBytes: f.size,
              uploadedById: uploaderId,
            },
            ...meta,
          }),
        ),
      );
    } catch (e) {
      // Do not leave orphaned objects behind if anything failed.
      await Promise.all(saved.map((s) => this.storage.remove(s.key)));
      throw e;
    }
  }

  /** Brief files from the person who created the task. */
  async addToTask(me: AuthUser, taskId: string, files: Upload[]) {
    this.validate(files);
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { assignments: { select: { id: true, assigneeId: true, status: true } } } });
    if (!task || task.createdById !== me.id) throw new NotFoundException('Task not found');
    if (task.closedAt) throw new BadRequestException('This task is closed');
    const existing = await this.prisma.attachment.count({ where: { taskId } });
    if (existing + files.length > MAX_PER_TASK) throw new BadRequestException(`A task can have at most ${MAX_PER_TASK} attachments`);
    const rows = await this.store(files, me.id, { taskId });
    await Promise.all(
      task.assignments.map((a) => this.notifier.notify(a.assigneeId, 'ATTACHMENT_ADDED', { assignmentId: a.id, taskId, title: task.title, count: rows.length, byUserId: me.id })),
    );
    await this.audit.log(me.id, 'ATTACH', 'Task', taskId, undefined, rows.map((r) => r.fileName));
    return rows;
  }

  /** Files sent along with a comment on an assignment. Either party may do this. */
  async addToAssignment(me: AuthUser, assignmentId: string, files: Upload[], body?: string) {
    this.validate(files);
    const a = await this.prisma.taskAssignment.findUnique({ where: { id: assignmentId }, include: { task: true } });
    if (!a || (a.assigneeId !== me.id && a.assignedById !== me.id)) throw new NotFoundException('Assignment not found');
    if (CLOSED.includes(a.status)) throw new BadRequestException('This task is closed');
    if (files.length > MAX_PER_UPDATE) throw new BadRequestException(`At most ${MAX_PER_UPDATE} files per update`);

    const update = await this.prisma.taskUpdate.create({
      data: { assignmentId, userId: me.id, type: UpdateType.COMMENT, body: body?.trim() || `Attached ${files.length} file(s)` },
    });
    let rows;
    try {
      rows = await this.store(files, me.id, { updateId: update.id });
    } catch (e) {
      await this.prisma.taskUpdate.delete({ where: { id: update.id } }); // no empty update left behind
      throw e;
    }
    const other = me.id === a.assigneeId ? a.assignedById : a.assigneeId;
    await this.notifier.notify(other, 'ATTACHMENT_ADDED', { assignmentId, taskId: a.taskId, title: a.task.title, count: rows.length, byUserId: me.id });
    await this.audit.log(me.id, 'ATTACH', 'TaskAssignment', assignmentId, undefined, rows.map((r) => r.fileName));
    return { updateId: update.id, attachments: rows };
  }

  /** Who may see an attachment: task-level = creator and assignees of that task; update-level = the two parties of that assignment. */
  private async authorize(id: string, me: AuthUser) {
    const att = await this.prisma.attachment.findUnique({ where: { id }, include: { update: { include: { assignment: true } } } });
    if (!att) throw new NotFoundException('Attachment not found');
    let allowed = false;
    if (att.updateId && att.update) {
      allowed = att.update.assignment.assigneeId === me.id || att.update.assignment.assignedById === me.id;
    } else if (att.taskId) {
      const n = await this.prisma.task.count({ where: { id: att.taskId, OR: [{ createdById: me.id }, { assignments: { some: { assigneeId: me.id } } }] } });
      allowed = n > 0;
    }
    if (!allowed) throw new NotFoundException('Attachment not found'); // never reveal existence
    return att;
  }

  async open(me: AuthUser, id: string) {
    const att = await this.authorize(id, me);
    return { att, stream: await this.storage.get(att.fileKey) };
  }

  async remove(me: AuthUser, id: string) {
    const att = await this.authorize(id, me);
    if (att.uploadedById !== me.id) throw new ForbiddenException('Only the uploader can delete a file');
    const taskId = att.taskId ?? att.update?.assignment.taskId;
    const task = taskId ? await this.prisma.task.findUnique({ where: { id: taskId } }) : null;
    if (task?.closedAt) throw new BadRequestException('This task is closed');
    await this.prisma.attachment.delete({ where: { id } });
    await this.storage.remove(att.fileKey);
    await this.audit.log(me.id, 'DELETE_ATTACHMENT', 'Attachment', id, { fileName: att.fileName });
    return { ok: true };
  }
}
