import { BadRequestException, Body, Controller, Delete, Get, Put, Query } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';
import { VisibilityMode, VisibilityScope } from '@prisma/client';
import { resolveVisibilityMode } from '@tm/shared';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';
import { AdminOnly, AuthUser, CurrentUser } from '../auth/decorators';

class SetVisibilityDto {
  @IsEnum(VisibilityScope) scope: VisibilityScope;
  @IsOptional() @IsString() scopeRefId?: string; // required for POSITION / USER
  @IsEnum(VisibilityMode) mode: VisibilityMode;
}

class SetDelegationDto {
  @IsString() fromPositionId: string;
  @IsArray() @IsString({ each: true }) toPositionIds: string[];
}

@Controller('settings')
export class SettingsController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ----- Visibility mode (Direct / Summary / Full), controlled by the admin -----

  @AdminOnly()
  @Get('visibility')
  visibility() {
    return this.prisma.visibilitySetting.findMany({ orderBy: [{ scope: 'asc' }, { updatedAt: 'desc' }] });
  }

  @AdminOnly()
  @Put('visibility')
  async setVisibility(@CurrentUser() me: AuthUser, @Body() dto: SetVisibilityDto) {
    const scopeRefId = dto.scope === 'GLOBAL' ? '' : dto.scopeRefId ?? '';
    if (dto.scope !== 'GLOBAL' && !scopeRefId) throw new BadRequestException('scopeRefId is required for POSITION/USER');
    const where = { scope_scopeRefId: { scope: dto.scope, scopeRefId } };
    const before = await this.prisma.visibilitySetting.findUnique({ where });
    const row = await this.prisma.visibilitySetting.upsert({
      where,
      create: { scope: dto.scope, scopeRefId, mode: dto.mode, updatedBy: me.id },
      update: { mode: dto.mode, updatedBy: me.id },
    });
    await this.audit.log(me.id, 'SET_VISIBILITY', 'VisibilitySetting', row.id, before, row);
    return row;
  }

  @AdminOnly()
  @Delete('visibility')
  async clearVisibility(@CurrentUser() me: AuthUser, @Query('scope') scope: VisibilityScope, @Query('scopeRefId') ref = '') {
    if (scope === 'GLOBAL') throw new BadRequestException('The global default cannot be removed, only changed');
    const where = { scope_scopeRefId: { scope, scopeRefId: ref } };
    const before = await this.prisma.visibilitySetting.findUnique({ where });
    if (before) {
      await this.prisma.visibilitySetting.delete({ where });
      await this.audit.log(me.id, 'CLEAR_VISIBILITY', 'VisibilitySetting', before.id, before);
    }
    return { ok: true };
  }

  /** What mode applies to the signed-in user as a task giver (used by the task module later). */
  @Get('visibility/effective')
  async effective(@CurrentUser() me: AuthUser) {
    const [settings, positions] = await Promise.all([
      this.prisma.visibilitySetting.findMany(),
      this.prisma.userPosition.findMany({ where: { userId: me.id }, select: { positionId: true } }),
    ]);
    const mode = resolveVisibilityMode(
      settings.map((s) => ({ scope: s.scope, scopeRefId: s.scopeRefId || null, mode: s.mode })),
      me.id,
      positions.map((p) => p.positionId),
    );
    return { mode };
  }

  // ----- Who may give tasks to whom (permission matrix) -----

  @Get('delegation')
  delegation() {
    return this.prisma.delegationPermission.findMany();
  }

  @AdminOnly()
  @Put('delegation')
  async setDelegation(@CurrentUser() me: AuthUser, @Body() dto: SetDelegationDto) {
    const before = await this.prisma.delegationPermission.findMany({ where: { fromPositionId: dto.fromPositionId } });
    await this.prisma.$transaction([
      this.prisma.delegationPermission.deleteMany({ where: { fromPositionId: dto.fromPositionId } }),
      this.prisma.delegationPermission.createMany({
        data: [...new Set(dto.toPositionIds)].map((toPositionId) => ({ fromPositionId: dto.fromPositionId, toPositionId })),
      }),
    ]);
    const after = await this.prisma.delegationPermission.findMany({ where: { fromPositionId: dto.fromPositionId } });
    await this.audit.log(me.id, 'SET_DELEGATION', 'DelegationPermission', dto.fromPositionId, before, after);
    return after;
  }

  // ----- Audit log (admin) -----

  @AdminOnly()
  @Get('audit')
  auditLog(@Query('limit') limit = '100') {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 100, 500),
      include: { actor: { select: { id: true, name: true, nameBn: true } } },
    });
  }
}
