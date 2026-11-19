import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const token =
    authStore.accessToken() ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('ott_access_token') || localStorage.getItem('access_token') || localStorage.getItem('token')
      : null);

  if (token && !req.headers.has('Authorization')) {
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token.trim()}`)
    });
    return next(authReq);
  }

  return next(req);
};
