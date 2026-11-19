import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/**
 * Strict Admin Guard:
 * Ensures the user is logged in AND has Admin/Super-Admin role.
 * If user is a Producer trying to access /admin, redirects to /producer/dashboard.
 * If user is unauthenticated, redirects to /login.
 */
export const adminGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  if (authStore.isOnlyProducer()) {
    return router.parseUrl('/producer/dashboard');
  }

  if (authStore.isStrictAdmin()) {
    return true;
  }

  return router.parseUrl('/login');
};

/**
 * Alias for legacy authGuard
 */
export const authGuard: CanActivateFn = adminGuard;

/**
 * Strict Producer Guard:
 * Ensures the user is logged in AND has Producer (or Admin) role.
 * If unauthenticated, redirects to /producer/login.
 */
export const producerGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return router.parseUrl('/producer/login');
  }

  if (authStore.isProducer() || authStore.isStrictAdmin()) {
    return true;
  }

  return router.parseUrl('/producer/login');
};

/**
 * Strict Public Guard:
 * Prevents authenticated users from seeing login pages, auto-redirecting to their active dashboard.
 */
export const publicOnlyGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    if (authStore.isOnlyProducer()) {
      return router.parseUrl('/producer/dashboard');
    }
    return router.parseUrl('/admin/dashboard');
  }

  return true;
};
