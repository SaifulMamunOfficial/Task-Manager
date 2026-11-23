import { Body, ConflictException, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { UnitType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';
import { AdminOnly, AuthUser, CurrentUser } from '../auth/decorators';

class CreateUnitDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() nameBn?: string;
  @IsOptional() @IsEnum(UnitType) type?: UnitType;
  @IsOptional() @IsString() parentId?: string;
}
class UpdateUnitDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() nameBn?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class PositionDto {
  @IsString() @MinLength(1) title: string;
  @IsOptional() @IsBoolean() ownTeamOnly?: boolean;
  @IsOptional() @IsBoolean() orgWide?: boolean;
  @IsOptional() @IsString() titleBn?: string;
  @IsOptional() @IsInt() level?: number;
}
class SecretariatDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() nameBn?: string;
  @IsString() unitId: string;
  @IsOptional() @IsString() secretaryUserId?: string;
}

@Controller()
export class OrgController {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  // ----- Read: any signed-in user (needed to pick people when giving tasks) -----

  @Get('org/tree')
  async tree() {
    const units = await this.prisma.unit.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        secretariats: { select: { id: true, name: true, nameBn: true, secretaryUserId: true } },
        members: {
          where: { user: { isActive: true } },
          select: {
            id: true,
            isPrimary: true,
            reportsToUserId: true,
            secretariatId: true,
            user: { select: { id: true, name: true, nameBn: true } },
            position: { select: { id: true, title: true, titleBn: true, level: true } },
          },
        },
      },
    });
    return units;
  }

  @Get('units')
  units() {
    return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  @Get('positions')
  positions() {
    return this.prisma.position.findMany({ orderBy: { level: 'asc' } });
  }

  // ----- Write: admin only -----

  @AdminOnly()
  @Post('units')
  async createUnit(@CurrentUser() me: AuthUser, @Body() dto: CreateUnitDto) {
    const unit = await this.prisma.unit.create({ data: dto });
    await this.audit.log(me.id, 'CREATE', 'Unit', unit.id, undefined, unit);
    return unit;
  }

  @AdminOnly()
  @Patch('units/:id')
  async updateUnit(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateUnitDto) {
    const before = await this.prisma.unit.findUniqueOrThrow({ where: { id } });
    const unit = await this.prisma.unit.update({ where: { id }, data: dto });
    await this.audit.log(me.id, 'UPDATE', 'Unit', id, before, unit);
    return unit;
  }

  /** Only an empty one can go: nobody in it, no secretariats, nothing under it. Otherwise deactivate it. */
  @AdminOnly()
  @Delete('units/:id')
  async deleteUnit(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const unit = await this.prisma.unit.findUniqueOrThrow({ where: { id } });
    if (unit.type === 'HEAD_OFFICE') throw new ConflictException('The head office cannot be deleted');
    const [people, secretariats, children] = await Promise.all([
      this.prisma.userPosition.count({ where: { unitId: id } }),
      this.prisma.secretariat.count({ where: { unitId: id } }),
      this.prisma.unit.count({ where: { parentId: id } }),
    ]);
    if (people > 0) throw new ConflictException('Department still has people');
    if (secretariats > 0) throw new ConflictException('Department still has secretariats');
    if (children > 0) throw new ConflictException('Department still has branches under it');
    await this.prisma.unit.delete({ where: { id } });
    await this.audit.log(me.id, 'DELETE', 'Unit', id, unit);
    return { ok: true };
  }

  @AdminOnly()
  @Post('positions')
  async createPosition(@CurrentUser() me: AuthUser, @Body() dto: PositionDto) {
    const exists = await this.prisma.position.findUnique({ where: { title: dto.title } });
    if (exists) throw new ConflictException('Position already exists');
    const p = await this.prisma.position.create({ data: dto });
    await this.audit.log(me.id, 'CREATE', 'Position', p.id, undefined, p);
    return p;
  }

  @AdminOnly()
  @Patch('positions/:id')
  async updatePosition(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: PositionDto) {
    const before = await this.prisma.position.findUniqueOrThrow({ where: { id } });
    const p = await this.prisma.position.update({ where: { id }, data: dto });
    await this.audit.log(me.id, 'UPDATE', 'Position', id, before, p);
    return p;
  }

  @AdminOnly()
  @Post('secretariats')
  async createSecretariat(@CurrentUser() me: AuthUser, @Body() dto: SecretariatDto) {
    const s = await this.prisma.secretariat.create({ data: dto });
    await this.audit.log(me.id, 'CREATE', 'Secretariat', s.id, undefined, s);
    return s;
  }

  @AdminOnly()
  @Delete('secretariats/:id')
  async deleteSecretariat(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    const members = await this.prisma.userPosition.count({ where: { secretariatId: id } });
    if (members > 0) throw new ConflictException('Secretariat still has members');
    const s = await this.prisma.secretariat.delete({ where: { id } });
    await this.audit.log(me.id, 'DELETE', 'Secretariat', id, s);
    return { ok: true };
  }
}
