import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './movie-api.service';

export interface ProducerSubmission {
  id?: number | string;
  producerId?: number | string;
  producerEmail?: string;
  producerName?: string;
  title: string;
  contentType: string;
  description?: string;
  oneLineBrief?: string;
  language?: string;
  posterUrl?: string;
  poster2Url?: string;
  bannerUrl?: string;
  trailerUrl?: string;
  productionName?: string;
  producerContactPhone?: string;
  googleDriveLink?: string;
  submissionSource?: string;
  agreementUrl?: string;
  agreementStatus?: string;
  expiresAt?: string;
  rawVideoUrl?: string;
  revenueSharePercentage?: number;
  status: string;
  reviewNotes?: string;
  adminReviewComment?: string;
  createdAt?: string;
}

export interface AdImpressionLog {
  id: number | string;
  adId: string;
  slotType: string;
  cuePointSeconds: number;
  adRevenue: number;
  producerEarnings: number;
  runTimestamp: string;
}

export interface ProducerAnalyticsDashboard {
  producerId: number | string;
  totalSubmissions: number;
  totalAdImpressions: number;
  totalAdRevenueEarned: number;
  totalSubscriptionEarnings: number;
  totalTvodEarnings: number;
  grandTotalEarnings: number;
}

export interface ProducerOnboardingProfile {
  id?: number | string;
  producerUserId?: number | string;
  studioName: string;
  companyName?: string;
  studioRegistrationNumber: string;
  businessType?: string;
  contactEmail: string;
  contactPhone: string;
  bankAccountPayoutId?: string;
  taxId?: string;
  defaultRevenueSharePercentage: number;
  panNumber?: string;
  panStatus?: string;
  panDocUrl?: string;
  aadharNumber?: string;
  aadharStatus?: string;
  aadharDocUrl?: string;
  aadharFrontDocUrl?: string;
  aadharBackDocUrl?: string;
  gstNumber?: string;
  gstStatus?: string;
  gstDocUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ifscCode?: string;
  bankStatus?: string;
  bankDocUrl?: string;
  onboardingStatus?: string;
  status?: string;
  signedAgreementUrl?: string;
  agreementStatus?: string;
  rejectionReason?: string;
  loginPassword?: string;
}

export interface MovieAnalyticsItem {
  id: number | string;
  title: string;
  contentType: string;
  runTimeMinutes: number;
  totalViews: number;
  adsRunned: number;
  totalWatchHours: number;
  producerEarnings: number;
  status: string;
}

