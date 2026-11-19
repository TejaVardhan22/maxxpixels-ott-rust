import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse } from './models/auth.models';

export interface SendOtpRequest {
  identifier: string;
  channel?: 'SMS' | 'EMAIL';
}

export interface VerifyOtpRequest {
  phoneNumber?: string;
  identifier?: string;
  otp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  sendOtp(request: SendOtpRequest): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/send-otp`, request);
  }

  verifyOtp(request: VerifyOtpRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/verify-otp`, request);
  }

  refreshToken(refreshToken: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.baseUrl}/refresh-token`, { refreshToken });
  }

  logout(): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/logout`, {});
  }
}
