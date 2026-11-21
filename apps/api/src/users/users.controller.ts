import { BadRequestException, Body, ConflictException, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
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
  @IsString() unitId: string;
  @IsString() positionId: string;
  @IsOptional() @IsString() reportsToUserId?: string;
  @IsOptional() @IsString() secretariatId?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

class CreateUserDto {
  @IsString() @MinLength(1) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(8) password: string;
  @IsOptional() @IsBoolean() isAdmin?: boolean;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PositionAssignmentDto)
  positions?: PositionAssignmentDto[];
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class SetPositionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PositionAssignmentDto)
  positions: PositionAssignmentDto[];
}

class ResetPasswordDto {
  @IsString() @MinLength(8) password: string;
}

const publicUser = {
  id: true,
  name: true,
  email: true,
  phone: true,
  isActive: true,
  isAdmin: true,
  positions: {
    select: {
      id: true,
      isPrimary: true,
      reportsToUserId: true,
      secretariatId: true,
      unit: { select: { id: true, name: true } },
      position: { select: { id: true, title: true, level: true } },
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
      select: me.isAdmin ? publicUser : { id: true, name: true, positions: publicUser.positions },
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
    await this.validatePositions(dto.positions ?? []);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        phone: dto.phone,
        isAdmin: !!dto.isAdmin,
        passwordHash: await bcrypt.hash(dto.password, 10),
        mustChangePassword: true,
        positions: { create: this.normalise(dto.positions ?? []) },
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
  @AdminOnly()
  @Patch(':id/positions')
  async setPositions(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: SetPositionsDto) {
    const target = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (target.isAdmin) throw new BadRequestException('The admin account is not part of the org hierarchy');
    await this.validatePositions(dto.positions, id);
    const before = await this.prisma.userPosition.findMany({ where: { userId: id } });
    await this.prisma.$transaction([
      this.prisma.userPosition.deleteMany({ where: { userId: id } }),
      this.prisma.userPosition.createMany({ data: this.normalise(dto.positions).map((p) => ({ ...p, userId: id })) }),
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
  private normalise(list: PositionAssignmentDto[]) {
    const primaryIdx = Math.max(0, list.findIndex((p) => p.isPrimary));
    return list.map((p, i) => ({
      unitId: p.unitId,
      positionId: p.positionId,
      reportsToUserId: p.reportsToUserId ?? null,
      secretariatId: p.secretariatId ?? null,
      isPrimary: i === primaryIdx,
    }));
  }

  private async validatePositions(list: PositionAssignmentDto[], selfId?: string) {
    const seen = new Set<string>();
    for (const p of list) {
      const key = `${p.unitId}:${p.positionId}`;
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
