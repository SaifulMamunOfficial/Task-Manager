import { Body, Controller, Delete, Get, Param, Post, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { AttachmentsService, MAX_BYTES } from './attachments.service';

const upload = () => FilesInterceptor('files', 10, { limits: { fileSize: MAX_BYTES, files: 10 } });

@Controller()
export class AttachmentsController {
  constructor(private attachments: AttachmentsService) {}

  /** multipart/form-data, field "files" (up to 10). Only the task's creator. */
  @Post('tasks/:taskId/attachments')
  @UseInterceptors(upload())
  addToTask(@CurrentUser() me: AuthUser, @Param('taskId') taskId: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.attachments.addToTask(me, taskId, files);
  }

  /** multipart/form-data: field "files" plus optional text field "body". Posts a comment with the files. */
  @Post('assignments/:id/attachments')
  @UseInterceptors(upload())
  addToAssignment(
    @CurrentUser() me: AuthUser,
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('body') body?: string,
  ) {
    return this.attachments.addToAssignment(me, id, files, body);
  }

  @Get('attachments/:id/download')
  async download(@CurrentUser() me: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const { att, stream } = await this.attachments.open(me, id);
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader('Content-Length', String(att.sizeBytes));
    // Always a download, never rendered in the browser, so uploaded HTML/SVG cannot run scripts.
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(att.fileName)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }

  @Delete('attachments/:id')
  remove(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.attachments.remove(me, id);
  }
}
