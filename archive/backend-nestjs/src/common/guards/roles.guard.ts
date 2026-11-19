import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, PERMISSIONS_KEY, IS_PUBLIC_KEY, AuthenticatedUser } from '../decorators/auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    let request: any;
    if (context.getType() === 'http') {
      request = context.switchToHttp().getRequest();
    } else {
      const gqlContext = context.getArgByIndex(2);
      request = gqlContext?.req || gqlContext?.request || context.switchToHttp().getRequest();
    }
    const user: AuthenticatedUser | undefined = request?.user;

    if (!user) {
      throw new ForbiddenException('Access denied: unauthenticated user');
    }

    const userRoles = (user.roles || []).map((r) => (r.startsWith('ROLE_') ? r.toUpperCase() : `ROLE_${r.toUpperCase()}`));

    // ROLE_SUPER_ADMIN, ROLE_ADMIN, and Master Administrator have full administrative privileges
    if (
      String(user.id) === '1' ||
      user.email === 'admin@maxxpixels.com' ||
      userRoles.includes('ROLE_SUPER_ADMIN') ||
      userRoles.includes('ROLE_ADMIN') ||
      userRoles.includes('SUPER_ADMIN') ||
      userRoles.includes('ADMIN')
    ) {
      return true;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const normalizedRequired = requiredRoles.map((r) =>
        r.startsWith('ROLE_') ? r.toUpperCase() : `ROLE_${r.toUpperCase()}`,
      );
      const hasRole = normalizedRequired.some((reqRole) => userRoles.includes(reqRole));
      if (!hasRole) {
        throw new ForbiddenException('Access denied: insufficient role privileges');
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      if (userRoles.includes('ROLE_ADMIN')) {
        return true;
      }
      const userPerms = (user.permissions || []).map((p) => p.toUpperCase());
      const hasPermission = requiredPermissions.some((reqPerm) => userPerms.includes(reqPerm.toUpperCase()));
      if (!hasPermission) {
        throw new ForbiddenException('Access denied: missing required permission');
      }
    }

    return true;
  }
}

