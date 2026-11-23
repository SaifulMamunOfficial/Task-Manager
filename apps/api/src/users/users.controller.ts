import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';
import { AdminOnly, AuthUser, CurrentUser } from '../auth/decorators';

class PositionAssignmentDto {
  // Left out for positions that belong to no department (Director, Assistant Director): the head office is used.
  @IsOptional() @IsString() unitId?: string;
  @IsString() positionId: string;
  @IsOptional() @IsString() reportsToUserId?: string;
  @IsOptional() @IsString() secretariatId?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

class CreateUserDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() nameBn?: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
  @IsOptional() @IsIn(['bn', 'en']) language?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionAssignmentDto)
  positions?: PositionAssignmentDto[];
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() nameBn?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(['bn', 'en']) language?: string;
}

class SetPositionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionAssignmentDto)
  positions: PositionAssignmentDto[];
}

class ResetPasswordDto {
  @IsString() @MinLength(8) password: string;
}

const publicUser = {
  id: true,
  avatarVer: true,
  name: true,
  nameBn: true,
  email: true,
  phone: true,
  isActive: true,
  isAdmin: true,
  language: true,
  positions: {
    select: {
      id: true,
      isPrimary: true,
      reportsToUserId: true,
      secretariatId: true,
      secretariat: { select: { id: true, name: true, nameBn: true } },
      unit: { select: { id: true, name: true, nameBn: true } },
      position: { select: { id: true, title: true, titleBn: true, level: true } },
    },
  },
} as const;

