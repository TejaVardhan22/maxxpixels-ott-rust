import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PageResponse } from './movie-api.service';

export interface PaymentTransaction {
  id: number;
  transactionId: string;
  orderId: string;
  gateway: 'RAZORPAY' | 'STRIPE' | 'CASHFREE' | 'APPLE_IAP' | 'GOOGLE_PLAY' | 'TVOD_STORE' | string;
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED' | 'ACTIVE' | 'EXPIRED' | string;
  userEmail?: string;
  userPhone?: string;
  userName?: string;
  userId?: number;
  planName?: string;
  orderType?: 'TVOD' | 'SUBSCRIPTION' | string;
  contentTitle?: string;
  contentId?: number;
  posterUrl?: string;
  validUntil?: string;
  validityHours?: number;
  isRentalActive?: boolean;
  purchaseType?: string;
  createdAt: string;
  purchasedAt?: string;
  failureReason?: string;
  errorDescription?: string;
  errorCode?: string;
  refundedAmount?: number;
  providerPaymentId?: string;
  providerOrderId?: string;
  paymentMethod?: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  totalTransactions: number;
  totalRefunds: number;
  successRate: number;
  tvodRevenue?: number;
  tvodTransactions?: number;
  activeTvodRentals?: number;
  totalContentPurchases?: number;
  subscriptionRevenue?: number;
  subscriptionTransactions?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentApiService {
  private readonly http = inject(HttpClient);

  getPayments(
    page = 0,
    size = 20,
    search = '',
    gateway = '',
    type = 'ALL',
    startDate = '',
    endDate = ''
  ): Observable<ApiResponse<PageResponse<PaymentTransaction>>> {
    let url = `${environment.apiBaseUrl}/admin/payments?page=${page}&size=${size}&search=${encodeURIComponent(search)}`;
    if (gateway && gateway !== 'ALL') url += `&gateway=${encodeURIComponent(gateway)}`;
    if (type && type !== 'ALL') url += `&type=${encodeURIComponent(type)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    return this.http.get<ApiResponse<PageResponse<PaymentTransaction>>>(url);
  }

  getTvodPurchases(
    page = 0,
    size = 20,
    search = '',
    startDate = '',
    endDate = ''
  ): Observable<ApiResponse<PageResponse<PaymentTransaction>>> {
    let url = `${environment.apiBaseUrl}/admin/payments/tvod?page=${page}&size=${size}&search=${encodeURIComponent(search)}`;
    if (startDate) url += `&startDate=${encodeURIComponent(startDate)}`;
    if (endDate) url += `&endDate=${encodeURIComponent(endDate)}`;
    return this.http.get<ApiResponse<PageResponse<PaymentTransaction>>>(url);
  }

  getAnalytics(): Observable<ApiResponse<RevenueMetrics>> {
    return this.http.get<ApiResponse<RevenueMetrics>>(`${environment.apiBaseUrl}/admin/payments/analytics`);
  }

  processRefund(id: number, reason = 'Customer Requested'): Observable<ApiResponse<PaymentTransaction>> {
    return this.http.post<ApiResponse<PaymentTransaction>>(`${environment.apiBaseUrl}/admin/payments/${id}/refund?reason=${encodeURIComponent(reason)}`, {});
  }
}
