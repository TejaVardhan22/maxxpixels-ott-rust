import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { MediaUploadComponent } from '../../shared/components/media-upload/media-upload.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface AuditHistoryRecord {
  id: number;
  action: string;
  entityName: string;
  entityId: string;
  userEmail: string;
  userRole: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

@Component({
  selector: 'app-system-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PermissionButtonComponent,
    MediaUploadComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>settings</mat-icon> PLATFORM INFRASTRUCTURE & CONFIGURATION</span>
          <h1>System Settings & Central Control Studio</h1>
          <p>Manage platform branding, currency, Google AdMob, Maintenance Mode, and configuration audit rollback</p>
        </div>
        <div class="header-actions">
          <span *ngIf="settingsForm.dirty" class="unsaved-badge">
            <mat-icon>warning</mat-icon> Unsaved Changes
          </span>
          <button *ngIf="settingsForm.dirty" mat-button class="discard-btn" (click)="onDiscardChanges()">
            <mat-icon>undo</mat-icon> Discard
          </button>
          <button mat-raised-button color="primary" class="save-btn" (click)="onSaveSettings()" [disabled]="isSaving">
            <mat-icon>{{ isSaving ? 'sync' : 'save' }}</mat-icon> {{ isSaving ? 'Saving...' : 'Save Configuration' }}
          </button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>language</mat-icon></div>
          <div>
            <span class="kpi-label">Platform Brand</span>
            <div class="kpi-val text-green">{{ settingsForm.value.appName || 'Not Set' }}</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>build_circle</mat-icon></div>
          <div>
            <span class="kpi-label">Platform Status</span>
            <div class="kpi-val" [class.text-red]="settingsForm.value.maintenanceMode" [class.text-green]="!settingsForm.value.maintenanceMode">
              {{ settingsForm.value.maintenanceMode ? '🔴 Maintenance Active' : '🟢 Live & Operational' }}
            </div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>currency_exchange</mat-icon></div>
          <div>
            <span class="kpi-label">Default Currency</span>
            <div class="kpi-val font-mono" style="font-size: 13px;">{{ settingsForm.value.defaultCurrency || 'INR' }}</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>monetization_on</mat-icon></div>
          <div>
            <span class="kpi-label">Google AdMob</span>
            <div class="kpi-val" [class.text-green]="settingsForm.value.admobEnabled === 'true'" [class.text-red]="settingsForm.value.admobEnabled !== 'true'">
              {{ settingsForm.value.admobEnabled === 'true' ? (settingsForm.value.admobTestMode === 'true' ? '🧪 Test Mode' : '🟢 Live Ads') : '🔴 Disabled' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 3. SEARCH & QUICK FILTER BAR -->
      <div class="search-filter-box">
        <mat-icon>search</mat-icon>
        <input type="text" [(ngModel)]="searchQuery" placeholder="Search settings (e.g. branding, currency, admob, maintenance, audit)..." (input)="onSearchChange()">
        <button *ngIf="searchQuery" mat-icon-button (click)="searchQuery = ''; onSearchChange()"><mat-icon>close</mat-icon></button>
      </div>

      <!-- 4. CATEGORY TABS -->
      <div class="sec-tabs">
        <button class="tab-btn" [class.active]="activeTab === 'BRANDING'" (click)="activeTab = 'BRANDING'">
          <mat-icon>language</mat-icon> Branding & Identity
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'PAYMENTS'" (click)="activeTab = 'PAYMENTS'">
          <mat-icon>currency_exchange</mat-icon> Currency & Billing
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'ADMOB'" (click)="activeTab = 'ADMOB'">
          <mat-icon>monetization_on</mat-icon> Google AdMob
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'MAINTENANCE'" (click)="activeTab = 'MAINTENANCE'">
          <mat-icon>construction</mat-icon> Maintenance Mode
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'HISTORY'" (click)="activeTab = 'HISTORY'; loadHistory()">
          <mat-icon>history</mat-icon> Audit & Rollback
        </button>
      </div>

      <!-- TAB 1: BRANDING & CDN -->
      <div *ngIf="activeTab === 'BRANDING'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box"><mat-icon>language</mat-icon></div>
            <div>
              <h3>General Branding, Contact & Public URLs</h3>
              <p>Configure platform application title, contact channels, legal links, and SEO metadata</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="section-title"><mat-icon>storefront</mat-icon><span>Platform Identity</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Application Platform Name</mat-label>
                  <input matInput formControlName="appName" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Short App Name</mat-label>
                  <input matInput formControlName="appShortName" maxlength="30" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Legal Company Name</mat-label>
                  <input matInput formControlName="companyName" required>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Public Website URL</mat-label>
                  <input matInput type="url" formControlName="websiteUrl" placeholder="https://maxxpixels.com" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row branding-assets">
              <div class="half-width asset-field">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Primary Logo URL</mat-label>
                  <input matInput type="url" formControlName="logoUrl" placeholder="https://.../logo.png" required>
                </mat-form-field>
                <app-media-upload [folder]="'branding'" [label]="'Upload Logo'" [initialUrl]="settingsForm.value.logoUrl || ''" (uploadComplete)="onBrandAssetUploaded('logoUrl', $event)"></app-media-upload>
              </div>

              <div class="half-width asset-field">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Dark Mode / Mobile Logo URL</mat-label>
                  <input matInput type="url" formControlName="darkLogoUrl" placeholder="https://.../logo_dark.png">
                </mat-form-field>
                <app-media-upload [folder]="'branding'" [label]="'Upload Dark Logo'" [initialUrl]="settingsForm.value.darkLogoUrl || ''" (uploadComplete)="onBrandAssetUploaded('darkLogoUrl', $event)"></app-media-upload>
              </div>
            </div>

            <div class="section-title"><mat-icon>support_agent</mat-icon><span>Customer Support & Legal Links</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Customer Support Email</mat-label>
                  <input matInput type="email" formControlName="supportEmail" required>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Customer Support Phone</mat-label>
                  <input matInput formControlName="supportPhone" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Terms of Service URL</mat-label>
                  <input matInput type="url" formControlName="termsUrl" required>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Privacy Policy URL</mat-label>
                  <input matInput type="url" formControlName="privacyPolicyUrl" required>
                </mat-form-field>
              </div>
            </div>

            <div class="section-title"><mat-icon>travel_explore</mat-icon><span>SEO & App Store Links</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>SEO Meta Title</mat-label>
                  <input matInput formControlName="seoTitle" maxlength="70" required>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Android Play Store App URL</mat-label>
                  <input matInput type="url" formControlName="androidAppUrl">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>SEO Meta Description</mat-label>
                  <textarea matInput formControlName="seoDescription" rows="2" maxlength="170" required></textarea>
                </mat-form-field>
              </div>
            </div>

            <div class="section-title"><mat-icon>share</mat-icon><span>Social Media Links (Shown in Website Footer)</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Facebook Page URL</mat-label>
                  <input matInput type="url" formControlName="facebookUrl" placeholder="https://www.facebook.com/maxxpixels">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Instagram Profile URL</mat-label>
                  <input matInput type="url" formControlName="instagramUrl" placeholder="https://www.instagram.com/maxxpixels">
                </mat-form-field>
              </div>
            </div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>X (Twitter) Profile URL</mat-label>
                  <input matInput type="url" formControlName="twitterUrl" placeholder="https://x.com/maxxpixels">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>YouTube Channel URL</mat-label>
                  <input matInput type="url" formControlName="youtubeUrl" placeholder="https://www.youtube.com/@maxxpixels">
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Branding Configuration
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 2: CURRENCY & BILLING -->
      <div *ngIf="activeTab === 'PAYMENTS'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box gold"><mat-icon>currency_exchange</mat-icon></div>
            <div>
              <h3>Currency &amp; Billing Preferences</h3>
              <p>Configure default storefront currency (Razorpay API keys and webhook secrets are managed in the server .env file)</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="section-title"><mat-icon>currency_exchange</mat-icon><span>Currency &amp; Billing Preferences</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Default Currency</mat-label>
                  <mat-select formControlName="defaultCurrency" panelClass="custom-select-panel" required>
                    <mat-option value="INR">₹ INR (Indian Rupee)</mat-option>
                    <mat-option value="USD">$ USD (US Dollar)</mat-option>
                    <mat-option value="EUR">€ EUR (Euro)</mat-option>
                    <mat-option value="AED">AED (UAE Dirham)</mat-option>
                    <mat-option value="GBP">£ GBP (British Pound)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="half-width">
                <div class="info-box-sm">
                  <mat-icon>info</mat-icon>
                  <span>Subscription plans and rental transactions will quote prices in this currency.</span>
                </div>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Currency Settings
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 3: GOOGLE ADMOB -->
      <div *ngIf="activeTab === 'ADMOB'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box gold"><mat-icon>monetization_on</mat-icon></div>
            <div>
              <h3>Google AdMob (Mobile App)</h3>
              <p>Remotely control mobile in-app AdMob status, test mode, and Ad Unit IDs without rebuilding the APK</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="section-title"><mat-icon>toggle_on</mat-icon><span>Master AdMob Switch</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>AdMob Status</mat-label>
                  <mat-select formControlName="admobEnabled" panelClass="custom-select-panel" required>
                    <mat-option value="true">🟢 Active (Serve Live In-App Ads)</mat-option>
                    <mat-option value="false">🔴 Disabled (Ad-Free for All Users)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>AdMob Mode (Live vs. Test Ads)</mat-label>
                  <mat-select formControlName="admobTestMode" panelClass="custom-select-panel">
                    <mat-option value="false">🚀 Production Mode (Real Ad Units)</mat-option>
                    <mat-option value="true">🧪 Test Mode (Guaranteed Google Test Ads)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Banner Ad Unit ID</mat-label>
                  <input matInput formControlName="admobBannerId" placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Interstitial Ad Unit ID</mat-label>
                  <input matInput formControlName="admobInterstitialId" placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Rewarded Video Ad Unit ID</mat-label>
                  <input matInput formControlName="admobRewardedId" placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX">
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save AdMob Settings
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 4: MAINTENANCE MODE -->
      <div *ngIf="activeTab === 'MAINTENANCE'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box"><mat-icon>construction</mat-icon></div>
            <div>
              <h3>Platform Maintenance Mode</h3>
              <p>Instantly put API, Web, and Mobile apps into scheduled maintenance while keeping Admin Panel accessible</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="toggles-card" style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05);">
              <h4 style="color: #ef4444; display: flex; align-items: center; gap: 8px;">
                <mat-icon>warning</mat-icon> Platform Maintenance Mode
              </h4>
              <div class="toggle-row">
                <div>
                  <span class="t-title">Enable Maintenance Mode</span>
                  <span class="t-desc">When active, Web &amp; Mobile show the maintenance screen and non-admin API routes return HTTP 503. Admins can still log in and manage the console.</span>
                </div>
                <mat-slide-toggle formControlName="maintenanceMode" color="warn"></mat-slide-toggle>
              </div>
            </div>

            <div class="form-row">
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Custom Maintenance Message for End Users</mat-label>
                  <textarea matInput formControlName="maintenanceMessage" rows="3" placeholder="We are currently performing scheduled maintenance. Please check back shortly."></textarea>
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Maintenance Settings
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 5: CONFIGURATION AUDIT & ROLLBACK -->
      <div *ngIf="activeTab === 'HISTORY'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box"><mat-icon>history</mat-icon></div>
            <div>
              <h3>Configuration Change Audit Trail & One-Click Rollback</h3>
              <p>Immutable history of settings modifications with before/after state and instant rollback</p>
            </div>
          </div>

          <div *ngIf="isLoadingHistory" style="text-align: center; padding: 30px; color: #a0a0b0;">
            <mat-icon style="animation: spin 1s infinite linear;">sync</mat-icon> Loading audit records...
          </div>

          <div *ngIf="!isLoadingHistory && historyRecords.length === 0" style="text-align: center; padding: 40px; color: #a0a0b0;">
            <mat-icon style="font-size: 36px; width: 36px; height: 36px;">history_toggle_drop</mat-icon>
            <p>No configuration changes recorded yet. Changes will be tracked automatically upon save.</p>
          </div>

          <div *ngIf="!isLoadingHistory && historyRecords.length > 0" class="history-list">
            <div *ngFor="let rec of historyRecords" class="history-card">
              <div class="history-header">
                <div>
                  <span class="history-action">{{ rec.action }}</span>
                  <span class="history-meta">• by <b>{{ rec.userEmail }}</b> • {{ rec.createdAt | date:'medium' }}</span>
                </div>
                <button mat-stroked-button color="warn" (click)="onRollback(rec.id)">
                  <mat-icon>replay</mat-icon> Rollback to this state
                </button>
              </div>
              <div class="history-details font-mono">
                {{ rec.details }}
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 4px; }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;

      .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(26, 76, 216, 0.15);
        color: #00d2ff;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        margin-bottom: 8px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }

      h1 { font-size: 26px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.5px; }
      p { color: #a0a0b0; font-size: 13px; margin: 0; }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;

        .unsaved-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #ffab00;
          font-size: 12px;
          font-weight: 700;
          background: rgba(255, 171, 0, 0.12);
          padding: 6px 12px;
          border-radius: 8px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .discard-btn {
          color: #a0a0b0;
          border: 1px solid #28283c;
          border-radius: 10px;
        }

        .save-btn {
          height: 44px;
          padding: 0 24px;
          border-radius: 10px;
          font-weight: 700;
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(26, 76, 216, 0.35);
        }
      }
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;

      .kpi-card {
        background: #161624;
        border: 1px solid #28283c;
        border-radius: 14px;
        padding: 18px;
        display: flex;
        align-items: center;
        gap: 14px;

        .kpi-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: #1c1c2b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .kpi-label { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 2px; }
        .kpi-val { font-size: 16px; font-weight: 700; color: #ffffff; }
        .text-green { color: #00e676; }
        .text-red { color: #ef4444; }
        .font-mono { font-family: monospace; font-size: 13px; color: #00d2ff; }

        &.green .kpi-icon { color: #00e676; background: rgba(0, 230, 118, 0.12); }
        &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
        &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
        &.purple .kpi-icon { color: #ab47bc; background: rgba(171, 71, 188, 0.12); }
      }
    }

    .search-filter-box {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 12px;
      padding: 10px 16px;
      margin-bottom: 20px;
      color: #a0a0b0;
      mat-icon { color: #00d2ff; }
      input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #ffffff;
        font-size: 14px;
      }
    }

    .sec-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
      flex-wrap: wrap;

      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #161624;
        border: 1px solid #28283c;
        color: #a0a0b0;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover, &.active {
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%);
          border-color: transparent;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(26, 76, 216, 0.35);
        }
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    .form-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 28px;
      color: #ffffff;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      .card-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 24px;

        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(26,76,216,0.2), rgba(199,37,163,0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00d2ff;
          &.blue { color: #00e676; }
          &.gold { color: #ffab00; }
          &.purple { color: #ab47bc; }
        }

        h3 { margin: 0 0 2px; font-size: 18px; font-weight: 800; color: #ffffff; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }
    }

    .settings-form {
      .full-width { width: 100%; margin-bottom: 16px; display: block; }
      .form-row { display: flex; gap: 16px; flex-wrap: wrap; }
      .half-width { flex: 1; min-width: 240px; }
      .section-title {
        display: flex; align-items: center; gap: 8px; color: #d9e2ff;
        font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
        margin: 10px 0 18px; padding-bottom: 10px; border-bottom: 1px solid #28283c;
        mat-icon { color: #00d2ff; font-size: 19px; width: 19px; height: 19px; }
      }

      .info-box-sm {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #101018;
        border: 1px solid #28283a;
        padding: 12px 16px;
        border-radius: 10px;
        height: 56px;
        font-size: 12px;
        color: #a0a0b0;
        mat-icon { color: #00d2ff; font-size: 20px; width: 20px; height: 20px; }
      }

      .toggles-card {
        background: #101018;
        border: 1px solid #28283a;
        border-radius: 12px;
        padding: 18px;
        margin: 16px 0 24px;
        h4 { margin: 0 0 14px; font-size: 14px; font-weight: 800; color: #ffffff; }
        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #1c1c2b;
          &:last-child { border-bottom: none; }
          .t-title { font-weight: 700; font-size: 13px; display: block; }
          .t-desc { font-size: 11px; color: #a0a0b0; display: block; }
        }
      }

      .submit-btn {
        height: 50px;
        border-radius: 12px;
        font-weight: 800;
        font-size: 15px;
        background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 4px 16px rgba(26, 76, 216, 0.4);
      }
    }

    .section-divider {
      margin: 24px 0 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      .divider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #00d2ff;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .test-btn {
          height: 32px;
          font-size: 12px;
          line-height: 30px;
          border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }
      }
    }

    .branding-assets { align-items: flex-start; margin-bottom: 14px; }
    .asset-field { min-width: 0; }

    .history-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-top: 16px;
      .history-card {
        background: #101018;
        border: 1px solid #28283a;
        border-radius: 10px;
        padding: 16px;
        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          .history-action { font-weight: 800; color: #00d2ff; }
          .history-meta { font-size: 12px; color: #a0a0b0; }
        }
        .history-details {
          font-size: 12px;
          color: #94a3b8;
          background: rgba(0,0,0,0.3);
          padding: 8px 12px;
          border-radius: 6px;
          overflow-x: auto;
        }
      }
    }

    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class SystemSettingsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  activeTab = 'BRANDING';
  searchQuery = '';
  isSaving = false;
  isLoadingHistory = false;
  historyRecords: AuditHistoryRecord[] = [];

  settingsForm = this.fb.group({
    // Branding & Identity (loaded dynamically from GET /api/v1/admin/settings)
    appName: ['', [Validators.required]],
    appShortName: ['', [Validators.required, Validators.maxLength(30)]],
    companyName: ['', [Validators.required]],
    websiteUrl: ['', [Validators.required]],
    logoUrl: ['', [Validators.required]],
    darkLogoUrl: [''],
    supportEmail: ['', [Validators.required]],
    supportPhone: ['', [Validators.required]],
    privacyPolicyUrl: ['', [Validators.required]],
    termsUrl: ['', [Validators.required]],
    seoTitle: ['', [Validators.required, Validators.maxLength(70)]],
    seoDescription: ['', [Validators.required, Validators.maxLength(170)]],
    androidAppUrl: [''],
    facebookUrl: [''],
    instagramUrl: [''],
    twitterUrl: [''],
    youtubeUrl: [''],

    // Currency & Billing
    defaultCurrency: ['INR', [Validators.required]],

    // Google AdMob (remotely read by Mobile App)
    admobEnabled: ['false', [Validators.required]],
    admobTestMode: ['false'],
    admobBannerId: [''],
    admobInterstitialId: [''],
    admobRewardedId: [''],

    // Maintenance Mode (wired in API 503 middleware, Web & Mobile)
    maintenanceMode: [false],
    maintenanceMessage: ['']
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  private readonly booleanControlKeys = new Set<string>([
    'maintenanceMode',
  ]);

  private coerceSettingsPayload(raw: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...raw };

    // Map common backend DB alias keys to form control names
    const aliases: Record<string, string[]> = {
      logoUrl: ['logoUrl', 'APP_LOGO_URL', 'appLogoUrl', 'logo_url'],
      darkLogoUrl: ['darkLogoUrl', 'DARK_LOGO_URL', 'dark_logo_url'],
      maintenanceMode: ['maintenanceMode', 'MAINTENANCE_MODE_ENABLED', 'maintenanceModeEnabled'],
    };
    for (const [target, keys] of Object.entries(aliases)) {
      if (normalized[target] === undefined || normalized[target] === null || normalized[target] === '') {
        for (const k of keys) {
          if (normalized[k] !== undefined && normalized[k] !== null && normalized[k] !== '') {
            normalized[target] = normalized[k];
            break;
          }
        }
      }
    }

    for (const key of this.booleanControlKeys) {
      if (key in normalized && typeof normalized[key] === 'string') {
        normalized[key] = normalized[key].toLowerCase() === 'true' || normalized[key] === '1';
      }
    }
    return normalized;
  }

  loadSettings(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/settings`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.settingsForm.patchValue(this.coerceSettingsPayload(res.data));
          this.settingsForm.markAsPristine();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('maxx:branding-updated', { detail: res.data }));
          }
        }
      },
      error: () => {
        this.notificationService.error('Failed to load system settings from backend.');
      }
    });
  }

  onBrandAssetUploaded(controlName: 'logoUrl' | 'darkLogoUrl', url: string): void {
    this.settingsForm.get(controlName)?.setValue(url);
    this.settingsForm.get(controlName)?.markAsDirty();
  }

  onSearchChange(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return;

    if (q.includes('brand') || q.includes('logo') || q.includes('seo') || q.includes('social')) {
      this.activeTab = 'BRANDING';
    } else if (q.includes('currency') || q.includes('billing') || q.includes('pay')) {
      this.activeTab = 'PAYMENTS';
    } else if (q.includes('ad') || q.includes('admob') || q.includes('banner')) {
      this.activeTab = 'ADMOB';
    } else if (q.includes('maint')) {
      this.activeTab = 'MAINTENANCE';
    } else if (q.includes('hist') || q.includes('audit') || q.includes('rollback')) {
      this.activeTab = 'HISTORY';
      this.loadHistory();
    }
  }

  loadHistory(): void {
    this.isLoadingHistory = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/settings/history`).subscribe({
      next: (res) => {
        this.isLoadingHistory = false;
        this.historyRecords = res.data || [];
      },
      error: () => {
        this.isLoadingHistory = false;
        this.notificationService.error('Failed to load configuration audit history.');
      }
    });
  }

  async onRollback(auditLogId: number): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Rollback Configuration?',
      'Are you sure you want to rollback to this configuration version? Unsaved changes will be discarded.',
      'Yes, Rollback'
    );
    if (!ok) {
      return;
    }

    this.notificationService.info(`Reverting configuration to audit record #${auditLogId}...`);
    this.http.post<any>(`${environment.apiBaseUrl}/admin/settings/rollback/${auditLogId}`, {}).subscribe({
      next: (res) => {
        this.notificationService.success('Configuration rolled back successfully!');
        this.loadSettings();
        this.loadHistory();
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Rollback failed.';
        this.notificationService.error(`Rollback Error: ${msg}`);
      }
    });
  }

  async onDiscardChanges(): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Discard Unsaved Changes?',
      'Discard all unsaved changes and reload from server?',
      'Yes, Discard'
    );
    if (ok) {
      this.loadSettings();
    }
  }

  onSaveSettings(): void {
    if (this.settingsForm.invalid) {
      this.settingsForm.markAllAsTouched();
      const invalidFields = Object.keys(this.settingsForm.controls).filter(
        (key) => this.settingsForm.get(key)?.invalid
      );
      this.notificationService.error(
        invalidFields.length
          ? `Please fix required fields: ${invalidFields.slice(0, 4).join(', ')}`
          : 'Please fill in all required fields before saving.'
      );
      return;
    }

    this.isSaving = true;
    const dto = this.settingsForm.value;

    this.http.put<any>(`${environment.apiBaseUrl}/admin/settings`, dto).subscribe({
      next: (res) => {
        this.isSaving = false;
        const count = res?.data?.updated;
        this.notificationService.success(
          typeof count === 'number' && count === 0
            ? 'No changes detected — configuration is already up to date.'
            : `Platform settings saved (${count ?? ''} updated) and cache refreshed!`
        );
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('maxx:branding-updated', { detail: dto }));
        }
        this.loadSettings();
        if (this.activeTab === 'HISTORY') {
          this.loadHistory();
        }
      },
      error: (err) => {
        this.isSaving = false;
        const msg = err?.error?.message || err?.message || 'Unable to save platform settings.';
        this.notificationService.error(msg);
      }
    });
  }
}