export interface ProducerAgreement {
  agreementId: string;
  effectiveDate: string;
  studioName: string;
  studioRegistrationNumber: string;
  contactEmail: string;
  contactPhone: string;
  panNumber: string;
  aadharNumber: string;
  gstNumber: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  revenueSharePercentage: number;
  approvedTitles: Array<{ id: number | string; title: string; contentType: string; status: string }>;
  agreementStatus: string;
  signedAgreementUrl: string | null;
  licenseTerms: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProducerApiService {
  private readonly http = inject(HttpClient);

  // 1. Admin: Get all onboarded producers
  getAllProducers(includeInactive = false): Observable<ApiResponse<ProducerOnboardingProfile[]>> {
    const params: any = {};
    if (includeInactive) params.includeInactive = 'true';
    return this.http.get<ApiResponse<ProducerOnboardingProfile[]>>(`${environment.apiBaseUrl}/admin/producers`, { params });
  }

  // 1b. Admin: Delete or remove producer studio (deactivates & hides)
  deleteProducer(id: number | string): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${environment.apiBaseUrl}/admin/producers/${id}`);
  }

  // 2. Admin: Onboard new producer studio
  onboardProducer(profile: ProducerOnboardingProfile): Observable<ApiResponse<ProducerOnboardingProfile>> {
    return this.http.post<ApiResponse<ProducerOnboardingProfile>>(`${environment.apiBaseUrl}/admin/producers/onboard`, profile);
  }

  // 3. Admin: Reset producer password
  resetProducerPassword(id: number | string, newPassword?: string): Observable<ApiResponse<string>> {
    const query = newPassword ? `?newPassword=${encodeURIComponent(newPassword)}` : '';
    return this.http.post<ApiResponse<string>>(`${environment.apiBaseUrl}/admin/producers/${id}/reset-password${query}`, {});
  }

  // 3b. Admin: Toggle active / deactivate producer status
  toggleProducerStatus(id: number | string, status?: string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiBaseUrl}/admin/producers/${id}/toggle-status`, { status });
  }

  // 4. Producer: Get studio profile
  getProducerProfile(producerId?: string): Observable<ApiResponse<ProducerOnboardingProfile>> {
    const params: any = {};
    if (producerId) params.producerId = producerId;
    return this.http.get<ApiResponse<ProducerOnboardingProfile>>(`${environment.apiBaseUrl}/producer/profile`, { params });
  }

  // 5. Producer: Get movie & series performance analytics
  getMovieAnalytics(producerId?: string): Observable<ApiResponse<MovieAnalyticsItem[]>> {
    const params: any = {};
    if (producerId) params.producerId = producerId;
    return this.http.get<ApiResponse<MovieAnalyticsItem[]>>(`${environment.apiBaseUrl}/producer/analytics/movies`, { params });
  }

  // 6. Producer: Submit media asset for review
  submitContent(submission: ProducerSubmission): Observable<ApiResponse<ProducerSubmission>> {
    return this.http.post<ApiResponse<ProducerSubmission>>(`${environment.apiBaseUrl}/producer/submissions`, submission);
  }

  // 7. Producer: Get my submissions
  getMySubmissions(): Observable<ApiResponse<ProducerSubmission[]>> {
    return this.http.get<ApiResponse<ProducerSubmission[]>>(`${environment.apiBaseUrl}/producer/submissions`);
  }

  // 8. Admin: Get pending submissions for review
  getAdminSubmissions(status = 'SUBMITTED'): Observable<ApiResponse<ProducerSubmission[]>> {
    return this.http.get<ApiResponse<ProducerSubmission[]>>(`${environment.apiBaseUrl}/admin/content/submissions`, { params: { status } });
  }

  // 9. Admin: Approve or Reject submission
  reviewSubmission(id: number | string, status: string, reviewNotes = ''): Observable<ApiResponse<ProducerSubmission>> {
    return this.http.post<ApiResponse<ProducerSubmission>>(
      `${environment.apiBaseUrl}/admin/content/submissions/${id}/review`,
      { action: status, notes: reviewNotes, rejectionReason: reviewNotes }
    );
  }

  // 10. Admin: Get pending producer onboardings (KYC)
  getPendingOnboardings(): Observable<ApiResponse<ProducerOnboardingProfile[]>> {
    return this.http.get<ApiResponse<ProducerOnboardingProfile[]>>(`${environment.apiBaseUrl}/admin/producers/onboardings`);
  }

  // 11. Admin: Review producer onboarding (Approve or Reject KYC)
  reviewProducerOnboarding(id: number | string, action: string, rejectionReason = ''): Observable<ApiResponse<ProducerOnboardingProfile>> {
    return this.http.post<ApiResponse<ProducerOnboardingProfile>>(
      `${environment.apiBaseUrl}/admin/producers/onboardings/${id}/review`,
      { action, rejectionReason, notes: rejectionReason }
    );
  }

  // 11b. Admin: Verify individual document (PAN, AADHAAR, BANK, GST)
  verifyProducerDoc(id: number | string, docType: string, docStatus = 'VERIFIED'): Observable<ApiResponse<ProducerOnboardingProfile>> {
    return this.http.post<ApiResponse<ProducerOnboardingProfile>>(
      `${environment.apiBaseUrl}/admin/producers/onboardings/${id}/review`,
      { docType, docStatus }
    );
  }

  // 12. Producer: Get agreement document & status
  getProducerAgreement(producerId?: string): Observable<ApiResponse<ProducerAgreement>> {
    const params: any = {};
    if (producerId) params.producerId = producerId;
    return this.http.get<ApiResponse<ProducerAgreement>>(`${environment.apiBaseUrl}/producer/agreement`, { params });
  }

  // 13. Producer: Upload signed agreement + KYC documents (PAN, Aadhaar, Bank) for final confirmation
  uploadProducerAgreement(payload: {
    signedAgreementUrl?: string;
    panNumber?: string;
    panDocUrl?: string;
    aadharNumber?: string;
    aadharDocUrl?: string;
    bankName?: string;
    bankAccountNumber?: string;
    ifscCode?: string;
    bankDocUrl?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${environment.apiBaseUrl}/producer/agreement/upload`, payload);
  }

  // 14. Admin: Generate secure login credentials for a producer after onboarding approval
  generateProducerCredentials(producerId: number | string): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(
      `${environment.apiBaseUrl}/admin/producers/${producerId}/credentials`,
      {}
    );
  }

  getDashboardAnalytics(producerId?: string): Observable<ApiResponse<ProducerAnalyticsDashboard>> {
    const params: any = {};
    if (producerId) params.producerId = producerId;
    return this.http.get<ApiResponse<ProducerAnalyticsDashboard>>(`${environment.apiBaseUrl}/producer/analytics/dashboard`, { params });
  }

  /** Producer dashboard: per-content views/uniques + VAST pre/mid/post ad runs + day-wise series. */
  getContentOverviewAnalytics(contentId?: number): Observable<ApiResponse<any>> {
    const params = contentId ? `?contentId=${contentId}` : '';
    return this.http.get<ApiResponse<any>>(`${environment.apiBaseUrl}/producer/analytics/content-overview${params}`);
  }

  getAdRunBreakdown(): Observable<ApiResponse<AdImpressionLog[]>> {
    return this.http.get<ApiResponse<AdImpressionLog[]>>(`${environment.apiBaseUrl}/producer/analytics/ad-breakdown`);
  }

  // 14. Upload KYC document file (Aadhaar Front/Back, PAN, Cancelled Cheque)
  uploadKycFile(file: File, folder = 'producer-kyc'): Observable<ApiResponse<{ url: string; fileUrl: string; fileName: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return this.http.post<ApiResponse<any>>(`${environment.apiBaseUrl}/storage/upload`, formData);
  }

  // 15. Update Producer KYC Documents (Aadhaar Front/Back, PAN, Cancelled Cheque, GST)
  updateProducerKycDocuments(docs: {
    aadharDocUrl?: string;
    aadharBackDocUrl?: string;
    panDocUrl?: string;
    bankDocUrl?: string;
    gstDocUrl?: string;
  }, producerId?: string): Observable<ApiResponse<ProducerOnboardingProfile>> {
    const params: any = {};
    if (producerId) params.producerId = producerId;
    return this.http.post<ApiResponse<ProducerOnboardingProfile>>(`${environment.apiBaseUrl}/producer/kyc/documents`, docs, { params });
  }
}
