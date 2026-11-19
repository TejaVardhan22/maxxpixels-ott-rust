import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from './movie-api.service';

export interface Plan {
  id?: number | string;
  name: string;
  code: string;
  billingPeriod: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' | 'ONE_TIME' | string;
  price: number;
  currency?: string;
  maxResolution: '720p' | '1080p' | '4K_UHD' | string;
  maxDevices: number;
  maxConcurrentStreams: number;
  adsEnabled: boolean;
  downloadsEnabled: boolean;
  trialDays?: number;
  singleUseOnly?: boolean; // Single use per user, non-rechargeable later
  autopayEnabled?: boolean; // Recurring autopay (e-Mandate / UPI Autopay / Card auto-renewal)
  autoRenew?: boolean;
  razorpayPlanId?: string; // Optional Razorpay Subscription Plan ID (plan_xxxxx)
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PlanApiService {
  private readonly http = inject(HttpClient);

  getPlans(page = 0, size = 20, search = ''): Observable<ApiResponse<PageResponse<Plan>>> {
    return this.http.get<ApiResponse<PageResponse<Plan>>>(
      `${environment.apiBaseUrl}/admin/plans?page=${page}&size=${size}&search=${search}`
    );
  }

  getPlanById(id: number | string): Observable<ApiResponse<Plan>> {
    return this.http.get<ApiResponse<Plan>>(`${environment.apiBaseUrl}/admin/plans/${id}`);
  }

  createPlan(plan: Plan): Observable<ApiResponse<Plan>> {
    return this.http.post<ApiResponse<Plan>>(`${environment.apiBaseUrl}/admin/plans`, plan);
  }

  updatePlan(id: number | string, plan: Plan): Observable<ApiResponse<Plan>> {
    return this.http.put<ApiResponse<Plan>>(`${environment.apiBaseUrl}/admin/plans/${id}`, plan);
  }

  toggleStatus(id: number | string): Observable<ApiResponse<Plan>> {
    return this.http.patch<ApiResponse<Plan>>(`${environment.apiBaseUrl}/admin/plans/${id}/toggle-status`, {});
  }

  deletePlan(id: number | string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/admin/plans/${id}`);
  }
}
