import { Global, Injectable, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.module';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  log(
    actorId: string | null,
    action: string,
    entity: string,
    entityId?: string | null,
    before?: unknown,
    after?: unknown,
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ?? null,
        before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
        after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
      },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
