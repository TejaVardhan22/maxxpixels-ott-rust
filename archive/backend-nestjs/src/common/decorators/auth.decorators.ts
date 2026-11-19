import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

export const IS_RAW_RESPONSE_KEY = 'isRawResponse';
export const RawResponse = () => SetMetadata(IS_RAW_RESPONSE_KEY, true);

export interface AuthenticatedUser {
  id: any;
  uuid?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  status?: string;
  roles: string[];
  permissions?: string[];
  keycloakSub?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): any => {
    let request: any;
    if (ctx.getType() === 'http') {
      request = ctx.switchToHttp().getRequest();
    } else {
      const gqlContext = ctx.getArgByIndex(2);
      request = gqlContext?.req || gqlContext?.request || ctx.switchToHttp().getRequest();
    }
    const user: AuthenticatedUser | undefined = request?.user;
    if (!user) {
      return null;
    }
    return data ? user[data] : user;
  },
);
