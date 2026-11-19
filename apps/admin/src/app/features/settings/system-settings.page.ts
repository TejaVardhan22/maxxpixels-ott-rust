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
          <p>Master controls for branding, cloud storage (Bunny/S3), payment gateways, maintenance mode, player rules, and audit rollback</p>
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
          <div class="kpi-icon"><mat-icon>cloud_done</mat-icon></div>
          <div>
            <span class="kpi-label">Active Storage</span>
            <div class="kpi-val text-green">{{ settingsForm.value.storageProvider === 'AWS' || settingsForm.value.storageProvider === 'S3' ? '☁️ AWS S3' : '🐰 Bunny.net Edge' }}</div>
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
          <div class="kpi-icon"><mat-icon>payment</mat-icon></div>
          <div>
            <span class="kpi-label">Payment Gateway</span>
            <div class="kpi-val font-mono" style="font-size: 13px;">{{ (settingsForm.value.paymentGatewayProvider === 'STRIPE' || settingsForm.value.paymentProvider === 'STRIPE') ? '💳 Stripe Global' : '🇮🇳 Razorpay Active' }}</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>devices</mat-icon></div>
          <div>
            <span class="kpi-label">Device Concurrency</span>
            <div class="kpi-val font-mono">{{ settingsForm.value.maxDevicesPerUser || '4' }} Devices • {{ settingsForm.value.maxConcurrentStreamsPerUser || '2' }} Streams</div>
          </div>
        </div>
      </div>

      <!-- 3. SEARCH & QUICK FILTER BAR -->
      <div class="search-filter-box">
        <mat-icon>search</mat-icon>
        <input type="text" [(ngModel)]="searchQuery" placeholder="Search configuration keys, settings, or credentials (e.g. razorpay, s3, bunny, player, watermark, maintenance)..." (input)="onSearchChange()">
        <button *ngIf="searchQuery" mat-icon-button (click)="searchQuery = ''; onSearchChange()"><mat-icon>close</mat-icon></button>
      </div>

      <!-- 4. CATEGORY TABS -->
      <div class="sec-tabs">
        <button class="tab-btn" [class.active]="activeTab === 'BRANDING'" (click)="activeTab = 'BRANDING'">
          <mat-icon>language</mat-icon> Branding & Identity
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'STORAGE'" (click)="activeTab = 'STORAGE'">
          <mat-icon>cloud</mat-icon> Bunny & AWS Storage
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'PAYMENTS'" (click)="activeTab = 'PAYMENTS'">
          <mat-icon>payment</mat-icon> Payments & Currency
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'NOTIFICATIONS'" (click)="activeTab = 'NOTIFICATIONS'">
          <mat-icon>mark_email_read</mat-icon> SMS, Email & Push
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'ADMOB'" (click)="activeTab = 'ADMOB'">
          <mat-icon>monetization_on</mat-icon> Google AdMob & Ads
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'MAINTENANCE'" (click)="activeTab = 'MAINTENANCE'">
          <mat-icon>construction</mat-icon> Maintenance & Flags
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'PLAYER'" (click)="activeTab = 'PLAYER'">
          <mat-icon>play_circle</mat-icon> Video Player
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'RESTRICTIONS'" (click)="activeTab = 'RESTRICTIONS'">
          <mat-icon>devices</mat-icon> Device Limits
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'GAMES_APK'" (click)="activeTab = 'GAMES_APK'">
          <mat-icon>sports_esports</mat-icon> Games & APK
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
                <app-media-upload [folder]="'branding'" [label]="'Upload Logo'" (uploadComplete)="onBrandAssetUploaded('logoUrl', $event)"></app-media-upload>
              </div>

              <div class="half-width asset-field">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Dark Mode / Mobile Logo URL</mat-label>
                  <input matInput type="url" formControlName="darkLogoUrl" placeholder="https://.../logo_dark.png">
                </mat-form-field>
                <app-media-upload [folder]="'branding'" [label]="'Upload Dark Logo'" (uploadComplete)="onBrandAssetUploaded('darkLogoUrl', $event)"></app-media-upload>
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

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Branding Configuration
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 2: STORAGE & CDN (BUNNY & S3) -->
      <div *ngIf="activeTab === 'STORAGE'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box blue"><mat-icon>cloud</mat-icon></div>
            <div>
              <h3>Cloud Storage & Video Streaming Provider</h3>
              <p>Switch between Bunny.net Edge CDN and AWS S3 / CloudFront with zero backend redeployment</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <!-- Active Provider Toggle -->
            <div class="section-title"><mat-icon>toggle_on</mat-icon><span>Active Storage & Streaming Provider</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Active Storage Provider</mat-label>
                  <mat-select formControlName="storageProvider" panelClass="custom-select-panel" required>
                    <mat-option value="BUNNY">🐰 Bunny.net (Edge Storage & Bunny Stream)</mat-option>
                    <mat-option value="AWS">☁️ AWS S3 & CloudFront Distribution</mat-option>
                    <mat-option value="S3">☁️ Generic S3 / Cloudflare R2 / MinIO</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="half-width">
                <div class="info-box-sm">
                  <mat-icon>info</mat-icon>
                  <span>Active Provider: <b>{{ settingsForm.value.storageProvider }}</b>. Changing this routes uploads and playback manifests automatically.</span>
                </div>
              </div>
            </div>

            <!-- BUNNY CONFIG -->
            <div class="section-divider">
              <div class="divider-header">
                <h4><mat-icon>folder_special</mat-icon> Bunny.net Storage & Video Stream</h4>
                <div style="display: flex; gap: 8px;">
                  <button type="button" mat-stroked-button color="accent" class="test-btn" (click)="testBunnyStorageConnection()">
                    <mat-icon>speed</mat-icon> Test Bunny Storage
                  </button>
                  <button type="button" mat-stroked-button color="primary" class="test-btn" (click)="testBunnyStreamConnection()">
                    <mat-icon>play_circle</mat-icon> Test Bunny Stream
                  </button>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bunny Storage Zone Name</mat-label>
                  <input matInput formControlName="bunnyStorageZoneName" placeholder="maxxpixels-images">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bunny Storage Zone Password / API Key</mat-label>
                  <input matInput [type]="hideBunnyStoragePassword ? 'password' : 'text'" formControlName="bunnyStorageZonePassword">
                  <button mat-icon-button matSuffix type="button" (click)="hideBunnyStoragePassword = !hideBunnyStoragePassword">
                    <mat-icon>{{ hideBunnyStoragePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bunny CDN Domain (Pull Zone)</mat-label>
                  <input matInput formControlName="bunnyCdnHostname" placeholder="https://maxxpixels-images.b-cdn.net">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bunny Storage Region</mat-label>
                  <input matInput formControlName="bunnyStorageRegion" placeholder="de, ny, sg, etc.">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bunny Stream Video Library ID</mat-label>
                  <input matInput formControlName="bunnyStreamLibraryId" placeholder="Enter Bunny Stream Library ID">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bunny Stream API Key</mat-label>
                  <input matInput [type]="hideBunnyStreamApiKey ? 'password' : 'text'" formControlName="bunnyStreamApiKey">
                  <button mat-icon-button matSuffix type="button" (click)="hideBunnyStreamApiKey = !hideBunnyStreamApiKey">
                    <mat-icon>{{ hideBunnyStreamApiKey ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <!-- AWS S3 CONFIG -->
            <div class="section-divider">
              <div class="divider-header">
                <h4><mat-icon>storage</mat-icon> AWS S3 / CloudFront / Cloudflare R2 Configuration</h4>
                <button type="button" mat-stroked-button color="accent" class="test-btn" (click)="testS3Connection()">
                  <mat-icon>cloud_sync</mat-icon> Test S3 Setup
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>S3 Master Bucket Name</mat-label>
                  <input matInput formControlName="s3MasterBucket" placeholder="maxxpixels-ott-assets">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>AWS Region</mat-label>
                  <input matInput formControlName="s3AwsRegion" placeholder="us-east-1, ap-south-1">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>AWS Access Key ID</mat-label>
                  <input matInput formControlName="s3AccessKey" placeholder="AKIA...">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>AWS Secret Access Key</mat-label>
                  <input matInput [type]="hideS3Secret ? 'password' : 'text'" formControlName="s3SecretKey">
                  <button mat-icon-button matSuffix type="button" (click)="hideS3Secret = !hideS3Secret">
                    <mat-icon>{{ hideS3Secret ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Storage & CDN Settings
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 3: PAYMENTS -->
      <div *ngIf="activeTab === 'PAYMENTS'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box gold"><mat-icon>payment</mat-icon></div>
            <div>
              <h3>Payment Gateways, Currency & Billing Rules</h3>
              <p>Configure Razorpay, Stripe, subscription renewals, tax percentages, and invoice prefixes</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <!-- Active Payment Gateway Selector -->
            <div class="section-title"><mat-icon>toggle_on</mat-icon><span>Active Payment Gateway Provider</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Active Payment Gateway</mat-label>
                  <mat-select formControlName="paymentGatewayProvider" panelClass="custom-select-panel" required>
                    <mat-option value="RAZORPAY">🇮🇳 Razorpay (UPI, NetBanking, Cards, Wallets)</mat-option>
                    <mat-option value="STRIPE">💳 Stripe (Global Cards, Apple Pay, Google Pay)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="half-width">
                <div class="info-box-sm">
                  <mat-icon>info</mat-icon>
                  <span>Active Gateway: <b>{{ settingsForm.value.paymentGatewayProvider || 'RAZORPAY' }}</b>. User subscription checkouts and orders will route to this gateway.</span>
                </div>
              </div>
            </div>

            <!-- RAZORPAY CONFIG -->
            <div class="section-divider">
              <div class="divider-header">
                <h4><mat-icon>account_balance_wallet</mat-icon> Razorpay Integration</h4>
                <button type="button" mat-stroked-button color="accent" class="test-btn" (click)="testRazorpayConnection()">
                  <mat-icon>verified</mat-icon> Test Razorpay Credentials
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Razorpay Key ID</mat-label>
                  <input matInput formControlName="razorpayKeyId" placeholder="rzp_live_...">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Razorpay Key Secret</mat-label>
                  <input matInput [type]="hideRazorpaySecret ? 'password' : 'text'" formControlName="razorpayKeySecret">
                  <button mat-icon-button matSuffix type="button" (click)="hideRazorpaySecret = !hideRazorpaySecret">
                    <mat-icon>{{ hideRazorpaySecret ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <!-- STRIPE CONFIG -->
            <div class="section-divider">
              <div class="divider-header">
                <h4><mat-icon>credit_card</mat-icon> Stripe Global Gateway Configuration</h4>
                <button type="button" mat-stroked-button color="accent" class="test-btn" (click)="testStripeConnection()">
                  <mat-icon>cloud_sync</mat-icon> Test Stripe Setup
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Stripe Publishable Key</mat-label>
                  <input matInput formControlName="stripePublicKey" placeholder="pk_live_...">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Stripe Secret Key</mat-label>
                  <input matInput [type]="hideStripeSecret ? 'password' : 'text'" formControlName="stripeSecretKey">
                  <button mat-icon-button matSuffix type="button" (click)="hideStripeSecret = !hideStripeSecret">
                    <mat-icon>{{ hideStripeSecret ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
            </div>

            <div class="section-title"><mat-icon>currency_exchange</mat-icon><span>Currency & Billing Preferences</span></div>
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
              <mat-icon>save</mat-icon> Save Payment Configuration
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 4: NOTIFICATIONS -->
      <div *ngIf="activeTab === 'NOTIFICATIONS'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box purple"><mat-icon>mark_email_read</mat-icon></div>
            <div>
              <h3>SMS, Email SMTP, WhatsApp & Push Notifications</h3>
              <p>Configure MSG91 OTP gateway, SendGrid / SMTP email delivery, and Firebase Cloud Messaging</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <!-- MSG91 SMS -->
            <div class="section-divider">
              <div class="divider-header">
                <h4><mat-icon>sms</mat-icon> MSG91 SMS OTP Gateway</h4>
                <button type="button" mat-stroked-button color="accent" class="test-btn" (click)="testGatewayConnection('SMS')">
                  <mat-icon>send</mat-icon> Test SMS OTP
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>MSG91 Auth Key</mat-label>
                  <input matInput [type]="hideMsg91AuthKey ? 'password' : 'text'" formControlName="msg91AuthKey">
                  <button mat-icon-button matSuffix type="button" (click)="hideMsg91AuthKey = !hideMsg91AuthKey">
                    <mat-icon>{{ hideMsg91AuthKey ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Sender ID (Header)</mat-label>
                  <input matInput formControlName="msg91SenderId" placeholder="MAXXPX" maxlength="6">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>MSG91 OTP Flow / Template ID</mat-label>
                  <input matInput formControlName="msg91TemplateId" placeholder="Enter MSG91 Template ID">
                </mat-form-field>
              </div>
              <div class="half-width">
                <div class="info-box-sm">
                  <mat-icon>verified</mat-icon>
                  <span>Flow template must have variables VAR1 or OTP mapped in MSG91 console.</span>
                </div>
              </div>
            </div>

            <!-- SMTP EMAIL -->
            <div class="section-divider">
              <div class="divider-header">
                <h4><mat-icon>mail</mat-icon> Transactional Email (SMTP)</h4>
                <button type="button" mat-stroked-button color="accent" class="test-btn" (click)="testGatewayConnection('EMAIL')">
                  <mat-icon>send</mat-icon> Test Email
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>SMTP Host</mat-label>
                  <input matInput formControlName="smtpHost" placeholder="smtp.sendgrid.net">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>From Email Address</mat-label>
                  <input matInput formControlName="smtpFromEmail" placeholder="no-reply@maxxpixels.com">
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Notification Settings
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 5: GOOGLE ADMOB & VAST -->
      <div *ngIf="activeTab === 'ADMOB'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box gold"><mat-icon>monetization_on</mat-icon></div>
            <div>
              <h3>Google AdMob & Video Advertising (VAST)</h3>
              <p>Configure mobile in-app banner, interstitial, rewarded ads, and video stream VAST tags</p>
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
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Google AdMob App ID</mat-label>
                  <input matInput formControlName="admobAppId" placeholder="ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX">
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
                  <input matInput formControlName="admobRewardedId">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>VAST 3.0 Ad Tag XML Endpoint</mat-label>
                  <input matInput formControlName="vastAdTagUrl" placeholder="/api/v1/ads/vast.xml">
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save AdMob & Advertising Settings
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 6: MAINTENANCE & FEATURE FLAGS -->
      <div *ngIf="activeTab === 'MAINTENANCE'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box"><mat-icon>construction</mat-icon></div>
            <div>
              <h3>Application Maintenance Mode & Feature Flags</h3>
              <p>Instantly put the platform into maintenance mode and toggle client features across Web, Android & TV</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <!-- Maintenance Mode Toggle -->
            <div class="toggles-card" style="border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05);">
              <h4 style="color: #ef4444; display: flex; align-items: center; gap: 8px;">
                <mat-icon>warning</mat-icon> Platform Maintenance Mode
              </h4>
              <div class="toggle-row">
                <div>
                  <span class="t-title">Enable Maintenance Mode</span>
                  <span class="t-desc">When active, clients receive HTTP 503 and custom notice. Admins can still log in and preview.</span>
                </div>
                <mat-slide-toggle formControlName="maintenanceMode" color="warn"></mat-slide-toggle>
              </div>
            </div>

            <div class="form-row">
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Custom Maintenance Message for End Users</mat-label>
                  <textarea matInput formControlName="maintenanceMessage" rows="2"></textarea>
                </mat-form-field>
              </div>
            </div>

            <div class="section-title"><mat-icon>flag</mat-icon><span>Cross-Platform Client Feature Flags</span></div>
            <div class="toggles-card">
              <div class="toggle-row">
                <div>
                  <span class="t-title">Offline Video Downloads</span>
                  <span class="t-desc">Permit encrypted offline downloads in Mobile App</span>
                </div>
                <mat-slide-toggle formControlName="featureDownloadsEnabled" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">Picture-in-Picture (PiP) & Background Playback</span>
                  <span class="t-desc">Allow floating player widget on mobile devices</span>
                </div>
                <mat-slide-toggle formControlName="featurePipEnabled" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">Smart TV Login Code</span>
                  <span class="t-desc">Allow Android TV users to link account via 6-digit PIN code</span>
                </div>
                <mat-slide-toggle formControlName="featureTvLoginEnabled" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">Kids Safe Profiles</span>
                  <span class="t-desc">Enable child-restricted profile mode with curated catalog</span>
                </div>
                <mat-slide-toggle formControlName="featureKidProfilesEnabled" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">PPV / Video Rentals (TVOD)</span>
                  <span class="t-desc">Allow users to rent individual movie titles without full subscription</span>
                </div>
                <mat-slide-toggle formControlName="featureRentalsEnabled" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">Interactive Games Catalog</span>
                  <span class="t-desc">Show HTML5 / APK games tab in Mobile and Web app</span>
                </div>
                <mat-slide-toggle formControlName="featureGamesEnabled" color="primary"></mat-slide-toggle>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Maintenance & Feature Flags
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 7: VIDEO PLAYER & PLAYBACK -->
      <div *ngIf="activeTab === 'PLAYER'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box blue"><mat-icon>play_circle</mat-icon></div>
            <div>
              <h3>Video Player & Playback Experience</h3>
              <p>Configure autoplay, dynamic anti-piracy watermarking, buffer limits, and default streaming resolutions</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="section-title"><mat-icon>high_quality</mat-icon><span>Stream Quality & Playback Defaults</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Default Stream Resolution</mat-label>
                  <mat-select formControlName="playerDefaultQuality" panelClass="custom-select-panel">
                    <mat-option value="AUTO">Auto (Adaptive Bitrate - ABR)</mat-option>
                    <mat-option value="1080p">1080p Full HD</mat-option>
                    <mat-option value="720p">720p HD</mat-option>
                    <mat-option value="480p">480p SD (Data Saver)</mat-option>
                    <mat-option value="4K">4K Ultra HD (Premium)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Watermark Overlay Text</mat-label>
                  <input matInput formControlName="playerWatermarkText" placeholder="MaxxPixels OTT">
                </mat-form-field>
              </div>
            </div>

            <div class="toggles-card">
              <div class="toggle-row">
                <div>
                  <span class="t-title">Autoplay Next Episode</span>
                  <span class="t-desc">Automatically cue up and start the next episode in a series</span>
                </div>
                <mat-slide-toggle formControlName="playerAutoplay" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">Dynamic Anti-Piracy Watermark</span>
                  <span class="t-desc">Render floating watermark over video player to deter screen recording</span>
                </div>
                <mat-slide-toggle formControlName="playerWatermarkEnabled" color="primary"></mat-slide-toggle>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Player Configuration
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 8: DEVICE & SECURITY RESTRICTIONS -->
      <div *ngIf="activeTab === 'RESTRICTIONS'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box purple"><mat-icon>devices</mat-icon></div>
            <div>
              <h3>Device Concurrency & Security Policies</h3>
              <p>Control multi-device logins, concurrent streaming limits, and session expiration</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="section-title"><mat-icon>security</mat-icon><span>User & Device Limitations</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Max Registered Devices per User</mat-label>
                  <input matInput type="number" formControlName="maxDevicesPerUser" min="1" max="10">
                  <mat-hint>Users must unlink an old device once this threshold is reached</mat-hint>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Max Simultaneous Active Streams</mat-label>
                  <input matInput type="number" formControlName="maxConcurrentStreamsPerUser" min="1" max="5">
                  <mat-hint>Maximum screens that can play simultaneously on a single subscription</mat-hint>
                </mat-form-field>
              </div>
            </div>

            <div class="toggles-card">
              <div class="toggle-row">
                <div>
                  <span class="t-title">Allow Screen Recording & Screenshots</span>
                  <span class="t-desc">Block screenshotting and screen recording via FLAG_SECURE on Android</span>
                </div>
                <mat-slide-toggle formControlName="allowScreenRecording" color="warn"></mat-slide-toggle>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save Device & Security Limits
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 9: GAMES & APK DISTRIBUTION -->
      <div *ngIf="activeTab === 'GAMES_APK'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box gold"><mat-icon>sports_esports</mat-icon></div>
            <div>
              <h3>Games Catalog & APK Distribution Management</h3>
              <p>Distribute mobile games and trigger OTA updates for sideloaded Android TV and Mobile APKs</p>
            </div>
          </div>

          <form [formGroup]="settingsForm" (ngSubmit)="onSaveSettings()" class="settings-form">
            <div class="section-title"><mat-icon>system_update</mat-icon><span>Mobile & TV App Version Management</span></div>
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Latest Android Version Code</mat-label>
                  <input matInput type="number" formControlName="apkLatestVersionCode" placeholder="12">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Latest Version Display Name</mat-label>
                  <input matInput formControlName="apkLatestVersionName" placeholder="1.2.0">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Direct APK Download URL</mat-label>
                  <input matInput type="url" formControlName="apkDownloadUrl" placeholder="https://.../maxxpixels-ott.apk">
                </mat-form-field>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn" type="submit" [disabled]="isSaving">
              <mat-icon>save</mat-icon> Save App Version & Games Config
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 10: CONFIGURATION AUDIT & ROLLBACK -->
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

  hideRazorpaySecret = true;
  hideStripeSecret = true;
  hideBunnyStoragePassword = true;
  hideBunnyStreamApiKey = true;
  hideS3Secret = true;
  hideMsg91AuthKey = true;

  settingsForm = this.fb.group({
    appName: ['MaxxPixels OTT', [Validators.required]],
    appShortName: ['MaxxPixels', [Validators.required, Validators.maxLength(30)]],
    companyName: ['MaxxPixels Entertainment Pvt Ltd', [Validators.required]],
    websiteUrl: ['https://maxxpixels.com', [Validators.required]],
    logoUrl: ['/branding/logo.png', [Validators.required]],
    darkLogoUrl: ['/branding/logo_dark.png'],
    faviconUrl: ['/branding/favicon.ico'],
    supportEmail: ['support@maxxpixels.com', [Validators.required]],
    supportPhone: ['+919999999999', [Validators.required]],
    supportWhatsapp: ['+919999999999'],
    supportUrl: ['https://maxxpixels.com/support', [Validators.required]],
    privacyPolicyUrl: ['https://maxxpixels.com/legal/privacy-policy', [Validators.required]],
    termsUrl: ['https://maxxpixels.com/legal/terms-of-service', [Validators.required]],
    companyAddress: ['Hyderabad, Telangana, India'],
    defaultTimezone: ['Asia/Kolkata', [Validators.required]],
    seoTitle: ['MaxxPixels OTT - Watch 4K Blockbusters, Originals & Live Shows', [Validators.required, Validators.maxLength(70)]],
    seoDescription: ['Stream movies, series and live entertainment on MaxxPixels.', [Validators.required, Validators.maxLength(170)]],
    androidAppUrl: ['https://play.google.com/store/apps/details?id=com.maxxpixels'],
    iosAppUrl: ['https://apps.apple.com/app/maxxpixels'],
    cdnBaseUrl: [''],
    defaultLanguage: ['en', [Validators.required]],
    defaultRegion: ['GLOBAL', [Validators.required]],

    // Storage (populated dynamically from backend settings)
    storageProvider: ['BUNNY', [Validators.required]],
    bunnyStorageZoneName: [''],
    bunnyStorageZonePassword: [''],
    bunnyStorageRegion: [''],
    bunnyCdnHostname: [''],
    bunnyStreamLibraryId: [''],
    bunnyStreamApiKey: [''],
    bunnyStreamCdnHostname: [''],
    s3MasterBucket: [''],
    s3StreamingBucket: [''],
    s3AwsRegion: [''],
    s3EndpointUrl: [''],
    s3AccessKey: [''],
    s3SecretKey: [''],

    // Payments
    paymentGatewayProvider: ['RAZORPAY', [Validators.required]],
    paymentProvider: ['RAZORPAY'],
    razorpayKeyId: [''],
    razorpayKeySecret: [''],
    stripePublicKey: [''],
    stripeSecretKey: [''],
    defaultCurrency: ['INR', [Validators.required]],
    autoRetryFailedRenewals: [true],

    // Notifications (populated dynamically from backend settings)
    smsProvider: ['MSG91', [Validators.required]],
    msg91AuthKey: [''],
    msg91SenderId: [''],
    msg91TemplateId: [''],
    smtpHost: [''],
    smtpPort: [587],
    smtpUsername: [''],
    smtpPassword: [''],
    smtpFromEmail: [''],
    smtpFromName: [''],
    fcmPushServerKey: [''],
    fcmProjectId: [''],

    // Ads (populated dynamically from backend settings)
    admobEnabled: ['false', [Validators.required]],
    admobTestMode: ['false'],
    admobAppId: [''],
    admobBannerId: [''],
    admobInterstitialId: [''],
    admobRewardedId: [''],
    admobAppOpenId: [''],
    vastAdTagUrl: ['/api/v1/ads/vast.xml'],

    // Maintenance & Feature Flags
    maintenanceMode: [false],
    maintenanceMessage: ['MaxxPixels OTT is currently undergoing scheduled platform upgrades. We will be back shortly.'],
    featureDownloadsEnabled: [true],
    featureWatchPartyEnabled: [true],
    featurePipEnabled: [true],
    featureCastingEnabled: [true],
    featureTvLoginEnabled: [true],
    featureKidProfilesEnabled: [true],
    featureRentalsEnabled: [true],
    featureGamesEnabled: [true],

    // Player
    playerAutoplay: [true],
    playerDefaultQuality: ['1080p'],
    playerWatermarkEnabled: [true],
    playerWatermarkText: ['MaxxPixels OTT'],

    // Restrictions
    maxDevicesPerUser: ['4'],
    maxConcurrentStreamsPerUser: ['2'],
    allowScreenRecording: [false],

    // Games & APK
    apkLatestVersionCode: ['12'],
    apkLatestVersionName: ['1.2.0'],
    apkDownloadUrl: ['https://maxxpixels.com/downloads/maxxpixels-ott-latest.apk']
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  private readonly booleanControlKeys = new Set<string>([
    'autoRetryFailedRenewals',
    'maintenanceMode',
    'featureDownloadsEnabled',
    'featureWatchPartyEnabled',
    'featurePipEnabled',
    'featureCastingEnabled',
    'featureTvLoginEnabled',
    'featureKidProfilesEnabled',
    'featureRentalsEnabled',
    'featureGamesEnabled',
    'playerAutoplay',
    'playerWatermarkEnabled',
    'allowScreenRecording',
  ]);

  private coerceSettingsPayload(raw: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...raw };
    for (const key of this.booleanControlKeys) {
      if (key in normalized && typeof normalized[key] === 'string') {
        normalized[key] = normalized[key].toLowerCase() === 'true' || normalized[key] === '1';
      }
    }
    if ('smtpPort' in normalized && typeof normalized['smtpPort'] === 'string') {
      const parsed = Number(normalized['smtpPort']);
      if (!Number.isNaN(parsed) && parsed > 0) {
        normalized['smtpPort'] = parsed;
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
        }
      },
      error: () => {
        this.notificationService.error('Failed to load system settings from backend.');
      }
    });
  }

  onBrandAssetUploaded(controlName: 'logoUrl' | 'darkLogoUrl' | 'faviconUrl', url: string): void {
    this.settingsForm.get(controlName)?.setValue(url);
    this.settingsForm.get(controlName)?.markAsDirty();
  }

  onSearchChange(): void {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) return;

    if (q.includes('bunny') || q.includes('s3') || q.includes('storage') || q.includes('cdn')) {
      this.activeTab = 'STORAGE';
    } else if (q.includes('pay') || q.includes('razorpay') || q.includes('stripe') || q.includes('currency')) {
      this.activeTab = 'PAYMENTS';
    } else if (q.includes('sms') || q.includes('mail') || q.includes('smtp') || q.includes('fcm') || q.includes('push')) {
      this.activeTab = 'NOTIFICATIONS';
    } else if (q.includes('ad') || q.includes('admob') || q.includes('vast') || q.includes('banner')) {
      this.activeTab = 'ADMOB';
    } else if (q.includes('maint') || q.includes('flag') || q.includes('download') || q.includes('casting')) {
      this.activeTab = 'MAINTENANCE';
    } else if (q.includes('player') || q.includes('watermark') || q.includes('quality') || q.includes('autoplay')) {
      this.activeTab = 'PLAYER';
    } else if (q.includes('device') || q.includes('screen') || q.includes('limit') || q.includes('concurrent')) {
      this.activeTab = 'RESTRICTIONS';
    } else if (q.includes('game') || q.includes('apk') || q.includes('version')) {
      this.activeTab = 'GAMES_APK';
    } else if (q.includes('hist') || q.includes('audit') || q.includes('rollback')) {
      this.activeTab = 'HISTORY';
      this.loadHistory();
    }
  }

  testBunnyStorageConnection(): void {
    const storageZone = this.settingsForm.value.bunnyStorageZoneName;
    const accessKey = this.settingsForm.value.bunnyStorageZonePassword;
    const region = this.settingsForm.value.bunnyStorageRegion;

    this.notificationService.info('Testing Bunny.net Storage connection...');
    this.http.post<any>(`${environment.apiBaseUrl}/admin/settings/test-bunny-storage`, {
      storageZone,
      accessKey,
      region
    }).subscribe({
      next: (res) => {
        const msg = res?.data?.message || res?.message || 'Bunny Storage connected successfully!';
        this.notificationService.success(`✅ ${msg}`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Storage connection test failed.';
        this.notificationService.error(`❌ ${msg}`);
      }
    });
  }

  testBunnyStreamConnection(): void {
    const libraryId = this.settingsForm.value.bunnyStreamLibraryId;
    const apiKey = this.settingsForm.value.bunnyStreamApiKey;

    this.notificationService.info('Testing Bunny.net Stream API connection...');
    this.http.post<any>(`${environment.apiBaseUrl}/admin/settings/test-bunny-stream`, {
      libraryId,
      apiKey
    }).subscribe({
      next: (res) => {
        const msg = res?.data?.message || res?.message || 'Bunny Stream authenticated successfully!';
        this.notificationService.success(`✅ ${msg}`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Bunny Stream connection failed.';
        this.notificationService.error(`❌ ${msg}`);
      }
    });
  }

  testS3Connection(): void {
    const bucket = this.settingsForm.value.s3MasterBucket;
    const region = this.settingsForm.value.s3AwsRegion;
    const accessKey = this.settingsForm.value.s3AccessKey;
    const secretKey = this.settingsForm.value.s3SecretKey;

    this.notificationService.info('Testing S3 Storage configuration...');
    this.http.post<any>(`${environment.apiBaseUrl}/admin/settings/test-s3`, {
      bucket,
      region,
      accessKey,
      secretKey
    }).subscribe({
      next: (res) => {
        const msg = res?.data?.message || res?.message || 'S3 configuration validated!';
        this.notificationService.success(`✅ ${msg}`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'S3 test failed.';
        this.notificationService.error(`❌ ${msg}`);
      }
    });
  }

  testRazorpayConnection(): void {
    const keyId = this.settingsForm.value.razorpayKeyId;
    const keySecret = this.settingsForm.value.razorpayKeySecret;

    this.notificationService.info('Testing Razorpay gateway authentication...');
    this.http.post<any>(`${environment.apiBaseUrl}/admin/settings/test-razorpay`, {
      keyId,
      keySecret
    }).subscribe({
      next: (res) => {
        const msg = res?.data?.message || res?.message || 'Razorpay authenticated successfully!';
        this.notificationService.success(`✅ ${msg}`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Razorpay authentication failed.';
        this.notificationService.error(`❌ ${msg}`);
      }
    });
  }

  testStripeConnection(): void {
    const publicKey = this.settingsForm.value.stripePublicKey;
    const secretKey = this.settingsForm.value.stripeSecretKey;

    this.notificationService.info('Testing Stripe gateway authentication...');
    this.http.post<any>(`${environment.apiBaseUrl}/admin/settings/test-stripe`, {
      publicKey,
      secretKey
    }).subscribe({
      next: (res) => {
        const msg = res?.data?.message || res?.message || 'Stripe authenticated successfully!';
        this.notificationService.success(`✅ ${msg}`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Stripe authentication failed.';
        this.notificationService.error(`❌ ${msg}`);
      }
    });
  }

  testGatewayConnection(channel: 'SMS' | 'EMAIL' | 'FCM'): void {
    this.notificationService.info(`Testing ${channel} Gateway ping...`);
    this.http.post<any>(`${environment.apiBaseUrl}/admin/notifications/test`, {
      channel,
      testTarget: this.settingsForm.value.supportPhone || '+919999999999',
      message: 'Test ping from MaxxPixels Settings Studio'
    }).subscribe({
      next: (res) => {
        const d = res?.data || res;
        this.notificationService.success(`✅ ${channel} Gateway Test: [${d.status || 'OK'}] ${d.details || 'Connected!'}`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Gateway connection failed';
        this.notificationService.error(`❌ ${channel} Gateway Error: ${msg}`);
      }
    });
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
