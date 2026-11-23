import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AvatarController } from './avatar.controller';
import { AttachmentsService } from './attachments.service';
import { StorageService } from './storage.service';

@Module({ controllers: [AttachmentsController, AvatarController], providers: [AttachmentsService, StorageService] })
export class AttachmentsModule {}
