import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { AdminOnly, AuthUser, CurrentUser } from '../auth/decorators';
import { AuditService } from '../common/audit.module';
import { RemindersService } from './reminders.service';
import { ReminderKind, REMINDER_KINDS } from './reminders.config';

class RuleDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsObject() config?: Record<string, number>;
}

@Controller('settings/reminders')
export class RemindersController {
  constructor(
    private reminders: RemindersService,
    private audit: AuditService,
  ) {}

  @AdminOnly()
  @Get()
  rules() {
    return this.reminders.getRules();
  }

  @AdminOnly()
  @Put(':kind')
  async setRule(@CurrentUser() me: AuthUser, @Param('kind') kind: string, @Body() dto: RuleDto) {
    if (!(REMINDER_KINDS as string[]).includes(kind)) throw new BadRequestException(`Unknown reminder kind. Use one of: ${REMINDER_KINDS.join(', ')}`);
    for (const [k, v] of Object.entries(dto.config ?? {})) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new BadRequestException(`config.${k} must be a non-negative number`);
    }
    const before = (await this.reminders.getRules())[kind as ReminderKind];
    const row = await this.reminders.setRule(kind as ReminderKind, dto.enabled, dto.config);
    await this.audit.log(me.id, 'SET_REMINDER_RULE', 'ReminderRule', row.id, before, row);
    return this.reminders.getRules();
  }

  /** Run a pass right now (ignores the send window). Optional ?at=ISO-date to simulate another moment. */
  @AdminOnly()
  @Post('run')
  async runNow(@Query('at') at?: string, @Query('respectWindow') respectWindow?: string) {
    const when = at ? new Date(at) : new Date();
    if (isNaN(when.getTime())) throw new BadRequestException('Invalid "at" date');
    return this.reminders.run(when, respectWindow !== 'true');
  }
}
