import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ProducerApiService, ProducerOnboardingProfile, ProducerSubmission } from '../../core/services/producer-api.service';
import { StorageApiService } from '../../core/services/storage-api.service';

@Component({
  selector: 'app-content-submission-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatTableModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div class="header-left">
          <div class="category-tag">
            <mat-icon>movie_filter</mat-icon>
            <span>PRODUCER STUDIO PORTAL &bull; INGESTION SUITE</span>
          </div>
          <h1>Media Submissions &amp; Ingestion Hub</h1>
          <p>Directly submit master 4K/HD video assets, poster artwork, and title metadata for platform screening, ABR transcoding, and OTT distribution</p>
        </div>

        <div class="header-right">
          <div class="studio-status-pill" *ngIf="studioProfile">
            <div class="studio-avatar">
              <mat-icon>business</mat-icon>
            </div>
            <div class="studio-info">
              <span class="studio-name">{{ studioProfile.studioName || studioProfile.companyName || 'Producer Studio' }}</span>
              <span class="studio-verified">
                <mat-icon>verified</mat-icon> Verified Content Partner
              </span>
            </div>
          </div>

          <div class="header-action-btns">
            <button type="button" mat-stroked-button class="btn-specs" (click)="toggleSpecsModal(true)">
              <mat-icon>help_outline</mat-icon> Ingestion Specs
            </button>
            <button type="button" mat-stroked-button class="btn-refresh" (click)="refreshAllData()" [disabled]="loadingSubmissions">
              <mat-icon [class.spin-icon]="loadingSubmissions">refresh</mat-icon> Refresh
            </button>
          </div>
        </div>
      </div>

      <!-- 2. KPI TELEMETRY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card purple" (click)="activeTabIndex = 1; filterStatus = 'ALL'">
          <div class="kpi-icon"><mat-icon>video_library</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-label">Total Submissions</span>
            <div class="kpi-val">{{ mySubmissions.length }} <small>Titles</small></div>
          </div>
        </div>

        <div class="kpi-card gold" (click)="activeTabIndex = 1; filterStatus = 'SUBMITTED'">
          <div class="kpi-icon"><mat-icon>hourglass_top</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-label">In Review / Transcoding</span>
            <div class="kpi-val text-gold">{{ getCountByStatus('SUBMITTED') }} <small>Pending</small></div>
          </div>
        </div>

        <div class="kpi-card green" (click)="activeTabIndex = 1; filterStatus = 'APPROVED'">
          <div class="kpi-icon"><mat-icon>check_circle</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-label">Approved &amp; Live</span>
            <div class="kpi-val text-green">{{ getCountByStatus('APPROVED') + getCountByStatus('PUBLISHED') }} <small>Streaming</small></div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>pie_chart</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-label">Agreed Net Revenue Share</span>
            <div class="kpi-val text-blue">{{ studioProfile?.defaultRevenueSharePercentage || 70 }}% <small>Studio Share</small></div>
          </div>
        </div>
      </div>

      <!-- 3. MAIN TABS (SUBMIT MEDIA / MY SUBMISSIONS) -->
      <mat-tab-group [selectedIndex]="activeTabIndex" (selectedIndexChange)="onTabChange($event)" animationDuration="250ms" class="custom-tab-group">
        <!-- TAB 1: SUBMIT NEW / EDIT MEDIA -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">{{ editingContentId ? 'edit_note' : 'cloud_upload' }}</mat-icon>
            <span>{{ editingContentId ? 'Edit & Resubmit Title' : 'Submit New Content Asset' }}</span>
            <span class="editing-chip" *ngIf="editingContentId">Editing #{{ editingContentId }}</span>
          </ng-template>

          <div class="tab-content">
            <!-- EDITING NOTICE BANNER -->
            <div class="edit-alert-banner" *ngIf="editingContentId">
              <div class="alert-content">
                <mat-icon class="alert-icon">mode_edit</mat-icon>
                <div>
                  <strong>Currently Editing: {{ submissionForm.value.title || 'Untitled Submission' }}</strong>
                  <p>You can update metadata, replace artwork, attach new master videos, and resubmit for immediate review.</p>
                </div>
              </div>
              <button mat-stroked-button class="btn-cancel-edit" (click)="cancelEditing()">
                <mat-icon>close</mat-icon> Cancel &amp; New Submission
              </button>
            </div>

            <!-- REJECTION REASON BANNER (IF APPLICABLE) -->
            <div class="rejection-alert-banner" *ngIf="currentEditingRejectionNotes">
              <mat-icon class="rejection-icon">warning</mat-icon>
              <div>
                <strong>Rejection Notes from MaxxPixels Reviewer:</strong>
                <p>{{ currentEditingRejectionNotes }}</p>
                <small>Please revise the highlighted items below and resubmit for expedited approval.</small>
              </div>
            </div>

            <!-- SUBMISSION FORM CARD -->
            <div class="form-card">
              <div class="form-header-banner">
                <div class="header-icon-box cyan">
                  <mat-icon>{{ editingContentId ? 'video_file' : 'add_to_queue' }}</mat-icon>
                </div>
                <div>
                  <h3>{{ editingContentId ? 'Update & Resubmit Title' : 'Direct Ingestion Form' }}</h3>
                  <p>Fill out the metadata, upload master 4K/HD video and artwork, and send directly for QC and ABR streaming transcoding.</p>
                </div>
              </div>

              <mat-progress-bar mode="indeterminate" *ngIf="submitting"></mat-progress-bar>

              <form [formGroup]="submissionForm" (ngSubmit)="onSubmitContent()" class="submission-form">

                <!-- STEP 01: TITLE, FORMAT & GENERAL METADATA -->
                <div class="section-container">
                  <div class="section-title-bar">
                    <span class="step-badge">01</span>
                    <div class="section-text">
                      <h4>General Title Information</h4>
                      <p>Specify the title name, content format, primary audio language, genre, and duration</p>
                    </div>
                  </div>

                  <div class="form-grid-3">
                    <!-- Title -->
                    <div class="grid-span-2">
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Title Name *</mat-label>
                        <input matInput formControlName="title" placeholder="e.g. Inception: Echoes of Eternity" required>
                        <mat-icon matSuffix>title</mat-icon>
                        <mat-error *ngIf="submissionForm.get('title')?.hasError('required')">Title is required</mat-error>
                      </mat-form-field>
                    </div>

                    <!-- Content Format -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Content Format *</mat-label>
                        <mat-select formControlName="contentType" required>
                          <mat-option value="MOVIE">🎬 Feature Film</mat-option>
                          <mat-option value="SERIES">📺 Web Series Episode</mat-option>
                          <mat-option value="SHORT_FILM">📱 Short Film</mat-option>
                          <mat-option value="DOCUMENTARY">🌍 Documentary</mat-option>
                          <mat-option value="MUSIC_VIDEO">🎵 Music Video</mat-option>
                          <mat-option value="TRAILER">🎞️ Teaser / Trailer</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Primary Language -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Primary Audio Language *</mat-label>
                        <mat-select formControlName="language" required>
                          <mat-option *ngFor="let lang of languagesList" [value]="lang">{{ lang }}</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Primary Genre -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Primary Genre *</mat-label>
                        <mat-select formControlName="genre" required>
                          <mat-option *ngFor="let g of allGenresList" [value]="g">{{ g }}</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Age Rating -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Content Age Rating / Certificate</mat-label>
                        <mat-select formControlName="ageRating">
                          <mat-option value="U">U (Universal - All Audiences)</mat-option>
                          <mat-option value="U/A 7+">U/A 7+ (Parental Guidance for Young Kids)</mat-option>
                          <mat-option value="U/A 13+">U/A 13+ (13 Years and Above)</mat-option>
                          <mat-option value="U/A 16+">U/A 16+ (16 Years and Above)</mat-option>
                          <mat-option value="A">A (Adults Only 18+)</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Release Year -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Release Year</mat-label>
                        <input matInput type="number" formControlName="releaseYear" min="1950" max="2035">
                        <mat-icon matSuffix>calendar_today</mat-icon>
                      </mat-form-field>
                    </div>

                    <!-- Runtime (Minutes) -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Approx Runtime (Minutes)</mat-label>
                        <input matInput type="number" formControlName="durationMinutes" min="1" max="600">
                        <span matSuffix>Mins&nbsp;</span>
                      </mat-form-field>
                    </div>

                    <!-- Director -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Director Name</mat-label>
                        <input matInput formControlName="director" placeholder="e.g. S. S. Rajamouli">
                        <mat-icon matSuffix>movie_creation</mat-icon>
                      </mat-form-field>
                    </div>
                  </div>

                  <!-- Cast Details -->
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="full-width custom-field">
                      <mat-label>Lead Cast &amp; Starpower</mat-label>
                      <input matInput formControlName="cast" placeholder="e.g. Ranbir Kapoor, Rashmika Mandanna, Anil Kapoor">
                      <mat-icon matSuffix>people</mat-icon>
                    </mat-form-field>
                  </div>

                  <!-- Synopsis -->
                  <div class="form-row">
                    <mat-form-field appearance="outline" class="full-width custom-field">
                      <mat-label>Synopsis &amp; Logline</mat-label>
                      <textarea matInput rows="3" formControlName="description" placeholder="A brief storyline summary, plot highlights, character conflicts, and logline for audiences..."></textarea>
                    </mat-form-field>
                  </div>
                </div>

                <!-- STEP 02: MASTER VIDEO ASSET INGESTION ZONE -->
                <div class="section-container">
                  <div class="section-title-bar">
                    <span class="step-badge">02</span>
                    <div class="section-text">
                      <h4>Master Video Asset Upload &amp; Cloud Transcoding</h4>
                      <p>Upload your 4K/HD video master directly or supply a direct video/HLS stream URL</p>
                    </div>

                    <!-- Mode Toggle: File Upload vs Direct URL -->
                    <div class="video-mode-switch">
                      <button
                        type="button"
                        class="mode-switch-btn"
                        [class.active]="videoInputMode === 'FILE'"
                        (click)="videoInputMode = 'FILE'">
                        <mat-icon>upload_file</mat-icon> Upload File
                      </button>
                      <button
                        type="button"
                        class="mode-switch-btn"
                        [class.active]="videoInputMode === 'URL'"
                        (click)="videoInputMode = 'URL'">
                        <mat-icon>link</mat-icon> Direct Stream URL
                      </button>
                    </div>
                  </div>

                  <!-- A. FILE UPLOAD MODE -->
                  <div class="master-dropzone" *ngIf="videoInputMode === 'FILE'" [class.uploading]="uploadingVideo" [class.has-file]="localVideoPreviewUrl || uploadedVideoUrl">
                    <!-- State 1: Uploading in progress -->
                    <div class="dropzone-state-uploading" *ngIf="uploadingVideo">
                      <div class="upload-spinner-ring">
                        <mat-icon class="spin-icon">autorenew</mat-icon>
                      </div>
                      <div class="upload-meta">
                        <span class="file-title-text">{{ videoFileName }}</span>
                        <mat-progress-bar mode="determinate" [value]="videoUploadProgress" class="progress-bar-cyan"></mat-progress-bar>
                        <div class="pct-row">
                          <span class="pct-num">{{ videoUploadProgress }}% Completed</span>
                          <span class="pct-status">Uploading to Cloud Storage &amp; Bunny.net Stream...</span>
                        </div>
                      </div>
                    </div>

                    <!-- State 2: Video attached & ready -->
                    <div class="dropzone-state-ready" *ngIf="!uploadingVideo && (localVideoPreviewUrl || uploadedVideoUrl)">
                      <div class="ready-badge-box">
                        <mat-icon class="check-icon">check_circle</mat-icon>
                        <div class="ready-text">
                          <span class="ready-title">Master Video Asset Attached &amp; Validated</span>
                          <span class="ready-filename">{{ videoFileName || 'master-video-asset.mp4' }}</span>
                          <span class="ready-codec-tag">Ready for Multi-Bitrate ABR Transcoding (1080p, 720p, 480p, HLS)</span>
                        </div>
                      </div>

                      <div class="ready-actions">
                        <button type="button" mat-flat-button color="accent" class="btn-preview-video" (click)="openVideoPreview(localVideoPreviewUrl || uploadedVideoUrl)">
                          <mat-icon>play_circle</mat-icon> Preview Master Playback
                        </button>
                        <label class="btn-replace-file">
                          <mat-icon>refresh</mat-icon> Replace File
                          <input type="file" (change)="onUploadVideoFile($event)" accept="video/*" style="display: none;">
                        </label>
                        <button type="button" mat-stroked-button color="warn" class="btn-remove-file" (click)="clearVideoAsset()">
                          <mat-icon>delete_outline</mat-icon>
                        </button>
                      </div>
                    </div>

                    <!-- State 3: Empty / prompt to drop file -->
                    <div class="dropzone-state-empty" *ngIf="!uploadingVideo && !localVideoPreviewUrl && !uploadedVideoUrl">
                      <div class="drop-icon-circle">
                        <mat-icon>cloud_upload</mat-icon>
                      </div>
                      <div class="drop-text-box">
                        <h5>Drag &amp; Drop Master Video Asset Here</h5>
                        <p>Supports MP4, MOV, MKV, WebM, and ProRes up to 15 GB</p>
                      </div>
                      <label class="btn-browse-file">
                        <mat-icon>folder_open</mat-icon> Browse File from Device
                        <input type="file" (change)="onUploadVideoFile($event)" accept="video/*" style="display: none;">
                      </label>
                    </div>
                  </div>

                  <!-- B. DIRECT STREAM URL MODE -->
                  <div class="direct-url-box" *ngIf="videoInputMode === 'URL'">
                    <mat-form-field appearance="outline" class="full-width custom-field">
                      <mat-label>Master Video / HLS Stream URL *</mat-label>
                      <input
                        matInput
                        [(ngModel)]="uploadedVideoUrl"
                        [ngModelOptions]="{standalone: true}"
                        (input)="onUrlInputChanged()"
                        placeholder="https://vz-xxxxxx.b-cdn.net/.../playlist.m3u8 or https://storage.../master.mp4">
                      <mat-icon matSuffix>link</mat-icon>
                    </mat-form-field>

                    <div class="url-action-row" *ngIf="uploadedVideoUrl">
                      <button type="button" mat-stroked-button class="btn-test-url" (click)="openVideoPreview(uploadedVideoUrl)">
                        <mat-icon>play_circle</mat-icon> Test &amp; Preview Stream URL
                      </button>
                      <span class="url-valid-badge">
                        <mat-icon>check</mat-icon> Stream Link Verified
                      </span>
                    </div>
                  </div>
                </div>

                <!-- STEP 03: POSTER & BANNER ARTWORK -->
                <div class="section-container">
                  <div class="section-title-bar">
                    <span class="step-badge">03</span>
                    <div class="section-text">
                      <h4>Visual Key Artwork (Poster &amp; Hero Banner)</h4>
                      <p>High-resolution artwork for mobile thumbnails, Smart TV banners, and OTT carousels</p>
                    </div>
                  </div>

                  <div class="artwork-dual-grid">
                    <!-- Vertical Poster Card (2:3) -->
                    <div class="artwork-box">
                      <div class="artwork-header">
                        <span class="art-title">
                          <mat-icon>photo</mat-icon> Vertical Poster (2:3 Ratio) *
                        </span>
                        <span class="art-badge" [class.badge-done]="localPosterPreviewUrl || uploadedPosterUrl">
                          {{ (localPosterPreviewUrl || uploadedPosterUrl) ? 'Artwork Attached' : '800 x 1200 px' }}
                        </span>
                      </div>

                      <div class="poster-canvas" [class.has-poster]="localPosterPreviewUrl || uploadedPosterUrl">
                        <img
                          *ngIf="localPosterPreviewUrl || uploadedPosterUrl"
                          [src]="localPosterPreviewUrl || uploadedPosterUrl"
                          alt="Poster Preview"
                          class="poster-render-img"
                          (error)="onPosterImgError($event)">

                        <div class="poster-empty-state" *ngIf="!localPosterPreviewUrl && !uploadedPosterUrl">
                          <mat-icon class="canvas-icon">add_photo_alternate</mat-icon>
                          <span class="canvas-title">Vertical Portrait Poster</span>
                          <small>Recommended: 800 &times; 1200 px (PNG/JPG)</small>
                        </div>

                        <div class="canvas-overlay-btns">
                          <label class="btn-canvas-upload">
                            <mat-icon>{{ (localPosterPreviewUrl || uploadedPosterUrl) ? 'edit' : 'cloud_upload' }}</mat-icon>
                            <span>{{ (localPosterPreviewUrl || uploadedPosterUrl) ? 'Change Poster' : 'Upload Poster' }}</span>
                            <input type="file" (change)="onUploadPosterFile($event)" accept="image/*" style="display: none;">
                          </label>
                          <button
                            type="button"
                            *ngIf="localPosterPreviewUrl || uploadedPosterUrl"
                            class="btn-canvas-clear"
                            (click)="clearPosterAsset()">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>

                      <!-- Direct Poster URL input -->
                      <div class="artwork-url-field">
                        <mat-form-field appearance="outline" class="full-width compact-field">
                          <mat-label>Or Paste Poster Image URL</mat-label>
                          <input matInput [(ngModel)]="uploadedPosterUrl" [ngModelOptions]="{standalone: true}" (change)="localPosterPreviewUrl = uploadedPosterUrl" placeholder="https://.../poster.jpg">
                        </mat-form-field>
                      </div>
                    </div>

                    <!-- Landscape Hero Banner Card (16:9) -->
                    <div class="artwork-box">
                      <div class="artwork-header">
                        <span class="art-title">
                          <mat-icon>wallpaper</mat-icon> Landscape Hero Banner (16:9 Ratio)
                        </span>
                        <span class="art-badge" [class.badge-done]="localBannerPreviewUrl || uploadedBannerUrl">
                          {{ (localBannerPreviewUrl || uploadedBannerUrl) ? 'Artwork Attached' : '1920 x 1080 px' }}
                        </span>
                      </div>

                      <div class="banner-canvas" [class.has-banner]="localBannerPreviewUrl || uploadedBannerUrl">
                        <img
                          *ngIf="localBannerPreviewUrl || uploadedBannerUrl"
                          [src]="localBannerPreviewUrl || uploadedBannerUrl"
                          alt="Banner Preview"
                          class="banner-render-img"
                          (error)="onBannerImgError($event)">

                        <div class="banner-empty-state" *ngIf="!localBannerPreviewUrl && !uploadedBannerUrl">
                          <mat-icon class="canvas-icon">panorama</mat-icon>
                          <span class="canvas-title">16:9 Landscape Hero Banner</span>
                          <small>Recommended: 1920 &times; 1080 px (PNG/JPG)</small>
                        </div>

                        <div class="canvas-overlay-btns">
                          <label class="btn-canvas-upload">
                            <mat-icon>{{ (localBannerPreviewUrl || uploadedBannerUrl) ? 'edit' : 'cloud_upload' }}</mat-icon>
                            <span>{{ (localBannerPreviewUrl || uploadedBannerUrl) ? 'Change Banner' : 'Upload Banner' }}</span>
                            <input type="file" (change)="onUploadBannerFile($event)" accept="image/*" style="display: none;">
                          </label>
                          <button
                            type="button"
                            *ngIf="localBannerPreviewUrl || uploadedBannerUrl"
                            class="btn-canvas-clear"
                            (click)="clearBannerAsset()">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>

                      <!-- Direct Banner URL input -->
                      <div class="artwork-url-field">
                        <mat-form-field appearance="outline" class="full-width compact-field">
                          <mat-label>Or Paste Banner Image URL</mat-label>
                          <input matInput [(ngModel)]="uploadedBannerUrl" [ngModelOptions]="{standalone: true}" (change)="localBannerPreviewUrl = uploadedBannerUrl" placeholder="https://.../banner.jpg">
                        </mat-form-field>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- STEP 04: PROMO TRAILER & MONETIZATION -->
                <div class="section-container">
                  <div class="section-title-bar">
                    <span class="step-badge">04</span>
                    <div class="section-text">
                      <h4>Promotional Trailer &amp; Commercial Terms</h4>
                      <p>Optional promo teaser video and commercial revenue model distribution</p>
                    </div>
                  </div>

                  <div class="form-grid-3">
                    <!-- Trailer Video File / URL -->
                    <div class="grid-span-2">
                      <div class="trailer-upload-box">
                        <div class="trailer-top-row">
                          <span class="trailer-label"><mat-icon>movie</mat-icon> Promo / Teaser Video (Optional)</span>
                          <span class="art-badge" *ngIf="localTrailerPreviewUrl || uploadedTrailerUrl">Attached</span>
                        </div>
                        <div class="trailer-input-group">
                          <label class="btn-trailer-upload">
                            <mat-icon>video_call</mat-icon>
                            <span>Upload Trailer File</span>
                            <input type="file" (change)="onUploadTrailerFile($event)" accept="video/*" style="display: none;">
                          </label>
                          <div class="trailer-url-input">
                            <mat-form-field appearance="outline" class="full-width compact-field">
                              <mat-label>Or Paste Trailer / YouTube URL</mat-label>
                              <input matInput [(ngModel)]="uploadedTrailerUrl" [ngModelOptions]="{standalone: true}" placeholder="https://youtube.com/watch?v=... or https://.../trailer.mp4">
                            </mat-form-field>
                          </div>
                          <button
                            type="button"
                            mat-icon-button
                            class="btn-preview-trailer"
                            *ngIf="uploadedTrailerUrl || localTrailerPreviewUrl"
                            (click)="openVideoPreview(uploadedTrailerUrl || localTrailerPreviewUrl)">
                            <mat-icon>play_circle</mat-icon>
                          </button>
                        </div>
                      </div>
                    </div>

                    <!-- Monetization Model -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Monetization Model</mat-label>
                        <mat-select formControlName="monetization">
                          <mat-option value="AVOD">📺 AVOD (Free with SSAI Video Ads)</mat-option>
                          <mat-option value="SVOD">👑 SVOD (Subscription VIP Only)</mat-option>
                          <mat-option value="TVOD">🎟️ TVOD (Pay-Per-View Rental)</mat-option>
                          <mat-option value="FREE">🎁 FREE (Open Public Access)</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <!-- Revenue Share Percentage -->
                    <div>
                      <mat-form-field appearance="outline" class="full-width custom-field">
                        <mat-label>Agreed Producer Revenue Share</mat-label>
                        <input matInput type="number" formControlName="revenueSharePercentage" min="1" max="100">
                        <span matSuffix>% Producer Share&nbsp;</span>
                      </mat-form-field>
                    </div>
                  </div>
                </div>

                <!-- VALIDATION STATUS / SUBMISSION ACTIONS BAR -->
                <div class="submit-action-bar">
                  <div class="validation-status-view">
                    <div class="status-indicator-dot" [class.ready]="isFormReadyToSubmit()"></div>
                    <div class="status-texts">
                      <strong *ngIf="isFormReadyToSubmit()">All Required Submission Assets Validated!</strong>
                      <strong *ngIf="!isFormReadyToSubmit()">Submission Incomplete:</strong>
                      <span class="missing-hints" *ngIf="!isFormReadyToSubmit()">
                        {{ getMissingFieldsHint() }}
                      </span>
                    </div>
                  </div>

                  <div class="action-buttons-group">
                    <button
                      type="button"
                      mat-stroked-button
                      class="btn-save-draft"
                      [disabled]="submitting || !submissionForm.get('title')?.value"
                      (click)="saveDraftSubmission()">
                      <mat-icon>drafts</mat-icon> Save as Draft
                    </button>

                    <button
                      type="submit"
                      mat-raised-button
                      class="btn-submit-master"
                      [disabled]="submitting || uploadingVideo || !isFormReadyToSubmit()">
                      <mat-icon *ngIf="!submitting">cloud_upload</mat-icon>
                      <mat-icon *ngIf="submitting" class="spin-icon">hourglass_top</mat-icon>
                      <span>{{ submitting ? 'Submitting Title...' : (editingContentId ? 'Resubmit for Review & ABR' : 'Submit Asset for QC & Transcoding Review') }}</span>
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        </mat-tab>

        <!-- TAB 2: MY SUBMISSIONS QUEUE -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">list_alt</mat-icon>
            <span>My Submissions Queue</span>
            <span class="queue-count-badge">{{ mySubmissions.length }}</span>
          </ng-template>

          <div class="tab-content">
            <!-- QUEUE CONTROLS BAR -->
            <div class="queue-controls-bar">
              <div class="filter-chips-row">
                <button
                  type="button"
                  class="filter-chip"
                  [class.active]="filterStatus === 'ALL'"
                  (click)="filterStatus = 'ALL'">
                  All Titles ({{ mySubmissions.length }})
                </button>
                <button
                  type="button"
                  class="filter-chip gold"
                  [class.active]="filterStatus === 'SUBMITTED'"
                  (click)="filterStatus = 'SUBMITTED'">
                  In Review ({{ getCountByStatus('SUBMITTED') }})
                </button>
                <button
                  type="button"
                  class="filter-chip green"
                  [class.active]="filterStatus === 'APPROVED'"
                  (click)="filterStatus = 'APPROVED'">
                  Approved &amp; Live ({{ getCountByStatus('APPROVED') + getCountByStatus('PUBLISHED') }})
                </button>
                <button
                  type="button"
                  class="filter-chip red"
                  [class.active]="filterStatus === 'REJECTED'"
                  (click)="filterStatus = 'REJECTED'">
                  Needs Revisions ({{ getCountByStatus('REJECTED') }})
                </button>
              </div>

              <div class="search-input-box">
                <mat-icon class="search-icon">search</mat-icon>
                <input
                  type="text"
                  [(ngModel)]="searchKeyword"
                  placeholder="Filter submissions by title..."
                  class="search-input">
              </div>
            </div>

            <!-- QUEUE TABLE / CARDS -->
            <div class="table-card">
              <mat-progress-bar mode="indeterminate" *ngIf="loadingSubmissions"></mat-progress-bar>

              <div class="table-responsive">
                <table mat-table [dataSource]="filteredSubmissions" class="submissions-table">

                  <!-- Poster / Artwork Column -->
                  <ng-container matColumnDef="media">
                    <th mat-header-cell *matHeaderCellDef>Artwork</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="media-thumb-wrapper">
                        <img
                          *ngIf="row.posterUrl; else fallbackIcon"
                          [src]="row.posterUrl"
                          [alt]="row.title"
                          class="poster-thumb"
                          (error)="onPosterImgError($event)">
                        <ng-template #fallbackIcon>
                          <div class="poster-placeholder"><mat-icon>movie</mat-icon></div>
                        </ng-template>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Title & Metadata Details -->
                  <ng-container matColumnDef="title">
                    <th mat-header-cell *matHeaderCellDef>Title &amp; Storyline</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="title-details-cell">
                        <div class="title-main-row">
                          <span class="title-heading">{{ row.title }}</span>
                          <span class="format-badge">{{ row.contentType }}</span>
                          <span class="rev-badge">{{ row.revenueSharePercentage }}% Rev Share</span>
                        </div>
                        <p class="desc-line">{{ row.description || 'No synopsis provided' }}</p>
                        <div class="meta-inline-tags">
                          <span class="meta-tag"><mat-icon>schedule</mat-icon> {{ row.createdAt | date:'mediumDate' }}</span>
                          <span class="meta-tag" *ngIf="row.producerName"><mat-icon>business</mat-icon> {{ row.producerName }}</span>
                        </div>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Master Asset Playback -->
                  <ng-container matColumnDef="rawVideo">
                    <th mat-header-cell *matHeaderCellDef>Master Video Asset</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="asset-cell">
                        <button
                          *ngIf="row.rawVideoUrl"
                          mat-flat-button
                          class="btn-table-play"
                          (click)="openVideoPreview(row.rawVideoUrl)">
                          <mat-icon>play_circle</mat-icon> Play Master
                        </button>
                        <span *ngIf="!row.rawVideoUrl" class="no-asset-label">No master video</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Review Status & Feedback -->
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>QC Status &amp; Review</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="status-cell-wrapper">
                        <app-status-badge [status]="row.status"></app-status-badge>

                        <div *ngIf="row.reviewNotes || row.adminReviewComment" class="review-feedback-box">
                          <mat-icon class="feedback-icon">chat_bubble_outline</mat-icon>
                          <span>{{ row.reviewNotes || row.adminReviewComment }}</span>
                        </div>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Actions Column -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let row">
                      <div class="table-actions-row">
                        <button
                          mat-stroked-button
                          class="btn-edit-submission"
                          (click)="editSubmission(row)">
                          <mat-icon>edit</mat-icon> Edit / Resubmit
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="['media', 'title', 'rawVideo', 'status', 'actions']"></tr>
                  <tr mat-row *matRowDef="let row; columns: ['media', 'title', 'rawVideo', 'status', 'actions'];" class="table-data-row"></tr>

                  <!-- Empty state row -->
                  <tr class="mat-row" *matNoDataRow>
                    <td class="mat-cell empty-table-cell" colspan="5">
                      <div class="empty-state-view">
                        <mat-icon class="empty-icon">video_library</mat-icon>
                        <h4>No Content Submissions Found</h4>
                        <p *ngIf="searchKeyword || filterStatus !== 'ALL'">No submissions match your active search or status filter.</p>
                        <p *ngIf="!searchKeyword && filterStatus === 'ALL'">You have not submitted any titles yet. Switch to the Ingestion tab to upload your first 4K/HD title!</p>
                        <button type="button" mat-flat-button color="accent" class="btn-create-first" (click)="activeTabIndex = 0">
                          <mat-icon>add</mat-icon> Submit New Media Asset
                        </button>
                      </div>
                    </td>
                  </tr>

                </table>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- 4. VIDEO PLAYBACK PREVIEW MODAL -->
      <div class="modal-backdrop" *ngIf="previewModalVideoUrl" (click)="closeVideoPreview()">
        <div class="modal-card video-preview-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>play_circle</mat-icon></div>
            <div>
              <h2>Master Video Screening Player</h2>
              <p>Direct screening test for platform ingestion and ABR transcode validation</p>
            </div>
            <button mat-icon-button (click)="closeVideoPreview()" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body video-body">
            <!-- Iframe player if embeddable -->
            <iframe
              *ngIf="isEmbedUrl(previewModalVideoUrl); else nativeVideoPlayer"
              [src]="getSafeVideoUrl(previewModalVideoUrl)"
              class="preview-player-frame"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen>
            </iframe>

            <!-- HTML5 Native Video Player -->
            <ng-template #nativeVideoPlayer>
              <div class="video-container">
                <video
                  #videoElement
                  [src]="previewModalVideoUrl"
                  controls
                  autoplay
                  playsinline
                  preload="auto"
                  class="preview-player"
                  (error)="onVideoPlayerError($event)">
                  Your browser does not support native HTML5 video playback.
                </video>
                <div class="video-error-banner" *ngIf="videoPlaybackError">
                  <mat-icon>info</mat-icon>
                  <div>
                    <strong>ProRes / Non-Web Container Notice:</strong>
                    <span>Your local browser does not support direct decoding for this raw codec container, but the asset is verified and queued for cloud ABR transcoding.</span>
                  </div>
                </div>
              </div>
            </ng-template>
          </div>

          <div class="modal-footer">
            <a [href]="previewModalVideoUrl" target="_blank" download class="download-link-btn" *ngIf="previewModalVideoUrl">
              <mat-icon>open_in_new</mat-icon> Open Master Source
            </a>
            <button mat-button (click)="closeVideoPreview()">Close Screening Player</button>
          </div>
        </div>
      </div>

      <!-- 5. TECHNICAL INGESTION SPECS MODAL -->
      <div class="modal-backdrop" *ngIf="showSpecsModal" (click)="toggleSpecsModal(false)">
        <div class="modal-card specs-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box cyan"><mat-icon>fact_check</mat-icon></div>
            <div>
              <h2>MaxxPixels OTT &bull; Technical Ingestion Specifications</h2>
              <p>Standards for master video delivery, multi-audio tracks, and key visual artworks</p>
            </div>
            <button mat-icon-button (click)="toggleSpecsModal(false)" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body specs-body">
            <div class="specs-grid">
              <div class="spec-card">
                <mat-icon class="spec-icon cyan">videocam</mat-icon>
                <h5>Master Video Delivery</h5>
                <ul>
                  <li><strong>Containers:</strong> MP4, MOV, MKV, Apple ProRes 422 HQ</li>
                  <li><strong>Codecs:</strong> H.264 / AVC, H.265 / HEVC, ProRes</li>
                  <li><strong>Resolution:</strong> 3840 &times; 2160 (4K UHD) or 1920 &times; 1080 (FHD)</li>
                  <li><strong>Frame Rate:</strong> 23.976 fps, 24 fps, 25 fps, 29.97 fps (Native)</li>
                  <li><strong>Bitrate:</strong> 15&ndash;35 Mbps (HD), 40&ndash;80 Mbps (4K UHD)</li>
                </ul>
              </div>

              <div class="spec-card">
                <mat-icon class="spec-icon purple">audiotrack</mat-icon>
                <h5>Multi-Audio &amp; Subtitles</h5>
                <ul>
                  <li><strong>Audio Channels:</strong> 5.1 Surround (L, R, C, LFE, Ls, Rs) or 2.0 Stereo</li>
                  <li><strong>Audio Codec:</strong> AAC-LC or Linear PCM at 48 kHz / 24-bit</li>
                  <li><strong>Audio Bitrate:</strong> 320 kbps (Stereo), 640 kbps (5.1)</li>
                  <li><strong>Subtitles:</strong> WebVTT (.vtt) or SubRip (.srt) in UTF-8</li>
                  <li><strong>Timecode:</strong> Must match video frame rate exactly</li>
                </ul>
              </div>

              <div class="spec-card">
                <mat-icon class="spec-icon green">image</mat-icon>
                <h5>Key Visual Artwork</h5>
                <ul>
                  <li><strong>Vertical Poster (2:3):</strong> 800 &times; 1200 px (Min) or 1600 &times; 2400 px</li>
                  <li><strong>Hero Banner (16:9):</strong> 1920 &times; 1080 px (Min) or 3840 &times; 2160 px</li>
                  <li><strong>Color Space:</strong> sRGB, 8-bit, 72 DPI minimum</li>
                  <li><strong>Format:</strong> High quality PNG or JPG (No watermarks or dates)</li>
                </ul>
              </div>

              <div class="spec-card">
                <mat-icon class="spec-icon gold">speed</mat-icon>
                <h5>ABR Transcoding &amp; SSAI</h5>
                <ul>
                  <li><strong>Cloud Transcoding:</strong> Automatic HLS/DASH packaging with multi-renditions</li>
                  <li><strong>Ad Cues:</strong> Automated SSAI mid-roll ad markers placed at scene transitions</li>
                  <li><strong>DRM:</strong> Encrypted Widevine &amp; FairPlay distribution on demand</li>
                  <li><strong>Review Turnaround:</strong> 24 to 48 hours from submission</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button mat-flat-button color="accent" (click)="toggleSpecsModal(false)">Got It, Thanks!</button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    .page-container {
      color: #ffffff;
      padding: 8px 0 40px;
    }

    /* HEADER */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;

      .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 1px;
        color: #00d2ff;
        background: rgba(0, 210, 255, 0.12);
        padding: 4px 10px;
        border-radius: 6px;
        margin-bottom: 8px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }

      h1 { font-size: 26px; font-weight: 800; margin: 0 0 6px; color: #ffffff; }
      p { font-size: 13px; color: #a0a0b8; margin: 0; max-width: 720px; line-height: 1.5; }

      .header-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .studio-status-pill {
        display: flex;
        align-items: center;
        gap: 10px;
        background: #141422;
        border: 1px solid #28283e;
        padding: 6px 14px;
        border-radius: 30px;

        .studio-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(0, 210, 255, 0.15);
          color: #00d2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }

        .studio-info {
          display: flex;
          flex-direction: column;
          .studio-name { font-size: 13px; font-weight: 700; color: #ffffff; }
          .studio-verified {
            font-size: 10px;
            color: #00e676;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 2px;
            mat-icon { font-size: 12px; width: 12px; height: 12px; }
          }
        }
      }

      .header-action-btns {
        display: flex;
        gap: 8px;

        .btn-specs {
          border-color: #3a3a52;
          color: #a0a0b8;
          font-size: 12px;
          font-weight: 600;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; color: #00d2ff; }
          &:hover { color: #ffffff; border-color: #00d2ff; }
        }

        .btn-refresh {
          border-color: #3a3a52;
          color: #a0a0b8;
          font-size: 12px;
          font-weight: 600;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          &:hover { color: #ffffff; border-color: #ffffff; }
        }
      }
    }

    /* KPI CARDS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;

      .kpi-card {
        background: #141422;
        border: 1px solid #28283e;
        border-radius: 14px;
        padding: 16px 18px;
        display: flex;
        align-items: center;
        gap: 14px;
        cursor: pointer;
        transition: transform 0.2s, border-color 0.2s;

        &:hover {
          transform: translateY(-2px);
          border-color: #00d2ff;
        }

        .kpi-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }

        .kpi-label { font-size: 11px; color: #8e8ea8; display: block; margin-bottom: 2px; font-weight: 600; }
        .kpi-val {
          font-size: 20px;
          font-weight: 800;
          color: #ffffff;
          small { font-size: 12px; font-weight: 500; color: #8e8ea8; }
        }

        &.purple .kpi-icon { background: rgba(171, 71, 188, 0.15); color: #ab47bc; }
        &.gold .kpi-icon { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
        &.green .kpi-icon { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        &.blue .kpi-icon { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }

        .text-gold { color: #f1c40f; }
        .text-green { color: #2ecc71; }
        .text-blue { color: #00d2ff; }
      }
    }

    /* TABS */
    .custom-tab-group {
      ::ng-deep .mat-mdc-tab-header {
        border-bottom: 1px solid #28283e;
        margin-bottom: 24px;
      }
      ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
        color: #a0a0b8;
        font-weight: 700;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      ::ng-deep .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
        color: #00d2ff !important;
      }
      ::ng-deep .mat-mdc-tab-indicator .mdc-tab-indicator__content--underline {
        border-color: #00d2ff !important;
        border-top-width: 3px !important;
      }
      .tab-icon { font-size: 20px; width: 20px; height: 20px; }
      .editing-chip {
        font-size: 11px;
        padding: 2px 8px;
        background: rgba(255, 152, 0, 0.2);
        color: #ff9800;
        border-radius: 12px;
        font-weight: 700;
      }
      .queue-count-badge {
        font-size: 11px;
        padding: 2px 8px;
        background: rgba(0, 210, 255, 0.15);
        color: #00d2ff;
        border-radius: 12px;
        font-weight: 800;
      }
    }

    .tab-content {
      padding: 0;
    }

    /* ALERT BANNERS */
    .edit-alert-banner {
      background: rgba(255, 152, 0, 0.12);
      border: 1px solid rgba(255, 152, 0, 0.35);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;

      .alert-content {
        display: flex;
        align-items: center;
        gap: 12px;
        .alert-icon { font-size: 28px; width: 28px; height: 28px; color: #ff9800; flex-shrink: 0; }
        strong { font-size: 14px; color: #ffffff; display: block; margin-bottom: 2px; }
        p { margin: 0; font-size: 12px; color: #d0d0e0; }
      }

      .btn-cancel-edit {
        border-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        font-size: 12px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      }
    }

    .rejection-alert-banner {
      background: rgba(231, 76, 60, 0.12);
      border: 1px solid rgba(231, 76, 60, 0.35);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 20px;

      .rejection-icon { font-size: 26px; width: 26px; height: 26px; color: #e74c3c; flex-shrink: 0; }
      strong { font-size: 13px; color: #e74c3c; display: block; margin-bottom: 4px; }
      p { margin: 0 0 4px; font-size: 13px; color: #ffffff; font-weight: 600; }
      small { color: #a0a0b8; font-size: 11px; }
    }

    /* FORM CARD */
    .form-card {
      background: #141422;
      border: 1px solid #28283e;
      border-radius: 16px;
      padding: 24px 28px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);

      .form-header-banner {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
        padding-bottom: 18px;
        border-bottom: 1px solid #222236;

        .header-icon-box {
          width: 46px;
          height: 46px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          &.cyan { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
          mat-icon { font-size: 26px; width: 26px; height: 26px; }
        }

        h3 { margin: 0 0 3px; font-size: 18px; font-weight: 800; color: #ffffff; }
        p { margin: 0; font-size: 13px; color: #8e8ea8; }
      }
    }

    /* SECTION CONTAINERS */
    .section-container {
      background: #10101c;
      border: 1px solid #222236;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 22px;

      .section-title-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
        flex-wrap: wrap;

        .step-badge {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #00d2ff;
          color: #0b0b14;
          font-weight: 800;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .section-text {
          flex: 1;
          h4 { margin: 0 0 2px; font-size: 15px; font-weight: 800; color: #ffffff; }
          p { margin: 0; font-size: 12px; color: #8e8ea8; }
        }

        .video-mode-switch {
          display: flex;
          background: #0b0b14;
          border: 1px solid #2c2c42;
          border-radius: 8px;
          padding: 3px;
          gap: 4px;

          .mode-switch-btn {
            border: none;
            background: transparent;
            color: #8e8ea8;
            font-size: 12px;
            font-weight: 700;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;

            mat-icon { font-size: 15px; width: 15px; height: 15px; }

            &.active {
              background: #00d2ff;
              color: #0b0b14;
              box-shadow: 0 2px 8px rgba(0, 210, 255, 0.4);
            }
          }
        }
      }
    }

    /* FORM LAYOUT */
    .form-grid-3 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 14px;
    }
    .grid-span-2 {
      grid-column: span 2;
      @media (max-width: 768px) {
        grid-column: span 1;
      }
    }
    .full-width {
      width: 100%;
    }
    .form-row {
      margin-top: 10px;
    }

    /* FORM FIELDS CUSTOM STYLING */
    .custom-field {
      ::ng-deep .mdc-text-field--outlined {
        background-color: #0b0b14 !important;
        border-radius: 10px !important;
      }
      ::ng-deep .mat-mdc-form-field-input-control {
        color: #ffffff !important;
      }
      ::ng-deep .mat-mdc-select-value {
        color: #ffffff !important;
      }
      ::ng-deep .mat-mdc-floating-label {
        color: #8e8ea8 !important;
      }
      ::ng-deep .mat-mdc-text-field-wrapper {
        border-color: #28283e !important;
      }
    }

    .compact-field {
      margin-bottom: 0;
      ::ng-deep .mdc-text-field--outlined {
        background-color: #0b0b14 !important;
        border-radius: 8px !important;
      }
      ::ng-deep .mat-mdc-form-field-input-control {
        color: #ffffff !important;
        font-size: 12px !important;
      }
    }

    /* MASTER VIDEO DROPZONE */
    .master-dropzone {
      border: 2px dashed #2f2f48;
      border-radius: 12px;
      padding: 32px 20px;
      text-align: center;
      background: #0b0b14;
      transition: all 0.25s ease;

      &.uploading {
        border-color: #00d2ff;
        background: rgba(0, 210, 255, 0.04);
      }
      &.has-file {
        border-color: #2ecc71;
        background: rgba(46, 204, 113, 0.03);
      }

      .dropzone-state-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;

        .drop-icon-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: rgba(0, 210, 255, 0.1);
          color: #00d2ff;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 34px; width: 34px; height: 34px; }
        }

        .drop-text-box {
          h5 { font-size: 16px; font-weight: 700; color: #ffffff; margin: 0 0 4px; }
          p { font-size: 12px; color: #8e8ea8; margin: 0; }
        }

        .btn-browse-file {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #1a4cd8, #00d2ff);
          color: #ffffff;
          font-weight: 700;
          font-size: 13px;
          padding: 10px 22px;
          border-radius: 10px;
          cursor: pointer;
          margin-top: 6px;
          box-shadow: 0 4px 14px rgba(0, 210, 255, 0.25);
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
          &:hover { opacity: 0.92; }
        }
      }

      .dropzone-state-uploading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 18px;
        padding: 12px 0;

        .upload-spinner-ring {
          color: #00d2ff;
          mat-icon { font-size: 38px; width: 38px; height: 38px; }
        }

        .upload-meta {
          flex: 1;
          max-width: 480px;
          text-align: left;
          .file-title-text { font-size: 14px; font-weight: 700; color: #ffffff; display: block; margin-bottom: 6px; }
          .progress-bar-cyan {
            height: 8px;
            border-radius: 4px;
            margin-bottom: 6px;
          }
          .pct-row {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            .pct-num { font-weight: 800; color: #00d2ff; }
            .pct-status { color: #8e8ea8; }
          }
        }
      }

      .dropzone-state-ready {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px;
        text-align: left;

        .ready-badge-box {
          display: flex;
          align-items: center;
          gap: 14px;

          .check-icon { font-size: 38px; width: 38px; height: 38px; color: #2ecc71; flex-shrink: 0; }
          .ready-text {
            display: flex;
            flex-direction: column;
            .ready-title { font-size: 15px; font-weight: 800; color: #2ecc71; margin-bottom: 2px; }
            .ready-filename { font-size: 13px; font-weight: 600; color: #ffffff; font-family: monospace; }
            .ready-codec-tag { font-size: 11px; color: #8e8ea8; margin-top: 2px; }
          }
        }

        .ready-actions {
          display: flex;
          align-items: center;
          gap: 10px;

          .btn-preview-video {
            font-size: 12px;
            font-weight: 700;
            background: #00d2ff;
            color: #0b0b14;
            mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
          }

          .btn-replace-file {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #a0a0b8;
            cursor: pointer;
            padding: 8px 14px;
            border: 1px solid #3a3a52;
            border-radius: 8px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { color: #ffffff; border-color: #ffffff; }
          }
        }
      }
    }

    .direct-url-box {
      margin-top: 8px;

      .url-action-row {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 6px;

        .btn-test-url {
          border-color: #00d2ff;
          color: #00d2ff;
          font-size: 12px;
          font-weight: 700;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
        }

        .url-valid-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #2ecc71;
          font-weight: 700;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
    }

    /* ARTWORK DUAL GRID */
    .artwork-dual-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .artwork-box {
      background: #0b0b14;
      border: 1px solid #28283e;
      border-radius: 12px;
      padding: 16px;

      .artwork-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .art-title {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; }
        }

        .art-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
          background: #1c1c2e;
          color: #8e8ea8;

          &.badge-done {
            background: rgba(46, 204, 113, 0.15);
            color: #2ecc71;
          }
        }
      }

      .poster-canvas {
        position: relative;
        height: 220px;
        border: 1px dashed #3a3a52;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #08080f;
        overflow: hidden;

        &.has-poster {
          border-style: solid;
          border-color: #2ecc71;
        }

        .poster-render-img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .poster-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #6e6e84;
          .canvas-icon { font-size: 34px; width: 34px; height: 34px; }
          .canvas-title { font-size: 12px; font-weight: 700; color: #a0a0b8; }
          small { font-size: 10px; }
        }

        .canvas-overlay-btns {
          position: absolute;
          bottom: 10px;
          display: flex;
          gap: 6px;

          .btn-canvas-upload {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00d2ff;
            color: #00d2ff;
            padding: 5px 14px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            backdrop-filter: blur(4px);
            mat-icon { font-size: 15px; width: 15px; height: 15px; }
            &:hover { background: #00d2ff; color: #0b0b14; }
          }

          .btn-canvas-clear {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #e74c3c;
            color: #e74c3c;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { background: #e74c3c; color: #ffffff; }
          }
        }
      }

      .banner-canvas {
        position: relative;
        height: 220px;
        border: 1px dashed #3a3a52;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #08080f;
        overflow: hidden;

        &.has-banner {
          border-style: solid;
          border-color: #2ecc71;
        }

        .banner-render-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .banner-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          color: #6e6e84;
          .canvas-icon { font-size: 34px; width: 34px; height: 34px; }
          .canvas-title { font-size: 12px; font-weight: 700; color: #a0a0b8; }
          small { font-size: 10px; }
        }

        .canvas-overlay-btns {
          position: absolute;
          bottom: 10px;
          display: flex;
          gap: 6px;

          .btn-canvas-upload {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #00d2ff;
            color: #00d2ff;
            padding: 5px 14px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            cursor: pointer;
            backdrop-filter: blur(4px);
            mat-icon { font-size: 15px; width: 15px; height: 15px; }
            &:hover { background: #00d2ff; color: #0b0b14; }
          }

          .btn-canvas-clear {
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid #e74c3c;
            color: #e74c3c;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            mat-icon { font-size: 16px; width: 16px; height: 16px; }
            &:hover { background: #e74c3c; color: #ffffff; }
          }
        }
      }

      .artwork-url-field {
        margin-top: 10px;
      }
    }

    /* TRAILER UPLOAD BOX */
    .trailer-upload-box {
      background: #0b0b14;
      border: 1px solid #28283e;
      border-radius: 10px;
      padding: 12px 16px;

      .trailer-top-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        .trailer-label {
          font-size: 12px;
          font-weight: 700;
          color: #ffffff;
          display: flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; }
        }
      }

      .trailer-input-group {
        display: flex;
        align-items: center;
        gap: 10px;

        .btn-trailer-upload {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #1c1c2e;
          border: 1px solid #3a3a52;
          color: #ffffff;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; }
          &:hover { border-color: #00d2ff; }
        }

        .trailer-url-input {
          flex: 1;
        }

        .btn-preview-trailer {
          color: #00d2ff;
        }
      }
    }

    /* SUBMIT ACTION BAR */
    .submit-action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0d0d18;
      border: 1px solid #28283e;
      border-radius: 14px;
      padding: 16px 20px;
      margin-top: 24px;
      flex-wrap: wrap;
      gap: 16px;

      .validation-status-view {
        display: flex;
        align-items: center;
        gap: 12px;

        .status-indicator-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #f1c40f;
          box-shadow: 0 0 10px rgba(241, 196, 15, 0.4);

          &.ready {
            background: #2ecc71;
            box-shadow: 0 0 10px rgba(46, 204, 113, 0.6);
          }
        }

        .status-texts {
          display: flex;
          flex-direction: column;
          strong { font-size: 13px; color: #ffffff; }
          .missing-hints { font-size: 11px; color: #f1c40f; }
        }
      }

      .action-buttons-group {
        display: flex;
        align-items: center;
        gap: 12px;

        .btn-save-draft {
          border-color: #3a3a52;
          color: #a0a0b8;
          font-size: 13px;
          font-weight: 700;
          height: 46px;
          border-radius: 10px;
          padding: 0 18px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 6px; }
          &:hover { color: #ffffff; border-color: #ffffff; }
        }

        .btn-submit-master {
          height: 48px;
          padding: 0 24px;
          border-radius: 10px;
          font-weight: 800;
          font-size: 14px;
          background: linear-gradient(135deg, #1a4cd8 0%, #00d2ff 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 6px 20px rgba(0, 210, 255, 0.35);
          display: inline-flex;
          align-items: center;
          gap: 8px;

          mat-icon { font-size: 20px; width: 20px; height: 20px; }
          &:disabled { opacity: 0.5; box-shadow: none; }
        }
      }
    }

    /* QUEUE CONTROLS BAR */
    .queue-controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 14px;

      .filter-chips-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;

        .filter-chip {
          border: 1px solid #28283e;
          background: #141422;
          color: #a0a0b8;
          font-size: 12px;
          font-weight: 700;
          padding: 7px 14px;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s;

          &:hover { border-color: #00d2ff; color: #ffffff; }

          &.active {
            background: #00d2ff;
            color: #0b0b14;
            border-color: #00d2ff;
            box-shadow: 0 2px 10px rgba(0, 210, 255, 0.3);
          }

          &.gold.active { background: #f1c40f; border-color: #f1c40f; color: #0b0b14; }
          &.green.active { background: #2ecc71; border-color: #2ecc71; color: #0b0b14; }
          &.red.active { background: #e74c3c; border-color: #e74c3c; color: #ffffff; }
        }
      }

      .search-input-box {
        position: relative;
        min-width: 260px;

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #8e8ea8;
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        .search-input {
          width: 100%;
          background: #141422;
          border: 1px solid #28283e;
          border-radius: 20px;
          padding: 8px 14px 8px 36px;
          color: #ffffff;
          font-size: 13px;
          outline: none;
          &:focus { border-color: #00d2ff; }
        }
      }
    }

    /* SUBMISSIONS QUEUE TABLE */
    .table-card {
      background: #141422;
      border: 1px solid #28283e;
      border-radius: 14px;
      overflow: hidden;

      .submissions-table {
        width: 100%;
        background: transparent;
        border-collapse: collapse;

        th {
          background: #0e0e18;
          color: #8e8ea8;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 14px 16px;
          border-bottom: 1px solid #222236;
        }

        td {
          padding: 14px 16px;
          border-bottom: 1px solid #1c1c2b;
          color: #ffffff;
          vertical-align: middle;
        }
      }

      .media-thumb-wrapper {
        .poster-thumb {
          width: 48px;
          height: 68px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid #28283e;
        }
        .poster-placeholder {
          width: 48px;
          height: 68px;
          background: #1c1c2e;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6e6e84;
        }
      }

      .title-details-cell {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .title-main-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;

          .title-heading { font-size: 15px; font-weight: 800; color: #ffffff; }
          .format-badge {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 4px;
            background: #242438;
            color: #00d2ff;
          }
          .rev-badge {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            background: rgba(46, 204, 113, 0.12);
            color: #2ecc71;
          }
        }

        .desc-line {
          margin: 0;
          font-size: 12px;
          color: #8e8ea8;
          max-width: 420px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .meta-inline-tags {
          display: flex;
          gap: 12px;
          font-size: 11px;
          color: #6e6e84;

          .meta-tag {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            mat-icon { font-size: 13px; width: 13px; height: 13px; }
          }
        }
      }

      .asset-cell {
        .btn-table-play {
          background: rgba(0, 210, 255, 0.12);
          color: #00d2ff;
          font-size: 11px;
          font-weight: 700;
          height: 32px;
          padding: 0 12px;
          border-radius: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
          &:hover { background: #00d2ff; color: #0b0b14; }
        }
        .no-asset-label { font-size: 11px; color: #6e6e84; }
      }

      .status-cell-wrapper {
        display: flex;
        flex-direction: column;
        gap: 6px;

        .review-feedback-box {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          font-size: 11px;
          color: #e74c3c;
          background: rgba(231, 76, 60, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          max-width: 280px;

          .feedback-icon { font-size: 13px; width: 13px; height: 13px; flex-shrink: 0; margin-top: 2px; }
        }
      }

      .table-actions-row {
        .btn-edit-submission {
          border-color: #3a3a52;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          height: 32px;
          mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; color: #00d2ff; }
          &:hover { border-color: #00d2ff; color: #00d2ff; }
        }
      }

      .empty-table-cell {
        text-align: center;
        padding: 60px 20px !important;

        .empty-state-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;

          .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #4e4e64; }
          h4 { margin: 0; font-size: 16px; font-weight: 800; color: #ffffff; }
          p { margin: 0; font-size: 13px; color: #8e8ea8; max-width: 420px; }
          .btn-create-first {
            margin-top: 8px;
            font-size: 13px;
            font-weight: 700;
            background: #00d2ff;
            color: #0b0b14;
            mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
          }
        }
      }
    }

    /* MODALS */
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(8px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .modal-card {
      background: #141422;
      border: 1px solid #28283e;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.85);

      .modal-header {
        padding: 16px 22px;
        background: #10101c;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid #222236;

        .header-icon-box {
          color: #00d2ff;
          &.cyan { color: #00d2ff; }
        }
        h2 { font-size: 17px; font-weight: 800; margin: 0 0 2px; color: #ffffff; }
        p { font-size: 12px; color: #8e8ea8; margin: 0; }
        .close-btn { margin-left: auto; color: #8e8ea8; }
      }

      .modal-footer {
        padding: 12px 22px;
        background: #10101c;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-top: 1px solid #222236;
      }
    }

    .video-preview-modal {
      max-width: 900px;
      width: 100%;

      .video-body {
        padding: 0;
        background: #000000;
        min-height: 380px;
        display: flex;
        align-items: center;
        justify-content: center;

        .video-container {
          width: 100%;
          position: relative;
        }

        .preview-player-frame {
          width: 100%;
          height: 480px;
          border: none;
        }

        .preview-player {
          width: 100%;
          max-height: 480px;
          background: #000000;
          outline: none;
        }

        .video-error-banner {
          margin: 12px 16px;
          padding: 10px 14px;
          background: rgba(241, 196, 15, 0.12);
          border: 1px solid rgba(241, 196, 15, 0.3);
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #f1c40f;
          font-size: 12px;
          mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
          strong { display: block; margin-bottom: 2px; }
          span { color: #d0d0e0; }
        }
      }

      .download-link-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        font-weight: 700;
        color: #00d2ff;
        text-decoration: none;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &:hover { text-decoration: underline; }
      }
    }

    .specs-modal {
      max-width: 820px;
      width: 100%;

      .specs-body {
        padding: 24px;
        max-height: 70vh;
        overflow-y: auto;

        .specs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          @media (max-width: 768px) {
            grid-template-columns: 1fr;
          }
        }

        .spec-card {
          background: #10101c;
          border: 1px solid #222236;
          border-radius: 12px;
          padding: 16px;

          .spec-icon {
            font-size: 28px;
            width: 28px;
            height: 28px;
            margin-bottom: 8px;
            &.cyan { color: #00d2ff; }
            &.purple { color: #ab47bc; }
            &.green { color: #2ecc71; }
            &.gold { color: #f1c40f; }
          }

          h5 { font-size: 14px; font-weight: 800; color: #ffffff; margin: 0 0 8px; }
          ul {
            margin: 0;
            padding-left: 18px;
            font-size: 12px;
            color: #a0a0b8;
            li {
              margin-bottom: 4px;
              strong { color: #ffffff; }
            }
          }
        }
      }
    }

    .spin-icon {
      animation: spin 1.5s linear infinite;
    }

    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
  `]
})
export class ContentSubmissionPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly producerApiService = inject(ProducerApiService);
  private readonly storageApiService = inject(StorageApiService);
  private readonly notificationService = inject(NotificationService);
  private readonly http = inject(HttpClient);

  activeTabIndex = 0;
  studioProfile: ProducerOnboardingProfile | null = null;
  mySubmissions: ProducerSubmission[] = [];

  // Filter & Search
  filterStatus: 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' = 'ALL';
  searchKeyword = '';

  // Options
  languagesList: string[] = [
    'Hindi',
    'English',
    'Telugu',
    'Tamil',
    'Kannada',
    'Malayalam',
    'Bengali',
    'Marathi',
    'Punjabi',
    'Gujarati',
    'Odia',
    'Bhojpuri'
  ];

  allGenresList: string[] = [
    'Action',
    'Thriller',
    'Drama',
    'Comedy',
    'Romance',
    'Crime',
    'Sci-Fi',
    'Horror',
    'Mystery',
    'Family',
    'Animation',
    'Fantasy',
    'Documentary',
    'Adventure',
    'Historical'
  ];

  // Ingestion Modes & Upload State
  videoInputMode: 'FILE' | 'URL' = 'FILE';
  uploadingVideo = false;
  videoUploadProgress = 0;
  videoFileName = '';
  uploadedVideoUrl = '';
  localVideoPreviewUrl = '';

  uploadedPosterUrl = '';
  localPosterPreviewUrl = '';

  uploadedBannerUrl = '';
  localBannerPreviewUrl = '';

  uploadedTrailerUrl = '';
  localTrailerPreviewUrl = '';

  submitting = false;
  loadingSubmissions = false;
  previewModalVideoUrl: string | null = null;
  videoPlaybackError = false;
  showSpecsModal = false;

  // Editing state
  editingContentId: number | string | null = null;
  currentEditingRejectionNotes: string | null = null;

  submissionForm = this.fb.group({
    title: ['', [Validators.required]],
    contentType: ['MOVIE', [Validators.required]],
    language: ['Hindi', [Validators.required]],
    genre: ['Action', [Validators.required]],
    ageRating: ['U/A 13+'],
    releaseYear: [new Date().getFullYear(), [Validators.min(1950), Validators.max(2035)]],
    durationMinutes: [120, [Validators.min(1)]],
    director: [''],
    cast: [''],
    description: [''],
    monetization: ['AVOD'],
    revenueSharePercentage: [70, [Validators.required, Validators.min(1), Validators.max(100)]]
  });

  ngOnInit(): void {
    this.loadProfile();
    this.loadMySubmissions();
    this.loadLanguages();
  }

  get filteredSubmissions(): ProducerSubmission[] {
    return this.mySubmissions.filter((sub) => {
      // 1. Status Filter
      if (this.filterStatus !== 'ALL') {
        const subStatus = (sub.status || '').toUpperCase();
        if (this.filterStatus === 'APPROVED') {
          if (subStatus !== 'APPROVED' && subStatus !== 'PUBLISHED') return false;
        } else if (subStatus !== this.filterStatus) {
          return false;
        }
      }

      // 2. Search Keyword
      if (this.searchKeyword.trim()) {
        const q = this.searchKeyword.toLowerCase().trim();
        const titleMatch = (sub.title || '').toLowerCase().includes(q);
        const descMatch = (sub.description || '').toLowerCase().includes(q);
        const typeMatch = (sub.contentType || '').toLowerCase().includes(q);
        return titleMatch || descMatch || typeMatch;
      }

      return true;
    });
  }

  onTabChange(index: number): void {
    this.activeTabIndex = index;
    if (index === 1) {
      this.loadMySubmissions();
    }
  }

  toggleSpecsModal(show: boolean): void {
    this.showSpecsModal = show;
  }

  refreshAllData(): void {
    this.loadProfile();
    this.loadMySubmissions();
    this.loadLanguages();
    this.notificationService.success('Data refreshed from MaxxPixels Core');
  }

  loadLanguages(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/languages`).subscribe({
      next: (res) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(list)) {
          list.forEach((l: any) => {
            const name = l.name || l.code;
            if (name && !this.languagesList.includes(name)) {
              this.languagesList.push(name);
            }
          });
        }
      },
      error: () => {
        // Keeps fallback languages intact
      }
    });
  }

  loadProfile(): void {
    this.producerApiService.getProducerProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.studioProfile = res.data;
          if (res.data.defaultRevenueSharePercentage) {
            this.submissionForm.patchValue({
              revenueSharePercentage: res.data.defaultRevenueSharePercentage
            });
          }
        }
      },
      error: (err) => {
        console.warn('Could not load producer studio profile', err);
      }
    });
  }

  loadMySubmissions(): void {
    this.loadingSubmissions = true;
    this.producerApiService.getMySubmissions().subscribe({
      next: (res) => {
        this.loadingSubmissions = false;
        if (res.success && res.data) {
          const rawData = res.data as any;
          const list = Array.isArray(rawData)
            ? rawData
            : (Array.isArray(rawData.items) ? rawData.items : (Array.isArray(rawData.content) ? rawData.content : []));

          this.mySubmissions = list.map((s: any) => ({
            id: s.id,
            title: s.title || 'Untitled',
            contentType: s.contentType || s.content_type || 'MOVIE',
            description: s.description || '',
            posterUrl: s.posterUrl || s.poster_url || '',
            bannerUrl: s.bannerUrl || s.banner_url || '',
            trailerUrl: s.trailerUrl || s.trailer_url || '',
            rawVideoUrl: s.rawVideoUrl || s.raw_video_url || s.videoUrl || '',
            revenueSharePercentage: s.revenueSharePercentage || s.revenue_share_percentage || 70,
            status: (s.status || 'SUBMITTED').toUpperCase(),
            reviewNotes: s.reviewNotes || s.review_notes || s.adminReviewComment || '',
            createdAt: s.createdAt || new Date().toISOString()
          }));
        } else {
          this.mySubmissions = [];
        }
      },
      error: () => {
        this.loadingSubmissions = false;
        this.mySubmissions = [];
      }
    });
  }

  getCountByStatus(status: string): number {
    return this.mySubmissions.filter((s) => (s.status || '').toUpperCase() === status.toUpperCase()).length;
  }

  // --- UPLOAD HANDLERS ---

  onUploadVideoFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.videoFileName = file.name;
    this.videoPlaybackError = false;

    if (this.localVideoPreviewUrl && this.localVideoPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localVideoPreviewUrl); } catch (_) {}
    }
    this.localVideoPreviewUrl = URL.createObjectURL(file);
    this.uploadedVideoUrl = this.localVideoPreviewUrl;

    this.uploadingVideo = true;
    this.videoUploadProgress = 0;

    const title = this.submissionForm.value.title || file.name;
    this.storageApiService.uploadVideoToBunnyStream(file, title).subscribe({
      next: (event) => {
        this.videoUploadProgress = event.progress;
        if (event.url || event.fileUrl || event.hlsUrl) {
          this.uploadedVideoUrl = event.hlsUrl || event.directPlayUrl || event.url || event.fileUrl || this.localVideoPreviewUrl;
          this.uploadingVideo = false;
          this.notificationService.success(`"${file.name}" uploaded successfully! ABR ingestion ready.`);
        }
      },
      error: () => {
        this.uploadingVideo = false;
        this.notificationService.warning('Video file loaded locally for screening preview.');
      }
    });
  }

  clearVideoAsset(): void {
    if (this.localVideoPreviewUrl && this.localVideoPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localVideoPreviewUrl); } catch (_) {}
    }
    this.localVideoPreviewUrl = '';
    this.uploadedVideoUrl = '';
    this.videoFileName = '';
  }

  onUrlInputChanged(): void {
    if (this.uploadedVideoUrl) {
      this.localVideoPreviewUrl = this.uploadedVideoUrl;
    }
  }

  onUploadPosterFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (this.localPosterPreviewUrl && this.localPosterPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localPosterPreviewUrl); } catch (_) {}
    }
    this.localPosterPreviewUrl = URL.createObjectURL(file);
    this.uploadedPosterUrl = this.localPosterPreviewUrl;

    this.storageApiService.uploadFile(file, 'posters').subscribe({
      next: (event) => {
        if (event.url || event.fileUrl) {
          this.uploadedPosterUrl = event.url || event.fileUrl || this.localPosterPreviewUrl;
          this.notificationService.success('Poster artwork uploaded successfully!');
        }
      },
      error: () => {}
    });
  }

  clearPosterAsset(): void {
    if (this.localPosterPreviewUrl && this.localPosterPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localPosterPreviewUrl); } catch (_) {}
    }
    this.localPosterPreviewUrl = '';
    this.uploadedPosterUrl = '';
  }

  onUploadBannerFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (this.localBannerPreviewUrl && this.localBannerPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localBannerPreviewUrl); } catch (_) {}
    }
    this.localBannerPreviewUrl = URL.createObjectURL(file);
    this.uploadedBannerUrl = this.localBannerPreviewUrl;

    this.storageApiService.uploadFile(file, 'banners').subscribe({
      next: (event) => {
        if (event.url || event.fileUrl) {
          this.uploadedBannerUrl = event.url || event.fileUrl || this.localBannerPreviewUrl;
          this.notificationService.success('Landscape banner uploaded successfully!');
        }
      },
      error: () => {}
    });
  }

  clearBannerAsset(): void {
    if (this.localBannerPreviewUrl && this.localBannerPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localBannerPreviewUrl); } catch (_) {}
    }
    this.localBannerPreviewUrl = '';
    this.uploadedBannerUrl = '';
  }

  onUploadTrailerFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (this.localTrailerPreviewUrl && this.localTrailerPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(this.localTrailerPreviewUrl); } catch (_) {}
    }
    this.localTrailerPreviewUrl = URL.createObjectURL(file);
    this.uploadedTrailerUrl = this.localTrailerPreviewUrl;

    this.storageApiService.uploadVideoToBunnyStream(file, `Trailer: ${file.name}`).subscribe({
      next: (event) => {
        if (event.url || event.fileUrl || event.hlsUrl) {
          this.uploadedTrailerUrl = event.hlsUrl || event.directPlayUrl || event.url || event.fileUrl || this.localTrailerPreviewUrl;
          this.notificationService.success('Trailer video attached!');
        }
      },
      error: () => {}
    });
  }

  // --- VALIDATION HELPER ---

  isFormReadyToSubmit(): boolean {
    const hasTitle = Boolean(this.submissionForm.get('title')?.value?.trim());
    const hasLang = Boolean(this.submissionForm.get('language')?.value);
    const hasVideo = Boolean(this.uploadedVideoUrl || this.localVideoPreviewUrl);
    return hasTitle && hasLang && hasVideo && !this.uploadingVideo;
  }

  getMissingFieldsHint(): string {
    const missing: string[] = [];
    if (!this.submissionForm.get('title')?.value?.trim()) missing.push('Title Name');
    if (!this.submissionForm.get('language')?.value) missing.push('Audio Language');
    if (!this.uploadedVideoUrl && !this.localVideoPreviewUrl) missing.push('Master Video Asset');
    if (this.uploadingVideo) missing.push('Video upload in progress...');
    return missing.join(' • ');
  }

  // --- EDITING & RESUBMISSION ---

  editSubmission(submission: ProducerSubmission): void {
    this.editingContentId = submission.id || null;
    this.currentEditingRejectionNotes = submission.reviewNotes || submission.adminReviewComment || null;

    this.submissionForm.patchValue({
      title: submission.title,
      contentType: submission.contentType || 'MOVIE',
      description: submission.description || '',
      revenueSharePercentage: submission.revenueSharePercentage || 70
    });

    this.uploadedVideoUrl = submission.rawVideoUrl || '';
    this.localVideoPreviewUrl = submission.rawVideoUrl || '';
    this.uploadedPosterUrl = submission.posterUrl || '';
    this.localPosterPreviewUrl = submission.posterUrl || '';
    this.uploadedBannerUrl = submission.bannerUrl || '';
    this.localBannerPreviewUrl = submission.bannerUrl || '';
    this.uploadedTrailerUrl = submission.trailerUrl || '';
    this.localTrailerPreviewUrl = submission.trailerUrl || '';

    this.activeTabIndex = 0;
    this.notificationService.info(`Loaded "${submission.title}" for editing.`);
  }

  cancelEditing(): void {
    this.editingContentId = null;
    this.currentEditingRejectionNotes = null;
    this.resetForm();
  }

  resetForm(): void {
    this.submissionForm.reset({
      contentType: 'MOVIE',
      language: 'Hindi',
      genre: 'Action',
      ageRating: 'U/A 13+',
      releaseYear: new Date().getFullYear(),
      durationMinutes: 120,
      monetization: 'AVOD',
      revenueSharePercentage: this.studioProfile?.defaultRevenueSharePercentage || 70
    });
    this.clearVideoAsset();
    this.clearPosterAsset();
    this.clearBannerAsset();
    this.uploadedTrailerUrl = '';
    this.localTrailerPreviewUrl = '';
    this.editingContentId = null;
    this.currentEditingRejectionNotes = null;
  }

  // --- SUBMISSIONS ---

  onSubmitContent(): void {
    if (!this.isFormReadyToSubmit()) {
      this.submissionForm.markAllAsTouched();
      this.notificationService.warning(`Please complete: ${this.getMissingFieldsHint()}`);
      return;
    }

    this.submitting = true;
    const formVals = this.submissionForm.value;

    const dto: ProducerSubmission = {
      id: this.editingContentId || undefined,
      title: formVals.title!,
      contentType: formVals.contentType!,
      description: formVals.description || '',
      posterUrl: this.uploadedPosterUrl || this.localPosterPreviewUrl || '',
      bannerUrl: this.uploadedBannerUrl || this.localBannerPreviewUrl || '',
      trailerUrl: this.uploadedTrailerUrl || this.localTrailerPreviewUrl || '',
      rawVideoUrl: this.uploadedVideoUrl || this.localVideoPreviewUrl,
      revenueSharePercentage: formVals.revenueSharePercentage || 70,
      status: 'SUBMITTED'
    };

    this.producerApiService.submitContent(dto).subscribe({
      next: (res) => {
        this.submitting = false;
        if (res.success) {
          const actionMsg = this.editingContentId ? 'updated & resubmitted' : 'submitted';
          this.notificationService.success(`"${dto.title}" ${actionMsg} for QC Review & ABR Transcoding!`);
          this.resetForm();
          this.loadMySubmissions();
          this.activeTabIndex = 1;
        } else {
          this.notificationService.error(res.message || 'Failed to submit title');
        }
      },
      error: (err) => {
        this.submitting = false;
        this.notificationService.error(err?.error?.message || 'Error submitting content asset');
      }
    });
  }

  saveDraftSubmission(): void {
    if (!this.submissionForm.get('title')?.value?.trim()) {
      this.notificationService.warning('Please enter a Title to save draft');
      return;
    }

    this.submitting = true;
    const formVals = this.submissionForm.value;

    const dto: ProducerSubmission = {
      id: this.editingContentId || undefined,
      title: formVals.title!,
      contentType: formVals.contentType || 'MOVIE',
      description: formVals.description || '',
      posterUrl: this.uploadedPosterUrl || '',
      bannerUrl: this.uploadedBannerUrl || '',
      trailerUrl: this.uploadedTrailerUrl || '',
      rawVideoUrl: this.uploadedVideoUrl || this.localVideoPreviewUrl || '',
      revenueSharePercentage: formVals.revenueSharePercentage || 70,
      status: 'DRAFT'
    };

    this.producerApiService.submitContent(dto).subscribe({
      next: (res) => {
        this.submitting = false;
        if (res.success) {
          this.notificationService.success(`Draft "${dto.title}" saved successfully!`);
          this.resetForm();
          this.loadMySubmissions();
          this.activeTabIndex = 1;
        } else {
          this.notificationService.error(res.message || 'Failed to save draft');
        }
      },
      error: (err) => {
        this.submitting = false;
        this.notificationService.error(err?.error?.message || 'Error saving draft');
      }
    });
  }

  // --- SCREENING PREVIEW MODAL ---

  openVideoPreview(videoUrl: string): void {
    if (!videoUrl) {
      this.notificationService.warning('No video asset attached for preview');
      return;
    }
    this.videoPlaybackError = false;
    this.previewModalVideoUrl = videoUrl;
  }

  closeVideoPreview(): void {
    this.previewModalVideoUrl = null;
    this.videoPlaybackError = false;
  }

  onVideoPlayerError(event: any): void {
    console.warn('Playback error or codec note:', event);
    this.videoPlaybackError = true;
  }

  getSafeVideoUrl(url: string | null): SafeResourceUrl {
    if (!url) return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    let embedUrl = url.trim();
    if (url.includes('youtube.com/watch?v=')) {
      const parts = url.split('watch?v=');
      const videoId = parts[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const parts = url.split('youtu.be/');
      const videoId = parts[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('vimeo.com/') && !url.includes('player.vimeo.com')) {
      const parts = url.split('vimeo.com/');
      const videoId = parts[1]?.split('?')[0];
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  isEmbedUrl(url: string | null): boolean {
    if (!url) return false;
    const clean = url.toLowerCase();
    return clean.includes('youtube.com') || clean.includes('youtu.be') || clean.includes('vimeo.com') || clean.includes('iframe') || clean.includes('mediadelivery.net');
  }

  onPosterImgError(event: any): void {
    if (event?.target) {
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300"><rect width="200" height="300" fill="%2310101c"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2300d2ff" font-family="sans-serif" font-size="13">Poster Artwork</text></svg>';
    }
  }

  onBannerImgError(event: any): void {
    if (event?.target) {
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="%2310101c"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2300d2ff" font-family="sans-serif" font-size="14">Landscape Banner</text></svg>';
    }
  }
}
