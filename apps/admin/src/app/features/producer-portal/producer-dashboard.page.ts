import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { Chart, registerables } from 'chart.js';
import {
  ProducerApiService,
  MovieAnalyticsItem,
  ProducerOnboardingProfile,
  ProducerAgreement,
  ProducerAnalyticsDashboard
} from '../../core/services/producer-api.service';
import { NotificationService } from '../../shared/services/notification.service';
import { AuthStore } from '../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';

Chart.register(...registerables);

interface AgreementForm {
  signedAgreementFile: File | null;
  panNumber: string;
  panFile: File | null;
  aadharNumber: string;
  aadharFile: File | null;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  bankFile: File | null;
}

interface UploadedUrls {
  signedAgreementUrl?: string;
  panDocUrl?: string;
  aadharDocUrl?: string;
  bankDocUrl?: string;
}

@Component({
  selector: 'app-producer-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="producer-dashboard-container">
      <!-- 0. ADMIN GOVERNANCE & LIVE STUDIO SYNC BAR (Visible to Platform Admins) -->
      <div class="admin-sync-bar" *ngIf="isAdmin">
        <div class="sync-left">
          <div class="sync-badge">
            <span class="live-dot"></span>
            <mat-icon class="sync-icon">sync_alt</mat-icon>
            <span class="sync-title">ADMIN GOVERNANCE &amp; STUDIO SYNC</span>
          </div>
          <span class="sync-desc">Live synchronization with Platform Catalog, Database &amp; Producer KYC Registry</span>
        </div>

        <div class="sync-controls">
          <div class="studio-picker">
            <mat-form-field appearance="outline" class="studio-select-field">
              <mat-label>Active Studio Inspector</mat-label>
              <mat-select [(ngModel)]="selectedProducerId" (selectionChange)="onStudioChange($event.value)">
                <mat-option value="ALL">
                  <span class="opt-all">🌟 Platform Aggregate Catalog (All Studios)</span>
                </mat-option>
                <mat-option *ngFor="let s of allStudios" [value]="s.id || s.producerUserId">
                  🏢 {{ s.studioName || s.companyName }} ({{ s.contactEmail }})
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="sync-actions">
            <button mat-raised-button color="primary" class="sync-btn" (click)="syncLiveData()" [disabled]="loading">
              <mat-icon [class.spin-anim]="loading">refresh</mat-icon>
              <span>Sync Live Data</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 1. TOP STUDIO BANNER -->
      <div class="studio-header">
        <div class="studio-info">
          <div class="studio-avatar">
            <mat-icon>movie_creation</mat-icon>
          </div>
          <div class="studio-details">
            <div class="studio-title-row">
              <h1 class="studio-name">{{ profile?.studioName || profile?.companyName || 'Maxx Studios Entertainment' }}</h1>
              <span class="meta-tag approved" *ngIf="profile?.onboardingStatus === 'APPROVED' || profile?.status === 'ACTIVE'">
                <mat-icon>verified</mat-icon> VERIFIED Studio Partner
              </span>
              <span class="meta-tag pending" *ngIf="profile?.onboardingStatus === 'PENDING' || profile?.status === 'PENDING'">
                <mat-icon>hourglass_empty</mat-icon> KYC PENDING REVIEW
              </span>
            </div>
            <div class="studio-meta">
              <span class="meta-tag">
                <mat-icon>account_balance</mat-icon> Payout Bank: {{ profile?.bankName || 'Verified Payout Account' }}<span *ngIf="profile?.ifscCode"> (IFSC: {{ profile?.ifscCode }})</span>
              </span>
              <span class="meta-tag">
                <mat-icon>badge</mat-icon> PAN: {{ profile?.panNumber || 'Verified' }} &bull; GST: {{ profile?.gstNumber || 'Active' }}
              </span>
              <span class="meta-tag highlight">
                <mat-icon>pie_chart</mat-icon> {{ profile?.defaultRevenueSharePercentage || 70 }}% Net Studio Payout
              </span>
              <span class="meta-tag sync-tag" *ngIf="lastSyncTime">
                <mat-icon>update</mat-icon> Synced: {{ lastSyncTime | date:'shortTime' }}
              </span>
            </div>
          </div>
        </div>

        <div class="header-actions">
          <a mat-raised-button color="primary" routerLink="/producer/submit" class="action-btn">
            <mat-icon>cloud_upload</mat-icon>
            <span>Submit Content</span>
          </a>
          <a mat-stroked-button color="accent" routerLink="/producer/ad-analytics" class="action-btn-secondary">
            <mat-icon>payments</mat-icon>
            <span>Ad Revenue &amp; Payouts</span>
          </a>
        </div>
      </div>

      <!-- 2. PRODUCER LICENSE AGREEMENT CARD -->
      <mat-card class="agreement-card" *ngIf="agreement">
        <div class="agreement-header">
          <div class="header-left">
            <mat-icon class="agreement-icon">description</mat-icon>
            <div>
              <h3>Producer Distribution &amp; Licensing Master Agreement</h3>
              <p>
                Agreement ID: <strong class="font-mono text-cyan">{{ agreement.agreementId }}</strong> &bull;
                Confirmation Status:
                <span class="status-badge confirmed">
                  {{ agreement.agreementStatus || 'CONFIRMED & EXECUTED' }}
                </span>
              </p>
            </div>
          </div>
          <div class="agreement-actions">
            <button mat-raised-button color="primary" class="btn-agree" (click)="downloadAgreement()">
              <mat-icon>download</mat-icon> Download Agreement (.TXT)
            </button>
            <button mat-stroked-button color="accent" class="btn-agree" (click)="uploadSignedAgreement()">
              <mat-icon>upload_file</mat-icon> Upload Signed Copy
            </button>
          </div>
        </div>

        <div class="agreement-details">
          <div class="detail-col">
            <span class="detail-label">Studio Legal Entity</span>
            <span class="detail-val">{{ agreement.studioName }}</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">Registration / CIN</span>
            <span class="detail-val font-mono">{{ agreement.studioRegistrationNumber || 'CIN-U92100TG2024PTC188231' }}</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">PAN / Tax ID</span>
            <span class="detail-val font-mono">{{ agreement.panNumber || 'ABCDE1234F' }}</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">Bank Payout Account</span>
            <span class="detail-val">{{ agreement.bankName }} (Acc: {{ agreement.bankAccountNumber || '50200012345678' }})</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">Net Royalty Split</span>
            <span class="detail-val text-green font-bold">{{ agreement.revenueSharePercentage || profile?.defaultRevenueSharePercentage || 70 }}% Net Payout</span>
          </div>
        </div>

        <div class="signed-url-row" *ngIf="agreement.signedAgreementUrl">
          <mat-icon color="primary">verified</mat-icon>
          <span>Executed Agreement Document: <a [href]="agreement.signedAgreementUrl" target="_blank" class="url-link">{{ agreement.signedAgreementUrl }}</a></span>
        </div>
      </mat-card>

      <!-- 2.2 PRODUCER LOGIN CREDENTIALS -->
      <mat-card *ngIf="agreement && agreement.agreementStatus === 'CONFIRMED'" class="credentials-card">
        <div class="agreement-header">
          <div class="header-left">
            <mat-icon class="agreement-icon" style="color: #00e676;">vpn_key</mat-icon>
            <div>
              <h3>Producer Studio Login Credentials</h3>
              <p>Share these credentials with the producer for portal access to ads & views analytics</p>
            </div>
          </div>
          <div class="agreement-actions">
            <button *ngIf="showCredentials" mat-raised-button color="warn" class="btn-agree" (click)="hideCredentials()">
              <mat-icon>visibility_off</mat-icon> Hide Credentials
            </button>
            <button *ngIf="!showCredentials" mat-raised-button color="primary" class="btn-agree" (click)="generateCredentials()">
              <mat-icon>vpn_key</mat-icon> Generate Login Credentials
            </button>
            <button *ngIf="showCredentials" mat-stroked-button color="accent" class="btn-agree" (click)="copyCredentials()">
              <mat-icon>content_copy</mat-icon> Copy Credentials
            </button>
          </div>
        </div>

        <div class="credentials-details" *ngIf="showCredentials && producerCredentials">
          <div class="detail-col">
            <span class="detail-label">Studio / Producer</span>
            <span class="detail-val">{{ producerCredentials.studioName || agreement.studioName }}</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">Login Email</span>
            <span class="detail-val font-mono">{{ producerCredentials.email }}</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">Temporary Password</span>
            <span class="detail-val font-mono text-red">{{ producerCredentials.password }}</span>
          </div>
          <div class="detail-col">
            <span class="detail-label">Login URL</span>
            <span class="detail-val">{{ producerCredentials.loginUrl || '/producer/login' }}</span>
          </div>
        </div>

        <div *ngIf="!showCredentials && producerCredentials" class="credentials-hint">
          <mat-icon>info</mat-icon>
          <span>Credentials already generated. Click "Show Credentials" to view password again.</span>
        </div>
        <div *ngIf="!producerCredentials && !showCredentials" class="credentials-hint">
          <mat-icon>security</mat-icon>
          <span>Generate login credentials so the producer can access the studio portal and view ads/views analytics.</span>
        </div>
      </mat-card>

      <!-- 2.1 AGREEMENT & KYC DOCUMENT UPLOAD FORM -->
      <div *ngIf="showAgreementForm" class="agreement-form-modal">
        <div class="agreement-form-backdrop" (click)="closeAgreementForm()"></div>
        <div class="agreement-form-panel" (click)="$event.stopPropagation()">
          <div class="agreement-form-header">
            <mat-icon>description</mat-icon>
            <h3>Upload Signed Agreement & KYC Documents</h3>
            <button mat-icon-button (click)="closeAgreementForm()"><mat-icon>close</mat-icon></button>
          </div>

          <form (ngSubmit)="submitAgreementAndKyc()" class="agreement-form-body">
            <!-- Signed Agreement PDF -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Signed Producer Agreement PDF *</mat-label>
              <input type="file" accept="application/pdf" (change)="onAgreementFileSelected($event)" required>
              <mat-hint>Upload your filled & signed agreement document (PDF)</mat-hint>
              <span *ngIf="uploadedUrls.signedAgreementUrl" class="url-chip">Uploaded: {{ uploadedUrls.signedAgreementUrl | slice:0:60 }}...</span>
            </mat-form-field>

            <!-- PAN -->
            <div class="form-row-2">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>PAN Number *</mat-label>
                <input matInput placeholder="ABCDE1234F" [(ngModel)]="agreementForm.panNumber" required>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>PAN Card PDF *</mat-label>
                <input type="file" accept="application/pdf" (change)="onPanFileSelected($event)" required>
                <span *ngIf="uploadedUrls.panDocUrl" class="url-chip">Uploaded</span>
              </mat-form-field>
            </div>

            <!-- Aadhaar -->
            <div class="form-row-2">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Aadhaar Number *</mat-label>
                <input matInput placeholder="1234 5678 9012" [(ngModel)]="agreementForm.aadharNumber" required>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Aadhaar Card PDF *</mat-label>
                <input type="file" accept="application/pdf" (change)="onAadharFileSelected($event)" required>
                <span *ngIf="uploadedUrls.aadharDocUrl" class="url-chip">Uploaded</span>
              </mat-form-field>
            </div>

            <!-- Bank Details -->
            <div class="form-row-3">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Bank Name *</mat-label>
                <input matInput placeholder="HDFC Bank" [(ngModel)]="agreementForm.bankName" required>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Account Number *</mat-label>
                <input matInput placeholder="50200012345678" [(ngModel)]="agreementForm.bankAccountNumber" required>
              </mat-form-field>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>IFSC Code *</mat-label>
                <input matInput placeholder="HDFC0000240" [(ngModel)]="agreementForm.ifscCode" required>
              </mat-form-field>
            </div>

            <!-- Bank Proof -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Cancelled Cheque / Passbook PDF *</mat-label>
              <input type="file" accept="application/pdf" (change)="onBankFileSelected($event)" required>
              <mat-hint>Upload cancelled cheque or bank passbook showing account number & IFSC</mat-hint>
              <span *ngIf="uploadedUrls.bankDocUrl" class="url-chip">Uploaded</span>
            </mat-form-field>

            <div class="agreement-form-actions">
              <button type="button" mat-stroked-button color="basic" (click)="closeAgreementForm()">Cancel</button>
              <button type="submit" mat-raised-button color="primary" class="submit-agreement-btn" [disabled]="uploadingAgreement">
                <mat-icon *ngIf="uploadingAgreement" class="spin">sync</mat-icon>
                <mat-icon *ngIf="!uploadingAgreement">save</mat-icon>
                {{ uploadingAgreement ? 'Confirming...' : 'Confirm Agreement & KYC' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 2.5 PRODUCER KYC & STATUTORY VERIFICATION DOCUMENTS -->
      <mat-card class="kyc-hub-card">
        <div class="kyc-hub-header">
          <div class="header-left">
            <div class="icon-box-kyc">
              <mat-icon>verified_user</mat-icon>
            </div>
            <div>
              <h3>Producer KYC &amp; Settlement Verification Documents</h3>
              <p>Upload and manage mandatory identity documents (Aadhaar Front &amp; Back, PAN Card, Cancelled Cheque)</p>
            </div>
          </div>
          <div class="kyc-overall-status">
            <span class="status-pill" [ngClass]="getKycStatusClass()">
              <mat-icon>{{ getKycStatusIcon() }}</mat-icon>
              {{ getKycStatusText() }}
            </span>
          </div>
        </div>

        <div class="kyc-docs-grid">
          <!-- 1. PAN Card -->
          <div class="doc-item-card" [class.verified]="profile?.panStatus === 'VERIFIED' || profile?.panStatus === 'APPROVED'">
            <div class="doc-top">
              <div class="doc-icon-title">
                <mat-icon>badge</mat-icon>
                <span class="title">PAN Card</span>
              </div>
              <span class="doc-badge" [class.badge-ok]="profile?.panStatus === 'VERIFIED' || profile?.panStatus === 'APPROVED'">
                {{ profile?.panStatus || (profile?.panDocUrl ? 'PENDING' : 'NOT UPLOADED') }}
              </span>
            </div>
            <div class="doc-meta font-mono">{{ profile?.panNumber || 'Tax Identification' }}</div>
            <div class="doc-footer">
              <input type="file" #panFileInput style="display:none" accept="image/*,application/pdf" (change)="onUploadKycFile($event, 'panDocUrl')">
              <button mat-stroked-button class="upload-btn" (click)="panFileInput.click()" [disabled]="uploadingKycField === 'panDocUrl'">
                <mat-icon *ngIf="uploadingKycField !== 'panDocUrl'">cloud_upload</mat-icon>
                <mat-icon *ngIf="uploadingKycField === 'panDocUrl'" class="spin-anim">sync</mat-icon>
                <span>{{ profile?.panDocUrl ? 'Replace PAN' : 'Upload PAN' }}</span>
              </button>
              <a *ngIf="profile?.panDocUrl" [href]="profile?.panDocUrl" target="_blank" class="view-link">
                <mat-icon>visibility</mat-icon> View Document
              </a>
            </div>
          </div>

          <!-- 2. Aadhaar Front Side -->
          <div class="doc-item-card" [class.verified]="profile?.aadharStatus === 'VERIFIED' || profile?.aadharStatus === 'APPROVED'">
            <div class="doc-top">
              <div class="doc-icon-title">
                <mat-icon>credit_card</mat-icon>
                <span class="title">Aadhaar (Front Side)</span>
              </div>
              <span class="doc-badge" [class.badge-ok]="profile?.aadharStatus === 'VERIFIED' || profile?.aadharStatus === 'APPROVED'">
                {{ profile?.aadharStatus || (profile?.aadharDocUrl ? 'PENDING' : 'NOT UPLOADED') }}
              </span>
            </div>
            <div class="doc-meta font-mono">{{ profile?.aadharNumber || '12-Digit UID Front' }}</div>
            <div class="doc-footer">
              <input type="file" #aadharFrontInput style="display:none" accept="image/*,application/pdf" (change)="onUploadKycFile($event, 'aadharDocUrl')">
              <button mat-stroked-button class="upload-btn" (click)="aadharFrontInput.click()" [disabled]="uploadingKycField === 'aadharDocUrl'">
                <mat-icon *ngIf="uploadingKycField !== 'aadharDocUrl'">cloud_upload</mat-icon>
                <mat-icon *ngIf="uploadingKycField === 'aadharDocUrl'" class="spin-anim">sync</mat-icon>
                <span>{{ profile?.aadharDocUrl ? 'Replace Front' : 'Upload Front' }}</span>
              </button>
              <a *ngIf="profile?.aadharDocUrl" [href]="profile?.aadharDocUrl" target="_blank" class="view-link">
                <mat-icon>visibility</mat-icon> View Front
              </a>
            </div>
          </div>

          <!-- 3. Aadhaar Back Side -->
          <div class="doc-item-card" [class.verified]="profile?.aadharStatus === 'VERIFIED' || profile?.aadharStatus === 'APPROVED'">
            <div class="doc-top">
              <div class="doc-icon-title">
                <mat-icon>flip_to_back</mat-icon>
                <span class="title">Aadhaar (Back Side)</span>
              </div>
              <span class="doc-badge" [class.badge-ok]="profile?.aadharStatus === 'VERIFIED' || profile?.aadharStatus === 'APPROVED'">
                {{ profile?.aadharBackDocUrl ? (profile?.aadharStatus || 'PENDING') : 'NOT UPLOADED' }}
              </span>
            </div>
            <div class="doc-meta">Address &amp; QR Barcode Side</div>
            <div class="doc-footer">
              <input type="file" #aadharBackInput style="display:none" accept="image/*,application/pdf" (change)="onUploadKycFile($event, 'aadharBackDocUrl')">
              <button mat-stroked-button class="upload-btn" (click)="aadharBackInput.click()" [disabled]="uploadingKycField === 'aadharBackDocUrl'">
                <mat-icon *ngIf="uploadingKycField !== 'aadharBackDocUrl'">cloud_upload</mat-icon>
                <mat-icon *ngIf="uploadingKycField === 'aadharBackDocUrl'" class="spin-anim">sync</mat-icon>
                <span>{{ profile?.aadharBackDocUrl ? 'Replace Back' : 'Upload Back' }}</span>
              </button>
              <a *ngIf="profile?.aadharBackDocUrl" [href]="profile?.aadharBackDocUrl" target="_blank" class="view-link">
                <mat-icon>visibility</mat-icon> View Back
              </a>
            </div>
          </div>

          <!-- 4. Cancelled Cheque / Bank Passbook -->
          <div class="doc-item-card" [class.verified]="profile?.bankStatus === 'VERIFIED' || profile?.bankStatus === 'APPROVED'">
            <div class="doc-top">
              <div class="doc-icon-title">
                <mat-icon>receipt_long</mat-icon>
                <span class="title">Cancelled Cheque</span>
              </div>
              <span class="doc-badge" [class.badge-ok]="profile?.bankStatus === 'VERIFIED' || profile?.bankStatus === 'APPROVED'">
                {{ profile?.bankStatus || (profile?.bankDocUrl ? 'PENDING' : 'NOT UPLOADED') }}
              </span>
            </div>
            <div class="doc-meta">{{ profile?.bankName || 'Settlement Bank' }} &bull; Acc: {{ profile?.bankAccountNumber || 'N/A' }}</div>
            <div class="doc-footer">
              <input type="file" #chequeFileInput style="display:none" accept="image/*,application/pdf" (change)="onUploadKycFile($event, 'bankDocUrl')">
              <button mat-stroked-button class="upload-btn" (click)="chequeFileInput.click()" [disabled]="uploadingKycField === 'bankDocUrl'">
                <mat-icon *ngIf="uploadingKycField !== 'bankDocUrl'">cloud_upload</mat-icon>
                <mat-icon *ngIf="uploadingKycField === 'bankDocUrl'" class="spin-anim">sync</mat-icon>
                <span>{{ profile?.bankDocUrl ? 'Replace Cheque' : 'Upload Cheque' }}</span>
              </button>
              <a *ngIf="profile?.bankDocUrl" [href]="profile?.bankDocUrl" target="_blank" class="view-link">
                <mat-icon>visibility</mat-icon> View Cheque
              </a>
            </div>
          </div>
        </div>
      </mat-card>

      <!-- 3. KPI STAT CARDS GRID -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon-box bg-purple">
            <mat-icon>movie</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Active Studio Catalog</span>
            <h3 class="kpi-value">{{ moviesList.length }} Titles</h3>
            <span class="kpi-sub positive"><mat-icon>trending_up</mat-icon> Live Streaming Assets</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box bg-blue">
            <mat-icon>visibility</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Video Streams</span>
            <h3 class="kpi-value">{{ totalViews | number }}</h3>
            <span class="kpi-sub positive"><mat-icon>trending_up</mat-icon> Real-time Playback</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box bg-gold">
            <mat-icon>monetization_on</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Gross Studio Earnings</span>
            <h3 class="kpi-value">₹{{ totalEarnings | number:'1.2-2' }}</h3>
            <span class="kpi-sub text-gold"><mat-icon>account_balance_wallet</mat-icon> {{ profile?.defaultRevenueSharePercentage || 70 }}% Net Studio Payout</span>
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-icon-box bg-green">
            <mat-icon>timer</mat-icon>
          </div>
          <div class="kpi-content">
            <span class="kpi-label">Total Watch Hours</span>
            <h3 class="kpi-value">{{ totalWatchHours | number:'1.0-0' }} Hours</h3>
            <span class="kpi-sub positive"><mat-icon>speed</mat-icon> High Engagement</span>
          </div>
        </div>
      </div>

      <!-- 4. ANALYTICS CHARTS SECTION -->
      <div class="charts-row">
        <!-- Chart 1: Monthly Viewership & Stream Trajectory -->
        <mat-card class="chart-card flex-2">
          <mat-card-header class="chart-header">
            <div class="header-left">
              <mat-icon class="chart-header-icon">show_chart</mat-icon>
              <div>
                <mat-card-title>Monthly Viewership &amp; Streaming Trend</mat-card-title>
                <mat-card-subtitle>Live streams &amp; cumulative watch hours across 12 months</mat-card-subtitle>
              </div>
            </div>
            <div class="chart-badge bg-blue-subtle">+32.4% YoY</div>
          </mat-card-header>
          <mat-card-content class="chart-body">
            <div class="chart-wrapper">
              <canvas #viewsChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Chart 2: Revenue Split Breakdown -->
        <mat-card class="chart-card flex-1">
          <mat-card-header class="chart-header">
            <div class="header-left">
              <mat-icon class="chart-header-icon text-gold">donut_small</mat-icon>
              <div>
                <mat-card-title>Revenue Distribution &amp; Split</mat-card-title>
                <mat-card-subtitle>Producer Net Share ({{ profile?.defaultRevenueSharePercentage || 70 }}%) vs Platform Distribution</mat-card-subtitle>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-body">
            <div class="chart-wrapper doughnut-wrapper">
              <canvas #revenueChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="charts-row">
        <!-- Chart 3: Top Media Catalog Performance -->
        <mat-card class="chart-card flex-1">
          <mat-card-header class="chart-header">
            <div class="header-left">
              <mat-icon class="chart-header-icon text-purple">bar_chart</mat-icon>
              <div>
                <mat-card-title>Top Media Title Performance</mat-card-title>
                <mat-card-subtitle>Streams and audience distribution by title</mat-card-subtitle>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-body">
            <div class="chart-wrapper">
              <canvas #topMediaChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Chart 4: Playback Platforms & Devices -->
        <mat-card class="chart-card flex-1">
          <mat-card-header class="chart-header">
            <div class="header-left">
              <mat-icon class="chart-header-icon text-green">devices</mat-icon>
              <div>
                <mat-card-title>Playback Platforms &amp; Devices</mat-card-title>
                <mat-card-subtitle>Distribution across Smart TV, Mobile, and Web</mat-card-subtitle>
              </div>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-body">
            <div class="chart-wrapper doughnut-wrapper">
              <canvas #deviceChart></canvas>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- 5. CONTENT CATALOG & PERFORMANCE TABLE -->
      <mat-card class="content-table-card">
        <mat-card-header class="card-header-bar">
          <div>
            <mat-card-title>Studio Media Catalog &amp; Performance</mat-card-title>
            <mat-card-subtitle>Live tracking of streaming views, ad impressions, watch time, and earnings</mat-card-subtitle>
          </div>
          <div class="table-actions">
            <a mat-stroked-button color="primary" routerLink="/producer/submit">
              <mat-icon>add</mat-icon> Submit New Title
            </a>
          </div>
        </mat-card-header>

        <mat-card-content class="p-0">
          <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

          <div class="table-responsive">
            <table mat-table [dataSource]="moviesList" class="custom-table">
              <!-- Title Column -->
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Media Title</th>
                <td mat-cell *matCellDef="let item">
                  <div class="title-cell">
                    <mat-icon class="title-icon">{{ item.contentType === 'SERIES' ? 'tv' : 'movie' }}</mat-icon>
                    <div>
                      <span class="title-text">{{ item.title }}</span>
                      <span class="title-type">{{ item.contentType || 'MOVIE' }} &bull; {{ item.runTimeMinutes }} mins</span>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Studio Name Column -->
              <ng-container matColumnDef="studio">
                <th mat-header-cell *matHeaderCellDef>Studio</th>
                <td mat-cell *matCellDef="let item">
                  <span class="studio-tag">{{ item.studioName || profile?.studioName || 'Producer Studio' }}</span>
                </td>
              </ng-container>

              <!-- Views Column -->
              <ng-container matColumnDef="totalViews">
                <th mat-header-cell *matHeaderCellDef>Total Streams</th>
                <td mat-cell *matCellDef="let item">
                  <span class="metric-val">{{ item.totalViews | number }}</span>
                </td>
              </ng-container>

              <!-- Ads Played Column -->
              <ng-container matColumnDef="adsRunned">
                <th mat-header-cell *matHeaderCellDef>Ad Impressions</th>
                <td mat-cell *matCellDef="let item">
                  <span class="metric-val text-blue">{{ item.adsRunned | number }}</span>
                </td>
              </ng-container>

              <!-- Watch Hours Column -->
              <ng-container matColumnDef="totalWatchHours">
                <th mat-header-cell *matHeaderCellDef>Watch Time</th>
                <td mat-cell *matCellDef="let item">
                  <span class="metric-val">{{ item.totalWatchHours | number:'1.0-0' }} hrs</span>
                </td>
              </ng-container>

              <!-- Producer Earnings Column -->
              <ng-container matColumnDef="producerEarnings">
                <th mat-header-cell *matHeaderCellDef>Producer Net Payout</th>
                <td mat-cell *matCellDef="let item">
                  <span class="earnings-badge">₹{{ item.producerEarnings | number:'1.2-2' }}</span>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Catalog Status</th>
                <td mat-cell *matCellDef="let item">
                  <app-status-badge [status]="item.status || 'PUBLISHED'"></app-status-badge>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell empty-table-cell" [attr.colspan]="displayedColumns.length">
                  <div class="empty-state">
                    <mat-icon>movie_filter</mat-icon>
                    <p>No media titles currently in this studio catalog.</p>
                    <a mat-stroked-button color="primary" routerLink="/producer/submit">Submit New Title</a>
                  </div>
                </td>
              </tr>
            </table>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .producer-dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      color: #ffffff;
      padding-bottom: 40px;
    }

    /* 0. Admin Sync Bar */
    .admin-sync-bar {
      background: linear-gradient(135deg, rgba(229, 9, 20, 0.12) 0%, rgba(30, 27, 75, 0.6) 100%);
      border: 1px solid rgba(229, 9, 20, 0.35);
      border-radius: 16px;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      flex-wrap: wrap;
      backdrop-filter: blur(12px);

      .sync-left {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .sync-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #ff4d5a;

          .live-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff4d5a;
            box-shadow: 0 0 10px #ff4d5a;
            animation: pulse-dot 1.5s infinite;
          }

          .sync-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }
        }

        .sync-desc {
          font-size: 12px;
          color: #a0a0b5;
        }
      }

      .sync-controls {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;

        .studio-picker {
          min-width: 280px;

          ::ng-deep .mat-mdc-form-field-subscript-wrapper {
            display: none;
          }
          ::ng-deep .mat-mdc-text-field-wrapper {
            background: rgba(18, 18, 28, 0.85);
            border-radius: 10px;
          }
        }

        .sync-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .sync-btn {
            background: #e50914 !important;
            color: #ffffff !important;
            font-weight: 700;
          }

          .admin-link-btn {
            color: #d1d5db;
            border-color: rgba(255, 255, 255, 0.15);
            font-size: 12px;
            &:hover {
              background: rgba(255, 255, 255, 0.08);
              color: #ffffff;
            }
          }
        }
      }
    }

    @keyframes pulse-dot {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    .spin-anim {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }

    /* 1. Studio Header */
    .studio-header {
      background: linear-gradient(135deg, #181824 0%, #12121c 100%);
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      flex-wrap: wrap;

      .studio-info {
        display: flex;
        align-items: center;
        gap: 20px;

        .studio-avatar {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: linear-gradient(135deg, #e50914 0%, #b80710 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 24px rgba(229, 9, 20, 0.35);

          mat-icon {
            font-size: 32px;
            width: 32px;
            height: 32px;
            color: #ffffff;
          }
        }

        .studio-details {
          .studio-title-row {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 8px;
          }

          .studio-name {
            font-size: 24px;
            font-weight: 800;
            margin: 0;
            color: #ffffff;
            letter-spacing: -0.5px;
          }

          .studio-meta {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;

            .meta-tag {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 4px 10px;
              border-radius: 20px;
              background: #202030;
              color: #a0a0b5;
              font-size: 12px;
              font-weight: 500;

              mat-icon {
                font-size: 14px;
                width: 14px;
                height: 14px;
              }

              &.approved {
                background: rgba(46, 204, 113, 0.15);
                color: #2ecc71;
                font-weight: 700;
              }

              &.pending {
                background: rgba(241, 196, 15, 0.15);
                color: #f1c40f;
                font-weight: 700;
              }

              &.highlight {
                background: rgba(0, 210, 255, 0.12);
                color: #00d2ff;
                font-weight: 700;
                border: 1px solid rgba(0, 210, 255, 0.25);
              }

              &.sync-tag {
                background: rgba(155, 89, 182, 0.15);
                color: #d8b4fe;
              }
            }
          }
        }
      }

      .header-actions {
        display: flex;
        gap: 12px;
        align-items: center;

        .action-btn {
          height: 44px;
          padding: 0 20px;
          border-radius: 10px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .action-btn-secondary {
          height: 44px;
          padding: 0 18px;
          border-radius: 10px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }

    /* 2. Agreement Card */
    .agreement-card {
      background: #181824 !important;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      color: #ffffff;

      .agreement-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 16px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;

          .agreement-icon {
            font-size: 36px;
            width: 36px;
            height: 36px;
            color: #00d2ff;
          }

          h3 {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: #ffffff;
          }

          p {
            font-size: 13px;
            color: #a0a0b5;
            margin: 0;
          }
        }

        .agreement-actions {
          display: flex;
          gap: 10px;
          .btn-agree {
            font-weight: 600;
            font-size: 12px;
          }
        }
      }

      .agreement-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        background: #12121c;
        padding: 16px 20px;
        border-radius: 12px;
        border: 1px solid #202030;

        .detail-col {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .detail-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #8e8ea0;
            font-weight: 600;
          }

          .detail-val {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
          }
        }
      }

      .signed-url-row {
        margin-top: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #a0a0b5;

        .url-link {
          color: #00d2ff;
          text-decoration: none;
          &:hover { text-decoration: underline; }
        }
      }

      /* Agreement & KYC Upload Form Modal */
      .agreement-form-modal {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;

        .agreement-form-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }

        .agreement-form-panel {
          position: relative;
          background: #161622;
          border: 1px solid #28283a;
          border-radius: 16px;
          width: 90%;
          max-width: 700px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7);

          .agreement-form-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid #28283a;

            mat-icon {
              color: #00d2ff;
              font-size: 28px;
              width: 28px;
              height: 28px;
            }

            h3 {
              margin: 0;
              font-size: 18px;
              font-weight: 700;
              color: #ffffff;
            }

            button {
              color: #a0a0b5;
              &:hover { color: #ffffff; }
            }
          }

          .agreement-form-body {
            padding: 24px;
            display: flex;
            flex-direction: column;
            gap: 16px;

            .full-width { width: 100%; }

            .form-row-2,
            .form-row-3 {
              display: grid;
              gap: 12px;
            }

            .form-row-2 { grid-template-columns: 1fr 1fr; }
            .form-row-3 { grid-template-columns: 1fr 1fr 1fr; }

            @media (max-width: 640px) {
              .form-row-2, .form-row-3 { grid-template-columns: 1fr; }
            }

            .url-chip {
              display: inline-block;
              margin-top: 6px;
              font-size: 10px;
              color: #00e676;
              background: rgba(0, 230, 118, 0.1);
              padding: 2px 8px;
              border-radius: 4px;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .agreement-form-actions {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              margin-top: 8px;

              .submit-agreement-btn {
                font-weight: 700;
                height: 44px;
                padding: 0 24px;
                font-size: 14px;
                background: linear-gradient(135deg, #e50914 0%, #f43f5e 100%) !important;
                color: #ffffff !important;
                box-shadow: 0 4px 16px rgba(229, 9, 20, 0.35);
                &:disabled { opacity: 0.6; cursor: not-allowed; }
              }

              .spin {
                animation: spin 1s linear infinite;
              }

              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            }
          }
        }
      }
    }

    /* 2.2 Producer Login Credentials Card */
    .credentials-card {
      background: #181824 !important;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      color: #ffffff;
      border-left: 4px solid #00e676;

      .agreement-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 16px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;

          .agreement-icon {
            font-size: 36px;
            width: 36px;
            height: 36px;
            color: #00e676;
          }

          h3 {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: #ffffff;
          }

          p {
            font-size: 13px;
            color: #a0a0b5;
            margin: 0;
          }
        }

        .agreement-actions {
          display: flex;
          gap: 10px;
          .btn-agree {
            font-weight: 600;
            font-size: 12px;
          }
        }
      }

      .credentials-details {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        background: #12121c;
        padding: 16px 20px;
        border-radius: 12px;
        border: 1px solid #202030;
        margin-top: 10px;

        .detail-col {
          display: flex;
          flex-direction: column;
          gap: 4px;

          .detail-label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #8e8ea0;
            font-weight: 600;
          }

          .detail-val {
            font-size: 14px;
            font-weight: 600;
            color: #ffffff;
            word-break: break-all;
          }

          .detail-val.text-red {
            color: #ff6b6b;
          }
        }
      }

      .credentials-hint {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        padding: 12px 16px;
        background: #12121c;
        border: 1px solid #28283a;
        border-radius: 8px;
        font-size: 12px;
        color: #a0a0b5;

        mat-icon {
          font-size: 16px;
          width: 16px;
          height: 16px;
          color: #00d2ff;
        }
      }
    }

    /* 2.5 KYC Hub Card */
    .kyc-hub-card {
      background: #181824 !important;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      color: #ffffff;

      .kyc-hub-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 16px;

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;

          .icon-box-kyc {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: rgba(0, 210, 255, 0.12);
            color: #00d2ff;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 26px; width: 26px; height: 26px; }
          }

          h3 {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 4px 0;
            color: #ffffff;
          }

          p {
            font-size: 13px;
            color: #a0a0b5;
            margin: 0;
          }
        }

        .kyc-overall-status {
          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 14px;
            border-radius: 20px;

            &.ok {
              background: rgba(0, 230, 118, 0.15);
              color: #00e676;
              border: 1px solid rgba(0, 230, 118, 0.3);
            }
            &.pending {
              background: rgba(255, 171, 0, 0.15);
              color: #ffab00;
              border: 1px solid rgba(255, 171, 0, 0.3);
            }
            &.rejected {
              background: rgba(255, 23, 68, 0.15);
              color: #ff1744;
              border: 1px solid rgba(255, 23, 68, 0.3);
            }
          }
        }
      }

      .kyc-docs-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;

        @media (max-width: 1100px) {
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 650px) {
          grid-template-columns: 1fr;
        }

        .doc-item-card {
          background: #10101a;
          border: 1px solid #28283c;
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: all 0.2s ease;

          &.verified {
            border-color: rgba(0, 230, 118, 0.3);
          }

          .doc-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;

            .doc-icon-title {
              display: flex;
              align-items: center;
              gap: 8px;
              mat-icon { font-size: 20px; width: 20px; height: 20px; color: #00d2ff; }
              .title { font-size: 13px; font-weight: 700; color: #ffffff; }
            }

            .doc-badge {
              font-size: 10px;
              font-weight: 800;
              padding: 2px 8px;
              border-radius: 4px;
              background: rgba(255, 171, 0, 0.15);
              color: #ffab00;

              &.badge-ok {
                background: rgba(0, 230, 118, 0.15);
                color: #00e676;
              }
            }
          }

          .doc-meta {
            font-size: 11px;
            color: #8e8ea0;
            min-height: 20px;
          }

          .doc-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-top: auto;
            padding-top: 8px;
            border-top: 1px dashed rgba(255, 255, 255, 0.08);

            .upload-btn {
              height: 34px;
              font-size: 11px;
              font-weight: 600;
              border-radius: 8px;
              color: #00d2ff;
              border-color: rgba(0, 210, 255, 0.3);
              mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
            }

            .view-link {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              font-size: 11px;
              color: #00e676;
              text-decoration: none;
              font-weight: 600;
              mat-icon { font-size: 14px; width: 14px; height: 14px; }
              &:hover { text-decoration: underline; }
            }
          }
        }
      }
    }

    /* 3. KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;

      .kpi-card {
        background: #181824;
        border: 1px solid #28283c;
        border-radius: 16px;
        padding: 22px 24px;
        display: flex;
        align-items: center;
        gap: 18px;
        transition: transform 0.2s, box-shadow 0.2s;

        &:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
          border-color: #3a3a52;
        }

        .kpi-icon-box {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;

          mat-icon {
            font-size: 28px;
            width: 28px;
            height: 28px;
            color: #ffffff;
          }

          &.bg-purple { background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); }
          &.bg-blue   { background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%); }
          &.bg-gold   { background: linear-gradient(135deg, #f1c40f 0%, #f39c12 100%); }
          &.bg-green  { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); }
        }

        .kpi-content {
          .kpi-label {
            font-size: 12px;
            color: #8e8ea0;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: block;
            margin-bottom: 4px;
          }

          .kpi-value {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 4px 0;
            color: #ffffff;
          }

          .kpi-sub {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            font-weight: 600;

            mat-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }

            &.positive { color: #2ecc71; }
            &.text-gold { color: #f1c40f; }
          }
        }
      }
    }

    /* 4. Charts Row */
    .charts-row {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;

      .chart-card {
        background: #181824 !important;
        border: 1px solid #28283c;
        border-radius: 16px;
        color: #ffffff;
        min-width: 300px;

        &.flex-1 { flex: 1; }
        &.flex-2 { flex: 2; }

        .chart-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid #202030;

          .header-left {
            display: flex;
            align-items: center;
            gap: 12px;

            .chart-header-icon {
              font-size: 24px;
              width: 24px;
              height: 24px;
              color: #00d2ff;
            }

            mat-card-title {
              font-size: 15px;
              font-weight: 700;
              margin: 0;
              color: #ffffff;
            }

            mat-card-subtitle {
              font-size: 12px;
              color: #8e8ea0;
              margin: 2px 0 0 0;
            }
          }

          .chart-badge {
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            &.bg-blue-subtle {
              background: rgba(0, 210, 255, 0.15);
              color: #00d2ff;
            }
          }
        }

        .chart-body {
          padding: 20px 24px;

          .chart-wrapper {
            position: relative;
            height: 260px;
            width: 100%;

            &.doughnut-wrapper {
              height: 240px;
            }
          }
        }
      }
    }

    /* 5. Content Catalog Table */
    .content-table-card {
      background: #181824 !important;
      border: 1px solid #28283c;
      border-radius: 16px;
      color: #ffffff;
      overflow: hidden;

      .card-header-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        border-bottom: 1px solid #202030;

        mat-card-title {
          font-size: 16px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
        }

        mat-card-subtitle {
          font-size: 12px;
          color: #8e8ea0;
          margin: 2px 0 0 0;
        }
      }

      .custom-table {
        background: transparent;
        width: 100%;

        th {
          background: #14141e;
          color: #8e8ea0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          padding: 14px 20px;
          border-bottom: 1px solid #28283c;
        }

        td {
          padding: 14px 20px;
          color: #ffffff;
          border-bottom: 1px solid #202030;
          font-size: 13px;
        }

        tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }

        .title-cell {
          display: flex;
          align-items: center;
          gap: 12px;

          .title-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
            color: #e50914;
          }

          .title-text {
            font-weight: 700;
            color: #ffffff;
            display: block;
          }

          .title-type {
            font-size: 11px;
            color: #8e8ea0;
          }
        }

        .studio-tag {
          font-size: 12px;
          font-weight: 600;
          color: #a0a0b5;
          background: rgba(255, 255, 255, 0.05);
          padding: 3px 8px;
          border-radius: 6px;
        }

        .metric-val {
          font-weight: 700;
          font-family: ui-monospace, monospace;
          color: #ffffff;

          &.text-blue { color: #00d2ff; }
        }

        .earnings-badge {
          font-size: 13px;
          font-weight: 800;
          color: #2ecc71;
          background: rgba(46, 204, 113, 0.12);
          padding: 4px 10px;
          border-radius: 6px;
          font-family: ui-monospace, monospace;
        }

        .empty-table-cell {
          padding: 40px;
          text-align: center;

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;

            mat-icon {
              font-size: 40px;
              width: 40px;
              height: 40px;
              color: #55556a;
            }

            p {
              color: #8e8ea0;
              margin: 0;
            }
          }
        }
      }
    }

    .font-mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .text-cyan { color: #00d2ff; }
    .text-green { color: #2ecc71; }
    .text-purple { color: #9b59b6; }
    .text-gold { color: #f1c40f; }
    .status-badge.confirmed {
      background: rgba(46, 204, 113, 0.15);
      color: #2ecc71;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 11px;
    }
  `]
})
export class ProducerDashboardPage implements OnInit, AfterViewInit, OnDestroy {
  private readonly producerApiService = inject(ProducerApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);

  @ViewChild('viewsChart') viewsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueChart') revenueChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topMediaChart') topMediaChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('deviceChart') deviceChartRef!: ElementRef<HTMLCanvasElement>;

  private viewsChartInstance?: Chart;
  private revenueChartInstance?: Chart;
  private topMediaChartInstance?: Chart;
  private deviceChartInstance?: Chart;

  loading = false;
  selectedProducerId = '';
  allStudios: ProducerOnboardingProfile[] = [];
  lastSyncTime: Date = new Date();

  profile: ProducerOnboardingProfile | null = null;
  agreement: ProducerAgreement | null = null;
  producerCredentials: { studioName?: string; email?: string; password?: string; loginUrl?: string } | null = null;
  showCredentials = false;
  generatingCredentials = false;
  moviesList: MovieAnalyticsItem[] = [];

  // Agreement + KYC upload form state
  showAgreementForm = false;
  uploadingAgreement = false;

  agreementForm: AgreementForm = {
    signedAgreementFile: null,
    panNumber: '',
    panFile: null,
    aadharNumber: '',
    aadharFile: null,
    bankName: '',
    bankAccountNumber: '',
    ifscCode: '',
    bankFile: null,
  };
  uploadedUrls: UploadedUrls = {};

  totalViews = 0;
  totalWatchHours = 0;
  totalEarnings = 0;

  get displayedColumns(): string[] {
    return this.isAdmin
      ? ['title', 'studio', 'totalViews', 'adsRunned', 'totalWatchHours', 'producerEarnings', 'status']
      : ['title', 'totalViews', 'adsRunned', 'totalWatchHours', 'producerEarnings', 'status'];
  }

  get isAdmin(): boolean {
    return this.authStore.isStrictAdmin() && !this.authStore.isOnlyProducer();
  }

  ngOnInit(): void {
    if (!this.authStore.isAuthenticated()) {
      return;
    }

    if (this.isAdmin) {
      this.selectedProducerId = 'ALL';
      this.route.queryParams.subscribe(params => {
        if (params['producerId']) {
          this.selectedProducerId = params['producerId'];
        }
      });
      this.loadAllStudios();
    } else {
      this.selectedProducerId = '';
    }

    this.loadAllData();
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initCharts();
    }, 150);
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  loadAllStudios(): void {
    this.producerApiService.getAllProducers().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.allStudios = res.data.filter(s => {
            const st = (s.status || s.onboardingStatus || '').toUpperCase();
            return st !== 'DEACTIVATED' && st !== 'SUSPENDED' && st !== 'INACTIVE';
          });
        }
      },
      error: (err) => {
        console.warn('Could not load all studios list', err);
      }
    });
  }

  onStudioChange(producerId: string): void {
    this.selectedProducerId = producerId;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { producerId: producerId === 'ALL' ? null : producerId },
      queryParamsHandling: 'merge'
    });
    this.loadAllData();
  }

  syncLiveData(): void {
    this.loading = true;
    this.notificationService.info('Syncing Producer Dashboard with Platform Database & Admin Catalog...');
    this.loadAllData(() => {
      this.lastSyncTime = new Date();
      this.notificationService.success('Producer Dashboard synchronized with live database.');
    });
  }

  loadAllData(callback?: () => void): void {
    const pId = this.isAdmin
      ? (this.selectedProducerId && this.selectedProducerId !== 'ALL' ? this.selectedProducerId : undefined)
      : undefined;
    const analyticsPId = this.isAdmin
      ? (this.selectedProducerId === 'ALL' ? 'ALL' : this.selectedProducerId)
      : undefined;

    this.loadProfile(pId);
    this.loadMovieAnalytics(analyticsPId, callback);
    this.loadAgreement(pId);
  }

  loadProfile(producerId?: string): void {
    this.producerApiService.getProducerProfile(producerId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.profile = res.data;
          this.updateRevenueChart();
        }
      },
      error: (err) => {
        console.warn('Could not load producer profile', err);
      }
    });
  }

  loadAgreement(producerId?: string): void {
    this.producerApiService.getProducerAgreement(producerId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.agreement = res.data;
        }
      },
      error: (err) => {
        console.warn('Could not load producer agreement', err);
      }
    });
  }

  loadMovieAnalytics(producerId?: string, callback?: () => void): void {
    this.loading = true;
    this.producerApiService.getMovieAnalytics(producerId).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.moviesList = res.data;
          this.calculateTotals();
          this.updateCharts();
        }
        if (callback) callback();
      },
      error: () => {
        this.loading = false;
        if (callback) callback();
      }
    });
  }

  calculateTotals(): void {
    this.totalViews = this.moviesList.reduce((acc, curr) => acc + (curr.totalViews || 0), 0);
    this.totalWatchHours = this.moviesList.reduce((acc, curr) => acc + (curr.totalWatchHours || 0), 0);
    this.totalEarnings = this.moviesList.reduce((acc, curr) => acc + (curr.producerEarnings || 0), 0);
  }

  downloadAgreement(): void {
    if (!this.agreement) return;

    const titlesList = this.agreement.approvedTitles && this.agreement.approvedTitles.length > 0
      ? this.agreement.approvedTitles.map((t: any) => `- [${t.contentType}] ${t.title} (Status: ${t.status})`).join('\n')
      : '- All Licensed Media Assets Submitted by Producer Studio';

    const textContent = `======================================================================
MAXXPIXELS OTT - PRODUCER MASTER DISTRIBUTION & LICENSING AGREEMENT
======================================================================

AGREEMENT ID: ${this.agreement.agreementId}
EFFECTIVE DATE: ${this.agreement.effectiveDate}
AGREEMENT STATUS: ${this.agreement.agreementStatus}

1. PARTIES & REGISTRATION
----------------------------------------------------------------------
Licensor Producer Studio: ${this.agreement.studioName}
Studio Registration Number: ${this.agreement.studioRegistrationNumber}
Official Contact Email: ${this.agreement.contactEmail}
Authorized Contact Phone: ${this.agreement.contactPhone}
PAN Tax Identification: ${this.agreement.panNumber}
Aadhaar Identification: ${this.agreement.aadharNumber}
GSTIN Number: ${this.agreement.gstNumber}

Licensee Platform: Maxxpixels OTT Media Networks Inc.

2. BANK PAYOUT & REVENUE SHARE
----------------------------------------------------------------------
Payout Bank Name: ${this.agreement.bankName}
Bank Account Number: ${this.agreement.bankAccountNumber}
Bank IFSC Code: ${this.agreement.ifscCode}
Producer Revenue Share Percentage: ${this.agreement.revenueSharePercentage}% Net Payout

3. LICENSED MEDIA CONTENT CATALOG (SCHEDULE A)
----------------------------------------------------------------------
${titlesList}

4. TERMS & CONDITIONS
----------------------------------------------------------------------
${this.agreement.licenseTerms}

5. SIGNATURE & EXECUTION
----------------------------------------------------------------------
Licensor Authorized Signature: _______________________ Date: ______________
Licensee Authorized Signature: [MAXXPIXELS OTT EXEC] Date: ${new Date().toISOString().split('T')[0]}
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Producer_Agreement_${this.agreement.agreementId}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.notificationService.success(`Agreement document downloaded for ${this.agreement.studioName}`);
  }

  uploadSignedAgreement(): void {
    this.showAgreementForm = true;
    this.uploadedUrls = {};
    // Pre-fill from existing agreement if available
    if (this.agreement) {
      this.agreementForm.panNumber = this.agreement.panNumber || '';
      this.agreementForm.aadharNumber = this.agreement.aadharNumber || '';
      this.agreementForm.bankName = this.agreement.bankName || '';
      this.agreementForm.bankAccountNumber = this.agreement.bankAccountNumber || '';
      this.agreementForm.ifscCode = this.agreement.ifscCode || '';
    }
  }

  generateCredentials(): void {
    if (!this.agreement) return;
    const producerId = this.selectedProducerId !== 'ALL' ? this.selectedProducerId : (this.agreement as any).id || 0;
    if (!producerId) return;

    this.generatingCredentials = true;
    this.producerApiService.generateProducerCredentials(producerId).subscribe({
      next: (res) => {
        this.generatingCredentials = false;
        if (res.success) {
          this.producerCredentials = res.data;
          this.showCredentials = true;
          this.notificationService.success('Producer login credentials generated successfully!');
        } else {
          this.notificationService.error(res.message || 'Failed to generate credentials');
        }
      },
      error: (err: any) => {
        this.generatingCredentials = false;
        this.notificationService.error(err?.error?.message || 'Error generating credentials');
      }
    });
  }

  hideCredentials(): void {
    this.showCredentials = false;
  }

  copyCredentials(): void {
    if (!this.producerCredentials) return;
    const text = `Studio: ${this.producerCredentials.studioName}\nEmail: ${this.producerCredentials.email}\nPassword: ${this.producerCredentials.password}\nLogin URL: ${this.producerCredentials.loginUrl || '/producer/login'}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.notificationService.success('Credentials copied to clipboard!');
      });
    }
  }

  closeAgreementForm(): void {
    this.showAgreementForm = false;
    this.uploadedUrls = {};
    this.agreementForm = {
      signedAgreementFile: null,
      panNumber: '',
      panFile: null,
      aadharNumber: '',
      aadharFile: null,
      bankName: '',
      bankAccountNumber: '',
      ifscCode: '',
      bankFile: null,
    };
  }

  onAgreementFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.agreementForm.signedAgreementFile = input.files[0];
    }
  }

  onPanFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.agreementForm.panFile = input.files[0];
    }
  }

  onAadharFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.agreementForm.aadharFile = input.files[0];
    }
  }

  onBankFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.agreementForm.bankFile = input.files[0];
    }
  }

  private async uploadFile(file: File, folder: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.producerApiService.uploadKycFile(file, folder).subscribe({
        next: (res) => {
          const url = res.data?.url || res.data?.fileUrl;
          resolve(url || '');
        },
        error: (err) => {
          reject(err?.error?.message || 'Upload failed');
        }
      });
    });
  }

  async submitAgreementAndKyc(): Promise<void> {
    if (!this.agreementForm.signedAgreementFile) {
      this.notificationService.error('Signed Agreement PDF is required.');
      return;
    }
    if (!this.agreementForm.panNumber.trim()) {
      this.notificationService.error('PAN Number is required.');
      return;
    }
    if (!this.agreementForm.aadharNumber.trim()) {
      this.notificationService.error('Aadhaar Number is required.');
      return;
    }
    if (!this.agreementForm.bankName.trim() || !this.agreementForm.bankAccountNumber.trim() || !this.agreementForm.ifscCode.trim()) {
      this.notificationService.error('Bank Name, Account Number, and IFSC Code are all required.');
      return;
    }

    this.uploadingAgreement = true;

    try {
      // Upload all PDF files in parallel
      const [
        agreementUrl,
        panUrl,
        aadharUrl,
        bankUrl
      ] = await Promise.all([
        this.uploadFile(this.agreementForm.signedAgreementFile!, 'producer-agreement'),
        this.uploadFile(this.agreementForm.panFile!, 'producer-kyc'),
        this.uploadFile(this.agreementForm.aadharFile!, 'producer-kyc'),
        this.uploadFile(this.agreementForm.bankFile!, 'producer-kyc'),
      ]);

      this.uploadedUrls = {
        signedAgreementUrl: agreementUrl,
        panDocUrl: panUrl,
        aadharDocUrl: aadharUrl,
        bankDocUrl: bankUrl,
      };

      const payload = {
        signedAgreementUrl: agreementUrl,
        panNumber: this.agreementForm.panNumber.trim(),
        panDocUrl: panUrl,
        aadharNumber: this.agreementForm.aadharNumber.trim(),
        aadharDocUrl: aadharUrl,
        bankName: this.agreementForm.bankName.trim(),
        bankAccountNumber: this.agreementForm.bankAccountNumber.trim(),
        ifscCode: this.agreementForm.ifscCode.trim(),
        bankDocUrl: bankUrl,
      };

      this.producerApiService.uploadProducerAgreement(payload).subscribe({
        next: (res) => {
          this.uploadingAgreement = false;
          if (res.success) {
            this.notificationService.success('Signed Agreement, PAN, Aadhaar & Bank documents CONFIRMED successfully!');
            this.showAgreementForm = false;
            this.uploadedUrls = {};
            this.loadAgreement(this.selectedProducerId !== 'ALL' ? this.selectedProducerId : undefined);
          } else {
            this.notificationService.error(res.message || 'Failed to confirm agreement & KYC');
          }
        },
        error: (err: any) => {
          this.uploadingAgreement = false;
          this.notificationService.error(err?.error?.message || 'Error confirming agreement & KYC');
        }
      });
    } catch (err: any) {
      this.uploadingAgreement = false;
      this.notificationService.error(err?.message || 'File upload failed');
    }
  }

  uploadingKycField: string | null = null;

  getKycStatusClass(): string {
    const p = this.profile;
    if (!p) return 'pending';
    const s = (p.onboardingStatus || p.status || '').toUpperCase();
    if (s === 'APPROVED' || s === 'VERIFIED') return 'ok';
    if (s === 'REJECTED') return 'rejected';
    return 'pending';
  }

  getKycStatusIcon(): string {
    const s = this.getKycStatusClass();
    if (s === 'ok') return 'verified';
    if (s === 'rejected') return 'error';
    return 'hourglass_empty';
  }

  getKycStatusText(): string {
    const s = this.getKycStatusClass();
    if (s === 'ok') return 'KYC COMPLIANT & APPROVED';
    if (s === 'rejected') return 'KYC REJECTED / RESUBMIT';
    return 'KYC PENDING VERIFICATION';
  }

  onUploadKycFile(event: Event, field: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.uploadingKycField = field;

    this.producerApiService.uploadKycFile(file).subscribe({
      next: (uploadRes) => {
        const url = uploadRes.data?.url || uploadRes.data?.fileUrl;
        if (!url) {
          this.uploadingKycField = null;
          this.notificationService.error('Upload succeeded but document URL was not returned.');
          return;
        }

        const payload: any = { [field]: url };
        const pId = this.selectedProducerId !== 'ALL' ? this.selectedProducerId : undefined;
        this.producerApiService.updateProducerKycDocuments(payload, pId).subscribe({
          next: (res) => {
            this.uploadingKycField = null;
            if (res.success && res.data) {
              this.profile = { ...this.profile, ...res.data };
              this.notificationService.success('KYC document uploaded and profile updated!');
            } else {
              this.notificationService.success('Document uploaded!');
              this.loadProfile(pId);
            }
          },
          error: (err) => {
            this.uploadingKycField = null;
            this.notificationService.error(err?.error?.message || 'Failed to update profile document');
          }
        });
      },
      error: (err) => {
        this.uploadingKycField = null;
        this.notificationService.error(err?.error?.message || 'Failed to upload document file');
      }
    });
  }

  private initCharts(): void {
    this.initViewsChart();
    this.initRevenueChart();
    this.initTopMediaChart();
    this.initDeviceChart();
  }

  private initViewsChart(): void {
    if (!this.viewsChartRef?.nativeElement) return;
    const ctx = this.viewsChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const blueGradient = ctx.createLinearGradient(0, 0, 0, 250);
    blueGradient.addColorStop(0, 'rgba(0, 210, 255, 0.35)');
    blueGradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');

    const purpleGradient = ctx.createLinearGradient(0, 0, 0, 250);
    purpleGradient.addColorStop(0, 'rgba(155, 89, 182, 0.25)');
    purpleGradient.addColorStop(1, 'rgba(155, 89, 182, 0.0)');

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const viewsMultiplier = this.totalViews > 0 ? this.totalViews / 12 : 50000;
    const viewsData = months.map((_, i) => Math.round(viewsMultiplier * (0.6 + (i * 0.08))));
    const hoursData = viewsData.map(v => Math.round((v * 135) / 60));

    this.viewsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Video Streams',
            data: viewsData,
            borderColor: '#00d2ff',
            backgroundColor: blueGradient,
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointBackgroundColor: '#00d2ff',
            pointHoverRadius: 6
          },
          {
            label: 'Watch Hours',
            data: hoursData,
            borderColor: '#9b59b6',
            backgroundColor: purpleGradient,
            fill: true,
            tension: 0.4,
            borderWidth: 2,
            borderDash: [4, 4],
            pointBackgroundColor: '#9b59b6',
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#a0a0b5', font: { family: 'Roboto', size: 12, weight: 600 } }
          },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 36, 0.95)',
            titleColor: '#ffffff',
            bodyColor: '#a0a0b5',
            borderColor: '#3a3a52',
            borderWidth: 1,
            padding: 12
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8e8ea0' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8e8ea0' }
          }
        }
      }
    });
  }

  private initRevenueChart(): void {
    if (!this.revenueChartRef?.nativeElement) return;
    const ctx = this.revenueChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const producerShare = this.profile?.defaultRevenueSharePercentage || 70;
    const platformShare = 100 - producerShare;

    this.revenueChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: [`Studio Net Share (${producerShare}%)`, `Platform Distribution (${platformShare}%)`, 'Ad Royalty Pool', 'Streaming Premium'],
        datasets: [{
          data: [producerShare, platformShare, 20, 15],
          backgroundColor: ['#2ecc71', '#00d2ff', '#9b59b6', '#f1c40f'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#a0a0b5', font: { size: 11, weight: 600 }, padding: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 36, 0.95)',
            borderColor: '#3a3a52',
            borderWidth: 1
          }
        }
      }
    });
  }

  private updateRevenueChart(): void {
    if (!this.revenueChartInstance) return;
    const producerShare = this.profile?.defaultRevenueSharePercentage || 70;
    const platformShare = 100 - producerShare;
    this.revenueChartInstance.data.labels = [
      `Studio Net Share (${producerShare}%)`,
      `Platform Distribution (${platformShare}%)`,
      'Ad Royalty Pool',
      'Streaming Premium'
    ];
    this.revenueChartInstance.data.datasets[0].data = [producerShare, platformShare, 20, 15];
    this.revenueChartInstance.update();
  }

  private initTopMediaChart(): void {
    if (!this.topMediaChartRef?.nativeElement) return;
    const ctx = this.topMediaChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = this.moviesList.length ? this.moviesList.slice(0, 5).map(m => m.title) : ['Catalog Asset 1', 'Catalog Asset 2'];
    const views = this.moviesList.length ? this.moviesList.slice(0, 5).map(m => m.totalViews) : [120000, 85000];

    this.topMediaChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Streams',
          data: views,
          backgroundColor: [
            'rgba(0, 210, 255, 0.85)',
            'rgba(155, 89, 182, 0.85)',
            'rgba(46, 204, 113, 0.85)',
            'rgba(241, 196, 15, 0.85)',
            'rgba(231, 76, 60, 0.85)'
          ],
          borderRadius: 8,
          borderWidth: 0
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 36, 0.95)',
            borderColor: '#3a3a52',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#8e8ea0' }
          },
          y: {
            grid: { display: false },
            ticks: { color: '#ffffff', font: { weight: 600 } }
          }
        }
      }
    });
  }

  private updateCharts(): void {
    if (this.topMediaChartInstance && this.moviesList.length) {
      this.topMediaChartInstance.data.labels = this.moviesList.slice(0, 5).map(m => m.title);
      this.topMediaChartInstance.data.datasets[0].data = this.moviesList.slice(0, 5).map(m => m.totalViews);
      this.topMediaChartInstance.update();
    }

    if (this.viewsChartInstance && this.totalViews > 0) {
      const viewsMultiplier = this.totalViews / 12;
      const viewsData = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        .map((_, i) => Math.round(viewsMultiplier * (0.6 + (i * 0.08))));
      const hoursData = viewsData.map(v => Math.round((v * 135) / 60));

      this.viewsChartInstance.data.datasets[0].data = viewsData;
      this.viewsChartInstance.data.datasets[1].data = hoursData;
      this.viewsChartInstance.update();
    }

    this.updateRevenueChart();
  }

  private initDeviceChart(): void {
    if (!this.deviceChartRef?.nativeElement) return;
    const ctx = this.deviceChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.deviceChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Smart TV (4K UHD)', 'Mobile Apps (iOS/Android)', 'Web Streaming', 'Tablets & Consoles'],
        datasets: [{
          data: [52, 32, 11, 5],
          backgroundColor: ['#00d2ff', '#3a7bd5', '#f1c40f', '#2ecc71'],
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#a0a0b5', font: { size: 11, weight: 600 }, padding: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(24, 24, 36, 0.95)',
            borderColor: '#3a3a52',
            borderWidth: 1
          }
        }
      }
    });
  }

  private destroyCharts(): void {
    this.viewsChartInstance?.destroy();
    this.revenueChartInstance?.destroy();
    this.topMediaChartInstance?.destroy();
    this.deviceChartInstance?.destroy();
  }
}
