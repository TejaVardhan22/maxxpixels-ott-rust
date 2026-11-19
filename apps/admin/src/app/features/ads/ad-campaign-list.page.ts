import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { RuntimeConfigService } from '../../core/services/runtime-config.service';
import { environment } from '../../../environments/environment';

export interface AdCampaignDto {
  id?: number;
  campaignName: string;
  advertiserName: string;
  vastTagUrl: string;
  videoUrl?: string;
  streamVideoId?: string;
  thumbnailUrl?: string;
  adBreakType: string; // PRE_ROLL, MID_ROLL, POST_ROLL, OVERLAY_BANNER
  durationSeconds: number;
  cpmRate: number;
  impressionsTarget: number;
  impressionsDelivered: number;
  totalBudget: number;
  spentBudget: number;
  targetDevices: string;
  status: string;
  clickUrl?: string;
  provider?: string;
}

@Component({
  selector: 'app-ad-campaign-list-page',
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
    MatTooltipModule,
    MatProgressBarModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>slideshow</mat-icon> SSAI AD CAMPAIGN & BUNNY STREAM VAST 4.2 ENGINE</span>
          <h1>Server-Side Ad Insertion (SSAI) & Ad Video Stream Studio</h1>
          <p>Upload Ad Videos directly to Bunny.net Stream Video Library, manage VAST 4.2 ad pods, CPM bidding, and live telemetry</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" class="add-btn" (click)="openCreateModal()">
            <mat-icon>cloud_upload</mat-icon> Upload & Create Ad Campaign
          </button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>campaign</mat-icon></div>
          <div>
            <span class="kpi-label">Active SSAI Ad Campaigns</span>
            <div class="kpi-val">{{ campaigns.length }} Campaigns Live</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>analytics</mat-icon></div>
          <div>
            <span class="kpi-label">Total Stitched Ad Impressions</span>
            <div class="kpi-val">{{ getTotalDelivered() | number }} Impressions</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>monetization_on</mat-icon></div>
          <div>
            <span class="kpi-label">Average Effective CPM Rate</span>
            <div class="kpi-val">{{ getAvgCpm() | currency:'INR':'symbol':'1.2-2' }} / 1k</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>payments</mat-icon></div>
          <div>
            <span class="kpi-label">Total Ad Revenue Delivered</span>
            <div class="kpi-val font-mono">{{ getTotalRevenue() | currency:'INR':'symbol':'1.2-2' }}</div>
          </div>
        </div>
      </div>

      <!-- 3. SEARCH & TYPE FILTERS -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Ad Break Type:</span>
          <button class="filter-pill" [class.active]="selectedType === 'ALL'" (click)="setTypeFilter('ALL')">All Ad Pods</button>
          <button class="filter-pill" [class.active]="selectedType === 'PRE_ROLL'" (click)="setTypeFilter('PRE_ROLL')">▶️ Pre-Roll (Start)</button>
          <button class="filter-pill" [class.active]="selectedType === 'MID_ROLL'" (click)="setTypeFilter('MID_ROLL')">⏸️ Mid-Roll (Cue Points)</button>
          <button class="filter-pill" [class.active]="selectedType === 'POST_ROLL'" (click)="setTypeFilter('POST_ROLL')">⏹️ Post-Roll (End)</button>
        </div>

        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="filterCampaigns()" placeholder="Search campaign name, advertiser...">
        </div>
      </div>

      <!-- 4. AD CAMPAIGNS TABLE -->
      <div class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Live VAST/VMAP Ad Campaign Bidding & Stream Delivery</h3>
            <p>Real-time server-side ad stitching, Bunny.net Stream video delivery, CPM rates, and budget pacing</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
          <thead>
            <tr>
              <th>Campaign & Advertiser Name</th>
              <th>Video Stream Source</th>
              <th>Ad Break & Duration</th>
              <th>CPM Rate</th>
              <th>Impression Delivery</th>
              <th>Budget Delivered</th>
              <th>Status</th>
              <th style="text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="filteredCampaigns.length === 0">
              <td colspan="8" style="text-align: center; padding: 48px 16px; color: #a0a0b0;">
                <mat-icon style="font-size: 40px; width: 40px; height: 40px; color: #3b3b55; margin-bottom: 8px;">campaign</mat-icon>
                <div style="font-size: 15px; font-weight: 700; color: #ffffff;">No Ad Campaigns Found</div>
                <div style="font-size: 12px; margin-top: 4px; color: #8e8ea0;">Click "Upload & Create Ad Campaign" above to launch your first SSAI ad creative.</div>
              </td>
            </tr>
            <tr *ngFor="let item of filteredCampaigns">
              <td>
                <div class="campaign-cell">
                  <span class="c-name">{{ item.campaignName }}</span>
                  <span class="c-adv"><mat-icon>storefront</mat-icon> {{ item.advertiserName }}</span>
                </div>
              </td>
              <td>
                <div class="stream-source-cell">
                  <span class="provider-badge" [class.bunny]="item.videoUrl?.includes('.b-cdn.net') || item.provider === 'BUNNY_STREAM'">
                    <mat-icon>stream</mat-icon> {{ (item.videoUrl?.includes('.b-cdn.net') || item.provider === 'BUNNY_STREAM') ? 'Bunny Stream' : 'VAST Tag' }}
                  </span>
                  <div class="stream-btn-row">
                    <button *ngIf="item.videoUrl" type="button" class="preview-chip" (click)="openPreviewModal(item)">
                      <mat-icon>play_circle</mat-icon> Play
                    </button>
                    <button type="button" class="vast-tag-chip" (click)="copyVastUrl(item)" matTooltip="Click to copy IAB VAST 4.2 XML URL">
                      <mat-icon>content_copy</mat-icon> Copy VAST
                    </button>
                    <a [href]="getVastUrl(item)" target="_blank" class="vast-xml-chip" matTooltip="Open VAST 4.2 XML in new tab">
                      <mat-icon>open_in_new</mat-icon> XML
                    </a>
                  </div>
                </div>
              </td>
              <td>
                <div class="break-badge">
                  <span class="b-type">{{ item.adBreakType }}</span>
                  <span class="b-dur">{{ item.durationSeconds }}s</span>
                </div>
              </td>
              <td>
                <span class="cpm-val font-mono">{{ item.cpmRate | currency:'INR':'symbol':'1.2-2' }} CPM</span>
              </td>
              <td>
                <div class="delivery-progress font-mono">
                  <span>{{ item.impressionsDelivered | number }} / {{ item.impressionsTarget | number }}</span>
                  <div class="bar-bg">
                    <div class="bar-fill" [style.width.%]="(item.impressionsDelivered / item.impressionsTarget) * 100"></div>
                  </div>
                </div>
              </td>
              <td>
                <span class="budget-text font-mono">{{ item.spentBudget | currency:'INR':'symbol':'1.2-2' }}</span>
              </td>
              <td>
                <app-status-badge [status]="item.status"></app-status-badge>
              </td>
              <td style="text-align: right;">
                <div class="action-btn-group">
                  <button mat-stroked-button color="primary" class="toggle-btn" (click)="toggleStatus(item)">
                    <mat-icon>{{ item.status === 'ACTIVE' ? 'pause' : 'play_arrow' }}</mat-icon> {{ item.status === 'ACTIVE' ? 'Pause' : 'Resume' }}
                  </button>
                  <button mat-icon-button color="warn" class="delete-btn" (click)="deleteCampaign(item)" matTooltip="Delete Campaign">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      <!-- 5. CREATE / UPLOAD AD CAMPAIGN MODAL -->
      <div class="modal-backdrop" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>cloud_upload</mat-icon></div>
            <div>
              <h2>Upload Ad Video & Launch Campaign</h2>
              <p>Upload ad creative directly to Bunny.net Stream or provide a custom VAST 4.2 XML URL</p>
            </div>
            <button mat-icon-button (click)="closeModal()" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>

          <!-- AD CREATIVE METHOD SWITCHER -->
          <div class="creative-tabs">
            <button type="button" class="tab-btn" [class.active]="creativeTab === 'UPLOAD'" (click)="creativeTab = 'UPLOAD'">
              <mat-icon>cloud_upload</mat-icon> Direct Video Upload (Bunny Stream)
            </button>
            <button type="button" class="tab-btn" [class.active]="creativeTab === 'VAST_URL'" (click)="creativeTab = 'VAST_URL'">
              <mat-icon>link</mat-icon> Custom VAST 4.2 URL
            </button>
          </div>

          <form [formGroup]="campaignForm" (ngSubmit)="onSaveCampaign()" class="modal-form">
            
            <!-- SECTION A: DIRECT BUNNY STREAM VIDEO UPLOADER -->
            <div *ngIf="creativeTab === 'UPLOAD'" class="bunny-upload-section">
              <div class="section-title">
                <mat-icon color="accent">movie</mat-icon> Ad Video File (Uploaded to Bunny.net Stream Video Library)
              </div>

              <!-- Upload Zone / Drop Area -->
              <div class="upload-dropzone" *ngIf="!uploadedAdVideoUrl && !uploadingAdVideo">
                <input type="file" #adVideoFileInput (change)="onAdVideoSelected($event)" style="display: none" accept="video/mp4,video/quicktime,video/webm,video/m4v">
                <div class="drop-content">
                  <div class="icon-circle"><mat-icon>cloud_upload</mat-icon></div>
                  <h4>Select Ad Video File to Stream via Bunny.net</h4>
                  <p>Supports MP4, MOV, WEBM (H.264 / AAC, 1080p, 4K). Binary uploads directly to Bunny Stream Library.</p>
                  <button type="button" mat-raised-button color="accent" class="btn-choose-file" (click)="adVideoFileInput.click()">
                    <mat-icon>attach_file</mat-icon> Choose Video File
                  </button>
                </div>
              </div>

              <!-- Upload In-Progress State -->
              <div class="upload-progress-box" *ngIf="uploadingAdVideo">
                <div class="prog-header">
                  <span><mat-icon class="spin">sync</mat-icon> Uploading Video Binary to Bunny.net Stream Video Library...</span>
                  <span class="prog-pct">{{ uploadProgress }}%</span>
                </div>
                <mat-progress-bar mode="determinate" [value]="uploadProgress" class="prog-bar"></mat-progress-bar>
                <div class="prog-footer">Please do not close this window while the stream asset is encoding.</div>
              </div>

              <!-- Upload Success & Video Stream Preview -->
              <div class="uploaded-video-card" *ngIf="(uploadedAdVideoUrl || localFileBlobUrl) && !uploadingAdVideo">
                <div class="card-left">
                  <div class="badge-row">
                    <span class="bunny-live-badge"><mat-icon>verified</mat-icon> {{ uploadedAdVideoUrl ? 'Bunny.net Stream Live' : 'Ready to Stream' }}</span>
                    <span *ngIf="uploadedVideoId" class="guid-badge">ID: {{ uploadedVideoId.slice(0, 8) }}...</span>
                  </div>
                  <div class="url-display" *ngIf="uploadedAdVideoUrl">
                    <label>Bunny CDN Stream URL:</label>
                    <code>{{ uploadedAdVideoUrl }}</code>
                  </div>
                  <div class="reupload-row">
                    <input type="file" #reuploadInput (change)="onAdVideoSelected($event)" style="display: none" accept="video/*">
                    <button type="button" mat-stroked-button class="reupload-btn" (click)="reuploadInput.click()">
                      <mat-icon>refresh</mat-icon> Replace Video
                    </button>
                  </div>
                </div>

                <!-- Interactive Mini Player -->
                <div class="card-right">
                  <video [src]="localFileBlobUrl || uploadedAdVideoUrl" controls class="mini-player" preload="metadata"></video>
                </div>
              </div>
            </div>

            <!-- SECTION B: COMMON CAMPAIGN METADATA -->
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Campaign Name *</mat-label>
                  <input matInput formControlName="campaignName" placeholder="e.g. Samsung Galaxy S26 Cinema Launch" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Advertiser Name *</mat-label>
                  <input matInput formControlName="advertiserName" placeholder="e.g. Samsung Electronics" required>
                </mat-form-field>
              </div>
            </div>

            <!-- VAST URL / DESTINATION -->
            <div class="form-row">
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>VAST 4.2 / SSAI Delivery URL *</mat-label>
                  <input matInput formControlName="vastTagUrl" placeholder="http://localhost:8080/api/v1/ads/vast.xml" required>
                  <button type="button" mat-icon-button matSuffix (click)="generateFormVastUrl()" matTooltip="Auto-generate dynamic VAST 4.2 XML URL" style="color: #6366f1;">
                    <mat-icon>auto_fix_high</mat-icon>
                  </button>
                </mat-form-field>
                <div class="field-hint-row">
                  <span>Dynamic IAB VAST 4.2 URL compatible with Google IMA, ExoPlayer, Apple AVPlayer, and OTT SSAI stitchers.</span>
                  <button type="button" class="link-btn" (click)="generateFormVastUrl()">
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">auto_fix_high</mat-icon> Auto-Generate VAST URL
                  </button>
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Ad Break Slot *</mat-label>
                  <mat-select formControlName="adBreakType" panelClass="custom-select-panel" required>
                    <mat-option value="PRE_ROLL">▶️ Pre-Roll (Stream Start)</mat-option>
                    <mat-option value="MID_ROLL">⏸️ Mid-Roll (Cue Points)</mat-option>
                    <mat-option value="POST_ROLL">⏹️ Post-Roll (Stream End)</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Ad Spot Duration (Seconds) *</mat-label>
                  <input matInput type="number" formControlName="durationSeconds" placeholder="30" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>CPM Rate ($ per 1k Impressions) *</mat-label>
                  <input matInput type="number" formControlName="cpmRate" placeholder="18.50" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Target Impression Count *</mat-label>
                  <input matInput type="number" formControlName="impressionsTarget" placeholder="2500000" required>
                </mat-form-field>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" mat-stroked-button (click)="closeModal()">Cancel</button>
              <button type="submit" mat-raised-button class="submit-btn" [disabled]="campaignForm.invalid || uploadingAdVideo">
                <mat-icon>campaign</mat-icon> Launch SSAI Ad Campaign
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- 6. VIDEO PREVIEW MODAL -->
      <div class="modal-backdrop" *ngIf="showPreviewModal" (click)="closePreviewModal()">
        <div class="modal-card preview-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>play_circle</mat-icon></div>
            <div>
              <h2>Ad Stream Preview: {{ previewModalTitle }}</h2>
              <p>Bunny.net Stream 4K Edge Delivery & Adaptive Player</p>
            </div>
            <button mat-icon-button (click)="closePreviewModal()" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>

          <!-- PLAYER MODE TOGGLES -->
          <div class="preview-mode-bar" *ngIf="previewModalEmbedUrl">
            <button type="button" class="mode-btn" [class.active]="previewPlayerMode === 'EMBED'" (click)="previewPlayerMode = 'EMBED'">
              <mat-icon>tv</mat-icon> Bunny Stream Edge Player
            </button>
            <button type="button" class="mode-btn" [class.active]="previewPlayerMode === 'DIRECT'" (click)="previewPlayerMode = 'DIRECT'">
              <mat-icon>movie</mat-icon> Direct Video File (MP4)
            </button>
          </div>

          <div class="preview-player-container">
            <!-- EMBED PLAYER -->
            <iframe
              *ngIf="previewPlayerMode === 'EMBED' && previewModalEmbedUrl"
              [src]="previewModalEmbedUrl"
              class="full-preview-iframe"
              loading="lazy"
              allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
              allowfullscreen="true">
            </iframe>

            <!-- DIRECT HTML5 VIDEO PLAYER -->
            <video
              *ngIf="previewPlayerMode === 'DIRECT' || !previewModalEmbedUrl"
              [src]="previewModalUrl"
              controls
              autoplay
              (error)="onPreviewVideoError()"
              class="full-preview-player"
              preload="auto">
            </video>
          </div>

          <div class="preview-footer">
            <div class="stream-url-info">
              <span>Source URL:</span>
              <code>{{ previewModalUrl }}</code>
            </div>
            <a [href]="previewModalUrl" target="_blank" rel="noopener noreferrer" class="external-btn">
              <mat-icon>open_in_new</mat-icon> Open in New Tab
            </a>
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

      .add-btn {
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
      .font-mono { font-family: monospace; font-size: 18px; color: #00e676; }

      &.green .kpi-icon { color: #00e676; background: rgba(0, 230, 118, 0.12); }
      &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
      &.purple .kpi-icon { color: #ab47bc; background: rgba(171, 71, 188, 0.12); }
    }

    /* FILTER BAR */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        .filter-label { font-size: 13px; color: #a0a0b0; font-weight: 600; margin-right: 4px; }
        .filter-pill {
          background: #1c1c2b;
          border: 1px solid #28283c;
          color: #a0a0b0;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover { border-color: #00d2ff; color: #ffffff; }
          &.active {
            background: rgba(26, 76, 216, 0.2);
            border-color: #1a4cd8;
            color: #00d2ff;
            font-weight: 700;
          }
        }
      }

      .search-box {
        position: relative;
        display: flex;
        align-items: center;
        min-width: 260px;
        .search-icon { position: absolute; left: 12px; color: #a0a0b0; font-size: 18px; width: 18px; height: 18px; }
        input {
          width: 100%;
          background: #11111a;
          border: 1px solid #28283c;
          border-radius: 8px;
          padding: 8px 12px 8px 38px;
          color: #ffffff;
          font-size: 13px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
      }
    }

    /* TABLE */
    .table-card {
      background: rgba(22, 22, 34, 0.8);
      border: 1px solid #28283c;
      border-radius: 14px;
      padding: 20px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);

      .table-title-row {
        margin-bottom: 16px;
        h3 { font-size: 18px; font-weight: 800; margin: 0 0 2px; color: #ffffff; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }

      .custom-table {
        width: 100%;
        min-width: 1050px;
        border-collapse: collapse;
        th {
          text-align: left;
          font-size: 12px;
          font-weight: 700;
          color: #a0a0b0;
          padding: 12px 14px;
          border-bottom: 1px solid #28283c;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        td {
          padding: 14px;
          border-bottom: 1px solid #1c1c2b;
          font-size: 13px;
          vertical-align: middle;
          white-space: nowrap;
        }

        .campaign-cell {
          .c-name { display: block; font-weight: 700; color: #ffffff; margin-bottom: 4px; }
          .c-adv {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            color: #00d2ff;
            font-size: 11px;
            font-weight: 600;
            mat-icon { font-size: 13px; width: 13px; height: 13px; }
          }
        }

        .stream-source-cell {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-start;

          .provider-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            background: rgba(255, 255, 255, 0.08);
            color: #a0a0b0;
            mat-icon { font-size: 13px; width: 13px; height: 13px; }

            &.bunny {
              background: rgba(255, 122, 0, 0.15);
              color: #ff9800;
              border: 1px solid rgba(255, 152, 0, 0.3);
            }
          }

          .stream-btn-row {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
          }

          .preview-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: #1c1c2e;
            border: 1px solid #2a2a44;
            color: #00d2ff;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            cursor: pointer;
            &:hover { background: rgba(0, 210, 255, 0.15); border-color: #00d2ff; }
            mat-icon { font-size: 14px; width: 14px; height: 14px; }
          }

          .vast-tag-chip {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: rgba(99, 102, 241, 0.15);
            border: 1px solid rgba(99, 102, 241, 0.4);
            color: #818cf8;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s ease;
            &:hover { background: rgba(99, 102, 241, 0.3); border-color: #818cf8; color: #ffffff; }
            mat-icon { font-size: 13px; width: 13px; height: 13px; }
          }

          .vast-xml-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #34d399;
            font-size: 11px;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 6px;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s ease;
            &:hover { background: rgba(16, 185, 129, 0.25); border-color: #34d399; color: #ffffff; }
            mat-icon { font-size: 13px; width: 13px; height: 13px; }
          }
        }

        .break-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #1c1c2b;
          border: 1px solid #28283c;
          border-radius: 6px;
          padding: 4px 8px;
          .b-type { font-weight: 700; color: #ffffff; font-size: 11px; }
          .b-dur { color: #ffab00; font-weight: 700; font-size: 11px; font-family: monospace; }
        }

        .cpm-val { font-size: 14px; font-weight: 700; color: #00e676; }
        .budget-text { font-size: 14px; font-weight: 700; color: #ffffff; }

        .delivery-progress {
          width: 150px;
          span { font-size: 11px; color: #a0a0b0; margin-bottom: 4px; display: block; }
          .bar-bg {
            height: 6px;
            background: #1c1c2b;
            border-radius: 3px;
            overflow: hidden;
            .bar-fill { height: 100%; background: linear-gradient(90deg, #1a4cd8, #00d2ff); border-radius: 3px; }
          }
        }

        .action-btn-group {
          display: flex;
          justify-content: flex-end;
          gap: 6px;
          .toggle-btn {
            height: 32px;
            font-size: 11px;
            font-weight: 700;
            mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          }
        }
      }
    }

    /* MODAL */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;

      .modal-card {
        background: #161624;
        border: 1px solid #28283c;
        border-radius: 16px;
        width: 100%;
        max-width: 680px;
        max-height: 90vh;
        overflow-y: auto;
        padding: 24px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);

        .modal-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 20px;
          position: relative;
          .header-icon-box {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(26,76,216,0.2), rgba(199,37,163,0.2));
            display: flex;
            align-items: center;
            justify-content: center;
            color: #00d2ff;
          }
          h2 { margin: 0 0 2px; font-size: 20px; font-weight: 800; }
          p { margin: 0; font-size: 12px; color: #a0a0b0; }
          .close-btn { position: absolute; right: 0; top: 0; color: #a0a0b0; }
        }

        .creative-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          .tab-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 14px;
            border-radius: 10px;
            background: #11111c;
            border: 1px solid #28283c;
            color: #a0a0b0;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            mat-icon { font-size: 18px; width: 18px; height: 18px; }
            &.active {
              background: rgba(0, 210, 255, 0.1);
              border-color: #00d2ff;
              color: #00d2ff;
            }
          }
        }

        /* BUNNY UPLOAD SECTION */
        .bunny-upload-section {
          background: #11111c;
          border: 1px solid #28283c;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 20px;

          .section-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 12px;
          }

          .upload-dropzone {
            border: 2px dashed #2a2a44;
            border-radius: 10px;
            padding: 24px;
            text-align: center;
            background: rgba(0, 0, 0, 0.2);
            .icon-circle {
              width: 50px;
              height: 50px;
              border-radius: 50%;
              background: rgba(0, 210, 255, 0.1);
              color: #00d2ff;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 12px;
            }
            h4 { margin: 0 0 6px; font-size: 14px; font-weight: 700; }
            p { font-size: 11px; color: #a0a0b0; margin: 0 0 16px; }
            .btn-choose-file {
              font-weight: 700;
              font-size: 12px;
              height: 38px;
              background-color: #1a4cd8 !important;
            }
          }

          .upload-progress-box {
            padding: 16px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 10px;
            .prog-header {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              font-weight: 700;
              color: #00d2ff;
              margin-bottom: 8px;
              span { display: flex; align-items: center; gap: 6px; }
              .spin { animation: spin 1s linear infinite; font-size: 16px; width: 16px; height: 16px; }
            }
            .prog-bar { height: 8px; border-radius: 4px; margin-bottom: 8px; }
            .prog-footer { font-size: 11px; color: #a0a0b0; text-align: center; }
          }

          .uploaded-video-card {
            display: flex;
            gap: 14px;
            align-items: center;
            background: rgba(0, 230, 118, 0.05);
            border: 1px solid rgba(0, 230, 118, 0.3);
            border-radius: 10px;
            padding: 14px;

            .card-left {
              flex: 1;
              min-width: 0;
              .badge-row {
                display: flex;
                gap: 8px;
                align-items: center;
                margin-bottom: 8px;
                .bunny-live-badge {
                  display: inline-flex;
                  align-items: center;
                  gap: 4px;
                  background: rgba(0, 230, 118, 0.2);
                  color: #00e676;
                  font-size: 11px;
                  font-weight: 800;
                  padding: 2px 8px;
                  border-radius: 6px;
                  mat-icon { font-size: 14px; width: 14px; height: 14px; }
                }
                .guid-badge { font-size: 10px; color: #a0a0b0; font-family: monospace; }
              }
              .url-display {
                margin-bottom: 10px;
                label { display: block; font-size: 11px; color: #a0a0b0; margin-bottom: 2px; }
                code { font-size: 11px; color: #ffffff; word-break: break-all; font-family: monospace; display: block; }
              }
              .reupload-btn {
                height: 30px;
                font-size: 11px;
                mat-icon { font-size: 14px; width: 14px; height: 14px; }
              }
            }

            .card-right {
              width: 140px;
              height: 80px;
              border-radius: 8px;
              overflow: hidden;
              background: #000;
              flex-shrink: 0;
              .mini-player { width: 100%; height: 100%; object-fit: cover; }
            }
          }
        }

        .modal-form {
          .full-width { width: 100%; margin-bottom: 14px; display: block; }
          .form-row { display: flex; gap: 14px; flex-wrap: wrap; }
          .half-width { flex: 1; min-width: 240px; }

          .field-hint-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: -12px;
            margin-bottom: 14px;
            font-size: 11px;
            color: #8e8ea0;
            gap: 8px;
            flex-wrap: wrap;

            .link-btn {
              background: none;
              border: none;
              color: #818cf8;
              font-weight: 700;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 0;
              font-size: 11px;
              &:hover { text-decoration: underline; color: #a5b4fc; }
            }
          }

          .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 16px;
            .submit-btn {
              background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
              color: #ffffff !important;
              font-weight: 800;
              padding: 0 20px;
              height: 44px;
              border-radius: 10px;
            }
          }
        }
      }

      .preview-modal {
        max-width: 840px;
        width: 100%;

        .preview-mode-bar {
          display: flex;
          gap: 10px;
          margin-bottom: 12px;
          .mode-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #11111c;
            border: 1px solid #28283c;
            color: #a0a0b0;
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &.active {
              background: rgba(0, 210, 255, 0.15);
              border-color: #00d2ff;
              color: #00d2ff;
            }
          }
        }

        .preview-player-container {
          background: #000;
          border-radius: 12px;
          overflow: hidden;
          width: 100%;
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          border: 1px solid #28283c;

          .full-preview-player {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }

          .full-preview-iframe {
            width: 100%;
            height: 100%;
            border: 0;
          }
        }

        .preview-footer {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;

          .stream-url-info {
            flex: 1;
            min-width: 240px;
            span { font-size: 11px; color: #a0a0b0; display: block; margin-bottom: 2px; }
            code { font-size: 11px; color: #00e676; font-family: monospace; word-break: break-all; }
          }

          .external-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            color: #00d2ff;
            font-size: 12px;
            font-weight: 700;
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 8px;
            background: rgba(0, 210, 255, 0.1);
            border: 1px solid rgba(0, 210, 255, 0.3);
            transition: all 0.2s ease;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { background: rgba(0, 210, 255, 0.2); }
          }
        }
      }
    }

    @keyframes spin { 100% { transform: rotate(360deg); } }
  `]
})
export class AdCampaignListPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly sanitizer = inject(DomSanitizer);

  campaigns: AdCampaignDto[] = [];
  filteredCampaigns: AdCampaignDto[] = [];
  selectedType = 'ALL';
  searchQuery = '';
  showModal = false;
  creativeTab: 'UPLOAD' | 'VAST_URL' = 'UPLOAD';

  uploadingAdVideo = false;
  uploadProgress = 0;
  uploadedAdVideoUrl = '';
  uploadedHlsUrl = '';
  uploadedVideoId = '';
  uploadedThumbnailUrl = '';
  localFileBlobUrl = '';

  showPreviewModal = false;
  previewModalUrl = '';
  previewModalEmbedUrl: SafeResourceUrl | null = null;
  previewPlayerMode: 'DIRECT' | 'EMBED' = 'EMBED';
  previewModalTitle = '';

  campaignForm = this.fb.group({
    campaignName: ['', [Validators.required]],
    advertiserName: ['', [Validators.required]],
    vastTagUrl: ['', []],
    adBreakType: ['MID_ROLL', [Validators.required]],
    durationSeconds: [15, [Validators.required]],
    cpmRate: [0, [Validators.required]],
    impressionsTarget: [0, [Validators.required]]
  });

  ngOnInit(): void {
    this.loadCampaigns();
  }

  loadCampaigns(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/campaigns`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.campaigns = res.data;
        } else {
          this.campaigns = [];
        }
        this.filterCampaigns();
      },
      error: () => {
        this.campaigns = [];
        this.filterCampaigns();
      }
    });
  }

  setTypeFilter(t: string): void {
    this.selectedType = t;
    this.filterCampaigns();
  }

  filterCampaigns(): void {
    let res = [...this.campaigns];
    if (this.selectedType !== 'ALL') {
      res = res.filter(c => c.adBreakType === this.selectedType);
    }
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      res = res.filter(c => c.campaignName.toLowerCase().includes(q) || c.advertiserName.toLowerCase().includes(q));
    }
    this.filteredCampaigns = res;
  }

  getTotalDelivered(): number {
    return this.campaigns.reduce((acc, curr) => acc + (curr.impressionsDelivered || 0), 0);
  }

  getTotalRevenue(): number {
    return this.campaigns.reduce((acc, curr) => acc + (curr.spentBudget || 0), 0);
  }

  getAvgCpm(): number {
    if (this.campaigns.length === 0) return 0;
    const sum = this.campaigns.reduce((acc, curr) => acc + (curr.cpmRate || 0), 0);
    return sum / this.campaigns.length;
  }

  getApiOrigin(): string {
    if (environment.apiHost) {
      return environment.apiHost.replace(/\/+$/, '');
    }
    return window.location.origin;
  }

  openCreateModal(): void {
    if (this.localFileBlobUrl) {
      URL.revokeObjectURL(this.localFileBlobUrl);
      this.localFileBlobUrl = '';
    }
    this.uploadedAdVideoUrl = '';
    this.uploadedHlsUrl = '';
    this.uploadedVideoId = '';
    this.uploadedThumbnailUrl = '';
    this.uploadingAdVideo = false;
    this.uploadProgress = 0;
    this.creativeTab = 'UPLOAD';

    const apiOrigin = this.getApiOrigin();
    this.campaignForm.reset({
      campaignName: '',
      advertiserName: '',
      vastTagUrl: `${apiOrigin}/api/v1/ads/vast?placement=PRE_ROLL`,
      adBreakType: 'PRE_ROLL',
      durationSeconds: 15,
      cpmRate: 150,
      impressionsTarget: 10000
    });
    this.showModal = true;
  }

  getVastUrl(item: AdCampaignDto): string {
    if (item.vastTagUrl && item.vastTagUrl.startsWith('http')) {
      return item.vastTagUrl.replace('admin.maxxpixels.com', 'api.maxxpixels.com');
    }
    const apiOrigin = this.getApiOrigin();
    if (item.id) {
      return `${apiOrigin}/api/v1/ads/vast/${item.id}.xml`;
    }
    return `${apiOrigin}/api/v1/ads/vast.xml`;
  }

  copyVastUrl(item: AdCampaignDto): void {
    const url = this.getVastUrl(item);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        this.notificationService.success(`VAST 4.2 URL copied to clipboard: ${url}`);
      }).catch(() => {
        this.fallbackCopy(url);
      });
    } else {
      this.fallbackCopy(url);
    }
  }

  private fallbackCopy(url: string): void {
    const el = document.createElement('textarea');
    el.value = url;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    this.notificationService.success(`VAST 4.2 URL copied to clipboard: ${url}`);
  }

  generateFormVastUrl(): void {
    const apiOrigin = this.getApiOrigin();
    const placement = this.campaignForm.value.adBreakType || 'PRE_ROLL';
    const vastUrl = `${apiOrigin}/api/v1/ads/vast?placement=${placement}`;
    this.campaignForm.patchValue({ vastTagUrl: vastUrl });
    this.notificationService.success('Dynamic IAB VAST 4.2 XML URL generated!');
  }

  closeModal(): void {
    this.showModal = false;
    if (this.localFileBlobUrl) {
      URL.revokeObjectURL(this.localFileBlobUrl);
      this.localFileBlobUrl = '';
    }
  }

  onAdVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    if (this.localFileBlobUrl) {
      URL.revokeObjectURL(this.localFileBlobUrl);
    }
    this.localFileBlobUrl = URL.createObjectURL(file);
    this.uploadAdVideo(file);
  }

  uploadAdVideo(file: File): void {
    this.uploadingAdVideo = true;
    this.uploadProgress = 5;

    const formData = new FormData();
    formData.append('file', file);
    const campaignName = this.campaignForm.value.campaignName || file.name.replace(/\.[^/.]+$/, '');
    formData.append('title', campaignName);
    formData.append('campaignName', campaignName);

    this.http.post<any>(`${environment.apiBaseUrl}/admin/ads/upload-video`, formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.uploadProgress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.uploadingAdVideo = false;
          const res = event.body;
          if (res?.success && res.data) {
            this.uploadedAdVideoUrl = res.data.directPlayUrl || res.data.videoUrl || '';
            this.uploadedHlsUrl = res.data.hlsUrl || '';
            this.uploadedVideoId = res.data.videoId || '';
            this.uploadedThumbnailUrl = res.data.thumbnailUrl || '';

            if (res.data.vastTagUrl) {
              this.campaignForm.patchValue({ vastTagUrl: res.data.vastTagUrl });
            }
            if (!this.campaignForm.value.campaignName) {
              this.campaignForm.patchValue({ campaignName: file.name.replace(/\.[^/.]+$/, '') });
            }

            this.notificationService.success('Ad video uploaded to Bunny.net Stream successfully!');
          } else {
            this.notificationService.error('Upload succeeded but server returned unexpected payload.');
          }
        }
      },
      error: (err) => {
        this.uploadingAdVideo = false;
        const msg = err?.error?.message || err?.message || 'Failed to upload ad video to Bunny Stream. Check credentials in Settings.';
        this.notificationService.error(msg);
      }
    });
  }

  openPreviewModal(item: AdCampaignDto): void {
    if (!item.videoUrl && !item.streamVideoId) return;

    let rawUrl = (item.videoUrl || '').trim();
    const cdnHost = this.runtimeConfig.bunnyStreamCdnHostname;
    if (cdnHost && rawUrl.includes('video.bunnycdn.com')) {
      rawUrl = rawUrl.replace('video.bunnycdn.com', cdnHost);
    }

    const guidMatch = item.streamVideoId || rawUrl.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i)?.[1];

    if (guidMatch && this.runtimeConfig.bunnyStreamLibraryId) {
      const guid = guidMatch;
      const libraryId = this.runtimeConfig.bunnyStreamLibraryId;
      this.previewModalUrl = cdnHost ? `https://${cdnHost}/${guid}/play_720p.mp4` : rawUrl;
      const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=true&loop=false&muted=false`;
      this.previewModalEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      this.previewPlayerMode = 'EMBED';
    } else {
      this.previewModalUrl = rawUrl.startsWith('http') ? rawUrl : `${environment.apiBaseUrl}${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
      this.previewModalEmbedUrl = null;
      this.previewPlayerMode = 'DIRECT';
    }

    this.previewModalTitle = item.campaignName;
    this.showPreviewModal = true;
  }

  onPreviewVideoError(): void {
    if (this.previewModalEmbedUrl && this.previewPlayerMode === 'DIRECT') {
      this.previewPlayerMode = 'EMBED';
    }
  }

  closePreviewModal(): void {
    this.showPreviewModal = false;
    this.previewModalUrl = '';
    this.previewModalEmbedUrl = null;
  }

  onSaveCampaign(): void {
    if (this.campaignForm.invalid) return;
    const dto = this.campaignForm.value as any;

    const tempId = Date.now();
    const newCampaign: AdCampaignDto = {
      id: tempId,
      ...dto,
      videoUrl: this.uploadedAdVideoUrl || dto.videoUrl || '',
      streamVideoId: this.uploadedVideoId || '',
      thumbnailUrl: this.uploadedThumbnailUrl || '',
      provider: this.uploadedAdVideoUrl ? 'BUNNY_STREAM' : 'VAST_TAG',
      impressionsDelivered: 0,
      spentBudget: 0,
      totalBudget: (dto.cpmRate * dto.impressionsTarget) / 1000,
      targetDevices: 'ALL',
      status: 'ACTIVE'
    };

    this.campaigns.unshift(newCampaign);
    this.filterCampaigns();
    this.closeModal();

    // Do not pass temporary client timestamp ID to the server
    const { id, ...payload } = newCampaign;
    if (payload.vastTagUrl) {
      payload.vastTagUrl = payload.vastTagUrl.replace('admin.maxxpixels.com', 'api.maxxpixels.com');
    }

    this.http.post<any>(`${environment.apiBaseUrl}/admin/ads/campaigns`, payload).subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          const index = this.campaigns.findIndex(c => c.id === tempId || c.id === res.data.id);
          if (index !== -1) {
            this.campaigns[index] = { ...this.campaigns[index], ...res.data };
          }
          this.filterCampaigns();
        }
        this.notificationService.success(`SSAI Ad Campaign "${dto.campaignName}" launched successfully on Bunny Stream!`);
      },
      error: (err) => {
        const msg = err?.error?.message || err?.message || 'Failed to save campaign on server';
        this.notificationService.error(msg);
        this.loadCampaigns();
      }
    });
  }

  toggleStatus(item: AdCampaignDto): void {
    const prevStatus = item.status;
    item.status = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.http.post<any>(`${environment.apiBaseUrl}/admin/ads/campaigns/${item.id}/toggle?status=${item.status}`, {}).subscribe({
      next: () => {
        this.notificationService.success(`Campaign "${item.campaignName}" is now ${item.status}`);
      },
      error: (err) => {
        item.status = prevStatus;
        const msg = err?.error?.message || `Failed to update status for "${item.campaignName}"`;
        this.notificationService.error(msg);
      }
    });
  }

  async deleteCampaign(item: AdCampaignDto): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Delete Campaign?',
      `Are you sure you want to delete campaign "${item.campaignName}"?`,
      'Yes, Delete'
    );
    if (!ok) return;
    this.campaigns = this.campaigns.filter(c => c.id !== item.id);
    this.filterCampaigns();
    this.http.delete<any>(`${environment.apiBaseUrl}/admin/ads/campaigns/${item.id}`).subscribe({
      next: () => {
        this.notificationService.success(`Campaign "${item.campaignName}" deleted successfully`);
      },
      error: (err) => {
        const msg = err?.error?.message || `Failed to delete campaign "${item.campaignName}"`;
        this.notificationService.error(msg);
        this.loadCampaigns();
      }
    });
  }
}
