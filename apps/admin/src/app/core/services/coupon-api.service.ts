import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from './movie-api.service';

export interface Coupon {
  id?: number | string;
  code: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED' | string;
  discountValue: number;
  minimumAmount?: number;
  minOrderAmount?: number;
  maximumDiscount?: number;
  maxDiscountAmount?: number;
  applicablePlanId?: number | null;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number;
  usagePerUser?: number;
  usedCount?: number;
  active?: boolean;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CouponApiService {
  private readonly http = inject(HttpClient);

  getCoupons(page = 0, size = 20, search = ''): Observable<ApiResponse<PageResponse<Coupon>>> {
    return this.http.get<ApiResponse<PageResponse<Coupon>>>(
      `${environment.apiBaseUrl}/admin/coupons?page=${page}&size=${size}&search=${search}`
    );
  }

  getCouponById(id: number | string): Observable<ApiResponse<Coupon>> {
    return this.http.get<ApiResponse<Coupon>>(`${environment.apiBaseUrl}/admin/coupons/${id}`);
  }

  createCoupon(coupon: Coupon): Observable<ApiResponse<Coupon>> {
    return this.http.post<ApiResponse<Coupon>>(`${environment.apiBaseUrl}/admin/coupons`, coupon);
  }

  updateCoupon(id: number | string, coupon: Coupon): Observable<ApiResponse<Coupon>> {
    return this.http.put<ApiResponse<Coupon>>(`${environment.apiBaseUrl}/admin/coupons/${id}`, coupon);
  }

  toggleStatus(id: number | string): Observable<ApiResponse<Coupon>> {
    return this.http.patch<ApiResponse<Coupon>>(`${environment.apiBaseUrl}/admin/coupons/${id}/toggle-status`, {});
  }

  deleteCoupon(id: number | string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${environment.apiBaseUrl}/admin/coupons/${id}`);
  }
}
