import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const IS_ADMIN_ONLY = 'isAdminOnly';

export const Public = () => SetMetadata(IS_PUBLIC, true);
export const AdminOnly = () => SetMetadata(IS_ADMIN_ONLY, true);

export interface AuthUser {
  id: string;
  isAdmin: boolean;
}

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});
