import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ActivatedRoute, Router } from '@angular/router';
import { MediaUploadComponent } from '../../shared/components/media-upload/media-upload.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NotificationService } from '../../shared/services/notification.service';
import { MovieApiService, Movie } from '../../core/services/movie-api.service';
import { ProducerApiService } from '../../core/services/producer-api.service';
import { CatalogApiService } from '../../core/services/catalog-api.service';
import { AuthStore } from '../../core/auth/auth.store';
import { environment } from '../../../environments/environment';
import { formatLanguage, formatMaturityRating, generatePosterPlaceholder } from '../../shared/utils/formatters';

@Component({
  selector: 'app-movie-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MatProgressBarModule,
    MediaUploadComponent
  ],
  template: `
    <div class="page-container">
      <!-- 0. TOP FLOATING STICKY QUICK NAVIGATION BAR -->
      <div class="quick-nav-bar">
        <div class="nav-pills">
          <button type="button" class="nav-pill" [class.active]="activeStep === 1" (click)="scrollToSection('sec-1', 1)">
            <span class="step-num">01</span> Metadata
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 2" (click)="scrollToSection('sec-3', 2)">
            <span class="step-num">02</span> Video Sources
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 3" (click)="scrollToSection('sec-4', 3)">
            <span class="step-num">03</span> Subtitles
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 4" (click)="scrollToSection('sec-5', 4)">
            <span class="step-num">04</span> Monetization
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 5" (click)="scrollToSection('sec-6', 5)">
            <span class="step-num">05</span> DRM & Geo
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 6" (click)="scrollToSection('sec-7', 6)">
            <span class="step-num">06</span> SEO & Chapters
          </button>
        </div>
        <div class="quick-nav-actions">
          <button type="button" mat-flat-button color="accent" class="btn-ai-nav" (click)="triggerAiAutoFill()">
            <mat-icon>auto_awesome</mat-icon> AI Auto-Fill
          </button>
          <button mat-stroked-button color="basic" (click)="onCancel()" class="btn-back">
            <mat-icon>arrow_back</mat-icon> Catalog
          </button>
          <button type="button" mat-stroked-button class="btn-top-draft" (click)="submitWithStatus('DRAFT')" [disabled]="loading">
            <mat-icon>drafts</mat-icon> Save Draft
          </button>
          <button type="button" mat-stroked-button class="btn-top-schedule" (click)="submitWithStatus('SCHEDULED')" [disabled]="loading">
            <mat-icon>schedule_send</mat-icon> Schedule
          </button>
          <button type="button" mat-flat-button color="warn" class="btn-top-submit" (click)="submitWithStatus('PUBLISHED')" [disabled]="loading">
            <mat-icon>{{ isEdit ? 'save' : 'cloud_upload' }}</mat-icon> {{ isEdit ? 'Update & Publish' : 'Publish Now' }}
          </button>
        </div>
      </div>

      <!-- MAIN FORM CONTAINER -->
      <mat-card class="form-card">
        <div class="form-header">
          <div class="header-titles">
            <span class="catalog-badge"><mat-icon>{{ categoryStudioIcon }}</mat-icon> {{ categoryStudioBadge }}</span>
            <h1>{{ isEdit ? ('Edit ' + categoryStudioName) : ('Create & Publish ' + categoryStudioName) }}</h1>
            <p>{{ categoryStudioDescription }}</p>
          </div>
        </div>

        <!-- MULTI-PART CONTENT NOTICE FOR SERIES / ALBUMS -->
        <div *ngIf="isSeriesOrAlbum" class="category-redirect-banner">
          <div class="banner-left">
            <mat-icon class="banner-icon">auto_stories</mat-icon>
            <div>
              <h4>{{ getSelectedTypeLabel() }} Studio Available</h4>
              <p>For multi-season episodes, multi-track audio albums, or microdrama vertical reels, you can switch to the dedicated studio.</p>
            </div>
          </div>
          <button type="button" mat-flat-button color="accent" class="btn-jump-studio" (click)="goToSeriesStudio()">
            <mat-icon>open_in_new</mat-icon> Open Series & Album Studio
          </button>
        </div>

        <mat-card-content class="form-content">
          <form [formGroup]="contentForm" (ngSubmit)="onSubmit()">

            <!-- 1. GENERAL INFORMATION SECTION -->
            <div id="sec-1" class="section-block">
              <div class="section-header">
                <span class="section-num">01</span>
                <div>
                  <h3 class="section-title">General Metadata</h3>
                  <p class="section-subtitle">Title, Main Type, Category, Language, Cast, and Release attributes</p>
                </div>
                <button type="button" class="btn-ai-fill" (click)="triggerAiAutoFill()" matTooltip="Auto-generate synopsis and tags using AI">
                  <mat-icon>auto_awesome</mat-icon> ✨ AI Auto-Fill
                </button>
              </div>

              <!-- INLINE SCHEDULE DATE & TIME PICKER (shown when Publish Later is selected) -->
              <div id="schedule-picker-box" class="schedule-picker-box" *ngIf="contentForm.value.status === 'SCHEDULED'">
                <div class="schedule-picker-header">
                  <mat-icon>event_available</mat-icon>
                  <div>
                    <strong>Schedule Auto-Publish Date &amp; Time</strong>
                    <span>Content stays hidden from Web &amp; Mobile until this exact date &amp; time, then goes live automatically.</span>
                  </div>
                </div>
                <div class="form-row" style="gap: 16px; margin-top: 12px;">
                  <mat-form-field appearance="outline" class="half-width">
                    <mat-label>Publish Date &amp; Time *</mat-label>
                    <input matInput type="datetime-local" formControlName="scheduledPublishAt" [min]="minScheduleDateTime">
                    <mat-icon matSuffix>schedule</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="half-width">
                    <mat-label>Auto-Expire / License End (Optional)</mat-label>
                    <input matInput type="datetime-local" formControlName="expiresAt">
                    <mat-icon matSuffix>event_busy</mat-icon>
                  </mat-form-field>
                </div>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>{{ categoryTitleLabel }}</mat-label>
                <input matInput formControlName="title" [placeholder]="categoryTitlePlaceholder" required>
                <mat-icon matSuffix color="primary">{{ categoryStudioIcon }}</mat-icon>
              </mat-form-field>

              <div class="form-row">
                <!-- Main Type + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Main Type *</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewMainType()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="contentType">
                      <mat-option *ngFor="let type of mainTypesList" [value]="type.value">{{ type.label }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <!-- Category (Sub Type) + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Category (Sub Type) *</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewCategory()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="category" multiple>
                      <mat-option *ngFor="let cat of activeCategoriesList" [value]="cat">{{ cat }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <div class="form-row">
                <!-- Genres / Sub-Types + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Genres / Sub-Types</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewGenre()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="genres" multiple>
                      <mat-option *ngFor="let g of activeGenresList" [value]="g">{{ g }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <!-- Language + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Original Language *</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewLanguage()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="originalLanguage">
                      <mat-option *ngFor="let lang of languagesList" [value]="lang">{{ lang }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- PODCAST & YOUTUBE DEDICATED CONTROLS -->
              <div *ngIf="isPodcast" class="specialized-category-box podcast-box">
                <div class="box-title"><mat-icon color="warn">smart_display</mat-icon> YouTube Sync & Podcast Feed Options</div>
                <div class="form-row">
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>YouTube Names Option / Channel URL</mat-label>
                      <input matInput formControlName="youtubeOption" placeholder="e.g. Channel Name, Episode Title, or Channel URL">
                      <mat-icon matSuffix color="warn">smart_display</mat-icon>
                    </mat-form-field>
                  </div>
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Direct YouTube Video ID / URL</mat-label>
                      <input matInput formControlName="masterPlaylistUrl" placeholder="https://www.youtube.com/watch?v=...">
                      <mat-icon matSuffix color="accent">link</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
                <div class="form-row">
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Podcast Host Name</mat-label>
                      <input matInput formControlName="podcastHost" placeholder="e.g. Podcast Host">
                      <mat-icon matSuffix color="primary">mic</mat-icon>
                    </mat-form-field>
                  </div>
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Guest Speaker(s)</mat-label>
                      <input matInput formControlName="podcastGuest" placeholder="e.g. Featured Guest">
                      <mat-icon matSuffix color="accent">person_pin</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
                <div class="form-row">
                  <div class="full-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Master Audio Podcast Stream URL (.mp3 / RSS feed)</mat-label>
                      <input matInput formControlName="podcastAudioUrl" placeholder="https://cdn.example.com/podcasts/ep1.mp3">
                      <mat-icon matSuffix color="primary">audiotrack</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
              </div>

              <!-- STAGE DRAMA DEDICATED CONTROLS -->
              <div *ngIf="isStageDrama" class="specialized-category-box drama-box">
                <div class="box-title"><mat-icon color="accent">theater_comedy</mat-icon> Traditional Stage Drama Details (Pouranika / Samajika)</div>
                <div class="form-row">
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Drama Troupe / Theater Company</mat-label>
                      <input matInput formControlName="dramaTroupe" placeholder="e.g. Surabhi Nataka Mandali">
                      <mat-icon matSuffix color="accent">groups</mat-icon>
                    </mat-form-field>
                  </div>
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Playwright / Script Writer</mat-label>
                      <input matInput formControlName="playwright" placeholder="e.g. Traditional Playwright">
                      <mat-icon matSuffix color="primary">edit_note</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
              </div>

              <!-- DOCUMENTARY DEDICATED CONTROLS -->
              <div *ngIf="isDocumentary" class="specialized-category-box doc-box">
                <div class="box-title"><mat-icon color="primary">menu_book</mat-icon> Documentary & Factual Investigation Details</div>
                <div class="form-row">
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Subject / Historical Theme</mat-label>
                      <input matInput formControlName="docTopic" placeholder="e.g. Heritage Architecture & Ecology">
                      <mat-icon matSuffix color="accent">history_edu</mat-icon>
                    </mat-form-field>
                  </div>
                  <div class="half-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Narrator / Voiceover Artist</mat-label>
                      <input matInput formControlName="docNarrator" placeholder="e.g. Documentary Narrator">
                      <mat-icon matSuffix color="primary">record_voice_over</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <!-- Cast + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">{{ isPodcast ? 'Panelists & Co-Hosts' : (isStageDrama ? 'Stage Performers' : (isDocumentary ? 'Interviewees & Researchers' : 'Cast Members')) }}</label>
                    <button type="button" class="btn-add-new" (click)="showAddCastBox = !showAddCastBox"><mat-icon>{{ showAddCastBox ? 'close' : 'add' }}</mat-icon> {{ showAddCastBox ? 'Close' : 'Add Cast Person' }}</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="cast" multiple>
                      <mat-option *ngFor="let actor of castList" [value]="actor">
                        <span style="display:inline-flex; align-items:center; gap:8px;">
                          <img *ngIf="getCastPhoto(actor)" [src]="getCastPhoto(actor)" style="width:22px;height:22px;border-radius:50%;object-fit:cover;">
                          <span>{{ actor }}</span>
                          <span *ngIf="getCastRole(actor)" style="opacity:0.65;font-size:11px;">({{ getCastRole(actor) }})</span>
                        </span>
                      </mat-option>
                    </mat-select>
                  </mat-form-field>

                  <!-- Inline Add Cast Person Card (Name, Role, Profile Photo, Bio) -->
                  <div *ngIf="showAddCastBox" style="padding:12px; border:1px solid rgba(255,255,255,0.12); border-radius:10px; margin-bottom:14px; background:rgba(255,255,255,0.03);">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                      <mat-form-field appearance="outline">
                        <mat-label>Person Name *</mat-label>
                        <input matInput #newCastName placeholder="e.g. Prabhas, Deepika Padukone">
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Role</mat-label>
                        <input matInput #newCastRole value="Actor" placeholder="Actor, Actress, Director">
                      </mat-form-field>
                    </div>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Short Bio (Optional)</mat-label>
                      <input matInput #newCastBio placeholder="Brief biography...">
                    </mat-form-field>
                    <div style="margin-bottom:10px;">
                      <app-media-upload folder="avatars" label="Upload Profile Photo" accept="image/*" [initialUrl]="newCastPhotoUrl" (uploadComplete)="newCastPhotoUrl = $event"></app-media-upload>
                    </div>
                    <button type="button" mat-flat-button color="accent" (click)="saveNewCastPerson(newCastName.value, newCastRole.value, newCastBio.value)">
                      <mat-icon>person_add</mat-icon> Save Cast Person
                    </button>
                  </div>
                </div>

                <!-- Producer + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">{{ isPodcast ? 'Podcast Network' : (isStageDrama ? 'Troupe Producer' : 'Producer / House') }}</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewProducer()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="producer">
                      <mat-option value="">Select Producer</mat-option>
                      <mat-option *ngFor="let prod of producersList" [value]="prod">{{ prod }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <div class="form-row">
                <!-- Release Date -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Release Date</label>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <input matInput type="date" formControlName="releaseDate">
                  </mat-form-field>
                </div>

                <!-- Video Duration Field -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Run Time / Duration *</label>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <input matInput formControlName="durationTime" [placeholder]="isShortFilm ? 'e.g. 18m 30s' : (isPodcast ? 'e.g. 45m 00s' : 'e.g. 2h40m20s or 02:40:20')">
                    <mat-icon matSuffix color="accent">timer</mat-icon>
                  </mat-form-field>
                  <div class="duration-badge-card">
                    <mat-icon class="clock-icon">schedule</mat-icon>
                    <span>Parsed Run Time: <strong>{{ getParsedDurationSummary() }}</strong></span>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <!-- Maturity Rating -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Maturity Age Rating</label>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="maturityRating">
                      <mat-option value="U">U (Universal - All Ages)</mat-option>
                      <mat-option value="UA_7+">U/A 7+ (Parental Guidance 7+)</mat-option>
                      <mat-option value="UA_13+">U/A 13+ (Parental Guidance 13+)</mat-option>
                      <mat-option value="UA_16+">U/A 16+ (Parental Guidance 16+)</mat-option>
                      <mat-option value="A">A 18+ (Adults Only 18+)</mat-option>
                      <mat-option value="PG-13">PG-13 (International)</mat-option>
                      <mat-option value="TV-MA">TV-MA (Mature Audience)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- 2. MULTI-RESOLUTION VIDEO SOURCE UPLOADS SECTION -->
            <div id="sec-3" class="section-block">
              <div class="section-header">
                <span class="section-num">02</span>
                <div>
                  <h3 class="section-title">Multi-Resolution Video Feeds (320p to 4K)</h3>
                  <p class="section-subtitle">Direct S3 bucket uploads or HLS adaptive master stream links</p>
                </div>
                <button type="button" class="btn-preview-stream" (click)="toggleVideoPreview()">
                  <mat-icon>play_circle</mat-icon> {{ showPreviewPlayer ? 'Close Inspector' : 'Inspect Stream' }}
                </button>
              </div>

              <!-- LIVE PLAYER STREAM INSPECTOR MODAL/BOX -->
              <div *ngIf="showPreviewPlayer" class="video-inspector-box">
                <div class="inspector-header">
                  <span><mat-icon>video_settings</mat-icon> Stream Playback Inspector</span>
                  <span class="stream-url-tag">{{ getActiveStreamUrl() || 'No Stream Loaded' }}</span>
                </div>
                <div class="inspector-player-wrapper">
                  <iframe *ngIf="getActiveStreamUrl() && isEmbedUrl()" [src]="getSafeEmbedUrl()" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="preview-video-element"></iframe>
                  <video *ngIf="getActiveStreamUrl() && !isEmbedUrl()" [src]="getActiveStreamUrl()" controls autoplay class="preview-video-element"></video>
                  <div *ngIf="!getActiveStreamUrl()" class="no-stream-placeholder">
                    <mat-icon>no_encryption</mat-icon>
                    <p>Enter a video URL or upload a video resolution file below to inspect live playback.</p>
                  </div>
                </div>
              </div>

              <!-- BUNNY.NET STREAM HLS LINK PIPELINE (NO LOCAL VIDEO UPLOADS) -->
              <div class="bunny-stream-card">
                <div class="bunny-header">
                  <div class="bunny-title-group">
                    <span class="bunny-icon">🐰</span>
                    <div>
                      <h4>Bunny.net Stream HLS Video Pipeline</h4>
                      <p>Paste your Bunny Stream HLS URL (.m3u8) or Video GUID for global multi-bitrate delivery</p>
                    </div>
                  </div>
                  <span class="res-badge primary">Native HLS (.m3u8)</span>
                </div>

                <div class="bunny-body">
                  <!-- 1. Direct Video Upload to Bunny Stream -->
                  <div class="bunny-upload-row">
                    <input type="file" #directBunnyVideoInput (change)="onBunnyVideoSelected($event)" accept="video/*" style="display:none">
                    <button type="button" mat-raised-button color="accent" class="btn-direct-bunny-upload" (click)="directBunnyVideoInput.click()" [disabled]="bunnyVideoUploading">
                      <mat-icon>{{ bunnyVideoUploading ? 'sync' : 'cloud_upload' }}</mat-icon> {{ bunnyVideoUploading ? 'Uploading to Bunny Stream (' + bunnyVideoProgress + '%)...' : 'Upload Video Directly to Bunny Stream' }}
                    </button>
                    <span class="or-separator">OR PASTE HLS LINK BELOW</span>
                  </div>

                  <!-- Upload Progress Bar -->
                  <div class="bunny-upload-progress" *ngIf="bunnyVideoUploading">
                    <div class="progress-info">
                      <span><mat-icon class="spin">sync</mat-icon> Uploading video binary to Bunny Stream Video Library...</span>
                      <span>{{ bunnyVideoProgress }}%</span>
                    </div>
                    <mat-progress-bar mode="determinate" [value]="bunnyVideoProgress" class="bar"></mat-progress-bar>
                  </div>

                  <!-- 1b. Stream Large Video from Google Drive -> Bunny Stream (Zero-Disk) -->
                  <div class="bunny-link-input-group full-width" style="margin-top: 12px;">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Paste Google Drive Video Link (1 GB - 100+ GB Zero-Disk Stream)</mat-label>
                      <input matInput #gdriveLinkInput placeholder="https://drive.google.com/file/d/FILE_ID/view?usp=sharing" [disabled]="gdriveStreaming">
                      <mat-icon matSuffix color="accent">add_to_drive</mat-icon>
                    </mat-form-field>
                    <button type="button" mat-raised-button color="primary" class="btn-apply-bunny" (click)="streamFromGoogleDrive(gdriveLinkInput.value)" [disabled]="gdriveStreaming">
                      <mat-icon>{{ gdriveStreaming ? 'sync' : 'cloud_sync' }}</mat-icon>
                      {{ gdriveStreaming ? 'Streaming (' + gdriveProgress + '%)...' : 'Stream from GDrive' }}
                    </button>
                  </div>

                  <div class="bunny-upload-progress" *ngIf="gdriveStreaming">
                    <div class="progress-info">
                      <span><mat-icon class="spin">sync</mat-icon> {{ gdriveStatusText }}</span>
                      <span>{{ gdriveProgress }}%</span>
                    </div>
                    <mat-progress-bar mode="determinate" [value]="gdriveProgress" class="bar"></mat-progress-bar>
                  </div>

                  <!-- 1c. Google Drive OAuth Login & Shared/My Drive Video Picker -->
                  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px; margin-bottom:10px;">
                    <button type="button" mat-stroked-button color="accent" (click)="connectGoogleDrive()">
                      <mat-icon>vpn_key</mat-icon>
                      {{ gdriveConnected ? 'Reconnect Google Drive (Connected)' : 'Login Google Drive (Private Files)' }}
                    </button>
                    <button type="button" mat-stroked-button color="primary" (click)="toggleGDriveVideoBrowser('shared')" [disabled]="gdriveStreaming">
                      <mat-icon>folder_shared</mat-icon>
                      Browse Shared with Me
                    </button>
                    <button type="button" mat-stroked-button (click)="toggleGDriveVideoBrowser('my')" [disabled]="gdriveStreaming">
                      <mat-icon>add_to_drive</mat-icon>
                      Browse My Drive
                    </button>
                  </div>

                  <div *ngIf="showGdriveVideoBrowser" style="margin-bottom:12px; padding:10px; border-radius:8px; background:#141422; border:1px solid #2a2a42;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                      <strong style="font-size:12px; color:#00d2ff;">Google Drive Videos ({{ gdriveBrowseScope === 'shared' ? 'Shared with me' : 'My Drive' }})</strong>
                      <input type="text" #gdriveSearchInput [value]="gdriveBrowseSearch" (input)="gdriveBrowseSearch = gdriveSearchInput.value" (keyup.enter)="loadGDriveVideos(gdriveBrowseScope)" placeholder="Filter by filename..." style="flex:1; height:30px; background:#10101a; border:1px solid #2a2a42; border-radius:6px; color:#fff; padding:0 8px; font-size:12px;">
                      <button type="button" mat-icon-button (click)="loadGDriveVideos(gdriveBrowseScope)"><mat-icon>refresh</mat-icon></button>
                      <button type="button" mat-icon-button (click)="showGdriveVideoBrowser = false"><mat-icon>close</mat-icon></button>
                    </div>
                    <div *ngIf="gdriveBrowseLoading" style="font-size:12px; opacity:0.75; padding:8px;">Loading videos from Google Drive...</div>
                    <div *ngIf="!gdriveBrowseLoading && gdriveVideoFiles.length === 0" style="font-size:12px; opacity:0.75; padding:8px;">No video files found. Make sure you clicked "Login Google Drive" first.</div>
                    <div *ngIf="!gdriveBrowseLoading && gdriveVideoFiles.length > 0" style="max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;">
                      <div *ngFor="let vf of gdriveVideoFiles" style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 10px; background:#1a1a2b; border-radius:6px; border:1px solid #2a2a42;">
                        <span style="font-size:12px; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">{{ vf.name }}</span>
                        <button type="button" mat-flat-button color="primary" style="height:28px; font-size:11px; flex-shrink:0;" (click)="selectGDriveVideo(vf, gdriveLinkInput)">
                          <mat-icon style="font-size:15px; width:15px; height:15px;">cloud_sync</mat-icon> Stream
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="bunny-link-input-group full-width" *ngIf="showGdriveCodeBox" style="margin-bottom:12px;">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Paste the redirected URL (http://localhost/?code=...) or Google Auth Code</mat-label>
                      <input matInput #gdriveAuthCodeInput placeholder="http://localhost/?code=4/0A...&scope=...">
                    </mat-form-field>
                    <button type="button" mat-flat-button color="accent" (click)="submitGoogleDriveCode(gdriveAuthCodeInput.value)">
                      <mat-icon>check</mat-icon> Save Login
                    </button>
                  </div>

                  <!-- 2. Manual Bunny Stream HLS URL / GUID input -->
                  <div class="bunny-link-input-group full-width">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Bunny Stream HLS URL / Master Playlist (.m3u8) or Video GUID *</mat-label>
                      <input matInput #manualBunnyInput formControlName="masterPlaylistUrl" placeholder="https://vz-xxxx.b-cdn.net/<video-guid>/playlist.m3u8">
                      <mat-icon matSuffix color="accent">link</mat-icon>
                    </mat-form-field>
                    <button type="button" mat-flat-button color="primary" class="btn-apply-bunny" (click)="applyBunnyStreamUrl(manualBunnyInput.value)">
                      <mat-icon>play_circle</mat-icon> Apply & Inspect Stream
                    </button>
                  </div>

                  <!-- Configured Stream Result / Status Card -->
                  <div class="bunny-status-card" *ngIf="contentForm.value.masterPlaylistUrl">
                    <div class="status-top-row">
                      <div class="status-left">
                        <mat-icon class="status-icon" [style.color]="bunnyStatusColor">check_circle</mat-icon>
                        <div>
                          <span class="status-label">Stream HLS URL Configured</span>
                          <span class="status-url font-mono">{{ contentForm.value.masterPlaylistUrl }}</span>
                        </div>
                      </div>
                      <div class="status-actions">
                        <button type="button" mat-icon-button color="warn" (click)="clearBunnyStream()" matTooltip="Clear HLS URL">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            <!-- 3. TRAILERS & SUBTITLE TRACKS SECTION -->
            <div id="sec-4" class="section-block">
              <div class="section-header">
                <span class="section-num">03</span>
                <div>
                  <h3 class="section-title">Trailers & Subtitles</h3>
                  <p class="section-subtitle">Promotional teaser trailers and multi-language VTT/SRT closed captions</p>
                </div>
              </div>

              <div class="form-row">
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Trailer Format</label>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-select formControlName="trailerType">
                      <mat-option value="Server Video">Server Video File</mat-option>
                      <mat-option value="Youtube Embed">YouTube / Vimeo Embed</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <div class="half-width">
                  <label class="custom-label">Upload Trailer File</label>
                  <app-media-upload folder="trailers" label="Upload Trailer Video" accept="video/*" [initialUrl]="contentForm.value.trailerUrl || ''" (uploadComplete)="onTrailerUploaded($event)"></app-media-upload>
                </div>
              </div>

              <!-- Multi Subtitle Tracks Form Array -->
              <div formArrayName="subtitles" class="subtitles-block">
                <label class="subtitle-header-label">Multi-Language Subtitle Tracks</label>

                <div *ngFor="let sub of subtitles.controls; let i=index" [formGroupName]="i" class="subtitle-row">
                  <mat-form-field appearance="outline" class="sub-lang-field">
                    <mat-label>Language Name</mat-label>
                    <input matInput formControlName="languageName" placeholder="e.g. English, Telugu">
                  </mat-form-field>

                  <div class="sub-upload-field">
                    <app-media-upload folder="subtitles" [label]="'Upload Subtitle (' + (i+1) + ')'" accept=".vtt,.srt" [initialUrl]="sub.value.fileUrl || ''" (uploadComplete)="onSubtitleUploaded(i, $event)"></app-media-upload>
                  </div>

                  <button mat-icon-button color="warn" type="button" (click)="removeSubtitleTrack(i)" *ngIf="subtitles.length > 1" matTooltip="Remove Track">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>

                <button mat-stroked-button color="accent" type="button" (click)="addSubtitleTrack()" class="btn-add-sub">
                  <mat-icon>add</mat-icon> Add Additional Subtitle Language
                </button>
              </div>

              <!-- Multi-Language Audio / Dubbed Tracks Form Array -->
              <div formArrayName="audioTracks" class="subtitles-block" style="margin-top: 20px;">
                <label class="subtitle-header-label">Multi-Language Audio / Dubbed Video Tracks</label>

                <div *ngFor="let track of audioTracks.controls; let i=index" [formGroupName]="i" class="subtitle-row">
                  <mat-form-field appearance="outline" class="sub-lang-field">
                    <mat-label>Audio Language</mat-label>
                    <input matInput formControlName="languageName" placeholder="e.g. Hindi, Telugu, Tamil">
                  </mat-form-field>

                  <mat-form-field appearance="outline" style="flex: 1;">
                    <mat-label>Dubbed HLS (.m3u8) / Audio File URL</mat-label>
                    <input matInput formControlName="url" placeholder="https://vz-...b-cdn.net/<guid>/playlist.m3u8">
                  </mat-form-field>

                  <button mat-icon-button color="warn" type="button" (click)="removeAudioTrack(i)" matTooltip="Remove Audio Track">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>

                <button mat-stroked-button color="accent" type="button" (click)="addAudioTrack()" class="btn-add-sub">
                  <mat-icon>add</mat-icon> Add Dubbed Language Track
                </button>
              </div>
            </div>

            <!-- 4. ARTWORK & MONETIZATION SECTION -->
            <div id="sec-5" class="section-block">
              <div class="section-header">
                <span class="section-num">04</span>
                <div>
                  <h3 class="section-title">Artwork & Monetization</h3>
                  <p class="section-subtitle">Plot description, 3:4 poster thumbnail, 16:9 banner, and subscription tiering</p>
                </div>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Synopsis / Description</mat-label>
                <textarea matInput formControlName="description" rows="4" placeholder="Enter storyline description..."></textarea>
              </mat-form-field>

              <div class="form-row artwork-row">
                <div class="half-width artwork-card">
                  <label class="custom-label">Poster Image (3:4 Ratio)</label>
                  <app-media-upload folder="posters" label="Thumbnail Image (3:4 Poster)" accept="image/*" [initialUrl]="contentForm.value.posterUrl || ''" (uploadComplete)="onPosterUploaded($event)" (previewChange)="localPosterPreview = $event"></app-media-upload>
                  <div *ngIf="localPosterPreview || contentForm.value.posterUrl" class="image-preview">
                    <img [src]="localPosterPreview || contentForm.value.posterUrl" alt="Poster Preview" (error)="onPosterImgError($event)">
                  </div>
                </div>

                <div class="half-width artwork-card">
                  <label class="custom-label">Landscape Banner (16:9 Ratio)</label>
                  <app-media-upload folder="banners" label="Landscape Image (16:9 Banner)" accept="image/*" [initialUrl]="contentForm.value.bannerUrl || ''" (uploadComplete)="onBannerUploaded($event)" (previewChange)="localBannerPreview = $event"></app-media-upload>
                  <div *ngIf="localBannerPreview || contentForm.value.bannerUrl" class="image-preview banner">
                    <img [src]="localBannerPreview || contentForm.value.bannerUrl" alt="Banner Preview" (error)="onBannerImgError($event)">
                  </div>
                </div>
              </div>

              <!-- Netflix / Hotstar Style Title Logo PNG + Content Warnings + Quality Badges + Schedule -->
              <div class="artwork-card" style="margin-top: 14px; margin-bottom: 18px;">
                <label class="custom-label">Transparent Title Logo (PNG — Optional for Hero Banner)</label>
                <app-media-upload folder="branding" label="Upload Transparent Title Logo (PNG)" accept="image/png,image/webp,image/svg+xml" [initialUrl]="contentForm.value.logoImageUrl || ''" (uploadComplete)="contentForm.patchValue({ logoImageUrl: $event })"></app-media-upload>
                <div *ngIf="contentForm.value.logoImageUrl" style="margin-top:8px; padding:10px; background:rgba(0,0,0,0.45); border-radius:8px; display:inline-block;">
                  <img [src]="contentForm.value.logoImageUrl" alt="Title Logo" style="max-height:56px; max-width:240px; object-fit:contain;">
                </div>
              </div>

              <div class="form-row" style="gap: 16px; margin-bottom: 8px;">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Content Advisory Descriptors (IT Rules)</mat-label>
                  <mat-select formControlName="contentWarnings" multiple>
                    <mat-option *ngFor="let w of contentWarningOptions" [value]="w">{{ w }}</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>Quality &amp; Audio Badges</mat-label>
                  <mat-select formControlName="qualityBadges" multiple>
                    <mat-option *ngFor="let b of qualityBadgeOptions" [value]="b">{{ b }}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="form-row" style="gap: 16px; margin-bottom: 14px;" *ngIf="contentForm.value.status !== 'SCHEDULED'">
                <mat-form-field appearance="outline" class="half-width">
                  <mat-label>License Expiry Date (Optional)</mat-label>
                  <input matInput type="datetime-local" formControlName="expiresAt">
                  <mat-hint>Automatically archives title after this date</mat-hint>
                </mat-form-field>
              </div>

              <div class="monetization-card">
                <label class="monetization-title"><mat-icon>monetization_on</mat-icon> Monetization Model *</label>
                <mat-radio-group formControlName="monetization" color="warn" class="monetization-grid">
                  <div class="model-option" [class.selected]="contentForm.value.monetization === 'AVOD'">
                    <mat-radio-button value="AVOD">
                      <div class="option-content">
                        <span class="model-name">AVOD</span>
                        <span class="model-desc">Ad-supported Free Content</span>
                      </div>
                    </mat-radio-button>
                  </div>

                  <div class="model-option" [class.selected]="contentForm.value.monetization === 'TVOD'">
                    <mat-radio-button value="TVOD">
                      <div class="option-content">
                        <span class="model-name">TVOD / Rent</span>
                        <span class="model-desc">Pay-Per-View Rental</span>
                      </div>
                    </mat-radio-button>
                  </div>

                  <div class="model-option" [class.selected]="contentForm.value.monetization === 'SVOD'">
                    <mat-radio-button value="SVOD">
                      <div class="option-content">
                        <span class="model-name">SVOD</span>
                        <span class="model-desc">Included in Subscription</span>
                      </div>
                    </mat-radio-button>
                  </div>
                </mat-radio-group>

                <!-- TVOD Configuration block -->
                <div class="tvod-config-block" *ngIf="contentForm.value.monetization === 'TVOD'">
                  <div class="tvod-config-header">
                    <mat-icon class="tvod-icon">local_activity</mat-icon>
                    <div>
                      <h4>Transactional Video On Demand (Rental) Settings</h4>
                      <p>Specify the pay-per-view rental price in INR and the viewing access duration in hours</p>
                    </div>
                  </div>

                  <div class="form-row tvod-inputs-row">
                    <mat-form-field appearance="outline" class="half-width">
                      <mat-label>Rental Price (INR ₹)</mat-label>
                      <span matPrefix class="currency-prefix">₹&nbsp;</span>
                      <input matInput type="number" formControlName="rentPrice" placeholder="e.g. 99" min="0">
                      <mat-hint>Amount user pays to unlock rental access</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="half-width">
                      <mat-label>Rental Validity (Hours)</mat-label>
                      <input matInput type="number" formControlName="validityHours" placeholder="e.g. 48" min="1">
                      <span matSuffix class="hours-suffix">&nbsp;Hours</span>
                      <mat-hint>Viewing window from time of purchase (e.g. 48h = 2 days)</mat-hint>
                    </mat-form-field>
                  </div>

                  <div class="tvod-preset-chips">
                    <span class="preset-label">Price:</span>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.rentPrice === 49" (click)="setRentPrice(49)">₹49</button>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.rentPrice === 99" (click)="setRentPrice(99)">₹99</button>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.rentPrice === 149" (click)="setRentPrice(149)">₹149</button>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.rentPrice === 199" (click)="setRentPrice(199)">₹199</button>
                    <span class="preset-sep">|</span>
                    <span class="preset-label">Validity:</span>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.validityHours === 24" (click)="setValidityHours(24)">24h</button>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.validityHours === 48" (click)="setValidityHours(48)">48h</button>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.validityHours === 72" (click)="setValidityHours(72)">72h</button>
                    <button type="button" class="preset-chip" [class.active]="contentForm.value.validityHours === 168" (click)="setValidityHours(168)">7 Days</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 5. DRM SECURITY & GEO-RESTRICTION SECTION -->
            <div id="sec-6" class="section-block">
              <div class="section-header">
                <span class="section-num">05</span>
                <div>
                  <h3 class="section-title">DRM & Regional Restrictions</h3>
                  <p class="section-subtitle">Digital rights management protection, geo-fencing, and licensing windows</p>
                </div>
              </div>

              <div class="form-row">
                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>DRM Protection System</mat-label>
                    <mat-select formControlName="drmSystem">
                      <mat-option value="NONE">None (Standard HLS)</mat-option>
                      <mat-option value="WIDEVINE">Google Widevine Modular L1/L3</mat-option>
                      <mat-option value="FAIRPLAY">Apple FairPlay Streaming (FPS)</mat-option>
                      <mat-option value="MULTI_DRM">Multi-DRM (Widevine + FairPlay + PlayReady)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Geo-Restriction Fencing</mat-label>
                    <mat-select formControlName="geoRestrictions" multiple>
                      <mat-option value="GLOBAL">Global (All Countries Allowed)</mat-option>
                      <mat-option value="IN">India (IN)</mat-option>
                      <mat-option value="US">North America (US / CA)</mat-option>
                      <mat-option value="EU">European Union (EU)</mat-option>
                      <mat-option value="APAC">Asia-Pacific (APAC)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- 6. SEO METADATA & CHAPTER TIMESTAMPS SECTION -->
            <div id="sec-7" class="section-block">
              <div class="section-header">
                <span class="section-num">06</span>
                <div>
                  <h3 class="section-title">SEO & Skip Chapter Timestamps</h3>
                  <p class="section-subtitle">Search engine meta tags, skip intro/outro markers, and chapter timestamps</p>
                </div>
              </div>

              <div class="form-row">
                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Skip Intro Start Time (HH:MM:SS)</mat-label>
                    <input matInput formControlName="skipIntroStart" placeholder="00:01:15">
                  </mat-form-field>
                </div>

                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Skip Intro End Time (HH:MM:SS)</mat-label>
                    <input matInput formControlName="skipIntroEnd" placeholder="00:02:40">
                  </mat-form-field>
                </div>
              </div>

              <div class="form-row">
                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Skip Outro / Credits Start Time</mat-label>
                    <input matInput formControlName="skipOutroStart" placeholder="02:35:10">
                  </mat-form-field>
                </div>

                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>SEO Keywords (Comma Separated)</mat-label>
                    <input matInput formControlName="seoKeywords" placeholder="action, sci-fi, telugu movie 2024">
                  </mat-form-field>
                </div>
              </div>
            </div>

            <!-- FLOATING STICKY SUBMIT FOOTER BAR -->
            <div class="submit-footer">
              <div class="footer-info">
                <span class="status-indicator" [ngClass]="contentForm.value.status?.toLowerCase()">
                  <span class="dot"></span> Status: <strong>{{ contentForm.value.status || 'PUBLISHED' }}</strong>
                  <span class="status-note" *ngIf="contentForm.value.status === 'DRAFT'">(Hidden from Web & App)</span>
                  <span class="status-note" *ngIf="contentForm.value.status === 'SCHEDULED'">
                    ({{ contentForm.value.scheduledPublishAt ? ('Auto-publishes ' + formatSchedulePreview(contentForm.value.scheduledPublishAt)) : 'Pick a date & time above' }})
                  </span>
                  <span class="status-note" *ngIf="contentForm.value.status === 'PUBLISHED'">(Live on Web & App)</span>
                </span>
                <span *ngIf="contentForm.invalid" class="validation-warning">
                  <mat-icon>info</mat-icon> Title & Original Language required
                </span>
              </div>
              <div class="footer-actions">
                <button mat-stroked-button color="basic" type="button" (click)="onCancel()">Cancel</button>
                <button mat-stroked-button color="primary" class="draft-btn" type="button" (click)="submitWithStatus('DRAFT')" [disabled]="loading">
                  <mat-icon>drafts</mat-icon> Save Draft
                </button>
                <button mat-stroked-button class="schedule-btn" type="button" (click)="submitWithStatus('SCHEDULED')" [disabled]="loading">
                  <mat-icon>schedule_send</mat-icon> Schedule Publish
                </button>
                <button mat-raised-button color="warn" class="submit-btn" type="button" (click)="submitWithStatus('PUBLISHED')" [disabled]="loading">
                  <mat-icon>{{ isEdit ? 'save' : 'cloud_upload' }}</mat-icon> {{ isEdit ? 'Update & Publish' : 'Publish Now' }}
                </button>
              </div>
            </div>

          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container {
      max-width: 1020px;
      margin: 0 auto;
      color: #ffffff;
      padding: 16px;
      padding-bottom: 80px;
    }

    /* TOP STICKY NAV BAR */
    .quick-nav-bar {
      position: sticky;
      top: 10px;
      z-index: 100;
      background: rgba(22, 22, 34, 0.95);
      backdrop-filter: blur(12px);
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      flex-wrap: wrap;
      gap: 12px;

      .nav-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;

        .nav-pill {
          background: #161622;
          border: 1px solid #28283a;
          color: #a0a0b0;
          padding: 5px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;

          .step-num {
            background: #252538;
            color: #ffffff;
            font-size: 9px;
            padding: 1px 4px;
            border-radius: 4px;
          }

          &:hover, &.active {
            background: #e50914;
            color: #ffffff;
            border-color: #e50914;
            .step-num { background: rgba(255, 255, 255, 0.2); }
          }
        }
      }

      .quick-nav-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        .btn-ai-nav { height: 36px; font-size: 12px; font-weight: 700; border-radius: 6px; background: #ab47bc !important; color: #ffffff !important; }
        .btn-back { height: 36px; border-radius: 6px; font-size: 12px; color: #d0d0e0; }
        .btn-top-draft {
          height: 36px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
          border-color: rgba(245, 158, 11, 0.4);
          background: rgba(245, 158, 11, 0.08);
          &:hover:not([disabled]) {
            background: rgba(245, 158, 11, 0.2);
            color: #fbbf24;
          }
        }
        .btn-top-schedule {
          height: 36px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          color: #38bdf8;
          border-color: rgba(56, 189, 248, 0.45);
          background: rgba(56, 189, 248, 0.1);
          &:hover:not([disabled]) {
            background: rgba(56, 189, 248, 0.22);
            color: #7dd3fc;
          }
        }
        .btn-top-submit {
          height: 36px;
          font-size: 13px;
          font-weight: 800;
          border-radius: 6px;
          background: linear-gradient(135deg, #e50914 0%, #ff1e27 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 14px rgba(229, 9, 20, 0.5);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover:not([disabled]) {
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(229, 9, 20, 0.7);
          }
        }
      }
    }

    /* FORM CARD */
    .form-card {
      background: #161622 !important;
      color: #ffffff;
      padding: 24px;
      border-radius: 16px;
      border: 1px solid #28283a;
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    }

    .form-header {
      margin-bottom: 24px;
      border-bottom: 1px solid #28283a;
      padding-bottom: 16px;

      .catalog-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(229, 9, 20, 0.15);
        color: #e50914;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 4px;
        margin-bottom: 8px;
        letter-spacing: 0.5px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #ffffff; }
      p { color: #a0a0b0; margin: 0; font-size: 13px; }
    }

    .form-content { padding: 0 !important; }

    /* SECTION BLOCK */
    .section-block {
      background: #101018;
      border: 1px solid #252538;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      scroll-margin-top: 80px;

      .section-header {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        margin-bottom: 20px;

        .section-num {
          background: #e50914;
          color: #ffffff;
          font-size: 14px;
          font-weight: 800;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 12px rgba(229, 9, 20, 0.4);
        }

        .section-title { font-size: 18px; font-weight: 700; margin: 0 0 2px; color: #ffffff; }
        .section-subtitle { font-size: 12px; color: #a0a0b0; margin: 0; }

        .btn-ai-fill {
          margin-left: auto;
          background: linear-gradient(135deg, #ab47bc, #7b1fa2);
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          box-shadow: 0 4px 12px rgba(171, 71, 188, 0.3);
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }

        .btn-preview-stream {
          margin-left: auto;
          background: #00d2ff;
          color: #000000;
          border: none;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
    }

    /* STREAM INSPECTOR BOX */
    .video-inspector-box {
      background: #000000;
      border: 1px solid #00d2ff;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 20px;

      .inspector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 13px;
        font-weight: 700;
        color: #00d2ff;
        mat-icon { vertical-align: middle; margin-right: 4px; }
        .stream-url-tag { font-size: 11px; color: #a0a0b0; background: #161622; padding: 2px 8px; border-radius: 4px; }
      }

      .inspector-player-wrapper {
        width: 100%;
        max-height: 360px;
        border-radius: 8px;
        overflow: hidden;
        background: #101018;
        display: flex;
        align-items: center;
        justify-content: center;

        .preview-video-element { width: 100%; max-height: 360px; border-radius: 8px; }
        .no-stream-placeholder {
          text-align: center;
          padding: 32px;
          color: #707080;
          mat-icon { font-size: 42px; width: 42px; height: 42px; margin-bottom: 8px; }
          p { margin: 0; font-size: 13px; }
        }
      }
    }

    /* FIELDS & LABELS */
    .field-with-add { display: flex; flex-direction: column; }
    .field-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .custom-label { font-size: 13px; font-weight: 600; color: #d0d0e0; display: block; margin-bottom: 6px; }

    /* CATEGORY REDIRECT BANNER */
    .category-redirect-banner {
      background: linear-gradient(135deg, rgba(171, 71, 188, 0.15), rgba(0, 210, 255, 0.15));
      border: 1px solid #ab47bc;
      border-radius: 12px;
      padding: 14px 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;

      .banner-left {
        display: flex;
        align-items: center;
        gap: 12px;
        .banner-icon { font-size: 28px; width: 28px; height: 28px; color: #00d2ff; }
        h4 { margin: 0 0 2px; font-size: 14px; font-weight: 700; color: #ffffff; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }

      .btn-jump-studio {
        height: 38px;
        font-weight: 700;
        font-size: 12px;
        border-radius: 8px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      }
    }

    /* SPECIALIZED CATEGORY BOXES */
    .specialized-category-box {
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;

      &.podcast-box {
        background: rgba(229, 9, 20, 0.08);
        border: 1px solid rgba(229, 9, 20, 0.35);
      }

      &.drama-box {
        background: rgba(0, 210, 255, 0.08);
        border: 1px solid rgba(0, 210, 255, 0.35);
      }

      &.doc-box {
        background: rgba(255, 171, 0, 0.08);
        border: 1px solid rgba(255, 171, 0, 0.35);
      }

      .box-title {
        font-size: 13px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
      }
    }

    .btn-add-new {
      background: #e50914;
      color: #ffffff;
      border: none;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      mat-icon { font-size: 12px; width: 12px; height: 12px; }
      &:hover { background: #ff1e27; }
    }

    .full-width { width: 100%; margin-bottom: 16px; display: block; }
    .form-row { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
    .half-width { flex: 1; min-width: 280px; }

    .duration-badge-card {
      background: #1a1a26;
      border: 1px solid #28283a;
      border-radius: 6px;
      padding: 8px 12px;
      margin-top: -8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #00e5ff;
      .clock-icon { font-size: 16px; width: 16px; height: 16px; color: #00e5ff; }
      strong { color: #ffffff; }
    }

    /* TOGGLES GRID */
    .toggles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }

    .toggle-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .toggle-info {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;

        .toggle-icon {
          font-size: 22px; width: 22px; height: 22px;
          &.gold { color: #ffab00; }
          &.blue { color: #00d2ff; }
          &.green { color: #00e676; }
          &.purple { color: #ab47bc; }
          &.red { color: #ff5252; }
        }

        .toggle-title { font-size: 13px; font-weight: 700; color: #ffffff; display: block; }
        .toggle-desc { font-size: 10px; color: #808090; }
      }

      .custom-radio-group { display: flex; gap: 16px; }
    }

    /* MULTI RESOLUTION UPLOADS GRID */
    .uploads-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }

    .resolution-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 10px;
      padding: 14px;
      position: relative;

      .res-badge {
        display: inline-block;
        font-size: 10px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 4px;
        margin-bottom: 10px;
        text-transform: uppercase;
        &.gray { background: #252538; color: #a0a0b0; }
        &.blue { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
        &.green { background: rgba(0, 230, 118, 0.15); color: #00e676; }
        &.primary { background: rgba(229, 9, 20, 0.15); color: #e50914; }
        &.purple { background: rgba(171, 71, 188, 0.15); color: #ab47bc; }
        &.gold { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
      }

      &.mode-card { margin-top: 12px; }
      .url-input { margin-top: 8px; margin-bottom: 0 !important; }
    }

    /* SUBTITLES BLOCK */
    .subtitles-block { margin-top: 16px; }
    .subtitle-header-label { font-size: 13px; font-weight: 700; color: #ffffff; display: block; margin-bottom: 12px; }
    .subtitle-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      background: #161622;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #28283a;
    }
    .sub-lang-field { width: 180px; margin-bottom: 0 !important; }
    .sub-upload-field { flex: 1; }
    .btn-add-sub { height: 40px; border-radius: 6px; font-size: 12px; font-weight: 600; margin-top: 8px; }

    /* ARTWORK PREVIEW */
    .artwork-row { margin-bottom: 16px; }
    .artwork-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 10px;
      padding: 14px;

      .image-preview {
        margin-top: 10px;
        border-radius: 6px;
        overflow: hidden;
        max-height: 160px;
        background: #000000;
        display: flex;
        align-items: center;
        justify-content: center;

        img { max-height: 160px; width: auto; object-fit: contain; }
      }
    }

    /* MONETIZATION GRID */
    .monetization-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 10px;
      padding: 16px;
      margin-top: 16px;

      .monetization-title {
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 12px;
        mat-icon { color: #ffab00; font-size: 18px; width: 18px; height: 18px; }
      }

      .monetization-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;

        .model-option {
          background: #101018;
          border: 1px solid #252538;
          border-radius: 8px;
          padding: 12px;
          transition: all 0.2s ease;

          &.selected {
            border-color: #e50914;
            background: rgba(229, 9, 20, 0.08);
          }

          .option-content {
            display: flex;
            flex-direction: column;
            margin-left: 8px;

            .model-name { font-size: 13px; font-weight: 700; color: #ffffff; }
            .model-desc { font-size: 10px; color: #a0a0b0; }
          }
        }
      }

      .tvod-config-block {
        margin-top: 16px;
        background: rgba(255, 171, 0, 0.05);
        border: 1px solid rgba(255, 171, 0, 0.3);
        border-radius: 8px;
        padding: 16px;

        .tvod-config-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;

          .tvod-icon {
            color: #ffb800;
            font-size: 24px;
            width: 24px;
            height: 24px;
          }

          h4 {
            margin: 0 0 2px;
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
          }

          p {
            margin: 0;
            font-size: 11px;
            color: #a0a0b0;
          }
        }

        .tvod-inputs-row {
          margin-bottom: 8px;

          .currency-prefix, .hours-suffix {
            color: #ffb800;
            font-weight: 700;
          }
        }

        .tvod-preset-chips {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 6px;

          .preset-label {
            font-size: 11px;
            font-weight: 700;
            color: #888899;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .preset-sep {
            color: #333344;
            font-size: 12px;
          }

          .preset-chip {
            background: #101018;
            border: 1px solid #2a2a3d;
            color: #cccccc;
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;

            &:hover {
              border-color: #ffb800;
              color: #ffb800;
            }

            &.active {
              background: rgba(255, 184, 0, 0.15);
              border-color: #ffb800;
              color: #ffb800;
              font-weight: 700;
            }
          }
        }
      }
    }

    .status-selector-row {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      padding: 12px 18px;
      background: #141420;
      border: 1px solid #28283a;
      border-radius: 10px;
      flex-wrap: wrap;

      .status-selector-label {
        font-size: 13px;
        font-weight: 700;
        color: #94a3b8;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #00d2ff; }
      }

      .status-btn-group {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;

        .status-choice-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          background: #1a1a28;
          border: 1px solid #2f2f44;
          color: #94a3b8;
          transition: all 0.2s ease;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }

          &.draft:hover, &.draft.active {
            background: rgba(245, 158, 11, 0.15);
            border-color: #f59e0b;
            color: #fbbf24;
            box-shadow: 0 0 12px rgba(245, 158, 11, 0.25);
          }

          &.scheduled:hover, &.scheduled.active {
            background: rgba(56, 189, 248, 0.16);
            border-color: #38bdf8;
            color: #7dd3fc;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.28);
          }

          &.published:hover, &.published.active {
            background: rgba(0, 230, 118, 0.15);
            border-color: #00e676;
            color: #00e676;
            box-shadow: 0 0 12px rgba(0, 230, 118, 0.25);
          }
        }
      }
    }

    .schedule-picker-box {
      margin: 0 0 20px;
      padding: 16px 20px;
      border-radius: 12px;
      background: rgba(56, 189, 248, 0.07);
      border: 1px solid rgba(56, 189, 248, 0.35);

      .schedule-picker-header {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        mat-icon { color: #38bdf8; font-size: 22px; width: 22px; height: 22px; margin-top: 2px; }
        strong { display: block; color: #e2e8f0; font-size: 14px; }
        span { display: block; color: #94a3b8; font-size: 12px; margin-top: 2px; }
      }
    }

    /* FLOATING STICKY SUBMIT FOOTER */
    .submit-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 200;
      background: rgba(22, 22, 34, 0.98);
      backdrop-filter: blur(16px);
      border-top: 1px solid #28283a;
      padding: 14px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 -8px 28px rgba(0, 0, 0, 0.7);

      .footer-info {
        display: flex;
        align-items: center;
        gap: 16px;

        .status-indicator {
          font-size: 13px;
          font-weight: 600;
          color: #00e676;
          display: flex;
          align-items: center;
          gap: 6px;

          &.draft {
            color: #f59e0b;
            .dot { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
          }
          &.scheduled {
            color: #38bdf8;
            .dot { background: #38bdf8; box-shadow: 0 0 8px #38bdf8; }
          }
          &.published {
            color: #00e676;
            .dot { background: #00e676; box-shadow: 0 0 8px #00e676; }
          }
          .status-note {
            font-size: 11px;
            color: #8e8ea0;
            font-weight: normal;
            margin-left: 4px;
          }

          .dot {
            width: 8px;
            height: 8px;
            background: #00e676;
            border-radius: 50%;
            box-shadow: 0 0 8px #00e676;
          }
        }

        .validation-warning {
          font-size: 12px;
          color: #ffab00;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          mat-icon { font-size: 16px; width: 16px; height: 16px; color: #ffab00; }
        }
      }

      .footer-actions {
        display: flex;
        gap: 12px;
        button { height: 46px; padding: 0 24px; border-radius: 8px; font-weight: 700; }

        .draft-btn {
          color: #f59e0b !important;
          border-color: rgba(245, 158, 11, 0.4) !important;
          background: rgba(245, 158, 11, 0.08) !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          &:hover:not([disabled]) {
            background: rgba(245, 158, 11, 0.2) !important;
            color: #fbbf24 !important;
          }
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .schedule-btn {
          color: #38bdf8 !important;
          border-color: rgba(56, 189, 248, 0.45) !important;
          background: rgba(56, 189, 248, 0.1) !important;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          &:hover:not([disabled]) {
            background: rgba(56, 189, 248, 0.22) !important;
            color: #7dd3fc !important;
          }
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }

        .submit-btn {
          background: linear-gradient(135deg, #e50914 0%, #ff1e27 100%) !important;
          color: #ffffff !important;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 18px rgba(229, 9, 20, 0.5);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;

          &:hover:not([disabled]) {
            transform: translateY(-2px);
            box-shadow: 0 6px 24px rgba(229, 9, 20, 0.7);
          }

          mat-icon { font-size: 20px; width: 20px; height: 20px; }
        }
      }
    }

    /* BUNNY STREAM CONTAINER */
    .bunny-stream-card {
      background: linear-gradient(135deg, rgba(26, 76, 216, 0.12) 0%, rgba(199, 37, 163, 0.12) 100%);
      border: 1px solid rgba(0, 210, 255, 0.35);
      border-radius: 14px;
      padding: 20px;
      margin-top: 16px;

      .bunny-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 12px;

        .bunny-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
          .bunny-icon { font-size: 28px; }
          h4 { margin: 0 0 2px; font-size: 16px; font-weight: 800; color: #ffffff; }
          p { margin: 0; font-size: 12px; color: #a0a0b0; }
        }
      }

      .bunny-upload-zone {
        display: flex;
        flex-direction: column;
        gap: 14px;

        .btn-direct-bunny-upload, .btn-bunny-upload {
          height: 48px;
          font-size: 14px;
          font-weight: 800;
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
          color: #ffffff;
          mat-icon { margin-right: 6px; }
        }

        .or-separator, .or-divider {
          text-align: center;
          color: #808095;
          font-size: 12px;
          font-weight: 700;
        }

        .bunny-link-input-group {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          mat-form-field { flex: 1; }
          .btn-apply-bunny { height: 52px; font-weight: 700; white-space: nowrap; }
        }
      }

      .bunny-upload-progress {
        .progress-info {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #00d2ff;
          margin-bottom: 8px;
          span { display: flex; align-items: center; gap: 6px; }
        }
      }

      .bunny-status-card {
        background: rgba(0, 0, 0, 0.45);
        border: 1px solid rgba(0, 230, 118, 0.3);
        border-radius: 10px;
        padding: 14px 18px;
        margin-top: 14px;

        .status-top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .status-left {
            display: flex;
            align-items: center;
            gap: 10px;
            overflow: hidden;
            .status-icon { font-size: 22px; width: 22px; height: 22px; }
            .status-label { display: block; font-size: 11px; color: #a0a0b0; }
            .status-url { font-size: 12px; color: #00d2ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          }

          .status-actions {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }
        }

        .encode-progress-row {
          margin-top: 10px;
          font-size: 12px;
          color: #ffab00;
          span { display: block; margin-bottom: 4px; }
        }
      }
    }
  `]
})
export class MovieFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly movieApiService = inject(MovieApiService);
  private readonly producerApiService = inject(ProducerApiService);
  private readonly catalogApiService = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly http = inject(HttpClient);
  readonly authStore = inject(AuthStore);

  isEdit = false;
  movieId: string | number | null = null;
  loading = false;
  activeStep = 1;
  showPreviewPlayer = false;

  bunnyVideoUploading = false;
  gdriveStreaming = false;
  gdriveProgress = 0;
  gdriveStatusText = 'Starting Google Drive -> Bunny Stream pipeline...';
  gdriveConnected = false;
  showGdriveCodeBox = false;
  bunnyVideoProgress = 0;
  bunnyVideoId = '';
  bunnyStatusText = '';
  bunnyEncodeProgress: number | null = null;

  get bunnyStatusColor(): string {
    if (this.bunnyStatusText === 'READY') return '#00e676';
    if (this.bunnyStatusText === 'TRANSCODING' || this.bunnyStatusText === 'PROCESSING') return '#ffab00';
    if (this.bunnyStatusText === 'ERROR' || this.bunnyStatusText === 'UPLOAD_FAILED') return '#ff5252';
    return '#00d2ff';
  }

  // Dynamic Options Lists strictly loaded from Catalog DB with '+ Add New' capabilities
  mainTypesList: { label: string; value: string }[] = [];

  categoriesList: string[] = [];
  genresList: string[] = [];
  languagesList: string[] = [];
  castList: string[] = [];
  castMembersMap: Record<string, { id?: number; name: string; role: string; bio: string; image: string; imageUrl: string }> = {};
  showAddCastBox = false;
  newCastPhotoUrl = '';
  producersList: string[] = [];

  get activeCategoriesList(): string[] {
    return this.categoriesList;
  }

  get activeGenresList(): string[] {
    return this.genresList;
  }

  get selectedCategoryType(): string {
    return this.contentForm?.get('contentType')?.value || 'MOVIE';
  }

  get isMovie(): boolean { return this.selectedCategoryType === 'MOVIE' || this.selectedCategoryType === 'AI_MOVIE'; }
  get isShortFilm(): boolean { return this.selectedCategoryType === 'SHORT_FILM'; }
  get isSeries(): boolean { return this.selectedCategoryType === 'SERIES' || this.selectedCategoryType === 'AI_SERIES'; }
  get isAlbum(): boolean { return this.selectedCategoryType === 'ALBUM'; }
  get isStageDrama(): boolean { return this.selectedCategoryType === 'STAGE_DRAMA'; }
  get isMicrodrama(): boolean { return this.selectedCategoryType === 'MICRODRAMA' || this.selectedCategoryType === 'AI_MICRODRAMA'; }
  get isPodcast(): boolean { return this.selectedCategoryType === 'PODCAST'; }
  get isDocumentary(): boolean { return this.selectedCategoryType === 'DOCUMENTARY'; }
  get isSeriesOrAlbum(): boolean { return ['SERIES', 'ALBUM', 'MICRODRAMA', 'AI_SERIES', 'AI_MICRODRAMA'].includes(this.selectedCategoryType); }

  get categoryStudioBadge(): string {
    switch (this.selectedCategoryType) {
      case 'AI_MICRODRAMA': return 'AI VERTICAL MICRO DRAMA REEL STUDIO';
      case 'AI_MOVIE': return 'AI CINEMA & FEATURE FILM STUDIO';
      case 'AI_SERIES': return 'AI EPISODIC WEB SERIES STUDIO';
      case 'SHORT_FILM': return 'SHORT FILM PRODUCTION STUDIO';
      case 'DOCUMENTARY': return 'DOCUMENTARY & FACTUAL STUDIO';
      case 'STAGE_DRAMA': return 'STAGE DRAMA & THEATER STUDIO';
      case 'PODCAST': return 'PODCAST & YOUTUBE SHOW STUDIO';
      case 'ALBUM': return 'MUSIC / VIDEO ALBUM STUDIO';
      case 'MICRODRAMA': return 'MICRO DRAMA REEL STUDIO';
      case 'SERIES': return 'WEB SERIES & SEASONS STUDIO';
      default: return 'ENTERPRISE MOVIE STUDIO';
    }
  }

  get categoryStudioIcon(): string {
    switch (this.selectedCategoryType) {
      case 'AI_MICRODRAMA':
      case 'AI_MOVIE':
      case 'AI_SERIES': return 'auto_awesome';
      case 'SHORT_FILM': return 'movie_creation';
      case 'DOCUMENTARY': return 'menu_book';
      case 'STAGE_DRAMA': return 'theater_comedy';
      case 'PODCAST': return 'mic';
      case 'ALBUM': return 'album';
      case 'MICRODRAMA': return 'stay_current_portrait';
      case 'SERIES': return 'tv';
      default: return 'movie';
    }
  }

  get categoryStudioName(): string {
    const item = this.mainTypesList.find(t => t.value === this.selectedCategoryType);
    return item ? item.label : 'Content';
  }

  get categoryStudioDescription(): string {
    switch (this.selectedCategoryType) {
      case 'AI_MICRODRAMA': return 'Configure AI-generated short-form vertical reels, high-hook episode cliffhangers, and neural scene metadata';
      case 'AI_MOVIE': return 'Configure generative AI feature cinema, synthetic actors, neural rendering feeds, and multi-lingual voice clones';
      case 'AI_SERIES': return 'Configure episodic AI series, generative lore, multi-season storylines, and AI production credits';
      case 'PODCAST': return 'Configure YouTube channel sync, host & guest interviews, audio feeds, and topics';
      case 'STAGE_DRAMA': return 'Configure traditional drama troupe, playwright, mythological/social subtypes, and performance feeds';
      case 'DOCUMENTARY': return 'Configure investigative topic, narrator, research credits, and high-definition video feeds';
      case 'SHORT_FILM': return 'Configure festival short film runtime, director credits, and streaming delivery';
      case 'ALBUM': return 'Configure music album title, artists, composers, and audio/video tracks';
      case 'MICRODRAMA': return 'Configure vertical short-form reel drama metadata and episode links';
      case 'SERIES': return 'Configure TV web series storyline, seasons, episodes, and broadcast ratings';
      default: return 'Configure titles, AI metadata, multi-resolution 4K feeds, subtitles, DRM security, and monetization';
    }
  }

  get categoryTitleLabel(): string {
    switch (this.selectedCategoryType) {
      case 'AI_MICRODRAMA': return 'AI Micro Drama Title *';
      case 'AI_MOVIE': return 'AI Movie Title *';
      case 'AI_SERIES': return 'AI Series Title *';
      case 'SHORT_FILM': return 'Short Film Title *';
      case 'DOCUMENTARY': return 'Documentary Title *';
      case 'STAGE_DRAMA': return 'Stage Drama Title *';
      case 'PODCAST': return 'Podcast Show / Episode Title *';
      case 'ALBUM': return 'Album Title *';
      case 'MICRODRAMA': return 'Micro Drama Title *';
      case 'SERIES': return 'Series Title *';
      default: return 'Name / Title *';
    }
  }

  get categoryTitlePlaceholder(): string {
    switch (this.selectedCategoryType) {
      case 'AI_MICRODRAMA': return 'e.g. Cyber City CEO AI Reel';
      case 'AI_MOVIE': return 'e.g. Neon Genesis 2099 AI';
      case 'AI_SERIES': return 'e.g. Chronicles of Eldoria AI S1';
      case 'SHORT_FILM': return 'e.g. The Silent Note (Short Film)';
      case 'DOCUMENTARY': return 'e.g. Wild Wonders of India';
      case 'STAGE_DRAMA': return 'e.g. Satya Harishchandra (Pouranika Drama)';
      case 'PODCAST': return 'e.g. Tech Talk Telugu Podcast Ep 12';
      case 'ALBUM': return 'e.g. Monsoon Melody Vol 1';
      case 'MICRODRAMA': return 'e.g. The CEO Secret Love';
      case 'SERIES': return 'e.g. Unstoppable S4';
      default: return 'e.g. Kalki 2898 AD';
    }
  }

  getSelectedTypeLabel(): string {
    const item = this.mainTypesList.find(t => t.value === this.selectedCategoryType);
    return item ? item.label : this.selectedCategoryType;
  }

  goToSeriesStudio(): void {
    this.router.navigate(['/admin/series/new'], { queryParams: { type: this.selectedCategoryType } });
  }

  localPosterPreview = '';
  localBannerPreview = '';
  contentWarningOptions = ['Violence', 'Strong Language', 'Smoking / Alcohol', 'Mature Themes', 'Fear / Horror', 'Flashing Lights'];
  qualityBadgeOptions = ['4K UHD', 'Full HD 1080p', 'HDR10', 'Dolby Audio', '5.1 Surround', 'CC Subtitles'];

  contentForm = this.fb.group({
    title: ['', [Validators.required]],
    contentType: ['', [Validators.required]],
    category: this.fb.control<string[]>([]),
    genres: this.fb.control<string[]>([]),
    youtubeOption: [''],
    podcastHost: [''],
    podcastGuest: [''],
    podcastAudioUrl: [''],
    dramaTroupe: [''],
    playwright: [''],
    docTopic: [''],
    docNarrator: [''],
    originalLanguage: ['', [Validators.required]],
    cast: this.fb.control<string[]>([]),
    producer: [''],
    releaseDate: [''],
    durationTime: [''],
    maturityRating: ['UA_13+'],
    isPremium: [true],
    isTitle: [true],
    isDownload: [true],
    isComment: [true],
    isLike: [true],
    videoUploadType: ['Server Video'],
    masterPlaylistUrl: [''],
    video320Url: [''],
    video480Url: [''],
    video720Url: [''],
    video1080Url: [''],
    video2kUrl: [''],
    video4kUrl: [''],
    trailerType: ['Server Video'],
    trailerUrl: [''],
    subtitles: this.fb.array([]),
    audioTracks: this.fb.array([]),
    description: [''],
    posterUrl: [''],
    bannerUrl: [''],
    logoImageUrl: [''],
    contentWarnings: this.fb.control<string[]>([]),
    qualityBadges: this.fb.control<string[]>([]),
    scheduledPublishAt: [''],
    expiresAt: [''],
    monetization: ['AVOD'],
    rentPrice: [99, [Validators.min(0)]],
    validityHours: [48, [Validators.min(1)]],
    drmSystem: ['MULTI_DRM'],
    geoRestrictions: [['GLOBAL']],
    skipIntroStart: [''],
    skipIntroEnd: [''],
    skipOutroStart: [''],
    seoKeywords: [''],
    status: ['PUBLISHED']
  });

  setRentPrice(price: number): void {
    this.contentForm.patchValue({ rentPrice: price });
  }

  setValidityHours(hours: number): void {
    this.contentForm.patchValue({ validityHours: hours });
  }

  get subtitles(): FormArray {
    return this.contentForm.get('subtitles') as FormArray;
  }

  createSubtitleFormGroup(langName = '', fileUrl = ''): FormBuilder | any {
    return this.fb.group({
      languageName: [langName || 'English'],
      fileUrl: [fileUrl || '']
    });
  }

  addSubtitleTrack(): void {
    this.subtitles.push(this.createSubtitleFormGroup());
  }

  removeSubtitleTrack(index: number): void {
    if (this.subtitles.length > 1) {
      this.subtitles.removeAt(index);
    }
  }

  get audioTracks(): FormArray {
    return this.contentForm.get('audioTracks') as FormArray;
  }

  createAudioTrackFormGroup(langName = '', url = ''): FormBuilder | any {
    return this.fb.group({
      languageName: [langName || 'Hindi'],
      url: [url || '']
    });
  }

  addAudioTrack(): void {
    this.audioTracks.push(this.createAudioTrackFormGroup());
  }

  removeAudioTrack(index: number): void {
    this.audioTracks.removeAt(index);
  }

  scrollToSection(id: string, stepNum: number): void {
    this.activeStep = stepNum;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  toggleVideoPreview(): void {
    this.showPreviewPlayer = !this.showPreviewPlayer;
  }

  isEmbedUrl(): boolean {
    const url = this.getActiveStreamUrl();
    if (!url) return false;
    const clean = url.toLowerCase();
    return clean.includes('youtube.com') || clean.includes('youtu.be') || clean.includes('vimeo.com') || clean.includes('embed');
  }

  getSafeEmbedUrl(): SafeResourceUrl {
    const raw = this.getActiveStreamUrl();
    if (!raw) return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    let embedUrl = raw.trim();
    if (raw.includes('youtube.com/watch?v=')) {
      const parts = raw.split('watch?v=');
      const videoId = parts[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (raw.includes('youtu.be/')) {
      const parts = raw.split('youtu.be/');
      const videoId = parts[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (raw.includes('vimeo.com/') && !raw.includes('player.vimeo.com')) {
      const parts = raw.split('vimeo.com/');
      const videoId = parts[1]?.split('?')[0];
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  getActiveStreamUrl(): string {
    const val = this.contentForm.value;
    if (val.videoUploadType === 'HLS Master Playlist' || val.videoUploadType === 'Youtube Embed') {
      return val.masterPlaylistUrl || val.video4kUrl || val.video1080Url || val.trailerUrl || '';
    }
    return (
      val.video4kUrl ||
      val.video2kUrl ||
      val.video1080Url ||
      val.video720Url ||
      val.video480Url ||
      val.video320Url ||
      val.masterPlaylistUrl ||
      val.trailerUrl ||
      ''
    );
  }

  triggerAiAutoFill(): void {
    const title = this.contentForm.value.title?.trim();
    if (!title) {
      this.notificationService.warning('Please enter a Title before using AI auto-fill.');
      return;
    }
    this.contentForm.patchValue({
      title: title,
      description: `An engaging cinematic experience centered around ${title}. High-octane action, groundbreaking visual effects, and intense narrative depth.`,
      category: ['Action', 'Drama', 'Thriller'],
      seoKeywords: `${title.toLowerCase()}, 4k ultra hd, ott streaming, blockbuster`,
      durationTime: '2h00m00s',
      maturityRating: 'UA_13+'
    });
    this.notificationService.success('✨ AI metadata and plot synopsis auto-filled!');
  }

  async onAddNewMainType(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Main Type', 'Main Type Name', 'e.g. Movies, Short Films, Web Series');
    if (clean && clean.trim()) {
      const trimmed = clean.trim();
      const codeValue = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const slugValue = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const exists = this.mainTypesList.some(t => t.value === codeValue || t.label.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        this.mainTypesList.push({ label: trimmed, value: codeValue });
      }
      this.contentForm.patchValue({ contentType: codeValue });
      this.notificationService.success(`Added new main type '${trimmed}'`);
    }
  }

  async onAddNewCategory(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Category', 'Category / Sub Type Name', 'e.g. Mystery, Devotional');
    if (clean) {
      this.catalogApiService.createCategory(clean).subscribe({
        next: (res) => {
          const catName = res.data?.name || clean;
          if (!this.categoriesList.includes(catName)) {
            this.categoriesList.push(catName);
          }
          const currentVal = this.contentForm.value.category || [];
          this.contentForm.patchValue({ category: [...currentVal, catName] });
          this.notificationService.success(`Added new category '${catName}'`);
        },
        error: () => {
          if (!this.categoriesList.includes(clean)) {
            this.categoriesList.push(clean);
          }
          const currentVal = this.contentForm.value.category || [];
          this.contentForm.patchValue({ category: [...currentVal, clean] });
          this.notificationService.success(`Added category '${clean}' locally`);
        }
      });
    }
  }

  async onAddNewGenre(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Genre / Sub-Type', 'Genre Name', 'e.g. Folk Song, Standup Comedy');
    if (clean) {
      this.catalogApiService.createGenre(clean).subscribe({
        next: (res) => {
          const genreName = res.data?.name || clean;
          if (!this.genresList.includes(genreName)) {
            this.genresList.push(genreName);
          }
          const currentVal = this.contentForm.value.genres || [];
          this.contentForm.patchValue({ genres: [...currentVal, genreName] });
          this.notificationService.success(`Added new genre '${genreName}'`);
        },
        error: () => {
          if (!this.genresList.includes(clean)) {
            this.genresList.push(clean);
          }
          const currentVal = this.contentForm.value.genres || [];
          this.contentForm.patchValue({ genres: [...currentVal, clean] });
          this.notificationService.success(`Added genre '${clean}' locally`);
        }
      });
    }
  }

  async onAddNewLanguage(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Language', 'Language Name', 'e.g. Marathi, Bengali');
    if (clean) {
      if (!this.languagesList.includes(clean)) {
        this.languagesList.push(clean);
        this.contentForm.patchValue({ originalLanguage: clean });
        this.notificationService.success(`Added new language '${clean}'`);
      }
    }
  }

  async onAddNewCast(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Cast', 'Actor / Actress Name', 'e.g. Robert Downey Jr');
    if (clean) {
      if (!this.castList.includes(clean)) {
        this.castList.push(clean);
        const currentCast = this.contentForm.value.cast || [];
        this.contentForm.patchValue({ cast: [...currentCast, clean] });
        this.notificationService.success(`Added new cast member '${clean}'`);
      }
    }
  }

  async onAddNewProducer(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Producer / Studio', 'Producer / Production House Name', 'e.g. Maxx Studios');
    if (clean && clean.trim()) {
      const studioName = clean.trim();
      const email = `${studioName.toLowerCase().replace(/[^a-z0-9]/g, '')}@studio.maxxpixels.com`;
      
      this.http.post<any>(`${environment.apiBaseUrl}/admin/producers/onboard`, {
        studioName,
        name: studioName,
        email
      }).subscribe({
        next: (res) => {
          if (!this.producersList.includes(studioName)) {
            this.producersList.push(studioName);
          }
          this.contentForm.patchValue({ producer: studioName });
          const password = res?.data?.loginPassword;
          this.notificationService.success(
            `Producer '${studioName}' onboarded and linked successfully!` +
            (password ? ` Login password: ${password}` : '')
          );
        },
        error: () => {
          if (!this.producersList.includes(studioName)) {
            this.producersList.push(studioName);
          }
          this.contentForm.patchValue({ producer: studioName });
          this.notificationService.success(`Producer '${studioName}' selected`);
        }
      });
    }
  }

  private normalizeMainTypeCode(raw?: string | null): string {
    const clean = (raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    switch (clean) {
      case 'MOVIES':
      case 'FILM':
        return 'MOVIE';
      case 'ALBUMS':
      case 'SONGS':
      case 'SONG':
      case 'MUSIC':
      case 'MUSIC___ALBUMS':
        return 'ALBUM';
      case 'SHORT_FILMS':
      case 'SHORTS':
      case 'SHORT':
        return 'SHORT_FILM';
      case 'MICRO_DRAMA':
      case 'MICRO_DRAMAS':
      case 'MICRODRAMAS':
        return 'MICRODRAMA';
      case 'PODCASTS':
        return 'PODCAST';
      case 'WEB_SERIES':
      case 'SHOWS':
      case 'SHOW':
      case 'TV_SHOW':
        return 'SERIES';
      case 'STAGE_DRAMAS':
      case 'STAGEDRAMA':
        return 'STAGE_DRAMA';
      case 'DOCUMENTARIES':
        return 'DOCUMENTARY';
      default:
        return clean || 'MOVIE';
    }
  }

  private normalizeMaturityRating(raw?: string | null): string {
    const s = (raw || '').trim().toUpperCase();
    if (!s) return 'UA_13+';
    if (s === 'U') return 'U';
    if (s.includes('7')) return 'UA_7+';
    if (s.includes('16')) return 'UA_16+';
    if (s === 'PG-13') return 'PG-13';
    if (s === 'TV-MA') return 'TV-MA';
    if (s === 'A' || s.includes('18')) return 'A';
    if (s.includes('13') || s.startsWith('U/A') || s.startsWith('UA')) return 'UA_13+';
    return 'UA_13+';
  }

  private formatSecondsToHms(totalSecs?: number | null, fallbackMins?: number | null): string {
    let secs = typeof totalSecs === 'number' && totalSecs > 0
      ? Math.round(totalSecs)
      : (typeof fallbackMins === 'number' && fallbackMins > 0 ? Math.round(fallbackMins * 60) : 0);
    if (secs <= 0) return '';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  loadProducers(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/producers`).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const list: string[] = res.data.map((p: any) => (p.studioName || p.companyName || p.fullName || p.name || '').trim()).filter(Boolean);
          if (list.length > 0) {
            const current = (this.contentForm.get('producer')?.value || '').trim();
            const merged = [...new Set([...this.producersList, ...list])];
            if (current) {
              const exact = merged.find(p => p.toLowerCase() === current.toLowerCase());
              if (exact) {
                if (exact !== current) {
                  this.contentForm.patchValue({ producer: exact });
                }
              } else {
                merged.unshift(current);
              }
            }
            this.producersList = merged;
            if (!this.isEdit && !current && this.producersList.length > 0) {
              this.contentForm.patchValue({ producer: this.producersList[0] });
            }
          }
        }
      },
      error: () => {
        // Fallback
      }
    });
  }

  getCastPhoto(name: string): string {
    return this.castMembersMap[name]?.image || this.castMembersMap[name]?.imageUrl || '';
  }

  getCastRole(name: string): string {
    return this.castMembersMap[name]?.role || '';
  }

  loadCastMembers(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/cast`).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        for (const c of rows) {
          if (!c?.name) continue;
          this.castMembersMap[c.name] = {
            id: c.id,
            name: c.name,
            role: c.role || 'Actor',
            bio: c.bio || '',
            image: c.image || c.imageUrl || '',
            imageUrl: c.imageUrl || c.image || ''
          };
          if (!this.castList.includes(c.name)) {
            this.castList.push(c.name);
          }
        }
      },
      error: () => {}
    });
  }

  saveNewCastPerson(rawName: string, rawRole: string, rawBio: string): void {
    const name = (rawName || '').trim();
    if (!name) {
      this.notificationService.warning('Cast person name is required.');
      return;
    }
    const role = (rawRole || 'Actor').trim();
    const bio = (rawBio || '').trim();
    const imageUrl = (this.newCastPhotoUrl || '').trim();

    this.http.post<any>(`${environment.apiBaseUrl}/admin/cast`, { name, role, bio, imageUrl }).subscribe({
      next: (res) => {
        const saved = res?.data || { name, role, bio, image: imageUrl, imageUrl };
        this.castMembersMap[name] = {
          id: saved.id,
          name,
          role: saved.role || role,
          bio: saved.bio || bio,
          image: saved.image || saved.imageUrl || imageUrl,
          imageUrl: saved.imageUrl || saved.image || imageUrl
        };
        if (!this.castList.includes(name)) {
          this.castList.push(name);
        }
        const currentCast = this.contentForm.value.cast || [];
        if (!currentCast.includes(name)) {
          this.contentForm.patchValue({ cast: [...currentCast, name] });
        }
        this.newCastPhotoUrl = '';
        this.showAddCastBox = false;
        this.notificationService.success(`Saved cast person '${name}'!`);
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Failed to save cast person.');
      }
    });
  }

  ngOnInit(): void {
    this.loadCatalogMetadata();
    this.loadCastMembers();
    this.loadProducers();
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit = true;
      this.movieId = idParam;
      this.loadMovie(this.movieId);
    }
  }

  loadCatalogMetadata(): void {
    // 1. Content Types (Main Types) from Catalog Metadata
    this.http.get<any>(`${environment.apiBaseUrl}/content-types`).subscribe({
      next: (res: any) => {
        const types = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(types) && types.length > 0) {
          const seenCodes = new Set<string>();
          const mappedTypes: { label: string; value: string }[] = [];
          for (const t of types) {
            const rawSlug = t.slug || t.title || t.name || '';
            const codeVal = this.normalizeMainTypeCode(rawSlug);
            if (seenCodes.has(codeVal)) continue;
            seenCodes.add(codeVal);
            const title = t.title || t.name || rawSlug;
            mappedTypes.push({ label: title, value: codeVal });
          }
          const currRaw = this.contentForm.get('contentType')?.value;
          const curr = currRaw ? this.normalizeMainTypeCode(currRaw) : '';
          if (curr && !mappedTypes.some(t => t.value === curr)) {
            mappedTypes.push({ label: curr, value: curr });
          }
          this.mainTypesList = mappedTypes;
          if (this.isEdit && curr && curr !== currRaw) {
            this.contentForm.patchValue({ contentType: curr });
          } else if (!this.isEdit && (!curr || !this.mainTypesList.some(t => t.value === curr))) {
            const match = this.mainTypesList.find(t => t.value === curr) || this.mainTypesList.find(t => t.value === 'MOVIE') || this.mainTypesList[0];
            if (match) {
              this.contentForm.patchValue({ contentType: match.value });
            }
          }
        }
      },
      error: () => {}
    });

    // 2. Languages from Catalog Metadata
    this.http.get<any>(`${environment.apiBaseUrl}/languages`).subscribe({
      next: (res: any) => {
        const langs = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(langs) && langs.length > 0) {
          const fromApi = langs.map((l: any) => (l.name || l.code || '').trim()).filter(Boolean);
          const defaults = ['Kannada', 'Tamil', 'Telugu', 'Hindi', 'Malayalam', 'English', 'Marathi', 'Bengali', 'Punjabi', 'Gujarati'];
          const merged = [...new Set([...this.languagesList, ...fromApi, ...defaults])];
          const curr = (this.contentForm.get('originalLanguage')?.value || '').trim();
          if (curr) {
            const exact = merged.find(l => l.toLowerCase() === curr.toLowerCase());
            if (exact && exact !== curr) {
              this.contentForm.patchValue({ originalLanguage: exact });
            } else if (!exact) {
              merged.unshift(curr);
            }
          }
          this.languagesList = merged;
          if (!this.isEdit && !curr && this.languagesList.length > 0) {
            const kn = this.languagesList.find((l: string) => l.toLowerCase() === 'kannada') || this.languagesList[0];
            this.contentForm.patchValue({ originalLanguage: kn });
          }
        }
      },
      error: () => {}
    });

    // 3. Categories from Catalog Metadata
    this.http.get<any>(`${environment.apiBaseUrl}/categories`).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const names = list.map((c: any) => c.name).filter(Boolean);
          this.categoriesList = [...new Set([...this.categoriesList, ...names])];
        }
      },
      error: () => {
        const defaults = ['Blockbuster Movies', 'New Releases', 'Trending Now', 'Maxx Originals'];
        this.categoriesList = [...new Set([...this.categoriesList, ...defaults])];
      }
    });

    // 4. Genres from Master Data (public route: GET /api/v1/genres)
    this.http.get<any>(`${environment.apiBaseUrl}/genres`).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const names = list.map((g: any) => g.name).filter(Boolean);
          this.genresList = [...new Set([...this.genresList, ...names])];
        }
      },
      error: () => {}
    });
  }

  getParsedDurationSummary(): string {
    const val = this.contentForm?.value?.durationTime;
    if (!val || !val.trim()) return '0h 0m 0s (0 mins)';
    const totalSecs = this.parseDurationToSeconds(val);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const mins = Math.round(totalSecs / 60);
    if (h > 0) return `${h}h ${m}m ${s}s (${mins} mins total)`;
    if (m > 0) return `${m}m ${s}s (${mins} mins total)`;
    return `${s}s (${mins} mins total)`;
  }

  parseDurationToSeconds(durationStr: string): number {
    if (!durationStr || !durationStr.trim()) return 0;
    const str = durationStr.trim().toLowerCase();
    let totalSeconds = 0;

    const hMatch = str.match(/(\d+)\s*h/);
    const mMatch = str.match(/(\d+)\s*m/);
    const sMatch = str.match(/(\d+)\s*s/);

    let found = false;
    if (hMatch) { totalSeconds += parseInt(hMatch[1], 10) * 3600; found = true; }
    if (mMatch) { totalSeconds += parseInt(mMatch[1], 10) * 60; found = true; }
    if (sMatch) { totalSeconds += parseInt(sMatch[1], 10); found = true; }

    if (found) return totalSeconds;

    const parts = str.split(':').map(p => parseInt(p, 10));
    if (parts.every(p => !isNaN(p))) {
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
    }

    const num = parseInt(str, 10);
    return isNaN(num) ? 0 : num * 60;
  }

  parseDurationToMinutes(durationStr: string): number {
    return Math.round(this.parseDurationToSeconds(durationStr) / 60);
  }

  onMasterPlaylistUploaded(url: string): void {
    this.contentForm.patchValue({ masterPlaylistUrl: url });
  }

  loadMovie(id: string | number): void {
    this.loading = true;
    this.movieApiService.getMovieById(id).subscribe({
      next: (res) => {
        this.loading = false;
        const m = (res as any)?.data?.data ?? (res as any)?.data ?? res;
        if (m && (m.id || m.title)) {
          const normContentType = this.normalizeMainTypeCode(m.contentType || (m as any).type);
          if (normContentType) {
            const exists = this.mainTypesList.some(t => t.value === normContentType);
            if (!exists) {
              this.mainTypesList = [...this.mainTypesList, { label: normContentType, value: normContentType }];
            }
          }

          const rawCat = Array.isArray(m.categories) && m.categories.length > 0 ? m.categories : m.category;
          const safeCategory: string[] = Array.isArray(rawCat)
            ? rawCat.map((c: any) => typeof c === 'string' ? c.trim() : (c?.name || c?.slug || '').trim()).filter(Boolean)
            : (rawCat ? [String(rawCat).trim()].filter(Boolean) : []);

          const rawGenres = m.genres;
          const safeGenres: string[] = Array.isArray(rawGenres)
            ? rawGenres.map((g: any) => typeof g === 'string' ? g.trim() : (g?.name || g?.slug || '').trim()).filter(Boolean)
            : (rawGenres ? [String(rawGenres).trim()].filter(Boolean) : []);

          const rawCast = m.cast || m.castMembers;
          const safeCast: string[] = Array.isArray(rawCast)
            ? rawCast.map((c: any) => {
                if (typeof c === 'string') return c.trim();
                const cname = (c?.name || c?.characterName || c?.person?.name || '').trim();
                if (cname && !this.castMembersMap[cname]) {
                  this.castMembersMap[cname] = {
                    id: c?.id,
                    name: cname,
                    role: c?.role || 'Actor',
                    bio: c?.bio || '',
                    image: c?.image || c?.imageUrl || '',
                    imageUrl: c?.imageUrl || c?.image || ''
                  };
                }
                return cname;
              }).filter(Boolean)
            : [];

          this.castList = [...new Set([...this.castList, ...safeCast])];
          this.categoriesList = [...new Set([...this.categoriesList, ...safeCategory])];
          this.genresList = [...new Set([...this.genresList, ...safeGenres])];

          const streamUrl = m.masterPlaylistUrl || (m as any).videoAssetId || (m as any).video_asset_id || (m as any).videoUrl || (m as any).video_url || m.media_asset?.hls_manifest_url || m.video4kUrl || m.video1080Url || m.video720Url || '';
          const bVideoId = m.bunnyVideoId || (m as any).bunny_video_id || m.media_asset?.bunny_video_id || '';
          if (bVideoId) {
            this.bunnyVideoId = bVideoId;
            this.bunnyStatusText = m.media_asset?.status || 'READY';
          } else if (streamUrl) {
            this.bunnyStatusText = 'READY';
          }

          let mappedLang = formatLanguage(m.originalLanguage || (m as any).originalLanguageCode || (m as any).languageName || 'Kannada');
          const existingLang = this.languagesList.find(l => l.toLowerCase() === mappedLang.toLowerCase());
          if (existingLang) {
            mappedLang = existingLang;
          } else if (mappedLang) {
            this.languagesList = [mappedLang, ...this.languagesList];
          }

          let prodName = (m.producer || (m as any).productionHouse || (m as any).production_house || (m as any).productionName || (m as any).producer?.companyName || '').trim();
          if (prodName) {
            const existingProd = this.producersList.find(p => p.toLowerCase() === prodName.toLowerCase());
            if (existingProd) {
              prodName = existingProd;
            } else {
              this.producersList = [prodName, ...this.producersList];
            }
          }

          let relDate = '';
          const rawDate = m.releaseDate || (m as any).release_date || m.createdAt;
          if (rawDate) {
            const str = String(rawDate).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
              relDate = str;
            } else if (str.includes('T')) {
              relDate = str.split('T')[0];
            } else {
              const dt = new Date(str);
              if (!isNaN(dt.getTime())) {
                relDate = dt.toISOString().split('T')[0];
              }
            }
          }
          const desc = m.description || (m as any).shortDescription || '';
          const formattedDuration =
            m.durationTime ||
            this.formatSecondsToHms((m as any).durationSeconds, m.durationMinutes) ||
            '02:00:00';
          const normRating = this.normalizeMaturityRating(m.maturityRating || (m as any).ageRating);

          this.contentForm.patchValue({
            title: m.title || '',
            contentType: normContentType,
            description: desc,
            originalLanguage: mappedLang,
            maturityRating: normRating,
            releaseDate: relDate,
            durationTime: formattedDuration,
            posterUrl: m.posterUrl || '',
            bannerUrl: m.bannerUrl || '',
            trailerUrl: m.trailerUrl || '',
            masterPlaylistUrl: streamUrl,
            producer: prodName,
            cast: safeCast,
            video320Url: m.video320Url || '',
            video480Url: m.video480Url || '',
            video720Url: m.video720Url || streamUrl,
            video1080Url: m.video1080Url || streamUrl,
            video2kUrl: m.video2kUrl || '',
            video4kUrl: m.video4kUrl || streamUrl,
            genres: safeGenres,
            category: safeCategory,
            status: m.status || 'PUBLISHED',
            monetization: m.monetization || (m.isPremium ? 'SVOD' : 'AVOD'),
            rentPrice: m.rentPrice ?? 99,
            validityHours: m.validityHours ?? 48,
            drmSystem: 'MULTI_DRM',
            geoRestrictions: ['GLOBAL'],
            isPremium: m.isPremium !== undefined ? m.isPremium : false,
            isTitle: true,
            isDownload: true,
            isComment: true,
            isLike: true,
            videoUploadType: 'Server Video',
            youtubeOption: m.youtubeOption || '',
            podcastHost: m.podcastHost || '',
            podcastGuest: m.podcastGuest || '',
            podcastAudioUrl: m.podcastAudioUrl || '',
            dramaTroupe: m.dramaTroupe || '',
            playwright: m.playwright || '',
            docTopic: m.docTopic || '',
            docNarrator: m.docNarrator || '',
            logoImageUrl: (m as any).logoImageUrl || '',
            contentWarnings: Array.isArray((m as any).contentWarnings) ? (m as any).contentWarnings : [],
            qualityBadges: Array.isArray((m as any).qualityBadges) ? (m as any).qualityBadges : [],
            skipIntroStart: this.formatSecondsToHms((m as any).skipIntroStart),
            skipIntroEnd: this.formatSecondsToHms((m as any).skipIntroEnd),
            skipOutroStart: this.formatSecondsToHms((m as any).skipOutroStart),
            scheduledPublishAt: this.toDatetimeLocal((m as any).scheduledPublishAt),
            expiresAt: this.toDatetimeLocal((m as any).expiresAt)
          });

          // Reload saved subtitles & multi-language audio tracks
          const rawSubs = Array.isArray((m as any).subtitles)
            ? (m as any).subtitles
            : (() => { try { return JSON.parse((m as any).subtitlesJson || '[]'); } catch { return []; } })();
          if (Array.isArray(rawSubs) && rawSubs.length > 0) {
            this.subtitles.clear();
            rawSubs.forEach((s: any) => {
              this.subtitles.push(this.createSubtitleFormGroup(
                s.label || s.languageName || s.language || 'English',
                s.fileUrl || s.src || s.url || ''
              ));
            });
          }

          const rawAudio = Array.isArray((m as any).audioTracks)
            ? (m as any).audioTracks
            : (() => { try { return JSON.parse((m as any).audioTracksJson || '[]'); } catch { return []; } })();
          if (Array.isArray(rawAudio) && rawAudio.length > 0) {
            this.audioTracks.clear();
            rawAudio.forEach((a: any) => {
              this.audioTracks.push(this.createAudioTrackFormGroup(
                a.label || a.languageName || a.language || 'Hindi',
                a.url || a.streamUrl || ''
              ));
            });
          }

          this.localPosterPreview = m.posterUrl || '';
          this.localBannerPreview = m.bannerUrl || '';
          this.contentForm.updateValueAndValidity();
        }
      },
      error: () => {
        this.loading = false;
        this.notificationService.error('Failed to load movie details for editing.');
      }
    });
  }

  onVideoUploaded(key: string, url: string): void {
    this.contentForm.patchValue({ [key + 'Url']: url });
  }

  onTrailerUploaded(url: string): void {
    this.contentForm.patchValue({ trailerUrl: url });
  }

  onSubtitleUploaded(index: number, url: string): void {
    const subGroup = this.subtitles.at(index);
    if (subGroup) {
      subGroup.patchValue({ fileUrl: url });
    }
  }

  onPosterUploaded(url: string): void {
    this.contentForm.patchValue({ posterUrl: url });
    this.localPosterPreview = url;
  }

  onBannerUploaded(url: string): void {
    this.contentForm.patchValue({ bannerUrl: url });
    this.localBannerPreview = url;
  }

  onPosterImgError(event: any): void {
    if (event?.target && !event.target.dataset.errored) {
      event.target.dataset.errored = 'true';
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2310101c"/><stop offset="100%" stop-color="%231e1e32"/></linearGradient></defs><rect width="300" height="400" rx="8" fill="url(%23bg)"/><circle cx="150" cy="150" r="40" fill="%2300d2ff" fill-opacity="0.15"/><path d="M125 175l18-22 14 17 20-25 23 30H100z" fill="%2300d2ff"/><circle cx="132" cy="130" r="8" fill="%23ffb800"/><text x="150" y="225" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Poster Preview</text><text x="150" y="248" dominant-baseline="middle" text-anchor="middle" fill="%2300d2ff" font-family="system-ui, sans-serif" font-size="11">Poster Artwork (3:4)</text></svg>';
    }
  }

  onBannerImgError(event: any): void {
    if (event?.target && !event.target.dataset.errored) {
      event.target.dataset.errored = 'true';
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><defs><linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2310101c"/><stop offset="100%" stop-color="%231e1e32"/></linearGradient></defs><rect width="480" height="270" rx="8" fill="url(%23bg2)"/><circle cx="240" cy="105" r="35" fill="%2300d2ff" fill-opacity="0.15"/><path d="M210 130l18-22 14 17 22-28 26 33H190z" fill="%2300d2ff"/><circle cx="220" cy="90" r="8" fill="%23ffb800"/><text x="240" y="170" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Landscape Banner Preview</text><text x="240" y="192" dominant-baseline="middle" text-anchor="middle" fill="%2300d2ff" font-family="system-ui, sans-serif" font-size="11">Landscape Banner (16:9)</text></svg>';
    }
  }

  onCancel(): void {
    if (this.router.url.includes('/producer')) {
      this.router.navigate(['/producer/dashboard']);
    } else {
      this.router.navigate(['/admin/movies']);
    }
  }

  get minScheduleDateTime(): string {
    return this.toDatetimeLocal(new Date().toISOString());
  }

  toDatetimeLocal(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  formatSchedulePreview(val?: string | null): string {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  setStatus(status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'): void {
    this.contentForm.patchValue({ status });
  }

  submitWithStatus(status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'): void {
    this.contentForm.patchValue({ status });
    if (status === 'SCHEDULED') {
      const schedVal = this.contentForm.value.scheduledPublishAt;
      if (!schedVal) {
        this.notificationService.warning('Please pick a future Publish Date & Time first, then click Schedule Publish.');
        setTimeout(() => {
          const el = document.getElementById('schedule-picker-box');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return;
      }
      const schedDate = new Date(schedVal);
      if (isNaN(schedDate.getTime()) || schedDate.getTime() <= Date.now()) {
        this.notificationService.warning('Scheduled date & time must be in the future. Pick a later time or click Publish Now.');
        setTimeout(() => {
          const el = document.getElementById('schedule-picker-box');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
        return;
      }
    }
    this.onSubmit();
  }

  onSubmit(): void {
    if (this.contentForm.invalid) {
      this.contentForm.markAllAsTouched();
      this.notificationService.warning('Please enter the required fields: Title and Original Language.');
      return;
    }

    this.loading = true;
    const formVal = this.contentForm.value;
    const parsedMins = this.parseDurationToMinutes(formVal.durationTime || '');
    const isProducerMode = this.router.url.includes('/producer') || (this.authStore.isProducer() && !this.authStore.hasRole('ADMIN') && !this.authStore.hasRole('SUPER_ADMIN'));

    const dto: Movie = {
      title: formVal.title || '',
      contentType: formVal.contentType || 'MOVIE',
      description: formVal.description || '',
      releaseDate: formVal.releaseDate || '',
      originalLanguage: formVal.originalLanguage || (this.languagesList[0] || ''),
      maturityRating: formVal.maturityRating || 'UA_13+',
      durationMinutes: parsedMins || 120,
      durationTime: formVal.durationTime || '02:00:00',
      status: isProducerMode ? 'SUBMITTED' : (formVal.status || 'PUBLISHED'),
      producer: formVal.producer || '',
      posterUrl: formVal.posterUrl || '',
      bannerUrl: formVal.bannerUrl || '',
      trailerUrl: formVal.trailerUrl || '',
      masterPlaylistUrl: formVal.masterPlaylistUrl || formVal.video4kUrl || formVal.video2kUrl || formVal.video1080Url || formVal.video720Url || '',
      bunnyVideoId: this.bunnyVideoId || '',
      video320Url: formVal.video320Url || '',
      video480Url: formVal.video480Url || '',
      video720Url: formVal.video720Url || '',
      video1080Url: formVal.video1080Url || '',
      video2kUrl: formVal.video2kUrl || '',
      video4kUrl: formVal.video4kUrl || '',
      genres: formVal.genres || [],
      category: formVal.category || [],
      categories: formVal.category || [],
      cast: formVal.cast || [],
      castMembers: formVal.cast || [],
      monetization: formVal.monetization || 'AVOD',
      rentPrice: formVal.rentPrice != null ? Number(formVal.rentPrice) : 99,
      validityHours: formVal.validityHours != null ? Number(formVal.validityHours) : 48,
      isPremium: (formVal.monetization || 'AVOD') !== 'AVOD'
    };

    const cleanedSubtitles = (formVal.subtitles || [])
      .filter((s: any) => s && (s.fileUrl || '').trim())
      .map((s: any) => {
        const label = (s.languageName || 'English').trim();
        const srclang = label.slice(0, 2).toLowerCase();
        const url = (s.fileUrl || '').trim();
        return { language: srclang, srclang, label, languageName: label, fileUrl: url, src: url };
      });
    const cleanedAudioTracks = (formVal.audioTracks || [])
      .filter((a: any) => a && (a.url || '').trim())
      .map((a: any) => {
        const label = (a.languageName || 'Hindi').trim();
        const lang = label.slice(0, 2).toLowerCase();
        const url = (a.url || '').trim();
        return { language: lang, label, languageName: label, url, streamUrl: url };
      });
    const richCast = (formVal.cast || []).map((name: string) => {
      const m = this.castMembersMap[name];
      return m
        ? { id: m.id || 0, name: m.name, role: m.role, bio: m.bio, image: m.image, imageUrl: m.imageUrl }
        : { id: 0, name, role: 'Actor', bio: '', image: '', imageUrl: '' };
    });
    const parseTimeToSec = (val?: string | null): number | null => {
      if (!val || !val.trim()) return null;
      const parts = val.trim().split(':').map(Number);
      if (parts.some(isNaN)) return null;
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0];
    };

    (dto as any).cast = richCast;
    (dto as any).castMembers = richCast;
    (dto as any).subtitles = cleanedSubtitles;
    (dto as any).audioTracks = cleanedAudioTracks;
    (dto as any).logoImageUrl = formVal.logoImageUrl || '';
    (dto as any).contentWarnings = formVal.contentWarnings || [];
    (dto as any).qualityBadges = formVal.qualityBadges || [];
    const sStart = parseTimeToSec(formVal.skipIntroStart);
    const sEnd = parseTimeToSec(formVal.skipIntroEnd);
    const sOutro = parseTimeToSec(formVal.skipOutroStart);
    if (sStart !== null) (dto as any).skipIntroStart = sStart;
    if (sEnd !== null) (dto as any).skipIntroEnd = sEnd;
    if (sOutro !== null) (dto as any).skipOutroStart = sOutro;
    if (formVal.scheduledPublishAt && dto.status === 'SCHEDULED') {
      (dto as any).scheduledPublishAt = new Date(formVal.scheduledPublishAt).toISOString();
    } else if (dto.status === 'PUBLISHED') {
      (dto as any).scheduledPublishAt = '';
    }
    if (formVal.expiresAt) {
      (dto as any).expiresAt = new Date(formVal.expiresAt).toISOString();
    } else if (this.isEdit) {
      (dto as any).expiresAt = '';
    }

    if (this.isEdit && this.movieId) {
      this.movieApiService.updateMovie(this.movieId, dto).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res?.success || res?.id || res?.data) {
            const statusMsg = dto.status === 'PUBLISHED'
              ? 'Content updated and published live on Web & Mobile!'
              : dto.status === 'SCHEDULED'
                ? `Content scheduled to auto-publish on ${this.formatSchedulePreview(formVal.scheduledPublishAt)}!`
                : 'Content updated and saved as Draft (hidden from users).';
            this.notificationService.success(statusMsg);
            this.router.navigate([isProducerMode ? '/producer/dashboard' : '/admin/movies']);
          }
        },
        error: (err) => {
          this.loading = false;
          const msg = err?.error?.message || 'Failed to update content.';
          this.notificationService.error(msg);
        }
      });
    } else if (isProducerMode) {
      this.producerApiService.submitContent({
        title: dto.title,
        contentType: dto.contentType || 'MOVIE',
        description: dto.description || '',
        posterUrl: dto.posterUrl,
        bannerUrl: dto.bannerUrl,
        trailerUrl: dto.trailerUrl,
        rawVideoUrl: dto.masterPlaylistUrl || '',
        revenueSharePercentage: 60,
        status: 'SUBMITTED'
      }).subscribe({
        next: () => {
          this.loading = false;
          this.notificationService.success('Content submitted for Admin Review & FFmpeg ABR Transcoding!');
          this.router.navigate(['/producer/dashboard']);
        },
        error: () => {
          this.movieApiService.createMovie(dto).subscribe({
            next: () => {
              this.loading = false;
              this.notificationService.success('Content submitted for Admin Review & FFmpeg ABR Transcoding!');
              this.router.navigate(['/producer/dashboard']);
            },
            error: (err) => {
              this.loading = false;
              const msg = err?.error?.message || 'Failed to submit content.';
              this.notificationService.error(msg);
            }
          });
        }
      });
    } else {
      this.movieApiService.createMovie(dto).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res?.success || res?.id || res?.data) {
            const statusMsg = dto.status === 'PUBLISHED'
              ? 'New content published live on Web & Mobile!'
              : dto.status === 'SCHEDULED'
                ? `Content scheduled to auto-publish on ${this.formatSchedulePreview(formVal.scheduledPublishAt)}!`
                : 'New content saved as Draft (hidden from Web & Mobile).';
            this.notificationService.success(statusMsg);
            this.router.navigate(['/admin/movies']);
          }
        },
        error: (err) => {
          this.loading = false;
          const msg = err?.error?.message || 'Failed to create content.';
          this.notificationService.error(msg);
        }
      });
    }
  }

  // --- BUNNY.NET STREAM METHODS ---

  onBunnyVideoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    this.uploadBunnyVideo(file);
  }

  uploadBunnyVideo(file: File): void {
    this.bunnyVideoUploading = true;
    this.bunnyVideoProgress = 5;
    const title = this.contentForm.value.title || file.name;

    // STEP 1: Direct Upload Session (zero JVM heap usage, streams directly to Bunny Stream)
    this.http.post<any>(`${environment.apiBaseUrl}/storage/direct-upload-token?title=${encodeURIComponent(title)}`, {}).subscribe({
      next: (ticketRes) => {
        if (ticketRes?.success && ticketRes?.data?.uploadUrl && ticketRes?.data?.accessKey) {
          const session = ticketRes.data;
          this.executeDirectStreamUpload(file, session);
        } else {
          this.executeThreadedBackendUpload(file, title);
        }
      },
      error: () => {
        this.executeThreadedBackendUpload(file, title);
      }
    });
  }

  private executeDirectStreamUpload(file: File, session: any): void {
    // Prefer Bunny TUS 1.0.0 Resumable Chunked Upload (5 MB chunks, survives drops/reloads)
    if (session?.tusEndpoint && session?.authorizationSignature && session?.authorizationExpire && session?.libraryId) {
      this.executeTusResumableUpload(file, session).catch(() => {
        this.executeLegacyPutUpload(file, session);
      });
      return;
    }
    this.executeLegacyPutUpload(file, session);
  }

  private async executeTusResumableUpload(file: File, session: any): Promise<void> {
    const fingerprint = `maxx_tus_${file.name}_${file.size}_${file.lastModified}`;
    const tusHeaders: Record<string, string> = {
      'Tus-Resumable': '1.0.0',
      'AuthorizationSignature': String(session.authorizationSignature),
      'AuthorizationExpire': String(session.authorizationExpire),
      'VideoId': String(session.videoId),
      'LibraryId': String(session.libraryId)
    };

    let uploadUrl = '';
    let offset = 0;

    // 1. Resume existing interrupted upload if saved in localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(fingerprint) || 'null');
      if (saved?.uploadUrl && saved?.videoId) {
        const headResp = await fetch(saved.uploadUrl, {
          method: 'HEAD',
          headers: {
            'Tus-Resumable': '1.0.0',
            'AuthorizationSignature': String(saved.authorizationSignature || tusHeaders['AuthorizationSignature']),
            'AuthorizationExpire': String(saved.authorizationExpire || tusHeaders['AuthorizationExpire']),
            'VideoId': String(saved.videoId),
            'LibraryId': String(saved.libraryId || tusHeaders['LibraryId'])
          }
        });
        if (headResp.ok) {
          uploadUrl = saved.uploadUrl;
          offset = Number(headResp.headers.get('Upload-Offset') || 0);
          session = { ...session, ...saved };
          tusHeaders['AuthorizationSignature'] = String(session.authorizationSignature);
          tusHeaders['AuthorizationExpire'] = String(session.authorizationExpire);
          tusHeaders['VideoId'] = String(session.videoId);
          this.bunnyVideoProgress = Math.min(99, Math.round((offset / file.size) * 100));
        } else {
          localStorage.removeItem(fingerprint);
        }
      }
    } catch {
      localStorage.removeItem(fingerprint);
    }

    // 2. Create new TUS upload session on Bunny Stream if not resuming
    if (!uploadUrl) {
      const metaFilename = btoa(unescape(encodeURIComponent(file.name)));
      const metaType = btoa(file.type || 'video/mp4');
      const createResp = await fetch(session.tusEndpoint, {
        method: 'POST',
        headers: {
          ...tusHeaders,
          'Upload-Length': String(file.size),
          'Upload-Metadata': `filename ${metaFilename},filetype ${metaType}`
        }
      });
      if (!createResp.ok) {
        throw new Error(`TUS create failed: HTTP ${createResp.status}`);
      }
      const loc = createResp.headers.get('Location') || '';
      uploadUrl = loc.startsWith('/') ? `https://video.bunnycdn.com${loc}` : loc;
      if (!uploadUrl) throw new Error('Missing TUS Location header');
      try {
        localStorage.setItem(fingerprint, JSON.stringify({
          uploadUrl,
          videoId: session.videoId,
          libraryId: session.libraryId,
          authorizationSignature: session.authorizationSignature,
          authorizationExpire: session.authorizationExpire,
          hlsUrl: session.hlsUrl,
          thumbnailUrl: session.thumbnailUrl
        }));
      } catch {}
    }

    // 3. Stream 5 MB resumable chunks with automatic retry on network hiccups
    const chunkSize = 5 * 1024 * 1024;
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = file.slice(offset, end);
      let uploaded = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, attempt * 1500));
            const h = await fetch(uploadUrl, { method: 'HEAD', headers: tusHeaders });
            if (h.ok) {
              const srvOff = Number(h.headers.get('Upload-Offset') || offset);
              if (srvOff >= end) {
                offset = srvOff;
                uploaded = true;
                break;
              }
            }
          }
          const patchResp = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
              ...tusHeaders,
              'Content-Type': 'application/offset+octet-stream',
              'Upload-Offset': String(offset)
            },
            body: chunk
          });
          if (patchResp.ok) {
            offset = Number(patchResp.headers.get('Upload-Offset') || end);
            this.bunnyVideoProgress = Math.min(99, Math.round((offset / file.size) * 100));
            uploaded = true;
            break;
          }
        } catch {
          // retry next attempt
        }
      }
      if (!uploaded) {
        this.bunnyVideoUploading = false;
        this.notificationService.error('Upload paused due to network error. Select the same file again to resume from ' + this.bunnyVideoProgress + '%.');
        return;
      }
    }

    // 4. Completed! Clear resume state, fill form & auto-save if editing
    try { localStorage.removeItem(fingerprint); } catch {}
    this.bunnyVideoUploading = false;
    this.bunnyVideoProgress = 100;
    this.bunnyVideoId = session.videoId;
    this.bunnyStatusText = 'UPLOADED';
    this.contentForm.patchValue({ masterPlaylistUrl: session.hlsUrl });
    if (session.thumbnailUrl && (!this.contentForm.value.posterUrl || !this.localPosterPreview)) {
      this.contentForm.patchValue({ posterUrl: session.thumbnailUrl, bannerUrl: session.thumbnailUrl });
      this.localPosterPreview = session.thumbnailUrl;
    }
    if (this.isEdit && this.movieId) {
      this.http.put<any>(`${environment.apiBaseUrl}/admin/movies/${this.movieId}`, {
        masterPlaylistUrl: session.hlsUrl,
        videoAssetId: session.videoId,
        bunnyVideoGuid: session.videoId
      }).subscribe({
        next: () => this.notificationService.success('Video uploaded via TUS resumable stream & saved to database!'),
        error: () => this.notificationService.success('Video uploaded to Bunny Stream! Click Save to persist.')
      });
    } else {
      this.notificationService.success('Video uploaded via TUS resumable stream to Bunny.net!');
    }
  }

  private executeLegacyPutUpload(file: File, session: any): void {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', session.uploadUrl, true);
    xhr.setRequestHeader('AccessKey', session.accessKey);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        this.bunnyVideoProgress = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        this.bunnyVideoUploading = false;
        this.bunnyVideoProgress = 100;
        this.bunnyVideoId = session.videoId;
        this.bunnyStatusText = 'UPLOADED';
        this.contentForm.patchValue({ masterPlaylistUrl: session.hlsUrl });
        if (session.thumbnailUrl && (!this.contentForm.value.posterUrl || !this.localPosterPreview)) {
          this.contentForm.patchValue({ posterUrl: session.thumbnailUrl, bannerUrl: session.thumbnailUrl });
          this.localPosterPreview = session.thumbnailUrl;
        }
        this.notificationService.success('4K/HD Video uploaded directly to Bunny Stream! ABR Transcoding in progress.');
      } else {
        this.executeThreadedBackendUpload(file, session.title);
      }
    };

    xhr.onerror = () => {
      this.executeThreadedBackendUpload(file, session.title);
    };

    xhr.send(file);
  }

  private executeThreadedBackendUpload(file: File, title: string): void {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);

    this.http.post<any>(`${environment.apiBaseUrl}/storage/upload-video-async`, formData).subscribe({
      next: (res) => {
        if (res?.success && res?.data?.jobId) {
          const jobId = res.data.jobId;
          this.pollUploadJob(jobId, res.data);
        } else {
          this.fallbackSyncUpload(formData);
        }
      },
      error: () => {
        this.fallbackSyncUpload(formData);
      }
    });
  }

  private pollUploadJob(jobId: string, initialData: any): void {
    const interval = setInterval(() => {
      this.http.get<any>(`${environment.apiBaseUrl}/storage/upload-job/${jobId}`).subscribe({
        next: (jobRes) => {
          if (jobRes?.success && jobRes?.data) {
            const job = jobRes.data;
            this.bunnyVideoProgress = job.progress || 10;
            if (job.status === 'COMPLETED') {
              clearInterval(interval);
              this.bunnyVideoUploading = false;
              this.bunnyVideoProgress = 100;
              this.bunnyVideoId = job.guid;
              this.bunnyStatusText = 'UPLOADED';
              this.contentForm.patchValue({ masterPlaylistUrl: job.hlsUrl });
              if (job.thumbnailUrl && (!this.contentForm.value.posterUrl || !this.localPosterPreview)) {
                this.contentForm.patchValue({ posterUrl: job.thumbnailUrl, bannerUrl: job.thumbnailUrl });
                this.localPosterPreview = job.thumbnailUrl;
              }
              this.notificationService.success('Video uploaded via background worker thread! Transcoding in progress.');
            } else if (job.status === 'FAILED') {
              clearInterval(interval);
              this.bunnyVideoUploading = false;
              this.notificationService.error(job.errorMessage || 'Background video upload worker encountered an error.');
            }
          }
        },
        error: () => {
          clearInterval(interval);
          this.bunnyVideoUploading = false;
        }
      });
    }, 2000);
  }

  private fallbackSyncUpload(formData: FormData): void {
    this.http.post<any>(`${environment.apiBaseUrl}/storage/upload-video`, formData, {
      reportProgress: true,
      observe: 'events'
    }).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          this.bunnyVideoProgress = Math.round((100 * event.loaded) / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.bunnyVideoUploading = false;
          this.bunnyVideoProgress = 100;
          const res = event.body;
          if (res?.success && res?.data) {
            this.bunnyVideoId = res.data.videoId;
            this.bunnyStatusText = res.data.status || 'UPLOADED';
            const hls = res.data.hlsUrl || res.data.streamUrl;
            this.contentForm.patchValue({ masterPlaylistUrl: hls });
            if (res.data.thumbnailUrl && (!this.contentForm.value.posterUrl || !this.localPosterPreview)) {
              this.contentForm.patchValue({ posterUrl: res.data.thumbnailUrl, bannerUrl: res.data.thumbnailUrl });
              this.localPosterPreview = res.data.thumbnailUrl;
            }
            this.notificationService.success('Video uploaded to Bunny Stream! Transcoding in progress.');
          }
        }
      },
      error: (err) => {
        this.bunnyVideoUploading = false;
        this.bunnyVideoProgress = 0;
        this.notificationService.error(err?.error?.message || 'Video upload failed.');
      }
    });
  }

  showGdriveVideoBrowser = false;
  gdriveBrowseScope: 'shared' | 'my' = 'shared';
  gdriveBrowseSearch = '';
  gdriveBrowseLoading = false;
  gdriveVideoFiles: any[] = [];

  toggleGDriveVideoBrowser(scope: 'shared' | 'my'): void {
    this.showGdriveVideoBrowser = true;
    this.loadGDriveVideos(scope);
  }

  loadGDriveVideos(scope: 'shared' | 'my'): void {
    this.gdriveBrowseScope = scope;
    this.gdriveBrowseLoading = true;
    const q = encodeURIComponent((this.gdriveBrowseSearch || '').trim());
    this.http.get<any>(`/api/gdrive/files?scope=${scope}&type=video&q=${q}`).subscribe({
      next: (res) => {
        this.gdriveBrowseLoading = false;
        this.gdriveVideoFiles = res?.files || [];
      },
      error: (err) => {
        this.gdriveBrowseLoading = false;
        this.gdriveVideoFiles = [];
        if (err?.status === 401) {
          this.notificationService.warning('Please click "Login Google Drive" first to browse private/shared files.');
        } else {
          this.notificationService.error(err?.error?.error || 'Failed to browse Google Drive.');
        }
      }
    });
  }

  selectGDriveVideo(vf: any, inputEl: HTMLInputElement): void {
    const link = `https://drive.google.com/file/d/${vf.id}/view`;
    if (inputEl) inputEl.value = link;
    this.showGdriveVideoBrowser = false;
    this.streamFromGoogleDrive(link);
  }

  connectGoogleDrive(): void {
    this.http.get<any>('/api/gdrive/auth-url').subscribe({
      next: (res) => {
        if (res?.authUrl) {
          this.showGdriveCodeBox = true;
          window.open(res.authUrl, '_blank', 'noopener,noreferrer');
          this.notificationService.info('Sign in with your Gmail in the opened tab, then paste the redirected localhost URL below.');
        } else {
          this.notificationService.error(res?.error || 'Google Drive OAuth is not configured on the server.');
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.error || 'Failed to get Google Drive login URL.');
      }
    });
  }

  submitGoogleDriveCode(rawCode: string): void {
    const code = (rawCode || '').trim();
    if (!code) {
      this.notificationService.warning('Please paste the redirected URL or authorization code.');
      return;
    }
    this.http.post<any>('/api/gdrive/exchange', { code }).subscribe({
      next: (res) => {
        if (res?.connected) {
          this.gdriveConnected = true;
          this.showGdriveCodeBox = false;
          this.notificationService.success(res.message || 'Google Drive connected! You can now stream private files.');
        } else {
          this.notificationService.error(res?.error || 'Failed to connect Google Drive.');
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.error || 'Google rejected the authorization code. Please try logging in again.');
      }
    });
  }

  streamFromGoogleDrive(rawUrl: string): void {
    const gdriveUrl = (rawUrl || '').trim();
    if (!gdriveUrl) {
      this.notificationService.warning('Please paste a Google Drive share link or File ID.');
      return;
    }
    const title = (this.contentForm.value.title || 'Untitled Video').trim();
    this.gdriveStreaming = true;
    this.gdriveProgress = 0;
    this.gdriveStatusText = 'Initializing Google Drive -> Bunny Stream transfer...';

    this.http.post<any>('/api/stream-gdrive', { gdriveUrl, title }).subscribe({
      next: (res) => {
        const jobId = res?.jobId;
        if (!jobId) {
          this.gdriveStreaming = false;
          this.notificationService.error(res?.error || 'Failed to start Google Drive stream job.');
          return;
        }
        this.notificationService.success('Google Drive stream started! Streaming directly to Bunny Stream...');
        const timer = setInterval(() => {
          this.http.get<any>(`/api/jobs/${jobId}`).subscribe({
            next: (job) => {
              const pct = Math.round(job?.progress?.percentage || 0);
              const speed = job?.progress?.speedMBps ? `${Number(job.progress.speedMBps).toFixed(1)} MB/s` : '';
              this.gdriveProgress = pct;
              this.gdriveStatusText = `Streaming to Bunny.net${speed ? ' (' + speed + ')' : ''}...`;

              if (job?.status === 'COMPLETED' && job?.videoMetadata) {
                clearInterval(timer);
                this.gdriveStreaming = false;
                this.gdriveProgress = 100;
                const meta = job.videoMetadata;
                this.bunnyVideoId = meta.guid || '';
                this.bunnyStatusText = 'UPLOADED';
                const hlsUrl = meta.hlsUrl || '';
                this.contentForm.patchValue({ masterPlaylistUrl: hlsUrl });

                const patchPayload: any = {
                  masterPlaylistUrl: hlsUrl,
                  videoAssetId: meta.guid || hlsUrl,
                  bunnyVideoGuid: meta.guid || ''
                };
                if (meta.thumbnailUrl && !this.contentForm.value.posterUrl) {
                  this.contentForm.patchValue({ posterUrl: meta.thumbnailUrl });
                  this.localPosterPreview = meta.thumbnailUrl;
                  patchPayload.posterUrl = meta.thumbnailUrl;
                }

                // Auto-save to DB immediately when editing an existing movie
                if (this.isEdit && this.movieId) {
                  this.http.put<any>(`${environment.apiBaseUrl}/admin/movies/${this.movieId}`, patchPayload).subscribe({
                    next: () => {
                      this.notificationService.success('Video streamed to Bunny.net & saved to database!');
                    },
                    error: () => {
                      this.notificationService.success('Video streamed to Bunny.net! Click Save to persist changes.');
                    }
                  });
                } else {
                  this.notificationService.success('Video streamed to Bunny.net! HLS URL filled — click Publish/Save to store in DB.');
                }
              } else if (job?.status === 'FAILED') {
                clearInterval(timer);
                this.gdriveStreaming = false;
                const errMsg = job?.error || 'Google Drive stream failed.';
                this.notificationService.error(errMsg + ' Click "Login Google Drive" if this is a private file.');
                this.showGdriveCodeBox = true;
              }
            },
            error: () => {
              clearInterval(timer);
              this.gdriveStreaming = false;
              this.notificationService.error('Lost connection to media-streamer service.');
            }
          });
        }, 2000);
      },
      error: (err) => {
        this.gdriveStreaming = false;
        this.notificationService.error(err?.error?.error || 'Failed to connect to media-streamer service.');
      }
    });
  }

  applyBunnyStreamUrl(rawInput: string): void {
    if (!rawInput || !rawInput.trim()) return;
    const clean = rawInput.trim();
    this.http.post<any>(`${environment.apiBaseUrl}/storage/resolve-video-url`, { streamUrl: clean, videoId: clean }).subscribe({
      next: (res) => {
        if (res?.success && res?.data) {
          this.bunnyVideoId = res.data.videoId;
          this.contentForm.patchValue({ masterPlaylistUrl: res.data.hlsUrl });
          this.bunnyStatusText = 'CONFIGURED';
          this.notificationService.success('Bunny Stream HLS URL resolved & linked successfully!');
        } else {
          this.contentForm.patchValue({ masterPlaylistUrl: clean });
          this.notificationService.success('Bunny Stream URL applied.');
        }
      },
      error: () => {
        this.contentForm.patchValue({ masterPlaylistUrl: clean });
        this.notificationService.success('Stream URL assigned.');
      }
    });
  }

  checkBunnyVideoStatus(): void {
    if (!this.bunnyVideoId) {
      this.notificationService.warning('No Bunny Stream Video ID associated.');
      return;
    }
    this.http.get<any>(`${environment.apiBaseUrl}/storage/video-status/${this.bunnyVideoId}`).subscribe({
      next: (res) => {
        if (res?.success && res?.data) {
          this.bunnyStatusText = res.data.statusText || 'ACTIVE';
          this.bunnyEncodeProgress = res.data.encodeProgress !== undefined ? res.data.encodeProgress : 100;
          this.notificationService.info(`Bunny Stream Status: ${this.bunnyStatusText} (${this.bunnyEncodeProgress}% encoded)`);
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'Unable to fetch status.';
        this.notificationService.error(msg);
      }
    });
  }

  clearBunnyStream(): void {
    this.bunnyVideoId = '';
    this.bunnyStatusText = '';
    this.bunnyEncodeProgress = null;
    this.contentForm.patchValue({ masterPlaylistUrl: '' });
  }
}
