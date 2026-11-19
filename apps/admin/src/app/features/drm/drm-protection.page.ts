import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface DrmRule {
  id: number;
  drmType: string;
  securityLevel: string;
  licenseType: string;
  enforceHdcp22: boolean;
  dynamicKeyRotation: boolean;
  keyRotationIntervalMinutes: number;
  invisibleWatermarking: boolean;
  status: string;
}

@Component({
  selector: 'app-drm-protection-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatSlideToggleModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>lock</mat-icon> MULTI-DRM & ANTI-PIRACY PROTECTION</span>
          <h1>Content DRM License Server & Watermark Studio</h1>
          <p>Super Admin protection rules for Google Widevine L1, Apple FairPlay, Microsoft PlayReady, HDCP 2.2, and dynamic video watermarking</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" class="save-btn" (click)="saveAllDrmRules()">
            <mat-icon>security</mat-icon> Save Multi-DRM Security Policies
          </button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>verified_user</mat-icon></div>
          <div>
            <span class="kpi-label">Multi-DRM Protection</span>
            <div class="kpi-val text-green">Widevine • FairPlay • PlayReady</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>high_quality</mat-icon></div>
          <div>
            <span class="kpi-label">HDCP Hardware Enforcement</span>
            <div class="kpi-val">HDCP 2.2 Active (4K UHD)</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>sync</mat-icon></div>
          <div>
            <span class="kpi-label">Dynamic Key Rotation</span>
            <div class="kpi-val font-mono">10 Min Key Refresh</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>branding_watermark</mat-icon></div>
          <div>
            <span class="kpi-label">Forensic Watermarking</span>
            <div class="kpi-val font-mono">User IP & Token Burned</div>
          </div>
        </div>
      </div>

      <!-- 3. DRM ENGINE RULES MATRIX CARDS -->
      <div class="rules-grid">
        <div class="rule-card" *ngFor="let rule of drmRules">
          <div class="rule-header">
            <div class="rule-icon-box"><mat-icon>lock</mat-icon></div>
            <div>
              <h3>{{ rule.drmType }}</h3>
              <span class="sec-level font-mono">{{ rule.securityLevel }}</span>
            </div>
            <app-status-badge [status]="rule.status"></app-status-badge>
          </div>

          <div class="rule-toggles">
            <div class="t-row">
              <div>
                <span class="t-label">Enforce HDCP 2.2 Hardware Rule</span>
                <span class="t-sub">Blocks HDMI video capture and screen recording</span>
              </div>
              <mat-slide-toggle [(ngModel)]="rule.enforceHdcp22" color="primary"></mat-slide-toggle>
            </div>

            <div class="t-row">
              <div>
                <span class="t-label">Dynamic AES-128 Key Rotation</span>
                <span class="t-sub">Rotate encryption keys every {{ rule.keyRotationIntervalMinutes }} minutes</span>
              </div>
              <mat-slide-toggle [(ngModel)]="rule.dynamicKeyRotation" color="primary"></mat-slide-toggle>
            </div>

            <div class="t-row">
              <div>
                <span class="t-label">Dynamic Forensic Watermarking</span>
                <span class="t-sub">Embed invisible user IP and session JWT into video frames</span>
              </div>
              <mat-slide-toggle [(ngModel)]="rule.invisibleWatermarking" color="primary"></mat-slide-toggle>
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
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 6px;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: #ffffff; }
      p { color: #a0a0b0; margin: 0; font-size: 13px; }

      .save-btn {
        height: 44px;
        border-radius: 10px;
        font-weight: 800;
        font-size: 13px;
        background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 4px 16px rgba(26, 76, 216, 0.35);
      }
    }

    /* KPI CARDS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: rgba(22, 22, 34, 0.8);
      border: 1px solid #28283c;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);

      .kpi-icon {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: #1c1c2b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .kpi-label { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 2px; }
      .kpi-val { font-size: 18px; font-weight: 700; color: #ffffff; }
      .text-green { color: #00e676; }
      .font-mono { font-family: monospace; font-size: 13px; color: #00d2ff; }

      &.green .kpi-icon { color: #00e676; background: rgba(0, 230, 118, 0.12); }
      &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
      &.purple .kpi-icon { color: #ab47bc; background: rgba(171, 71, 188, 0.12); }
    }

    /* RULES GRID */
    .rules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 20px;
    }

    .rule-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      .rule-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        border-bottom: 1px solid #202030;
        padding-bottom: 16px;

        .rule-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(26, 76, 216, 0.18);
          color: #00d2ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        h3 { margin: 0 0 2px; font-size: 16px; font-weight: 800; color: #ffffff; }
        .sec-level { font-size: 11px; color: #ffab00; }
      }

      .rule-toggles {
        display: flex;
        flex-direction: column;
        gap: 14px;

        .t-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #101018;
          border: 1px solid #202030;
          padding: 12px 14px;
          border-radius: 10px;

          .t-label { font-size: 13px; font-weight: 700; color: #ffffff; display: block; }
          .t-sub { font-size: 11px; color: #a0a0b0; display: block; }
        }
      }
    }
  `]
})
export class DrmProtectionPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  drmRules: DrmRule[] = [
    {
      id: 1,
      drmType: 'Google Widevine Modular (L1/L3)',
      securityLevel: 'WIDEVINE_L1_HARDWARE_SECURE',
      licenseType: 'STREAM_RENTAL',
      enforceHdcp22: true,
      dynamicKeyRotation: true,
      keyRotationIntervalMinutes: 10,
      invisibleWatermarking: true,
      status: 'ACTIVE'
    },
    {
      id: 2,
      drmType: 'Apple FairPlay Streaming (FPS)',
      securityLevel: 'SECURE_ENCLAVE_FPS_HARDWARE',
      licenseType: 'STREAM_ONLY',
      enforceHdcp22: true,
      dynamicKeyRotation: true,
      keyRotationIntervalMinutes: 15,
      invisibleWatermarking: true,
      status: 'ACTIVE'
    },
    {
      id: 3,
      drmType: 'Microsoft PlayReady (SL3000)',
      securityLevel: 'PLAYREADY_SL3000_HARDWARE',
      licenseType: 'STREAM_RENTAL',
      enforceHdcp22: true,
      dynamicKeyRotation: true,
      keyRotationIntervalMinutes: 10,
      invisibleWatermarking: true,
      status: 'ACTIVE'
    }
  ];

  ngOnInit(): void {
    this.loadDrmRules();
  }

  loadDrmRules(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/drm/rules`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          this.drmRules = res.data;
        }
      }
    });
  }

  saveAllDrmRules(): void {
    this.http.post<any>(`${environment.apiBaseUrl}/admin/drm/rules`, this.drmRules).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.drmRules = res.data;
        }
        this.notificationService.success('Multi-DRM Protection Rules & Watermark Policies saved successfully!');
      },
      error: () => {
        this.notificationService.error('Failed to save DRM policies to server');
      }
    });
  }
}
