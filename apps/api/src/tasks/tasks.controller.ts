import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { AssignmentStatus, Priority } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/decorators';
import { TasksService } from './tasks.service';

class CreateTaskDto {
  @IsString() @MinLength(1) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) assigneeIds: string[];
  @IsOptional() @IsString() fromPositionId?: string;
}

// Delegation: title is optional (defaults to the parent task's title).
class DelegateDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsISO8601() dueDate?: string;
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) assigneeIds: string[];
  @IsOptional() @IsString() fromPositionId?: string;
}

class TransitionDto {
  @IsEnum(AssignmentStatus) status: AssignmentStatus;
  @IsOptional() @IsString() comment?: string;
}

class UpdateDto {
  @IsOptional() @IsString() body?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progressPercent?: number;
}

class NoteDto {
  @IsString() @MinLength(1) body: string;
}

class MarkReadDto {
  @IsOptional() @IsArray() @IsString({ each: true }) ids?: string[];
}

@Controller()
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Post('tasks')
  create(@CurrentUser() me: AuthUser, @Body() dto: CreateTaskDto) {
    return this.tasks.create(me, dto);
  }

  /** bucket: overdue | today | week | open | closed (omit for all) */
  @Get('tasks/mine')
  mine(@CurrentUser() me: AuthUser, @Query('bucket') bucket?: string) {
    return this.tasks.mine(me, bucket);
  }

  @Get('tasks/given')
  given(@CurrentUser() me: AuthUser, @Query('bucket') bucket?: string) {
    return this.tasks.given(me, bucket);
  }

  @Post('tasks/:taskId/notes')
  addNote(@CurrentUser() me: AuthUser, @Param('taskId') taskId: string, @Body() dto: NoteDto) {
    return this.tasks.addNote(taskId, me, dto.body);
  }

  @Get('assignments/:id')
  detail(@CurrentUser() me: AuthUser, @Param('id') id: string) {
    return this.tasks.detail(id, me);
  }

  @Post('assignments/:id/transition')
  transition(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: TransitionDto) {
    return this.tasks.transition(id, me, dto.status, dto.comment);
  }

  @Post('assignments/:id/updates')
  update(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: UpdateDto) {
    return this.tasks.postUpdate(id, me, dto.body, dto.progressPercent);
  }

  /** Pass the task on: creates a sub-task under this assignment. */
  @Post('assignments/:id/delegate')
  delegate(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: DelegateDto) {
    return this.tasks.create(me, { ...dto, title: dto.title ?? '' }, id);
  }

  @Get('notifications')
  notifications(@CurrentUser() me: AuthUser, @Query('unread') unread?: string) {
    return this.tasks.notifications(me, unread === 'true');
  }

  @Post('notifications/read')
  markRead(@CurrentUser() me: AuthUser, @Body() dto: MarkReadDto) {
    return this.tasks.markRead(me, dto.ids);
  }
}
