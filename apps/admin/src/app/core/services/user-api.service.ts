import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from './movie-api.service';

export interface ProfileInfo {
  id: number | string;
  name: string;
  kidsProfile: boolean;
  pinProtected: boolean;
  preferredLanguage: string;
  maturityLevel: string;
}

export interface DeviceInfo {
  id: number | string;
  deviceId: string;
  deviceName: string;
  platform: 'SMART_TV' | 'IOS' | 'ANDROID' | 'WEB' | string;
  ipAddress: string;
  lastSeen: string;
}

export interface UserAccount {
  id?: number | string;
  uuid?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  mobile?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  authMethod?: 'SMS_OTP' | 'EMAIL_OTP' | 'PASSWORD' | string;
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'DELETED' | string;
  roles?: string[];
  subscriptionTier?: string;
  subscriptionStatus?: string;
  subscriptionAmount?: string;
  subscriptionExpiryDate?: string;
  activeDevicesCount?: number;
  rentalsCount?: number;
  devices?: DeviceInfo[];
  lastLoginAt?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserApiService {
  private readonly http = inject(HttpClient);

  getUsers(page = 0, size = 100, search = '', role = 'USER'): Observable<ApiResponse<PageResponse<UserAccount>>> {
    const params = new URLSearchParams({
      page: String(page),
      size: String(size),
      search: search || '',
      role: role || 'USER'
    });
    return this.http.get<ApiResponse<PageResponse<UserAccount>>>(
      `${environment.apiBaseUrl}/admin/users?${params.toString()}`
    );
  }

  getUserById(id: number | string): Observable<ApiResponse<UserAccount>> {
    return this.http.get<ApiResponse<UserAccount>>(`${environment.apiBaseUrl}/admin/users/${id}`);
  }

  createUser(user: Partial<UserAccount> & { password?: string }): Observable<ApiResponse<UserAccount>> {
    return this.http.post<ApiResponse<UserAccount>>(`${environment.apiBaseUrl}/admin/users`, user);
  }

  updateUser(id: number | string, user: Partial<UserAccount>): Observable<ApiResponse<UserAccount>> {
    return this.http.put<ApiResponse<UserAccount>>(`${environment.apiBaseUrl}/admin/users/${id}`, user);
  }

  toggleStatus(id: number | string): Observable<ApiResponse<UserAccount>> {
    return this.http.patch<ApiResponse<UserAccount>>(`${environment.apiBaseUrl}/admin/users/${id}/toggle-status`, {});
  }

  sendSmsOtp(id: number | string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${environment.apiBaseUrl}/admin/users/${id}/send-otp`, {});
  }

  revokeDevices(id: number | string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${environment.apiBaseUrl}/admin/users/${id}/revoke-devices`, {});
  }

  resetPassword(id: number | string, newPassword?: string): Observable<ApiResponse<string>> {
    return this.http.post<ApiResponse<string>>(`${environment.apiBaseUrl}/admin/users/${id}/reset-password`, { newPassword });
  }

  deleteUser(id: number | string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/admin/users/${id}`);
  }
}
