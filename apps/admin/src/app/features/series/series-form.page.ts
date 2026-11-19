import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ActivatedRoute, Router } from '@angular/router';
import { MediaUploadComponent } from '../../shared/components/media-upload/media-upload.component';
import { NotificationService } from '../../shared/services/notification.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SeriesApiService, Series, Season, Episode } from '../../core/services/series-api.service';
import { CatalogApiService } from '../../core/services/catalog-api.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-series-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatRadioModule,
    MatIconModule,
    MatTooltipModule,
    MatChipsModule,
    MediaUploadComponent
  ],
  template: `
    <div class="page-container">
      <!-- TOP STICKY NAV BAR -->
      <div class="quick-nav-bar">
        <div class="nav-pills">
          <button type="button" class="nav-pill" [class.active]="activeStep === 1" (click)="scrollToSection('sec-1', 1)">
            <span class="step-num">01</span> {{ isAlbum ? 'Album & Artists' : 'Metadata & Cast' }}
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 2" (click)="scrollToSection('sec-2', 2)">
            <span class="step-num">02</span> {{ isAlbum ? 'Discs & Tracks' : 'Seasons & Episodes' }}
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 3" (click)="scrollToSection('sec-3', 3)">
            <span class="step-num">03</span> Stream Inspector
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 4" (click)="scrollToSection('sec-4', 4)">
            <span class="step-num">04</span> Artwork
          </button>
          <button type="button" class="nav-pill" [class.active]="activeStep === 5" (click)="scrollToSection('sec-5', 5)">
            <span class="step-num">05</span> DRM & Monetization
          </button>
        </div>
        <div class="quick-nav-actions">
          <button type="button" mat-flat-button color="accent" class="btn-ai-nav" (click)="triggerAiAutoFill()">
            <mat-icon>auto_awesome</mat-icon> AI Auto-Fill
          </button>
          <button mat-stroked-button color="basic" (click)="onCancel()" class="btn-back">
            <mat-icon>arrow_back</mat-icon> {{ isAlbum ? 'Albums Catalog' : 'Series Catalog' }}
          </button>
          <button type="button" mat-flat-button color="warn" class="btn-top-submit" (click)="onSubmit()" [disabled]="loading">
            <mat-icon>{{ isEdit ? 'save' : 'cloud_upload' }}</mat-icon> {{ isAlbum ? (isEdit ? 'Update Album' : 'Publish Album') : (isEdit ? 'Update Series' : 'Publish Series') }}
          </button>
        </div>
      </div>

      <!-- MAIN FORM CARD -->
      <mat-card class="form-card">
        <div class="form-header">
          <div class="header-titles">
            <span class="catalog-badge"><mat-icon>{{ isAlbum ? 'album' : 'tv' }}</mat-icon> {{ isAlbum ? 'PRODUCTION MUSIC / VIDEO ALBUM STUDIO' : 'PRODUCTION WEB SERIES STUDIO' }}</span>
            <h1>{{ isAlbum ? (isEdit ? 'Edit Music / Video Album' : 'Create & Publish Album') : (isEdit ? 'Edit Web Series, Seasons & Episodes' : 'Create & Publish Web Series') }}</h1>
            <p>{{ isAlbum ? 'Configure album title, artists, tracklist, audio/video feeds, and monetization' : 'Configure series metadata, cast, multi-season hierarchy, 4K / HLS video streams, DRM, and geo-fencing' }}</p>
          </div>
        </div>

        <mat-card-content class="form-content">
          <form [formGroup]="seriesForm" (ngSubmit)="onSubmit()">

            <!-- 1. GENERAL METADATA & CAST/CREW -->
            <div id="sec-1" class="section-block">
              <div class="section-header">
                <span class="section-num">01</span>
                <div>
                  <h3 class="section-title">{{ isAlbum ? 'Album Metadata & Artists' : 'General Metadata & Cast' }}</h3>
                  <p class="section-subtitle">{{ isAlbum ? 'Album Title, Category, Language, Artists & Track Producers' : 'Series Title, Main Type, Language, Cast & Crew, Synopsis' }}</p>
                </div>
                <button type="button" class="btn-ai-fill" (click)="triggerAiAutoFill()">
                  <mat-icon>auto_awesome</mat-icon> ✨ AI Auto-Fill
                </button>
              </div>

              <mat-form-field appearance="outline" class="full-width custom-field">
                <mat-label>{{ isAlbum ? 'Album Title *' : 'Series Title *' }}</mat-label>
                <input matInput formControlName="title" [placeholder]="isAlbum ? 'e.g. A.R. Rahman - Classics & Live Hits' : 'e.g. Unstoppable Series S4'" required>
                <mat-icon matSuffix color="primary">{{ isAlbum ? 'album' : 'tv' }}</mat-icon>
              </mat-form-field>

              <div class="form-row">
                <!-- Main Type + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Main Type *</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewMainType()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width custom-field">
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
                  <mat-form-field appearance="outline" class="full-width custom-field">
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
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-select formControlName="genres" multiple>
                      <mat-option *ngFor="let g of activeGenresList" [value]="g">{{ g }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <!-- Original Language + Add New -->
                <div class="field-with-add half-width">
                  <div class="field-label-row">
                    <label class="custom-label">Original Language *</label>
                    <button type="button" class="btn-add-new" (click)="onAddNewLanguage()"><mat-icon>add</mat-icon> Add New</button>
                  </div>
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-select formControlName="originalLanguage">
                      <mat-option *ngFor="let lang of languagesList" [value]="lang">{{ lang }}</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- YouTube Option for Podcast -->
              <div *ngIf="seriesForm.get('contentType')?.value === 'PODCAST'" class="form-row">
                <div class="full-width">
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-label>YouTube Names Option / Channel URL</mat-label>
                    <input matInput formControlName="youtubeOption" placeholder="e.g. Channel Name, Episode Title, or Channel URL">
                    <mat-icon matSuffix color="warn">smart_display</mat-icon>
                  </mat-form-field>
                </div>
              </div>

              <div class="form-row">
                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-label>Maturity Age Rating</mat-label>
                    <mat-select formControlName="maturityRating">
                      <mat-option value="U">U (Universal)</mat-option>
                      <mat-option value="UA_7+">UA 7+</mat-option>
                      <mat-option value="UA_13+">UA 13+</mat-option>
                      <mat-option value="UA_16+">UA 16+</mat-option>
                      <mat-option value="A">A (Adults 18+)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-label>Publication Status</mat-label>
                    <mat-select formControlName="status">
                      <mat-option value="PUBLISHED">Published & Live</mat-option>
                      <mat-option value="DRAFT">Draft Mode</mat-option>
                      <mat-option value="SCHEDULED">Scheduled Release</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- CAST & ARTISTS SECTION -->
              <div class="sub-block">
                <div class="sub-block-header">
                  <label class="custom-label"><mat-icon>{{ isAlbum ? 'music_note' : 'people' }}</mat-icon> {{ isAlbum ? 'Featured Singers, Composers & Lyricists' : 'Lead Cast & Crew' }}</label>
                  <button type="button" mat-stroked-button color="primary" class="btn-add-cast" (click)="addCastMember()">
                    <mat-icon>add</mat-icon> {{ isAlbum ? 'Add Artist' : 'Add Cast Member' }}
                  </button>
                </div>

                <div formArrayName="cast" class="cast-grid">
                  <div *ngFor="let cGroup of cast.controls; let cIdx = index" [formGroupName]="cIdx" class="cast-card">
                    <div class="avatar-badge"><mat-icon>{{ isAlbum ? 'music_note' : 'person' }}</mat-icon></div>
                    <input type="text" formControlName="name" [placeholder]="isAlbum ? 'Artist / Singer Name' : 'Actor Name'" class="cast-input">
                    <input type="text" formControlName="role" [placeholder]="isAlbum ? 'Role (e.g. Singer, Composer)' : 'Role / Character'" class="cast-input">
                    <button type="button" mat-icon-button color="warn" (click)="removeCastMember(cIdx)">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
              </div>

              <mat-form-field appearance="outline" class="full-width custom-field">
                <mat-label>{{ isAlbum ? 'Album Description & Liner Notes' : 'Series Storyline & Synopsis' }}</mat-label>
                <textarea matInput formControlName="description" rows="3" [placeholder]="isAlbum ? 'Enter album details, musical theme, liner notes...' : 'Enter storyline synopsis...'"></textarea>
              </mat-form-field>
            </div>

            <!-- 2. SEASONS & EPISODES / DISCS & TRACKS BUILDER -->
            <div id="sec-2" class="section-block">
              <div class="section-header">
                <span class="section-num">02</span>
                <div>
                  <h3 class="section-title">{{ isAlbum ? 'Album Tracks & Music Videos Builder' : 'Seasons & Episodes Builder' }}</h3>
                  <p class="section-subtitle">{{ isAlbum ? 'Manage audio/video tracks, album volumes, audio quality and stream links' : 'Multi-season hierarchy, episode video stream feeds, and Skip Intro/Outro timestamps' }}</p>
                </div>
                <button type="button" mat-flat-button color="primary" class="btn-add-season" (click)="addSeason()">
                  <mat-icon>add</mat-icon> {{ isAlbum ? 'Add Disc / Volume' : 'Add Season' }}
                </button>
              </div>

              <div formArrayName="seasons" class="seasons-container">
                <div *ngFor="let seasonGroup of seasons.controls; let sIdx = index" [formGroupName]="sIdx" class="season-card">
                  <div class="season-header">
                    <div class="season-title-info">
                      <span class="season-badge">{{ isAlbum ? 'Disc ' + (sIdx + 1) : 'Season ' + (sIdx + 1) }}</span>
                      <input type="text" formControlName="title" class="season-title-input" [placeholder]="isAlbum ? 'Disc Title (e.g. Disc ' + (sIdx + 1) + ': Hits)' : 'Season Title (e.g. Season ' + (sIdx + 1) + ': The Beginning)'">
                    </div>
                    <button type="button" mat-icon-button color="warn" (click)="removeSeason(sIdx)" *ngIf="seasons.length > 1" [matTooltip]="isAlbum ? 'Remove Disc' : 'Remove Season'">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>

                  <!-- Season Episodes / Album Tracks Array -->
                  <div formArrayName="episodes" class="episodes-list">
                    <div *ngFor="let epGroup of getEpisodes(sIdx).controls; let eIdx = index" [formGroupName]="eIdx" class="episode-item">
                      <div class="episode-header">
                        <div class="ep-left">
                          <span class="ep-num">{{ isAlbum ? 'T' + (eIdx + 1) : 'E' + (eIdx + 1) }}</span>
                          <input type="text" formControlName="title" class="ep-title-input" [placeholder]="isAlbum ? 'Track Title (e.g. Track ' + (eIdx + 1) + ': Title Song)' : 'Episode Title (e.g. Episode ' + (eIdx + 1) + ': Pilot)'">
                          <input type="text" formControlName="durationTime" class="ep-duration-input" [placeholder]="isAlbum ? 'Duration (e.g. 4m 30s)' : 'Duration (e.g. 45m)'">
                        </div>
                        <div class="ep-right">
                          <button type="button" mat-flat-button color="accent" class="btn-inspect-ep" (click)="inspectEpisodeStream(epGroup.value.videoAssetId)">
                            <mat-icon>play_circle</mat-icon> Inspect Stream
                          </button>
                          <button type="button" mat-icon-button color="warn" (click)="removeEpisode(sIdx, eIdx)" *ngIf="getEpisodes(sIdx).length > 1" [matTooltip]="isAlbum ? 'Remove Track' : 'Remove Episode'">
                            <mat-icon>close</mat-icon>
                          </button>
                        </div>
                      </div>

                      <div class="episode-media-grid full-width">
                        <div class="media-col full-width">
                          <mat-form-field appearance="outline" class="full-width custom-field no-margin">
                            <mat-label>{{ isAlbum ? 'Track Audio/Video Stream URL (.m3u8 / .mp3)' : 'Bunny Stream HLS Video URL (.m3u8)' }}</mat-label>
                            <input matInput formControlName="videoAssetId" [placeholder]="isAlbum ? 'https://vz-xxxx.b-cdn.net/.../playlist.m3u8' : 'https://vz-xxxx.b-cdn.net/.../playlist.m3u8'">
                            <mat-icon matSuffix color="accent">{{ isAlbum ? 'audiotrack' : 'link' }}</mat-icon>
                          </mat-form-field>
                        </div>
                      </div>

                      <!-- Skip Timestamps (Hidden for Albums) -->
                      <div *ngIf="!isAlbum" class="timestamps-row">
                        <div class="time-field">
                          <mat-form-field appearance="outline" class="full-width custom-field no-margin">
                            <mat-label>Skip Intro Start (HH:MM:SS)</mat-label>
                            <input matInput formControlName="skipIntroStart" placeholder="00:01:15">
                            <mat-icon matSuffix color="primary">timer</mat-icon>
                          </mat-form-field>
                        </div>
                        <div class="time-field">
                          <mat-form-field appearance="outline" class="full-width custom-field no-margin">
                            <mat-label>Skip Intro End (HH:MM:SS)</mat-label>
                            <input matInput formControlName="skipIntroEnd" placeholder="00:02:40">
                            <mat-icon matSuffix color="primary">skip_next</mat-icon>
                          </mat-form-field>
                        </div>
                        <div class="time-field">
                          <mat-form-field appearance="outline" class="full-width custom-field no-margin">
                            <mat-label>Skip Outro / Credits</mat-label>
                            <input matInput formControlName="skipOutroStart" placeholder="00:43:10">
                            <mat-icon matSuffix color="primary">flag</mat-icon>
                          </mat-form-field>
                        </div>
                      </div>
                    </div>

                    <button type="button" mat-stroked-button color="accent" class="btn-add-ep" (click)="addEpisode(sIdx)">
                      <mat-icon>add</mat-icon> {{ isAlbum ? 'Add Track to Disc ' + (sIdx + 1) : 'Add Episode to Season ' + (sIdx + 1) }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3. STREAM PLAYBACK INSPECTOR MODAL -->
            <div id="sec-3" class="section-block">
              <div class="section-header">
                <span class="section-num">03</span>
                <div>
                  <h3 class="section-title">Stream Playback Inspector</h3>
                  <p class="section-subtitle">Live stream playback test and video player inspector</p>
                </div>
                <button type="button" class="btn-preview-stream" (click)="showPreviewPlayer = !showPreviewPlayer">
                  <mat-icon>play_circle</mat-icon> {{ showPreviewPlayer ? 'Close Inspector' : 'Inspect Active Stream' }}
                </button>
              </div>

              <div *ngIf="showPreviewPlayer" class="video-inspector-box">
                <div class="inspector-header">
                  <span><mat-icon>video_settings</mat-icon> Live Stream Inspector</span>
                  <span class="stream-url-tag">{{ activeInspectorUrl || 'No Stream Loaded' }}</span>
                </div>
                <div class="inspector-player-wrapper">
                  <iframe *ngIf="activeInspectorUrl && isEmbedUrl()" [src]="getSafeEmbedUrl()" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="preview-video-element"></iframe>
                  <video *ngIf="activeInspectorUrl && !isEmbedUrl()" [src]="activeInspectorUrl" controls autoplay class="preview-video-element"></video>
                  <div *ngIf="!activeInspectorUrl" class="no-stream-placeholder">
                    <mat-icon>no_encryption</mat-icon>
                    <p>Click "Inspect Stream" on any episode above to test video playback.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. ARTWORK & BANNERS -->
            <div id="sec-4" class="section-block">
              <div class="section-header">
                <span class="section-num">04</span>
                <div>
                  <h3 class="section-title">{{ isAlbum ? 'Album Cover Art & Banners' : 'Series Artwork & Banners' }}</h3>
                  <p class="section-subtitle">{{ isAlbum ? 'Album cover art (3:4 or 1:1) and hero landscape banner (16:9)' : 'Series poster thumbnail (3:4) and hero landscape banner (16:9)' }}</p>
                </div>
              </div>

              <div class="form-row artwork-row">
                <div class="half-width artwork-card">
                  <label class="custom-label">{{ isAlbum ? 'Album Cover Art (3:4 or 1:1)' : 'Series Poster (3:4 Ratio)' }}</label>
                  <app-media-upload folder="series_posters" [label]="isAlbum ? 'Album Cover Image' : 'Series Poster Image'" accept="image/*" [initialUrl]="seriesForm.value.posterUrl || ''" (uploadComplete)="onPosterUploaded($event)" (previewChange)="localPosterPreview = $event"></app-media-upload>
                  <div *ngIf="localPosterPreview || seriesForm.value.posterUrl" class="image-preview">
                    <img [src]="localPosterPreview || seriesForm.value.posterUrl" alt="Series Poster" (error)="onPosterImgError($event)">
                  </div>
                </div>

                <div class="half-width artwork-card">
                  <label class="custom-label">{{ isAlbum ? 'Album Banner (16:9 Ratio)' : 'Landscape Hero Banner (16:9 Ratio)' }}</label>
                  <app-media-upload folder="series_banners" [label]="isAlbum ? 'Album Banner Image' : 'Hero Banner Image'" accept="image/*" [initialUrl]="seriesForm.value.bannerUrl || ''" (uploadComplete)="onBannerUploaded($event)" (previewChange)="localBannerPreview = $event"></app-media-upload>
                  <div *ngIf="localBannerPreview || seriesForm.value.bannerUrl" class="image-preview banner">
                    <img [src]="localBannerPreview || seriesForm.value.bannerUrl" alt="Series Banner" (error)="onBannerImgError($event)">
                  </div>
                </div>
              </div>
            </div>

            <!-- 5. DRM, GEO-FENCING & MONETIZATION -->
            <div id="sec-5" class="section-block">
              <div class="section-header">
                <span class="section-num">05</span>
                <div>
                  <h3 class="section-title">DRM Security, Geo-Fence & Monetization</h3>
                  <p class="section-subtitle">Widevine/FairPlay DRM encryption, regional licensing, and AVOD/SVOD tiers</p>
                </div>
              </div>

              <div class="form-row">
                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-label>DRM Protection System</mat-label>
                    <mat-select formControlName="drmType">
                      <mat-option value="NONE">None (Clear Stream)</mat-option>
                      <mat-option value="WIDEVINE_L1">Google Widevine Modular L1 (Hardware)</mat-option>
                      <mat-option value="WIDEVINE_L3">Google Widevine Modular L3 (Software)</mat-option>
                      <mat-option value="FAIRPLAY">Apple FairPlay Streaming (FPS)</mat-option>
                      <mat-option value="PLAYREADY">Microsoft PlayReady DRM</mat-option>
                      <mat-option value="MULTI_DRM">Cenc Multi-DRM (Widevine + FairPlay + PlayReady)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <div class="half-width">
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-label>Geo-Restriction Fencing</mat-label>
                    <mat-select formControlName="geoRestriction">
                      <mat-option value="GLOBAL">Global (All Countries Allowed)</mat-option>
                      <mat-option value="IN">India Only (IN)</mat-option>
                      <mat-option value="US_CA">North America (US / CA)</mat-option>
                      <mat-option value="EU">European Union (EU)</mat-option>
                      <mat-option value="APAC">Asia-Pacific (APAC)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <div class="monetization-card">
                <label class="monetization-title"><mat-icon>monetization_on</mat-icon> Monetization Model</label>
                <mat-radio-group formControlName="monetization" color="warn" class="monetization-grid">
                  <div class="model-option" [class.selected]="seriesForm.value.monetization === 'AVOD'">
                    <mat-radio-button value="AVOD">
                      <div class="option-content">
                        <span class="model-name">AVOD</span>
                        <span class="model-desc">Free Ad-Supported Content</span>
                      </div>
                    </mat-radio-button>
                  </div>

                  <div class="model-option" [class.selected]="seriesForm.value.monetization === 'SVOD'">
                    <mat-radio-button value="SVOD">
                      <div class="option-content">
                        <span class="model-name">SVOD</span>
                        <span class="model-desc">Subscriber Exclusive Content</span>
                      </div>
                    </mat-radio-button>
                  </div>

                  <div class="model-option" [class.selected]="seriesForm.value.monetization === 'TVOD'">
                    <mat-radio-button value="TVOD">
                      <div class="option-content">
                        <span class="model-name">TVOD / Pass</span>
                        <span class="model-desc">Pay-Per-View Rental</span>
                      </div>
                    </mat-radio-button>
                  </div>
                </mat-radio-group>
              </div>
            </div>

            <!-- STICKY ACTION FOOTER BAR -->
            <div class="submit-footer">
              <div class="footer-info">
                <span class="status-indicator"><span class="dot"></span> Status: {{ seriesForm.value.status }}</span>
                <span *ngIf="seriesForm.invalid" class="validation-warning">
                  <mat-icon>info</mat-icon> Title & Original Language required
                </span>
              </div>
              <div class="footer-actions">
                <button mat-stroked-button color="basic" type="button" (click)="onCancel()">Cancel</button>
                <button mat-raised-button color="warn" class="submit-btn" type="submit" [disabled]="loading">
                  <mat-icon>{{ isEdit ? 'save' : 'cloud_upload' }}</mat-icon> {{ isAlbum ? (isEdit ? 'Update Album' : 'Save & Publish Album') : (isEdit ? 'Update Web Series' : 'Save & Publish Series') }}
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
      max-width: 1040px;
      margin: 0 auto;
      color: #ffffff;
      padding: 16px;
      padding-bottom: 90px;
    }

    /* MAXXPIXELS LOGO BRANDED FORM FIELDS */
    ::ng-deep .custom-field {
      .mat-mdc-text-field-wrapper {
        background-color: #141326 !important;
        border-radius: 10px !important;
      }
      .mdc-notched-outline__leading,
      .mdc-notched-outline__notch,
      .mdc-notched-outline__trailing {
        border-color: #282744 !important;
      }
      &:hover .mdc-notched-outline__leading,
      &:hover .mdc-notched-outline__notch,
      &:hover .mdc-notched-outline__trailing {
        border-color: #00d2ff !important;
      }
      &.mat-focused .mdc-notched-outline__leading,
      &.mat-focused .mdc-notched-outline__notch,
      &.mat-focused .mdc-notched-outline__trailing {
        border-color: #c725a3 !important;
        border-width: 2px !important;
      }
      .mat-mdc-floating-label { color: #a0a0b0 !important; }
      input, textarea, .mat-mdc-select-value { color: #ffffff !important; }
      .mat-mdc-select-arrow { color: #ffab00 !important; }
    }

    /* QUICK STICKY NAV BAR */
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
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;

          .step-num {
            background: #252538;
            color: #ffffff;
            font-size: 10px;
            padding: 1px 5px;
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
        background: rgba(0, 210, 255, 0.15);
        color: #00d2ff;
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

        .btn-add-season { margin-left: auto; height: 36px; border-radius: 6px; font-weight: 700; font-size: 12px; }
        .btn-preview-stream { margin-left: auto; background: #00d2ff; color: #000; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 700; font-size: 12px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
      }
    }

    .full-width { width: 100%; margin-bottom: 16px; display: block; }
    .form-row { display: flex; gap: 16px; margin-bottom: 8px; flex-wrap: wrap; }
    .half-width { flex: 1; min-width: 280px; }

    /* DYNAMIC FIELDS & LABELS */
    .field-with-add { display: flex; flex-direction: column; }
    .field-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .custom-label { font-size: 13px; font-weight: 600; color: #d0d0e0; display: block; margin-bottom: 6px; }

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
      &:hover { background: #ff1e27; }
    }

    /* CAST BLOCK */
    .sub-block {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 16px;

      .sub-block-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .custom-label {
          font-size: 13px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px;
          mat-icon { color: #00d2ff; font-size: 18px; width: 18px; height: 18px; }
        }
        .btn-add-cast { height: 32px; font-size: 11px; }
      }

      .cast-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 10px;

        .cast-card {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #101018;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid #202030;

          .avatar-badge {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #252538;
            display: flex;
            align-items: center;
            justify-content: center;
            mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; }
          }

          .cast-input {
            flex: 1;
            background: #161622;
            border: 1px solid #28283a;
            border-radius: 6px;
            color: #ffffff;
            padding: 0 10px;
            height: 34px;
            font-size: 12px;
            &:focus { outline: none; border-color: #00d2ff; }
          }
        }
      }
    }

    /* SEASONS & EPISODES BUILDER STYLES */
    .seasons-container { display: flex; flex-direction: column; gap: 16px; }

    .season-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 20px;

      .season-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 1px solid #252538;

        .season-title-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;

          .season-badge {
            background: linear-gradient(135deg, #e50914, #b20710);
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
            padding: 4px 10px;
            border-radius: 6px;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(229, 9, 20, 0.4);
          }

          .season-title-input {
            flex: 1;
            background: #101018;
            border: 1px solid #28283a;
            border-radius: 6px;
            color: #ffffff;
            padding: 0 12px;
            height: 40px;
            font-size: 14px;
            font-weight: 700;
            &:focus { outline: none; border-color: #e50914; }
          }
        }
      }

      .episodes-list {
        display: flex;
        flex-direction: column;
        gap: 14px;

        .episode-item {
          background: #101018;
          border: 1px solid #202030;
          border-radius: 10px;
          padding: 16px;

          .episode-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;

            .ep-left {
              display: flex;
              align-items: center;
              gap: 10px;
              flex: 1;

              .ep-num {
                background: #00d2ff;
                color: #000000;
                font-size: 11px;
                font-weight: 800;
                padding: 3px 8px;
                border-radius: 6px;
              }

              .ep-title-input {
                flex: 1;
                background: #161622;
                border: 1px solid #28283a;
                border-radius: 6px;
                color: #ffffff;
                padding: 0 12px;
                height: 36px;
                font-size: 13px;
                font-weight: 600;
                &:focus { outline: none; border-color: #00d2ff; }
              }

              .ep-duration-input {
                width: 110px;
                background: #161622;
                border: 1px solid #28283a;
                border-radius: 6px;
                color: #00e5ff;
                padding: 0 10px;
                height: 36px;
                font-size: 12px;
                text-align: center;
                font-weight: 700;
              }
            }

            .ep-right {
              display: flex;
              align-items: center;
              gap: 6px;
              margin-left: 12px;
              .btn-inspect-ep { height: 34px; font-size: 11px; font-weight: 700; border-radius: 6px; }
            }
          }

          .episode-media-grid {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 10px;
            .media-col { flex: 1; }
            .upload-col { width: 240px; }
            .no-margin { margin-bottom: 0 !important; }
          }

          .timestamps-row {
            display: flex;
            gap: 12px;
            .time-field { flex: 1; }
          }
        }

        .btn-add-ep { height: 40px; border-radius: 8px; font-size: 13px; font-weight: 700; }
      }
    }

    /* INSPECTOR PLAYER BOX */
    .video-inspector-box {
      background: #000000;
      border: 1px solid #00d2ff;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;

      .inspector-header {
        background: #161622;
        padding: 10px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        font-weight: 700;
        color: #00d2ff;
        border-bottom: 1px solid #28283a;
        span { display: flex; align-items: center; gap: 6px; }
        .stream-url-tag { font-family: monospace; color: #a0a0b0; font-size: 11px; }
      }

      .inspector-player-wrapper {
        min-height: 260px;
        display: flex;
        align-items: center;
        justify-content: center;
        .preview-video-element { width: 100%; max-height: 380px; object-fit: contain; }
        .no-stream-placeholder { text-align: center; color: #a0a0b0; padding: 40px; mat-icon { font-size: 36px; width: 36px; height: 36px; color: #ffab00; } }
      }
    }

    /* ARTWORK */
    .artwork-row { margin-bottom: 16px; }
    .artwork-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 10px;
      padding: 16px;

      .custom-label { font-size: 12px; font-weight: 700; color: #ffffff; display: block; margin-bottom: 8px; }

      .image-preview {
        margin-top: 10px;
        border-radius: 8px;
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
      border-radius: 12px;
      padding: 18px;

      .monetization-title {
        font-size: 14px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 14px;
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
      padding: 14px 36px;
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
          gap: 8px;

          .dot {
            width: 8px;
            height: 8px;
            background: #00e676;
            border-radius: 50%;
            box-shadow: 0 0 10px #00e676;
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
        gap: 14px;
        button { height: 46px; padding: 0 26px; border-radius: 8px; font-weight: 700; }
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
  `]
})
export class SeriesFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly seriesApiService = inject(SeriesApiService);
  private readonly catalogApiService = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly http = inject(HttpClient);

  isEdit = false;
  seriesId: string | number | null = null;
  loading = false;
  activeStep = 1;
  showPreviewPlayer = false;
  activeInspectorUrl = '';

  get isAlbum(): boolean {
    return this.seriesForm?.get('contentType')?.value === 'ALBUM';
  }

  // Dynamic Options Lists strictly loaded from Catalog DB with '+ Add New' capabilities
  mainTypesList: { label: string; value: string }[] = [];

  categoriesList: string[] = [];
  genresList: string[] = [];
  languagesList: string[] = [];

  get activeCategoriesList(): string[] {
    return this.categoriesList;
  }

  get activeGenresList(): string[] {
    return this.genresList;
  }

  localPosterPreview = '';
  localBannerPreview = '';

  seriesForm = this.fb.group({
    title: ['', [Validators.required]],
    contentType: ['', [Validators.required]],
    category: this.fb.control<string[]>([], [Validators.required]),
    genres: this.fb.control<string[]>([]),
    youtubeOption: [''],
    originalLanguage: ['', [Validators.required]],
    maturityRating: ['UA_13+'],
    status: ['PUBLISHED'],
    description: ['Synopsis here...'],
    posterUrl: [''],
    bannerUrl: [''],
    monetization: ['SVOD', [Validators.required]],
    drmType: ['WIDEVINE_L1'],
    geoRestriction: ['GLOBAL'],
    cast: this.fb.array([
      this.createCastFormGroup('Nandamuri Balakrishna', 'Host / Main Lead'),
      this.createCastFormGroup('Allu Arjun', 'Special Guest')
    ]),
    seasons: this.fb.array([
      this.createSeasonFormGroup(1, 'Season 1')
    ])
  });

  get cast(): FormArray {
    return this.seriesForm.get('cast') as FormArray;
  }

  get seasons(): FormArray {
    return this.seriesForm.get('seasons') as FormArray;
  }

  getEpisodes(seasonIndex: number): FormArray {
    return this.seasons.at(seasonIndex).get('episodes') as FormArray;
  }

  createCastFormGroup(name = '', role = ''): FormGroup {
    return this.fb.group({
      name: [name, [Validators.required]],
      role: [role]
    });
  }

  addCastMember(): void {
    this.cast.push(this.createCastFormGroup('', ''));
  }

  removeCastMember(index: number): void {
    this.cast.removeAt(index);
  }

  createSeasonFormGroup(seasonNumber = 1, seasonTitle = 'Season 1'): FormGroup {
    const defaultTitle = this.isAlbum ? `Disc ${seasonNumber}` : seasonTitle;
    return this.fb.group({
      seasonNumber: [seasonNumber],
      title: [defaultTitle, [Validators.required]],
      description: [''],
      posterUrl: [''],
      episodes: this.fb.array([
        this.createEpisodeFormGroup(1, this.isAlbum ? 'Track 1: Song' : 'Episode 1: Pilot'),
        this.createEpisodeFormGroup(2, this.isAlbum ? 'Track 2: Reprise' : 'Episode 2: The Rising')
      ])
    });
  }

  createEpisodeFormGroup(episodeNumber = 1, episodeTitle = 'Episode 1'): FormGroup {
    return this.fb.group({
      episodeNumber: [episodeNumber],
      title: [episodeTitle, [Validators.required]],
      durationTime: [this.isAlbum ? '4m 30s' : '45m'],
      videoAssetId: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'],
      stillImageUrl: [''],
      skipIntroStart: ['00:01:15'],
      skipIntroEnd: ['00:02:40'],
      skipOutroStart: ['00:43:10'],
      isPremium: [true]
    });
  }

  addSeason(): void {
    const newNumber = this.seasons.length + 1;
    const newTitle = this.isAlbum ? `Disc ${newNumber}` : `Season ${newNumber}`;
    this.seasons.push(this.createSeasonFormGroup(newNumber, newTitle));
    this.notificationService.success(`Added ${this.isAlbum ? 'Disc' : 'Season'} ${newNumber}`);
  }

  removeSeason(index: number): void {
    if (this.seasons.length > 1) {
      this.seasons.removeAt(index);
    }
  }

  addEpisode(seasonIndex: number): void {
    const epArray = this.getEpisodes(seasonIndex);
    const newEpNum = epArray.length + 1;
    const newEpTitle = this.isAlbum ? `Track ${newEpNum}: Song` : `Episode ${newEpNum}`;
    epArray.push(this.createEpisodeFormGroup(newEpNum, newEpTitle));
    this.notificationService.success(`Added ${this.isAlbum ? 'Track' : 'Episode'} ${newEpNum} to ${this.isAlbum ? 'Disc' : 'Season'} ${seasonIndex + 1}`);
  }

  removeEpisode(seasonIndex: number, episodeIndex: number): void {
    const epArray = this.getEpisodes(seasonIndex);
    if (epArray.length > 1) {
      epArray.removeAt(episodeIndex);
    }
  }

  isEmbedUrl(): boolean {
    if (!this.activeInspectorUrl) return false;
    const clean = this.activeInspectorUrl.toLowerCase();
    return clean.includes('youtube.com') || clean.includes('youtu.be') || clean.includes('vimeo.com') || clean.includes('embed');
  }

  getSafeEmbedUrl(): SafeResourceUrl {
    if (!this.activeInspectorUrl) return this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
    let embedUrl = this.activeInspectorUrl.trim();
    if (embedUrl.includes('youtube.com/watch?v=')) {
      const parts = embedUrl.split('watch?v=');
      const videoId = parts[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (embedUrl.includes('youtu.be/')) {
      const parts = embedUrl.split('youtu.be/');
      const videoId = parts[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (embedUrl.includes('vimeo.com/') && !embedUrl.includes('player.vimeo.com')) {
      const parts = embedUrl.split('vimeo.com/');
      const videoId = parts[1]?.split('?')[0];
      embedUrl = `https://player.vimeo.com/video/${videoId}`;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }

  inspectEpisodeStream(url: string): void {
    this.activeInspectorUrl = url || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    this.showPreviewPlayer = true;
    this.scrollToSection('sec-3', 3);
  }

  scrollToSection(id: string, stepNum: number): void {
    this.activeStep = stepNum;
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async onAddNewMainType(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Main Type', 'Main Type Name', 'e.g. Web Series, Album, Microdrama');
    if (clean && clean.trim()) {
      const trimmed = clean.trim();
      const codeValue = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      const slugValue = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const exists = this.mainTypesList.some(t => t.value === codeValue || t.label.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        this.mainTypesList.push({ label: trimmed, value: codeValue });
      }
      this.seriesForm.patchValue({ contentType: codeValue });
      this.notificationService.success(`Added new main type '${trimmed}'`);
    }
  }

  async onAddNewCategory(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Category', 'Category / Sub Type Name', 'e.g. Folk Song, Devotional');
    if (clean) {
      this.catalogApiService.createCategory(clean).subscribe({
        next: (res) => {
          const catName = res.data?.name || clean;
          if (!this.categoriesList.includes(catName)) {
            this.categoriesList.push(catName);
          }
          const currentVal = this.seriesForm.value.category || [];
          this.seriesForm.patchValue({ category: [...currentVal, catName] });
          this.notificationService.success(`Added new category '${catName}'`);
        },
        error: () => {
          if (!this.categoriesList.includes(clean)) {
            this.categoriesList.push(clean);
          }
          const currentVal = this.seriesForm.value.category || [];
          this.seriesForm.patchValue({ category: [...currentVal, clean] });
          this.notificationService.success(`Added category '${clean}' locally`);
        }
      });
    }
  }

  async onAddNewGenre(): Promise<void> {
    const clean = await this.notificationService.prompt('Add New Genre / Sub-Type', 'Genre Name', 'e.g. Folk Song, Classical');
    if (clean) {
      this.catalogApiService.createGenre(clean).subscribe({
        next: (res) => {
          const genreName = res.data?.name || clean;
          if (!this.genresList.includes(genreName)) {
            this.genresList.push(genreName);
          }
          const currentVal = this.seriesForm.value.genres || [];
          this.seriesForm.patchValue({ genres: [...currentVal, genreName] });
          this.notificationService.success(`Added new genre '${genreName}'`);
        },
        error: () => {
          if (!this.genresList.includes(clean)) {
            this.genresList.push(clean);
          }
          const currentVal = this.seriesForm.value.genres || [];
          this.seriesForm.patchValue({ genres: [...currentVal, clean] });
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
        this.seriesForm.patchValue({ originalLanguage: clean });
        this.notificationService.success(`Added new language '${clean}'`);
      }
    }
  }

  loadCatalogMetadata(): void {
    // 1. Content Types (Main Types) from Catalog Metadata
    this.http.get<any>(`${environment.apiBaseUrl}/content-types`).subscribe({
      next: (res: any) => {
        const types = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(types) && types.length > 0) {
          this.mainTypesList = types.map((t: any) => {
            const rawSlug = t.slug || t.title || '';
            const codeVal = rawSlug.toUpperCase().replace(/[^A-Z0-9]/g, '_');
            const title = t.title || t.name || rawSlug;
            return { label: title, value: codeVal };
          });
          const curr = this.seriesForm.get('contentType')?.value;
          const match = this.mainTypesList.find(t => t.value === curr) || this.mainTypesList.find(t => t.value === 'SERIES') || this.mainTypesList[0];
          if (match && (!curr || !this.mainTypesList.some(t => t.value === curr))) {
            this.seriesForm.patchValue({ contentType: match.value });
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
          this.languagesList = langs.map((l: any) => l.name || l.code).filter(Boolean);
          const curr = this.seriesForm.get('originalLanguage')?.value;
          if (!curr && this.languagesList.length > 0) {
            this.seriesForm.patchValue({ originalLanguage: this.languagesList[0] });
          }
        }
      },
      error: () => {}
    });

    // 3. Genres & Categories from Catalog Metadata
    this.http.get<any>(`${environment.apiBaseUrl}/genres`).subscribe({
      next: (res: any) => {
        const list = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(list) && list.length > 0) {
          const names = list.map((g: any) => g.name).filter(Boolean);
          this.genresList = [...names];
          this.categoriesList = [...names];
        }
      },
      error: () => {}
    });
  }

  triggerAiAutoFill(): void {
    const title = this.seriesForm.value.title?.trim();
    if (!title) {
      this.notificationService.warning(`Please enter a ${this.isAlbum ? 'Album Title' : 'Series Title'} first before generating AI metadata.`);
      return;
    }

    const currentLang = this.seriesForm.value.originalLanguage || (this.languagesList[0] || '');

    if (this.isAlbum) {
      this.seriesForm.patchValue({
        title: title,
        description: `An evocative audio-visual music album titled "${title}". Features stellar vocal performances, rich instrumental orchestration, and unforgettable melodic compositions.`,
        category: ['Love Song', 'Emotional Songs'],
        genres: ['Love Song', 'Devotional Song'],
        originalLanguage: currentLang,
        maturityRating: 'U',
        drmType: 'NONE',
        geoRestriction: 'GLOBAL'
      });
      this.notificationService.success('✨ AI metadata and album description auto-filled!');
    } else {
      this.seriesForm.patchValue({
        title: title,
        description: `A gripping, high-stakes drama series centered around ${title}. Features captivating multi-episode storylines, exceptional production value, and rich character arcs.`,
        category: ['Emotional', 'Thriller'],
        genres: ['Emotional', 'Thriller'],
        originalLanguage: currentLang,
        maturityRating: 'UA_13+',
        drmType: 'MULTI_DRM',
        geoRestriction: 'GLOBAL'
      });
      this.notificationService.success('✨ AI metadata, DRM security, and series synopsis auto-filled!');
    }
  }

  ngOnInit(): void {
    this.loadCatalogMetadata();

    const typeParam = this.route.snapshot.queryParamMap.get('type');
    if (typeParam === 'ALBUM') {
      this.seriesForm.patchValue({
        contentType: 'ALBUM',
        title: 'New Music / Video Album',
        description: 'An evocative audio-visual music album featuring memorable melodies and heartfelt lyrics.',
        category: ['Love Song', 'Emotional Songs'],
        genres: ['Love Song', 'Emotional Songs']
      });
      if (this.seasons.length > 0) {
        this.seasons.at(0).patchValue({ title: 'Disc 1' });
        const eps = this.getEpisodes(0);
        if (eps.length > 0) {
          eps.at(0).patchValue({ title: 'Track 1: Song', durationTime: '4m 30s' });
        }
      }
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEdit = true;
      this.seriesId = idParam;
      this.loadSeries(this.seriesId);
    }
  }

  loadSeries(id: string | number): void {
    this.loading = true;
    this.seriesApiService.getSeriesById(id).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success && res.data) {
          const sData = res.data;
          this.seriesForm.patchValue({
            title: sData.title,
            contentType: sData.contentType || 'SERIES',
            originalLanguage: sData.originalLanguage || (this.languagesList[0] || ''),
            maturityRating: sData.maturityRating || 'UA_13+',
            status: sData.status || 'PUBLISHED',
            description: sData.description || '',
            posterUrl: sData.posterUrl || '',
            bannerUrl: sData.bannerUrl || ''
          });

          if (sData.category && sData.category.length > 0) {
            this.seriesForm.patchValue({ category: sData.category });
          }
          if (sData.genres && sData.genres.length > 0) {
            this.seriesForm.patchValue({ genres: sData.genres });
          }

          if (sData.seasons && sData.seasons.length > 0) {
            this.seasons.clear();
            sData.seasons.forEach((s: any, sIdx: number) => {
              const sGroup = this.fb.group({
                seasonNumber: [s.seasonNumber || (sIdx + 1)],
                title: [s.title || (this.isAlbum ? `Disc ${sIdx + 1}` : `Season ${sIdx + 1}`), [Validators.required]],
                description: [s.description || ''],
                posterUrl: [s.posterUrl || ''],
                episodes: this.fb.array([])
              });

              const epArray = sGroup.get('episodes') as FormArray;
              if (s.episodes && s.episodes.length > 0) {
                s.episodes.forEach((e: any, eIdx: number) => {
                  epArray.push(this.fb.group({
                    episodeNumber: [e.episodeNumber || (eIdx + 1)],
                    title: [e.title || (this.isAlbum ? `Track ${eIdx + 1}` : `Episode ${eIdx + 1}`), [Validators.required]],
                    durationTime: [this.isAlbum ? '4m 30s' : '45m'],
                    videoAssetId: [e.videoAssetId || ''],
                    stillImageUrl: [e.stillImageUrl || ''],
                    skipIntroStart: ['00:01:15'],
                    skipIntroEnd: ['00:02:40'],
                    skipOutroStart: ['00:43:10'],
                    isPremium: [e.isPremium ?? true]
                  }));
                });
              } else {
                epArray.push(this.createEpisodeFormGroup(1, this.isAlbum ? 'Track 1: Song' : 'Episode 1: Pilot'));
              }

              this.seasons.push(sGroup);
            });
          }
          this.localPosterPreview = sData.posterUrl || '';
          this.localBannerPreview = sData.bannerUrl || '';
        }
      },
      error: () => { this.loading = false; }
    });
  }

  onEpisodeVideoUploaded(seasonIndex: number, episodeIndex: number, url: string): void {
    const epGroup = this.getEpisodes(seasonIndex).at(episodeIndex);
    if (epGroup) {
      epGroup.patchValue({ videoAssetId: url });
      this.activeInspectorUrl = url;
    }
  }

  onPosterUploaded(url: string): void {
    this.seriesForm.patchValue({ posterUrl: url });
    this.localPosterPreview = url;
  }

  onBannerUploaded(url: string): void {
    this.seriesForm.patchValue({ bannerUrl: url });
    this.localBannerPreview = url;
  }

  onPosterImgError(event: any): void {
    if (event?.target && !event.target.dataset.errored) {
      event.target.dataset.errored = 'true';
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2310101c"/><stop offset="100%" stop-color="%231e1e32"/></linearGradient></defs><rect width="300" height="400" rx="8" fill="url(%23bg)"/><circle cx="150" cy="150" r="40" fill="%2300d2ff" fill-opacity="0.15"/><path d="M125 175l18-22 14 17 20-25 23 30H100z" fill="%2300d2ff"/><circle cx="132" cy="130" r="8" fill="%23ffb800"/><text x="150" y="225" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Series Poster Preview</text><text x="150" y="248" dominant-baseline="middle" text-anchor="middle" fill="%2300d2ff" font-family="system-ui, sans-serif" font-size="11">Poster Artwork (3:4)</text></svg>';
    }
  }

  onBannerImgError(event: any): void {
    if (event?.target && !event.target.dataset.errored) {
      event.target.dataset.errored = 'true';
      event.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270"><defs><linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="%2310101c"/><stop offset="100%" stop-color="%231e1e32"/></linearGradient></defs><rect width="480" height="270" rx="8" fill="url(%23bg2)"/><circle cx="240" cy="105" r="35" fill="%2300d2ff" fill-opacity="0.15"/><path d="M210 130l18-22 14 17 22-28 26 33H190z" fill="%2300d2ff"/><circle cx="220" cy="90" r="8" fill="%23ffb800"/><text x="240" y="170" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-family="system-ui, sans-serif" font-size="14" font-weight="600">Series Hero Banner</text><text x="240" y="192" dominant-baseline="middle" text-anchor="middle" fill="%2300d2ff" font-family="system-ui, sans-serif" font-size="11">Landscape Banner (16:9)</text></svg>';
    }
  }

  onCancel(): void {
    this.router.navigate(['/admin/series']);
  }

  onSubmit(): void {
    if (this.seriesForm.invalid) {
      this.seriesForm.markAllAsTouched();
      this.notificationService.warning('Please enter the required fields: Title and Original Language.');
      return;
    }

    this.loading = true;
    const formVal = this.seriesForm.value;

    const seasonsData: Season[] = this.seasons.controls.map((sGroup, sIdx) => {
      const epArray: Episode[] = (sGroup.get('episodes') as FormArray).controls.map((epGroup, eIdx) => ({
        episodeNumber: eIdx + 1,
        title: epGroup.value.title || (this.isAlbum ? `Track ${eIdx + 1}` : `Episode ${eIdx + 1}`),
        durationSeconds: this.isAlbum ? 270 : 2700,
        videoAssetId: epGroup.value.videoAssetId || '',
        stillImageUrl: epGroup.value.stillImageUrl || '',
        isPremium: epGroup.value.isPremium ?? true
      }));

      return {
        seasonNumber: sIdx + 1,
        title: sGroup.value.title || (this.isAlbum ? `Disc ${sIdx + 1}` : `Season ${sIdx + 1}`),
        description: sGroup.value.description || '',
        posterUrl: sGroup.value.posterUrl || '',
        episodes: epArray
      };
    });

    const dto: Series = {
      title: formVal.title || '',
      contentType: formVal.contentType || 'SERIES',
      category: formVal.category || [],
      genres: formVal.genres || [],
      originalLanguage: formVal.originalLanguage || (this.languagesList[0] || ''),
      maturityRating: formVal.maturityRating || 'UA_13+',
      status: formVal.status || 'PUBLISHED',
      description: formVal.description || '',
      posterUrl: formVal.posterUrl || '',
      bannerUrl: formVal.bannerUrl || '',
      totalSeasons: this.seasons.length,
      totalEpisodes: seasonsData.reduce((acc, s) => acc + (s.episodes ? s.episodes.length : 0), 0),
      seasons: seasonsData
    };

    if (this.isEdit && this.seriesId) {
      this.seriesApiService.updateSeries(this.seriesId, dto).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            this.notificationService.success(this.isAlbum ? 'Album updated successfully!' : 'Web series updated successfully!');
            this.router.navigate(['/admin/series']);
          }
        },
        error: (err: any) => {
          this.loading = false;
          const msg = err?.error?.message || 'Failed to update series.';
          this.notificationService.error(msg);
        }
      });
    } else {
      this.seriesApiService.createSeries(dto).subscribe({
        next: (res: any) => {
          this.loading = false;
          if (res.success) {
            this.notificationService.success(this.isAlbum ? 'New album created and published successfully!' : 'New web series created and published successfully!');
            this.router.navigate(['/admin/series']);
          }
        },
        error: (err: any) => {
          this.loading = false;
          const msg = err?.error?.message || 'Failed to create series.';
          this.notificationService.error(msg);
        }
      });
    }
  }
}
