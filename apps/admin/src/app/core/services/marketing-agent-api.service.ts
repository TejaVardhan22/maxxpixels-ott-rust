import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from './movie-api.service';

export interface MarketingAgent {
  id?: number | string;
  agentCode: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  aadhaarNumber?: string;
  panNumber?: string;
  aadhaarDocUrl?: string;
  panDocUrl?: string;
  status: string;
  memberCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingMember {
  id: number | string;
  agentId: number | string;
  agentCode?: string;
  userId: number | string;
  phoneNumber?: string;
  fullName?: string;
  email?: string;
  joinedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarketingAgentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/marketing`;

  listAgents(): Observable<ApiResponse<MarketingAgent[]>> {
    return this.http.get<ApiResponse<MarketingAgent[]>>(`${this.base}/agents`);
  }

  createAgent(payload: Partial<MarketingAgent>): Observable<ApiResponse<MarketingAgent>> {
    return this.http.post<ApiResponse<MarketingAgent>>(`${this.base}/agents`, payload);
  }

  listMembers(agentId: number | string): Observable<ApiResponse<MarketingMember[]>> {
    return this.http.get<ApiResponse<MarketingMember[]>>(`${this.base}/${agentId}/members`);
  }

  toggleStatus(agentId: number | string): Observable<ApiResponse<MarketingAgent>> {
    return this.http.post<ApiResponse<MarketingAgent>>(`${this.base}/${agentId}/toggle-status`, {});
  }

  validateCode(code: string): Observable<ApiResponse<MarketingAgent>> {
    return this.http.get<ApiResponse<MarketingAgent>>(
      `${environment.apiBaseUrl}/marketing/validate/${encodeURIComponent(code)}`
    );
  }

  uploadDocument(file: File, folder = 'marketing-kyc'): Observable<ApiResponse<{ url: string; fileUrl: string; fileName: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    return this.http.post<ApiResponse<any>>(`${environment.apiBaseUrl}/storage/upload`, formData);
  }
}
