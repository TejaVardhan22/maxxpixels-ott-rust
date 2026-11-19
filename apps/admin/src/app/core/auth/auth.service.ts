import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from './auth.store';
import { AuthResponse, LoginRequest } from './models/auth.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  login(credentials: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/login`, credentials).pipe(
      tap(response => {
        const payload = response?.data || response;
        const user = payload?.user || payload;
        const accessToken = payload?.accessToken || (payload as any)?.token;
        const refreshToken = payload?.refreshToken;
        if (accessToken) {
          this.authStore.setAuth(
            user,
            accessToken,
            refreshToken
          );
        }
      })
    );
  }

  refreshToken(): Observable<ApiResponse<AuthResponse>> {
    const currentRefreshToken = this.authStore.refreshToken();
    if (!currentRefreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/refresh`, {
      refreshToken: currentRefreshToken
    }).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.authStore.setAuth(
            response.data.user,
            response.data.accessToken,
            response.data.refreshToken
          );
        }
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout(redirectTo: string = '/login'): void {
    const token = this.authStore.refreshToken();
    if (token) {
      this.http.post(`${environment.apiBaseUrl}/auth/logout`, { refreshToken: token })
        .pipe(catchError(() => of(null)))
        .subscribe();
    }
    this.authStore.clearAuth();
    this.router.navigate([redirectTo]);
  }

  redirectAfterLogin(preferredPath?: string): void {
    if (preferredPath) {
      this.router.navigate([preferredPath]);
      return;
    }
    if (this.authStore.isOnlyProducer() || (this.authStore.isProducer() && !this.authStore.isStrictAdmin())) {
      this.router.navigate(['/producer/dashboard']);
    } else {
      this.router.navigate(['/admin/dashboard']);
    }
  }
}
