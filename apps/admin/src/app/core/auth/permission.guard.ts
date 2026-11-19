import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * Strict Permission Guard:
 * Checks required roles and permissions specified in route data.
 * E.g., data: { roles: ['SUPER_ADMIN'], permissions: ['CONTENT_VIEW'] }
 */
export const permissionGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  // Super Admins and Platform Admins have unrestricted access to all admin sections
  if (authStore.isStrictAdmin()) {
    return true;
  }

  // Producers must never be routed to admin dashboard
  if (authStore.isOnlyProducer()) {
    return router.parseUrl('/producer/dashboard');
  }

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  const requiredPermissions = route.data?.['permissions'] as string[] | undefined;

  if (requiredRoles && requiredRoles.length > 0) {
    if (!authStore.hasAnyRole(requiredRoles)) {
      return router.parseUrl(authStore.isOnlyProducer() ? '/producer/dashboard' : '/admin/dashboard');
    }
  }

  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!authStore.hasAnyPermission(requiredPermissions)) {
      return router.parseUrl(authStore.isOnlyProducer() ? '/producer/dashboard' : '/admin/dashboard');
    }
  }

  return true;
};
