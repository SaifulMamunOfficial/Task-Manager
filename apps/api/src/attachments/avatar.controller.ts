import { BadRequestException, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthUser, CurrentUser, Public } from '../auth/decorators';
import { PrismaService } from '../prisma/prisma.module';
import { AuditService } from '../common/audit.module';
import { StorageService } from './storage.service';

const MAX_AVATAR = 2 * 1024 * 1024;

/** Looks at the first bytes, so a renamed file cannot pass as a picture. */
function imageType(b: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

@Controller('avatar')
export class AvatarController {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private audit: AuditService,
  ) {}

  /** Own profile picture. multipart/form-data, field "file" (jpeg, png or webp, up to 2 MB). */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR, files: 1 } }))
  async set(@CurrentUser() me: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('No picture received (use form field "file")');
    const type = imageType(file.buffer);
    if (!type) throw new BadRequestException('The picture must be a JPEG, PNG or WebP image');
    const old = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { avatarKey: true, avatarVer: true } });
    const key = `avatars/${me.id}/${randomUUID()}.${type.split('/')[1]}`;
    await this.storage.put(key, file.buffer, type);
    const user = await this.prisma.user.update({ where: { id: me.id }, data: { avatarKey: key, avatarVer: Math.max(old.avatarVer + 1, Math.floor(Date.now() / 1000)) }, select: { avatarVer: true } });
    if (old.avatarKey) await this.storage.remove(old.avatarKey);
    await this.audit.log(me.id, 'UPDATE_AVATAR', 'User', me.id);
    return user;
  }

  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() me: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { avatarKey: true } });
    if (!u.avatarKey) return;
    await this.prisma.user.update({ where: { id: me.id }, data: { avatarKey: null, avatarVer: 0 } });
    await this.storage.remove(u.avatarKey);
    await this.audit.log(me.id, 'REMOVE_AVATAR', 'User', me.id);
  }

  /** Public so a plain <img> can load it; the address contains the person's random id and a profile picture is not sensitive inside the organization. */
  @Public()
  @Get(':id')
  async get(@Param('id') id: string, @Res() res: Response) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { avatarKey: true } });
    if (!u?.avatarKey) throw new NotFoundException();
    const stream = await this.storage.get(u.avatarKey);
    const ext = u.avatarKey.split('.').pop();
    res.setHeader('Content-Type', ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}