@Controller('users')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // Any signed-in user can list active colleagues (to choose assignees). Admin sees inactive ones too.
  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.prisma.user.findMany({
      where: me.isAdmin ? {} : { isActive: true, isAdmin: false },
      orderBy: { name: 'asc' },
      select: me.isAdmin ? publicUser : { id: true, avatarVer: true, name: true, nameBn: true, positions: publicUser.positions },
    });
  }

  @AdminOnly()
  @Get(':id')
  get(@Param('id') id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: publicUser });
  }

  @AdminOnly()
  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already in use');
    if (dto.isAdmin && dto.positions?.length) {
      throw new BadRequestException('The admin account is not part of the org hierarchy');
    }
    const positions = await this.withUnits(dto.positions ?? []);
    await this.validatePositions(positions);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        nameBn: dto.nameBn || null,
        email,
        phone: dto.phone,
        isAdmin: !!dto.isAdmin,
        language: dto.language ?? 'bn',
        passwordHash: await bcrypt.hash(dto.password, 10),
        mustChangePassword: true,
        positions: { create: this.normalise(positions) },
      },
      select: publicUser,
    });
    await this.audit.log(me.id, 'CREATE', 'User', user.id, undefined, { ...user });
    return user;
  }

  @AdminOnly()
  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    if (id === me.id && dto.isActive === false) throw new BadRequestException('You cannot deactivate yourself');
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: publicUser });
    const user = await this.prisma.user.update({ where: { id }, data: dto, select: publicUser });
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    await this.audit.log(me.id, 'UPDATE', 'User', id, before, user);
    return user;
  }

  // Replace all of a user's positions (supports holding several, e.g. Secretary + Unit Head).
  /**
   * Permanent delete, only for an account with no work history (a wrong or unused account).
   * Anyone who has given, received or written anything is deactivated instead, so tasks keep their history.
   */
  @AdminOnly()
  @Delete(':id')
  async remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    if (id === me.id) throw new BadRequestException('You cannot delete yourself');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id }, select: publicUser });
    const [made, got, gave, updates, notes, files] = await Promise.all([
      this.prisma.task.count({ where: { createdById: id } }),
      this.prisma.taskAssignment.count({ where: { assigneeId: id } }),
      this.prisma.taskAssignment.count({ where: { assignedById: id } }),
      this.prisma.taskUpdate.count({ where: { userId: id } }),
      this.prisma.taskNote.count({ where: { userId: id } }),
      this.prisma.attachment.count({ where: { uploadedById: id } }),
    ]);
    if (made + got + gave + updates + notes + files > 0) throw new ConflictException('This person has task history (tasks given, received or written), so the account cannot be deleted. Deactivate it instead.');
    await this.prisma.$transaction([
      this.prisma.userPosition.updateMany({ where: { reportsToUserId: id }, data: { reportsToUserId: null } }),
      this.prisma.secretariat.updateMany({ where: { secretaryUserId: id }, data: { secretaryUserId: null } }),
      this.prisma.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await this.audit.log(me.id, 'DELETE', 'User', id, user);
    return { ok: true };
  }

  @AdminOnly()
  @Patch(':id/positions')
  async setPositions(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: SetPositionsDto) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.isAdmin) throw new BadRequestException('The admin account is not part of the org hierarchy');
    const positions = await this.withUnits(dto.positions);
    await this.validatePositions(positions, id);
    const before = await this.prisma.userPosition.findMany({ where: { userId: id } });
    await this.prisma.$transaction([
      this.prisma.userPosition.deleteMany({ where: { userId: id } }),
      this.prisma.userPosition.createMany({ data: this.normalise(positions).map((p) => ({ ...p, userId: id })) }),
    ]);
    const after = await this.prisma.userPosition.findMany({ where: { userId: id } });
    await this.audit.log(me.id, 'SET_POSITIONS', 'User', id, before, after);
    return this.prisma.user.findUniqueOrThrow({ where: { id }, select: publicUser });
  }

  @AdminOnly()
  @Post(':id/reset-password')
  async resetPassword(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: ResetPasswordDto) {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(dto.password, 10), mustChangePassword: true },
    });
    await this.prisma.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.audit.log(me.id, 'RESET_PASSWORD', 'User', id);
    return { ok: true };
  }

  // Exactly one primary position; the first one if none is flagged.
  /** Rows without a department get the head office (only allowed for positions that are not tied to a department). */
  private async withUnits(list: PositionAssignmentDto[]): Promise<(PositionAssignmentDto & { unitId: string })[]> {
    if (list.every((p) => p.unitId)) return list as (PositionAssignmentDto & { unitId: string })[];
    const head = await this.prisma.unit.findFirst({ where: { type: 'HEAD_OFFICE' }, select: { id: true } });
    const wide = new Set((await this.prisma.position.findMany({ where: { orgWide: true }, select: { id: true } })).map((x) => x.id));
    return list.map((p) => {
      if (p.unitId) return p as PositionAssignmentDto & { unitId: string };
      if (!head || !wide.has(p.positionId)) throw new BadRequestException('Choose a department for this position');
      return { ...p, unitId: head.id, secretariatId: undefined };
    });
  }

  private normalise(list: (PositionAssignmentDto & { unitId: string })[]) {
    const primaryIdx = Math.max(0, list.findIndex((p) => p.isPrimary));
    return list.map((p, i) => ({
      unitId: p.unitId,
      positionId: p.positionId,
      reportsToUserId: p.reportsToUserId ?? null,
      secretariatId: p.secretariatId ?? null,
      isPrimary: i === primaryIdx,
    }));
  }

  private async validatePositions(list: { unitId?: string; positionId: string; secretariatId?: string; reportsToUserId?: string }[], selfId?: string) {
    const seen = new Set<string>();
    for (const p of list) {
      const key = `${p.unitId}:${p.positionId}:${p.secretariatId ?? ""}`;
      if (seen.has(key)) throw new BadRequestException('Duplicate unit/position pair');
      seen.add(key);
      if (p.reportsToUserId && p.reportsToUserId === selfId) throw new BadRequestException('A user cannot report to themselves');
      if (p.reportsToUserId) await this.assertNoCycle(selfId, p.reportsToUserId);
    }
  }

  // Walk up the reports-to chain; reject if it leads back to the user being edited.
  private async assertNoCycle(selfId: string | undefined, startId: string) {
    if (!selfId) return;
    const visited = new Set<string>();
    let frontier = [startId];
    while (frontier.length) {
      if (frontier.includes(selfId)) throw new BadRequestException('Reporting line would create a loop');
      frontier.forEach((f) => visited.add(f));
      const rows = await this.prisma.userPosition.findMany({
        where: { userId: { in: frontier }, reportsToUserId: { not: null } },
        select: { reportsToUserId: true },
      });
      frontier = [...new Set(rows.map((r) => r.reportsToUserId!))].filter((x) => !visited.has(x));
    }
  }
}
