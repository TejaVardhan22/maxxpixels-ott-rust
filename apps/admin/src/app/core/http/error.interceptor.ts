import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';
import { NotificationService } from '../../shared/services/notification.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);
  const notificationService = inject(NotificationService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        if (!req.url.includes('/auth/login')) {
          authStore.clearAuth();
          notificationService.error('Session expired. Please log in again.');
          router.navigate(['/login']);
        }
      } else if (error.status === 403) {
        notificationService.error('Access Denied: You do not have permission for this action.');
        router.navigate(['/403']);
      } else if (error.status === 404) {
        notificationService.warning(error.error?.message || 'Requested resource not found');
      } else if (error.status >= 500) {
        notificationService.error('Server error occurred. Please try again later.');
      } else {
        const msg = error.error?.message || error.message || 'An error occurred';
        notificationService.error(msg);
      }

      return throwError(() => error);
    })
  );
};
