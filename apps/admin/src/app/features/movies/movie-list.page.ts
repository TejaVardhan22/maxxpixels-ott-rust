import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { MovieApiService, Movie } from '../../core/services/movie-api.service';
import { RuntimeConfigService } from '../../core/services/runtime-config.service';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationService } from '../../shared/services/notification.service';
import {
  formatLanguage,
  formatMaturityRating,
  getMaturityRatingBadgeClass,
  formatDuration,
  generatePosterPlaceholder
} from '../../shared/utils/formatters';

@Component({
  selector: 'app-movie-list-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressBarModule,
    MatDialogModule,
    PermissionButtonComponent,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- Top Title & Action Header -->
      <div class="header-row">
        <div>
          <h1 class="page-title">Content &amp; Catalog Management</h1>
          <p class="page-subtitle">Manage OTT Movies, Music Albums, Microdramas, Podcasts, Short Films, and Series</p>
        </div>
        <div class="header-actions">
          <app-permission-button permission="CONTENT_CREATE" color="primary" icon="add" (buttonClick)="onAddMovie()">
            Add New Content
          </app-permission-button>
        </div>
      </div>

      <!-- Content Type Filter Tabs -->
      <div class="filter-tabs-row">
        <button
          *ngFor="let tab of contentTabs"
          type="button"
          class="filter-tab-btn"
          [class.active]="selectedType === tab.value"
          (click)="onSelectType(tab.value)">
          <mat-icon>{{ tab.icon }}</mat-icon>
          <span>{{ tab.label }}</span>
        </button>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="metrics-grid">
        <mat-card class="metric-card" [class.active-filter]="selectedStatus === 'ALL'" (click)="onSelectStatus('ALL')" matTooltip="Click to view all content">
          <mat-card-content>
            <div class="metric-icon primary"><mat-icon>video_library</mat-icon></div>
            <div class="metric-details">
              <span class="label">Total Titles</span>
              <h2>{{ totalElements }}</h2>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card success" [class.active-filter]="selectedStatus === 'PUBLISHED'" (click)="onSelectStatus('PUBLISHED')" matTooltip="Click to view published live content">
          <mat-card-content>
            <div class="metric-icon success"><mat-icon>check_circle</mat-icon></div>
            <div class="metric-details">
              <span class="label">Published (Live)</span>
              <h2>{{ publishedCount }}</h2>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card warning" [class.active-filter]="selectedStatus === 'DRAFT'" (click)="onSelectStatus('DRAFT')" matTooltip="Click to view draft content">
          <mat-card-content>
            <div class="metric-icon warning"><mat-icon>edit_note</mat-icon></div>
            <div class="metric-details">
              <span class="label">Drafts (Hidden)</span>
              <h2>{{ draftCount }}</h2>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Main Movies Table Container -->
      <div class="table-card">
        <div class="search-bar">
          <mat-form-field appearance="outline" class="search-input">
            <mat-label>Search Titles</mat-label>
            <input matInput (keyup)="onSearch($event)" placeholder="Search by title, genre, or language...">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <div class="status-tab-filter">
            <button type="button" class="status-tab-pill" [class.active]="selectedStatus === 'ALL'" (click)="onSelectStatus('ALL')">
              All
            </button>
            <button type="button" class="status-tab-pill published" [class.active]="selectedStatus === 'PUBLISHED'" (click)="onSelectStatus('PUBLISHED')">
              <mat-icon>check_circle</mat-icon> Published Live
            </button>
            <button type="button" class="status-tab-pill scheduled" [class.active]="selectedStatus === 'SCHEDULED'" (click)="onSelectStatus('SCHEDULED')">
              <mat-icon>schedule</mat-icon> Scheduled
            </button>
            <button type="button" class="status-tab-pill draft" [class.active]="selectedStatus === 'DRAFT'" (click)="onSelectStatus('DRAFT')">
              <mat-icon>drafts</mat-icon> Drafts
            </button>
          </div>
        </div>

        <mat-progress-bar mode="indeterminate" *ngIf="loading"></mat-progress-bar>

        <div class="table-responsive">
          <table mat-table [dataSource]="movies" class="custom-table">

            <!-- Poster & Title Column -->
            <ng-container matColumnDef="movie">
              <th mat-header-cell *matHeaderCellDef>Title &amp; Metadata</th>
              <td mat-cell *matCellDef="let movie">
                <div class="movie-cell">
                  <div class="poster-wrapper">
                    <img
                      [src]="movie.posterUrl || getPosterPlaceholder(movie)"
                      class="poster-thumb"
                      [alt]="movie.title"
                      loading="lazy"
                      (error)="onImgError($event, movie)">
                  </div>
                  <div class="movie-info">
                    <span class="movie-title" [title]="movie.title">{{ movie.title }}</span>
                    <div class="movie-meta-row">
                      <span
                        class="id-badge"
                        [matTooltip]="'Click to copy full ID: #' + movie.id"
                        (click)="copyToClipboard(movie.id ? String(movie.id) : '', 'Content ID')">
                        <mat-icon class="id-icon">tag</mat-icon>
                        {{ getShortId(movie.id) }}
                        <mat-icon class="copy-icon">content_copy</mat-icon>
                      </span>
                      <span class="meta-divider">•</span>
                      <span class="language-pill" [matTooltip]="'Original Audio: ' + formatLanguage(movie.originalLanguage)">
                        <mat-icon class="lang-icon">translate</mat-icon>
                        {{ formatLanguage(movie.originalLanguage) }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Content Type Column -->
            <ng-container matColumnDef="contentType">
              <th mat-header-cell *matHeaderCellDef>Category / Type</th>
              <td mat-cell *matCellDef="let movie">
                <span class="type-badge" [ngClass]="getTypeBadgeClass(movie.contentType)">
                  <mat-icon class="type-icon">{{ getTypeIcon(movie.contentType) }}</mat-icon>
                  {{ getFormattedType(movie.contentType) }}
                </span>
              </td>
            </ng-container>

            <!-- Genres Column -->
            <ng-container matColumnDef="genres">
              <th mat-header-cell *matHeaderCellDef>Genres &amp; Tags</th>
              <td mat-cell *matCellDef="let movie">
                <div class="genre-tags" *ngIf="movie.genres && movie.genres.length > 0; else noGenres">
                  <span class="genre-chip" *ngFor="let g of movie.genres">{{ g }}</span>
                </div>
                <ng-template #noGenres>
                  <span class="text-muted">-</span>
                </ng-template>
              </td>
            </ng-container>

            <!-- Maturity Rating Column -->
            <ng-container matColumnDef="maturityRating">
              <th mat-header-cell *matHeaderCellDef>Rating</th>
              <td mat-cell *matCellDef="let movie">
                <span class="rating-badge" [ngClass]="getMaturityRatingBadgeClass(movie.maturityRating)">
                  {{ formatMaturityRating(movie.maturityRating) }}
                </span>
              </td>
            </ng-container>

            <!-- Duration Column -->
            <ng-container matColumnDef="durationMinutes">
              <th mat-header-cell *matHeaderCellDef>Duration</th>
              <td mat-cell *matCellDef="let movie">
                <div class="duration-cell">
                  <mat-icon class="duration-icon">schedule</mat-icon>
                  <span>{{ formatDuration(movie.durationMinutes, movie.durationTime) }}</span>
                </div>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let movie">
                <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                  <app-status-badge [status]="movie.status"></app-status-badge>
                  <span *ngIf="movie.status === 'SCHEDULED' && movie.scheduledPublishAt" style="font-size:11px;color:#38bdf8;white-space:nowrap;">
                    {{ movie.scheduledPublishAt | date:'MMM d, y, h:mm a' }}
                  </span>
                </div>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="text-right">Actions</th>
              <td mat-cell *matCellDef="let movie" class="text-right">
                <div class="action-buttons">
                  <button
                    mat-icon-button
                    class="btn-action"
                    [ngClass]="movie.status === 'PUBLISHED' ? 'btn-unpublish' : 'btn-publish'"
                    [matTooltip]="movie.status === 'PUBLISHED' ? 'Unpublish to Draft (Hides from Web & Mobile)' : 'Publish Live (Visible on Web & Mobile)'"
                    (click)="onTogglePublish(movie)">
                    <mat-icon>{{ movie.status === 'PUBLISHED' ? 'unpublished' : 'publish' }}</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    class="btn-action btn-preview"
                    matTooltip="Preview Video Stream"
                    (click)="onPreviewVideo(movie)">
                    <mat-icon>play_circle</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    class="btn-action btn-edit"
                    matTooltip="Edit Content"
                    (click)="onEditMovie(movie.id!)">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    class="btn-action btn-delete"
                    matTooltip="Delete Content"
                    (click)="onDeleteMovie(movie)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <!-- Empty State -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell empty-cell" [attr.colspan]="displayedColumns.length">
                <div class="empty-state">
                  <mat-icon class="empty-icon">video_library</mat-icon>
                  <h3>No Content Found</h3>
                  <p>Try adjusting your search query or selected type filter.</p>
                </div>
              </td>
            </tr>
          </table>
        </div>

        <mat-paginator
          [length]="totalElements"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
          class="custom-paginator">
        </mat-paginator>
      </div>

      <!-- VIDEO STREAM PLAYBACK MODAL -->
      <div class="video-modal-backdrop" *ngIf="previewModalOpen" (click)="closeVideoPreview()">
        <div class="video-modal-dialog" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-left">
              <div class="header-top-tag">
                <span class="preview-badge"><mat-icon>play_circle</mat-icon> Stream Playback Inspector</span>
                <span class="type-badge" [ngClass]="getTypeBadgeClass(previewMovie?.contentType)">{{ getFormattedType(previewMovie?.contentType) }}</span>
              </div>
              <h3>{{ previewMovie?.title }}</h3>
              <span class="stream-url-tag font-mono">{{ previewUrl }}</span>
            </div>
            <button mat-icon-button class="btn-close" (click)="closeVideoPreview()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Mode switcher for Bunny / direct -->
          <div class="preview-mode-bar" *ngIf="previewModalEmbedUrl">
            <button
              type="button"
              class="mode-btn"
              [class.active]="previewPlayerMode === 'EMBED'"
              (click)="previewPlayerMode = 'EMBED'">
              <mat-icon>tv</mat-icon> Bunny Stream Edge Player
            </button>
            <button
              type="button"
              class="mode-btn"
              [class.active]="previewPlayerMode === 'DIRECT'"
              (click)="previewPlayerMode = 'DIRECT'">
              <mat-icon>movie</mat-icon> Direct Video File (MP4/HLS)
            </button>
          </div>

          <div class="modal-body">
            <div class="player-wrapper">
              <iframe
                *ngIf="previewPlayerMode === 'EMBED' && previewModalEmbedUrl"
                [src]="previewModalEmbedUrl"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                class="modal-video-frame">
              </iframe>
              <iframe
                *ngIf="previewPlayerMode !== 'EMBED' && isEmbedUrl(previewUrl)"
                [src]="getSafeEmbedUrl(previewUrl)"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                class="modal-video-frame">
              </iframe>
              <video
                *ngIf="previewPlayerMode !== 'EMBED' && !isEmbedUrl(previewUrl)"
                [src]="previewUrl"
                controls
                autoplay
                playsinline
                (error)="onPreviewVideoError()"
                class="modal-video-frame">
              </video>
            </div>
          </div>
          <div class="modal-footer">
            <button mat-stroked-button color="basic" (click)="copyStreamUrl(previewUrl)">
              <mat-icon>content_copy</mat-icon> Copy Stream URL
            </button>
            <button mat-flat-button color="primary" *ngIf="previewMovie?.id" (click)="goToWatchPlayer()">
              <mat-icon>tv</mat-icon> Watch in OTT Player
            </button>
            <button mat-flat-button color="warn" (click)="closeVideoPreview()">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 24px; }
    .filter-tabs-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 20px;
    }
    .filter-tab-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #14141e;
      border: 1px solid #2a2a38;
      border-radius: 9999px;
      color: #94a3b8;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      &:hover {
        background: #1f2030;
        color: #ffffff;
      }
      &.active {
        background: #e50914;
        border-color: #e50914;
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(229, 9, 20, 0.4);
      }
    }

    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      .type-icon { font-size: 14px; width: 14px; height: 14px; }
      &.type-movie { background: rgba(229, 9, 20, 0.15); color: #ff5a60; border: 1px solid rgba(229, 9, 20, 0.3); }
      &.type-album { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
      &.type-microdrama { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
      &.type-podcast { background: rgba(14, 165, 233, 0.15); color: #38bdf8; border: 1px solid rgba(14, 165, 233, 0.3); }
      &.type-short { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
      &.type-series { background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); }
      &.type-ai { background: rgba(99, 102, 241, 0.2); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.4); }
      &.type-other { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3); }
    }

    .genre-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      max-width: 240px;
    }
    .genre-chip {
      background: #1c1d2b;
      color: #94a3b8;
      border: 1px solid #2e3046;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 500;
    }
    .text-muted { color: #64748b; font-size: 12px; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .page-title { font-size: 24px; font-weight: 700; margin: 0 0 4px; color: #ffffff; }
    .page-subtitle { color: #a0a0b0; margin: 0; font-size: 14px; }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: #1a1a24 !important;
      color: #ffffff;
      border-radius: 12px;
      border: 1px solid #2a2a38;
      cursor: pointer;
      transition: all 0.2s ease;
      &:hover {
        transform: translateY(-2px);
        border-color: #3b82f6;
      }
      &.active-filter {
        border-color: #00d2ff !important;
        box-shadow: 0 0 16px rgba(0, 210, 255, 0.35);
      }
      mat-card-content {
        display: flex;
        align-items: center;
        padding: 16px;
      }
      .metric-icon {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 16px;
        &.primary { background: rgba(52, 152, 219, 0.15); color: #3498db; }
        &.success { background: rgba(46, 204, 113, 0.15); color: #2ecc71; }
        &.warning { background: rgba(241, 196, 15, 0.15); color: #f1c40f; }
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }
      .label { color: #a0a0b0; font-size: 13px; font-weight: 500; }
      h2 { font-size: 24px; font-weight: 700; margin: 4px 0 0; }
    }

    .table-card {
      background: #1a1a24;
      border-radius: 12px;
      border: 1px solid #2a2a38;
      overflow: hidden;
      width: 100%;
    }
    .table-responsive {
      width: 100%;
      max-width: 100%;
      overflow-x: auto !important;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
      display: block;
    }
    .search-bar {
      padding: 16px 20px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .search-input { width: 100%; max-width: 380px; }

    .status-tab-filter {
      display: flex;
      gap: 8px;
      align-items: center;

      .status-tab-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 20px;
        background: #12121c;
        border: 1px solid #28283a;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        mat-icon { font-size: 15px; width: 15px; height: 15px; }

        &:hover {
          background: #1c1c2a;
          color: #ffffff;
        }

        &.active {
          background: #252538;
          border-color: #00d2ff;
          color: #00d2ff;
          font-weight: 700;
        }

        &.published.active {
          background: rgba(0, 230, 118, 0.15);
          border-color: #00e676;
          color: #00e676;
        }

        &.draft.active {
          background: rgba(245, 158, 11, 0.15);
          border-color: #f59e0b;
          color: #fbbf24;
        }
      }
    }

    .custom-table {
      width: 100%;
      min-width: 1100px;
      background: transparent;
      border-collapse: collapse;
      th {
        color: #a0a0b0;
        font-weight: 600;
        font-size: 13px;
        border-bottom: 1px solid #2a2a38;
        padding: 16px;
        white-space: nowrap;
      }
      td {
        color: #ffffff;
        border-bottom: 1px solid #2a2a38;
        padding: 14px 16px;
        white-space: nowrap;
      }
    }

    .movie-cell {
      display: flex;
      align-items: center;
      gap: 14px;
      .poster-wrapper {
        position: relative;
        width: 48px;
        height: 68px;
        flex-shrink: 0;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #2d2e42;
        background: #0d0d16;
      }
      .poster-thumb {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .movie-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        .movie-title {
          font-weight: 600;
          font-size: 15px;
          color: #ffffff;
          max-width: 260px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .movie-meta-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #94a3b8;
        }
        .meta-divider { color: #475569; }
        .id-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: #141420;
          border: 1px solid #28283c;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 11px;
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.2s;
          .id-icon { font-size: 12px; width: 12px; height: 12px; color: #64748b; }
          .copy-icon { font-size: 11px; width: 11px; height: 11px; opacity: 0; transition: opacity 0.2s; }
          &:hover {
            border-color: #00d2ff;
            color: #00d2ff;
            .copy-icon { opacity: 1; }
          }
        }
        .language-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #00e5ff;
          font-weight: 500;
          font-size: 12px;
          .lang-icon { font-size: 13px; width: 13px; height: 13px; }
        }
      }
    }

    .rating-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-align: center;
      min-width: 50px;
      &.badge-rating-green { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
      &.badge-rating-cyan { background: rgba(6, 182, 212, 0.15); color: #22d3ee; border: 1px solid rgba(6, 182, 212, 0.3); }
      &.badge-rating-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
      &.badge-rating-orange { background: rgba(249, 115, 22, 0.15); color: #fb923c; border: 1px solid rgba(249, 115, 22, 0.3); }
      &.badge-rating-red { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); }
      &.badge-rating-default { background: #2a2a38; color: #cbd5e1; border: 1px solid #3a3a4c; }
    }

    .duration-cell {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 500;
      .duration-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; }
    }

    .text-right { text-align: right; }
    .action-buttons {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      .btn-action {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 20px; width: 20px; height: 20px; }
        &.btn-publish {
          color: #10b981;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.3);
          &:hover {
            background: #10b981;
            color: #ffffff;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.5);
          }
        }
        &.btn-unpublish {
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.3);
          &:hover {
            background: #f59e0b;
            color: #ffffff;
            box-shadow: 0 0 12px rgba(245, 158, 11, 0.5);
          }
        }
        &.btn-preview {
          color: #00e5ff;
          background: rgba(0, 229, 255, 0.08);
          border: 1px solid rgba(0, 229, 255, 0.2);
          &:hover {
            background: #00e5ff;
            color: #000000;
            box-shadow: 0 0 12px rgba(0, 229, 255, 0.5);
          }
        }
        &.btn-edit {
          color: #a855f7;
          background: rgba(168, 85, 247, 0.08);
          border: 1px solid rgba(168, 85, 247, 0.2);
          &:hover {
            background: #a855f7;
            color: #ffffff;
            box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);
          }
        }
        &.btn-delete {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          &:hover {
            background: #ef4444;
            color: #ffffff;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
          }
        }
      }
    }

    .empty-cell { padding: 48px; text-align: center; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #a0a0b0;
      .empty-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5; }
      h3 { font-size: 18px; margin: 0 0 4px; color: #ffffff; }
      p { margin: 0; font-size: 14px; }
    }

    .custom-paginator {
      background: transparent !important;
      color: #ffffff !important;
      border-top: 1px solid #2a2a38;
    }

    .video-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .video-modal-dialog {
      background: #14141e;
      border: 1px solid #2a2a3c;
      border-radius: 16px;
      width: 100%;
      max-width: 920px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 18px 24px;
      background: #1a1a28;
      border-bottom: 1px solid #2a2a3c;
      .header-left {
        display: flex;
        flex-direction: column;
        gap: 6px;
        overflow: hidden;
        h3 { margin: 0; font-size: 18px; font-weight: 700; color: #ffffff; }
      }
      .header-top-tag {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .preview-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 700;
        color: #00e5ff;
        text-transform: uppercase;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      .stream-url-tag {
        font-size: 12px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 700px;
      }
      .btn-close { color: #94a3b8; &:hover { color: #ffffff; } }
    }
    .preview-mode-bar {
      display: flex;
      gap: 10px;
      padding: 10px 24px;
      background: #101018;
      border-bottom: 1px solid #2a2a3c;
      .mode-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        background: #181824;
        border: 1px solid #2d2d3f;
        border-radius: 6px;
        color: #94a3b8;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
        &:hover {
          background: #242436;
          color: #ffffff;
        }
        &.active {
          background: rgba(0, 229, 255, 0.15);
          border-color: #00e5ff;
          color: #00e5ff;
        }
      }
    }
    .modal-body {
      padding: 0;
      background: #000000;
      .player-wrapper {
        position: relative;
        width: 100%;
        aspect-ratio: 16 / 9;
        background: #000000;
      }
      .modal-video-frame {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: #1a1a28;
      border-top: 1px solid #2a2a3c;
    }
  `]
})
export class MovieListPage implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly movieApiService = inject(MovieApiService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  // Expose utils to template
  readonly formatLanguage = formatLanguage;
  readonly formatMaturityRating = formatMaturityRating;
  readonly getMaturityRatingBadgeClass = getMaturityRatingBadgeClass;
  readonly formatDuration = formatDuration;
  readonly String = String;

  movies: Movie[] = [];
  displayedColumns: string[] = ['movie', 'contentType', 'genres', 'maturityRating', 'durationMinutes', 'status', 'actions'];

  previewModalOpen = false;
  previewMovie: Movie | null = null;
  previewUrl = '';
  previewModalEmbedUrl: SafeResourceUrl | null = null;
  previewPlayerMode: 'EMBED' | 'DIRECT' = 'DIRECT';

  contentTabs = [
    { label: 'All Content', value: 'ALL', icon: 'apps' },
    { label: 'Movies', value: 'MOVIE', icon: 'movie' },
    { label: 'AI Movies', value: 'AI_MOVIE', icon: 'auto_awesome' },
    { label: 'AI Series', value: 'AI_SERIES', icon: 'smart_toy' },
    { label: 'AI Microdramas', value: 'AI_MICRODRAMA', icon: 'stay_current_portrait' },
    { label: 'Music & Albums', value: 'ALBUM', icon: 'album' },
    { label: 'Microdramas', value: 'MICRODRAMA', icon: 'video_collection' },
    { label: 'Podcasts', value: 'PODCAST', icon: 'podcasts' },
    { label: 'Short Films', value: 'SHORT_FILM', icon: 'slideshow' },
    { label: 'Series & Shows', value: 'SERIES', icon: 'tv' },
  ];
  selectedType = 'ALL';
  selectedStatus = 'ALL';

  totalElements = 0;
  publishedCount = 0;
  draftCount = 0;
  pageSize = 20;
  currentPage = 0;
  searchQuery = '';
  loading = false;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const typeParam = params['type'] || params['contentType'];
      if (typeParam) {
        this.selectedType = typeParam.toUpperCase();
      } else {
        this.selectedType = 'ALL';
      }
      const statusParam = params['status'];
      if (statusParam) {
        this.selectedStatus = statusParam.toUpperCase();
      }
      this.currentPage = 0;
      this.loadMovies();
    });
  }

  loadMovies(): void {
    if (!this.authStore.isAuthenticated()) {
      return;
    }
    this.loading = true;
    this.movieApiService.getMovies(
      this.currentPage,
      this.pageSize,
      this.searchQuery,
      this.selectedType,
      this.selectedStatus === 'ALL' ? '' : this.selectedStatus
    ).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.movies = res.data.content || [];
          this.totalElements = res.data.totalElements || this.movies.length;
          this.publishedCount = this.movies.filter(m => m.status === 'PUBLISHED').length;
          this.draftCount = this.movies.filter(m => m.status === 'DRAFT').length;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  onSelectStatus(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 0;
    this.loadMovies();
  }

  onTogglePublish(movie: Movie): void {
    const newStatus = movie.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    this.movieApiService.updateMovieStatus(movie.id!, newStatus).subscribe({
      next: () => {
        movie.status = newStatus;
        if (newStatus === 'PUBLISHED') {
          this.notificationService.success(`"${movie.title}" is now PUBLISHED and live on Web & Mobile!`);
        } else {
          this.notificationService.info(`"${movie.title}" moved to DRAFT. It is now hidden from public users.`);
        }
        this.loadMovies();
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to update content status.';
        this.notificationService.error(msg);
      }
    });
  }

  onSelectType(type: string): void {
    this.selectedType = type;
    this.currentPage = 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: type === 'ALL' ? null : type },
      queryParamsHandling: 'merge'
    });
  }

  getShortId(id?: string | number): string {
    if (!id) return '-';
    const str = String(id);
    if (str.length > 8) {
      return str.substring(0, 8) + '...';
    }
    return str;
  }

  copyToClipboard(text: string, label = 'Text'): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.notificationService.success(`${label} copied to clipboard!`);
    });
  }

  getFormattedType(type?: string): string {
    if (!type) return 'Movie';
    switch (type.toUpperCase()) {
      case 'MOVIE': return 'Movie';
      case 'AI_MOVIE': return 'AI Movie';
      case 'AI_SERIES': return 'AI Series';
      case 'AI_MICRODRAMA': return 'AI Microdrama';
      case 'ALBUM': return 'Album / Music';
      case 'MICRODRAMA': return 'Microdrama';
      case 'PODCAST': return 'Podcast';
      case 'SHORT_FILM': return 'Short Film';
      case 'SERIES': return 'Series / Show';
      case 'STAGE_DRAMA': return 'Stage Drama';
      case 'DOCUMENTARY': return 'Documentary';
      default: return type;
    }
  }

  getTypeIcon(type?: string): string {
    if (!type) return 'movie';
    switch (type.toUpperCase()) {
      case 'MOVIE': return 'movie';
      case 'AI_MOVIE':
      case 'AI_SERIES':
      case 'AI_MICRODRAMA': return 'auto_awesome';
      case 'ALBUM': return 'album';
      case 'MICRODRAMA': return 'stay_current_portrait';
      case 'PODCAST': return 'podcasts';
      case 'SHORT_FILM': return 'slideshow';
      case 'SERIES': return 'tv';
      case 'STAGE_DRAMA': return 'theater_comedy';
      case 'DOCUMENTARY': return 'menu_book';
      default: return 'video_library';
    }
  }

  getTypeBadgeClass(type?: string): string {
    if (!type) return 'type-movie';
    switch (type.toUpperCase()) {
      case 'MOVIE': return 'type-movie';
      case 'AI_MOVIE':
      case 'AI_SERIES':
      case 'AI_MICRODRAMA': return 'type-ai';
      case 'ALBUM': return 'type-album';
      case 'MICRODRAMA': return 'type-microdrama';
      case 'PODCAST': return 'type-podcast';
      case 'SHORT_FILM': return 'type-short';
      case 'SERIES': return 'type-series';
      default: return 'type-other';
    }
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadMovies();
  }

  onSearch(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.currentPage = 0;
    this.loadMovies();
  }

  onAddMovie(): void {
    this.router.navigate(['/admin/movies/new']);
  }

  onEditMovie(id: number | string): void {
    this.router.navigate(['/admin/movies/edit', id]);
  }

  onPreviewVideo(movie: Movie): void {
    const rawUrl = movie.masterPlaylistUrl || movie.video4kUrl || movie.video1080Url || movie.video720Url || movie.trailerUrl || (movie as any).videoUrl || (movie as any).videoAssetId || (movie as any).video_asset_id || (movie as any).media_asset?.hls_manifest_url;
    
    if (rawUrl && String(rawUrl).trim()) {
      this.openVideoPreviewModal(movie, String(rawUrl).trim());
      return;
    }

    if (movie.id) {
      this.loading = true;
      this.movieApiService.getMovieById(movie.id).subscribe({
        next: (res) => {
          this.loading = false;
          const full = res.data;
          const fetchedUrl = full?.masterPlaylistUrl || (full as any)?.videoAssetId || (full as any)?.video_asset_id || (full as any)?.videoUrl || (full as any)?.media_asset?.hls_manifest_url || full?.video4kUrl || full?.video1080Url || full?.trailerUrl;
          if (fetchedUrl && String(fetchedUrl).trim()) {
            movie.masterPlaylistUrl = String(fetchedUrl).trim();
            this.openVideoPreviewModal(movie, String(fetchedUrl).trim());
          } else {
            this.notificationService.warning(`No video playback stream configured for '${movie.title}'. Click Edit to attach an HLS stream.`);
          }
        },
        error: () => {
          this.loading = false;
          this.notificationService.warning(`No video playback stream configured for '${movie.title}'. Click Edit to attach an HLS stream.`);
        }
      });
    } else {
      this.notificationService.warning(`No video playback URL configured for '${movie.title}'`);
    }
  }

  openVideoPreviewModal(movie: Movie, streamUrl: string): void {
    this.previewMovie = movie;
    let cleanUrl = (streamUrl || '').trim();

    const cdnHost = this.runtimeConfig.bunnyStreamCdnHostname;
    if (cdnHost && cleanUrl.includes('video.bunnycdn.com')) {
      cleanUrl = cleanUrl.replace('video.bunnycdn.com', cdnHost);
    }

    const bunnyIdMatch = movie.bunnyVideoId || (movie as any).streamVideoId || cleanUrl.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/i)?.[1];

    if (bunnyIdMatch && this.runtimeConfig.bunnyStreamLibraryId) {
      const guid = bunnyIdMatch;
      const libraryId = this.runtimeConfig.bunnyStreamLibraryId;
      this.previewUrl = cdnHost ? `https://${cdnHost}/${guid}/play_720p.mp4` : cleanUrl;
      const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${guid}?autoplay=true&loop=false&muted=false`;
      this.previewModalEmbedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
      this.previewPlayerMode = 'EMBED';
    } else {
      this.previewUrl = cleanUrl;
      this.previewModalEmbedUrl = null;
      this.previewPlayerMode = 'DIRECT';
    }

    this.previewModalOpen = true;
  }

  onPreviewVideoError(): void {
    if (this.previewModalEmbedUrl && this.previewPlayerMode === 'DIRECT') {
      this.previewPlayerMode = 'EMBED';
    }
  }

  closeVideoPreview(): void {
    this.previewModalOpen = false;
    this.previewMovie = null;
    this.previewUrl = '';
    this.previewModalEmbedUrl = null;
  }

  isEmbedUrl(url: string): boolean {
    if (!url) return false;
    const clean = url.toLowerCase();
    return clean.includes('youtube.com') || clean.includes('youtu.be') || clean.includes('vimeo.com') || clean.includes('embed') || clean.includes('iframe.mediadelivery.net');
  }

  getSafeEmbedUrl(raw: string): SafeResourceUrl {
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

  copyStreamUrl(url: string): void {
    if (!url) return;
    this.copyToClipboard(url, 'Stream URL');
  }

  goToWatchPlayer(id?: string | number): void {
    const targetId = id || this.previewMovie?.id;
    if (!targetId) return;
    this.closeVideoPreview();
    this.router.navigate(['/watch', targetId]);
  }

  async onDeleteMovie(movie: Movie): Promise<void> {
    const confirmed = await this.notificationService.confirm(
      'Delete Movie',
      `Are you sure you want to delete '${movie.title}'? This action cannot be undone.`,
      'Yes, Delete Movie'
    );
    if (confirmed) {
      this.movieApiService.deleteMovie(movie.id!).subscribe({
        next: () => {
          this.notificationService.success(`Movie '${movie.title}' deleted successfully.`);
          this.loadMovies();
        }
      });
    }
  }

  getPosterPlaceholder(movie?: Movie): string {
    return generatePosterPlaceholder(movie?.title, movie?.contentType, movie?.originalLanguage);
  }

  onImgError(event: any, movie?: Movie): void {
    if (!event?.target) return;
    const currentSrc = event.target.src || '';
    const svgPlaceholder = this.getPosterPlaceholder(movie);
    if (currentSrc !== svgPlaceholder) {
      event.target.src = svgPlaceholder;
    } else {
      event.target.src = 'assets/placeholder-poster.jpg';
    }
  }
}
