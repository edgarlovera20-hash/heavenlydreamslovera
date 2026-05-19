import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createParamDecorator, ExecutionContext } = require('@nestjs/common');
  return createParamDecorator((_: unknown, ctx: typeof ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  })();
};
