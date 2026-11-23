import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private audit: AuditService,
  ) {}

  private async issueTokens(user: { id: string; isAdmin: boolean }) {
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, isAdmin: user.isAdmin },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      },
    );
    const refreshToken = randomBytes(48).toString('hex');
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + days * 86400_000),
      },
    });
    return { accessToken, refreshToken };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Same error for unknown user / wrong password / inactive: do not leak which.
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: await this.me(user.id) };
  }

  /** Rotating refresh: the presented token is revoked and a new pair is issued. */
  async refresh(refreshToken: string) {
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(refreshToken) } });
    if (!row || row.revokedAt || row.expiresAt < new Date()) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({ where: { id: row.userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Account disabled');
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issueTokens(user);
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new BadRequestException('Current password is wrong');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false },
    });
    // Sign out all other sessions.
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async setLanguage(userId: string, language: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { language } });
  }

  /** The person edits their own name and phone (email is their sign-in, only an admin changes it). */
  async updateProfile(userId: string, data: { name?: string; nameBn?: string; phone?: string }) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, nameBn: true, phone: true } });
    const next = {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.nameBn !== undefined ? { nameBn: data.nameBn.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone.trim() || null } : {}),
    };
    await this.prisma.user.update({ where: { id: userId }, data: next });
    await this.audit.log(userId, 'UPDATE_PROFILE', 'User', userId, before, next);
    return this.me(userId);
  }

  me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        nameBn: true,
        email: true,
        phone: true,
        isAdmin: true,
        mustChangePassword: true,
        language: true,
        notifyEmail: true,
        notifyPush: true,
        avatarVer: true,
        positions: {
          select: {
            id: true,
            isPrimary: true,
            unit: { select: { id: true, name: true, nameBn: true } },
            position: { select: { id: true, title: true, titleBn: true, level: true } },
            reportsToUserId: true,
            secretariatId: true,
            secretariat: { select: { id: true, name: true, nameBn: true } },
          },
        },
      },
    });
  }
}
