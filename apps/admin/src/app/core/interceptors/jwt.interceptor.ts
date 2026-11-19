import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthStore } from '../auth/auth.store';
import { AuthApiService } from '../auth/auth-api.service';

@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  private readonly authStore = inject(AuthStore);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    let authReq = req;
    const token = this.authStore.accessToken();

    const isAuthEndpoint =
      req.url.includes('/auth/send-otp') ||
      req.url.includes('/auth/verify-otp') ||
      req.url.includes('/auth/login') ||
      req.url.includes('/auth/register') ||
      req.url.includes('/auth/refresh') ||
      req.url.includes('/auth/refresh-token') ||
      req.url.includes('/auth/logout');

    if (token && !isAuthEndpoint) {
      authReq = req.clone({
        headers: req.headers.set('Authorization', `Bearer ${token}`)
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !isAuthEndpoint) {
          return this.handle401Error(authReq, next);
        }
        return throwError(() => error);
      })
    );
  }

  private handle401Error(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const rToken = this.authStore.refreshToken();
      if (!rToken) {
        this.isRefreshing = false;
        this.authStore.clearSession();
        this.router.navigate(['/login']);
        return throwError(() => new Error('Session expired'));
      }

      return this.authApi.refreshToken(rToken).pipe(
        switchMap((res) => {
          this.isRefreshing = false;
          if (res.success && res.data) {
            this.authStore.setSession(res.data.accessToken, res.data.refreshToken || rToken, res.data.user);
            this.refreshTokenSubject.next(res.data.accessToken);
            return next.handle(req.clone({
              headers: req.headers.set('Authorization', `Bearer ${res.data.accessToken}`)
            }));
          }
          this.authStore.clearSession();
          this.router.navigate(['/login']);
          return throwError(() => new Error('Refresh token invalid'));
        }),
        catchError((err: any) => {
          this.isRefreshing = false;
          // Clear session on definitive authentication rejection (400/401/403)
          if (err instanceof HttpErrorResponse && (err.status === 400 || err.status === 401 || err.status === 403)) {
            this.authStore.clearSession();
            this.router.navigate(['/login']);
          }
          return throwError(() => err);
        })
      );
    } else {
      return this.refreshTokenSubject.pipe(
        filter(t => t !== null),
        take(1),
        switchMap(t => next.handle(req.clone({
          headers: req.headers.set('Authorization', `Bearer ${t}`)
        })))
      );
    }
  }
}
