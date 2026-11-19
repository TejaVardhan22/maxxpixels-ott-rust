import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataTableComponent, TableColumn } from '../../shared/components/data-table/data-table.component';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { SeriesApiService, Series } from '../../core/services/series-api.service';
import { NotificationService } from '../../shared/services/notification.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { formatLanguage, formatMaturityRating, getMaturityRatingBadgeClass, generatePosterPlaceholder } from '../../shared/utils/formatters';

@Component({
  selector: 'app-series-list-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    DataTableComponent,
    PermissionButtonComponent,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER & ACTIONS -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>tv</mat-icon> WEB SERIES & SEASONS STUDIO</span>
          <h1>TV Series & Seasons Catalog</h1>
          <p>Manage Web Series, Microdramas, Seasons, Episodes, and Release Schedules</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="accent" class="album-btn" (click)="onCreateNewAlbum()">
            <mat-icon>album</mat-icon> Add Album Songs
          </button>
          <button mat-raised-button color="primary" class="add-btn" (click)="onCreateNewSeries()">
            <mat-icon>add</mat-icon> Add New Series
          </button>
        </div>
      </div>

      <!-- 2. KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card blue">
          <mat-icon class="kpi-icon">tv</mat-icon>
          <div>
            <span class="kpi-label">Total Web Series</span>
            <div class="kpi-val">{{ totalElements || 80 }}</div>
          </div>
        </div>

        <div class="kpi-card green">
          <mat-icon class="kpi-icon">video_library</mat-icon>
          <div>
            <span class="kpi-label">Seasons Published</span>
            <div class="kpi-val">210 Seasons</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <mat-icon class="kpi-icon">movie</mat-icon>
          <div>
            <span class="kpi-label">Active Episodes</span>
            <div class="kpi-val">1,840 Episodes</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <mat-icon class="kpi-icon">play_circle_filled</mat-icon>
          <div>
            <span class="kpi-label">Total Streams</span>
            <div class="kpi-val">14.2 Million</div>
          </div>
        </div>
      </div>

      <!-- 3. FILTER TABS & CATEGORY SELECTION -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Main Type:</span>
          <button class="filter-pill" [class.active]="selectedType === 'ALL'" (click)="filterByType('ALL')">All Types</button>
          <button class="filter-pill" [class.active]="selectedType === 'SERIES'" (click)="filterByType('SERIES')">Web Series</button>
          <button class="filter-pill" [class.active]="selectedType === 'AI_SERIES'" (click)="filterByType('AI_SERIES')">AI Series</button>
          <button class="filter-pill" [class.active]="selectedType === 'AI_MICRODRAMA'" (click)="filterByType('AI_MICRODRAMA')">AI Microdramas</button>
          <button class="filter-pill" [class.active]="selectedType === 'ALBUM'" (click)="filterByType('ALBUM')">Album Songs</button>
          <button class="filter-pill" [class.active]="selectedType === 'MICRODRAMA'" (click)="filterByType('MICRODRAMA')">Microdramas</button>
          <button class="filter-pill" [class.active]="selectedType === 'TV_SHOW'" (click)="filterByType('TV_SHOW')">TV Shows</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">Language:</span>
          <button class="filter-pill" [class.active]="selectedLang === 'ALL'" (click)="filterByLang('ALL')">All</button>
          <button *ngFor="let lang of availableLanguages" class="filter-pill" [class.active]="selectedLang === lang" (click)="filterByLang(lang)">{{ lang }}</button>
        </div>
      </div>

      <!-- 4. STREAM PLAYBACK INSPECTOR MODAL -->
      <div *ngIf="inspectingSeries" class="inspector-modal-box">
        <div class="inspector-header">
          <span><mat-icon>play_circle</mat-icon> Streaming Inspector — {{ inspectingSeries.title }}</span>
          <button type="button" mat-icon-button (click)="inspectingSeries = null"><mat-icon>close</mat-icon></button>
        </div>
        <div class="inspector-body">
          <video src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" controls autoplay class="modal-video"></video>
          <div class="series-meta-summary">
            <h4>{{ inspectingSeries.title }} ({{ inspectingSeries.originalLanguage }})</h4>
            <p>Seasons: {{ inspectingSeries.totalSeasons }} | Total Episodes: {{ inspectingSeries.totalEpisodes }} | Rating: {{ inspectingSeries.maturityRating }}</p>
          </div>
        </div>
      </div>

      <!-- 5. SERIES CATALOG DATA TABLE -->
      <mat-card class="table-card">
        <div class="table-responsive">
          <table class="custom-series-table">
            <thead>
              <tr>
                <th>Poster</th>
                <th>Series Title</th>
                <th>Main Type</th>
                <th>Language</th>
                <th>Seasons</th>
                <th>Episodes</th>
                <th>Maturity</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredSeries">
                <td>
                  <div class="poster-thumb">
                    <img [src]="item.posterUrl || getPosterPlaceholder(item)" alt="Poster" (error)="onImgError($event, item)">
                  </div>
                </td>
                <td>
                  <div class="title-col">
                    <span class="series-title">{{ item.title }}</span>
                    <span class="series-id">ID: #{{ item.id }}</span>
                  </div>
                </td>
                <td><span class="type-tag" [class.micro]="item.contentType === 'MICRODRAMA'" [class.album]="item.contentType === 'ALBUM'">{{ item.contentType }}</span></td>
                <td><span class="lang-badge">{{ formatLanguage(item.originalLanguage) }}</span></td>
                <td><span class="season-count">{{ item.contentType === 'ALBUM' ? (item.totalSeasons || 1) + ' Discs' : (item.totalSeasons || 1) + ' Seasons' }}</span></td>
                <td><span class="ep-count">{{ item.contentType === 'ALBUM' ? (item.totalEpisodes || 1) + ' Tracks' : (item.totalEpisodes || 1) + ' Ep' }}</span></td>
                <td><span class="rating-chip" [ngClass]="getMaturityRatingBadgeClass(item.maturityRating)">{{ formatMaturityRating(item.maturityRating) }}</span></td>
                <td><app-status-badge [status]="item.status"></app-status-badge></td>
                <td class="text-right">
                  <div class="action-btn-group">
                    <button mat-icon-button color="accent" (click)="onInspectSeries(item)" matTooltip="Inspect Video Feed">
                      <mat-icon>play_circle</mat-icon>
                    </button>
                    <button mat-icon-button color="primary" (click)="onEditSeries(item.id!)" matTooltip="Edit Series & Episodes">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="onDeleteSeries(item)" matTooltip="Delete Series">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 4px; }
    
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;

      .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(0, 210, 255, 0.15);
        color: #00d2ff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 4px;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: #ffffff; }
      p { color: #a0a0b0; margin: 0; font-size: 13px; }

      .add-btn { height: 42px; border-radius: 8px; font-weight: 700; background-color: #e50914 !important; }
    }

    /* KPI CARDS */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 14px;

      .kpi-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #202030;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
      }

      .kpi-label { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 2px; }
      .kpi-val { font-size: 20px; font-weight: 700; color: #ffffff; }

      &.blue .kpi-icon { color: #00d2ff; }
      &.green .kpi-icon { color: #00e676; }
      &.purple .kpi-icon { color: #ab47bc; }
      &.gold .kpi-icon { color: #ffab00; }
    }

    /* FILTER BAR */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 20px;
      flex-wrap: wrap;

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;

        .filter-label { font-size: 12px; font-weight: 700; color: #a0a0b0; }
        .filter-pill {
          background: #101018;
          border: 1px solid #28283a;
          color: #ffffff;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover, &.active { background: #e50914; border-color: #e50914; color: #ffffff; }
        }
      }
    }

    /* INSPECTOR MODAL */
    .inspector-modal-box {
      background: #000000;
      border: 1px solid #00d2ff;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;

      .inspector-header {
        background: #161622;
        padding: 10px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #00d2ff;
        font-weight: 700;
        font-size: 13px;
        span { display: flex; align-items: center; gap: 6px; }
      }

      .inspector-body {
        padding: 16px;
        .modal-video { width: 100%; max-height: 380px; border-radius: 8px; margin-bottom: 12px; }
        .series-meta-summary {
          h4 { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #ffffff; }
          p { margin: 0; font-size: 12px; color: #a0a0b0; }
        }
      }
    }

    /* TABLE STYLES */
    .table-card {
      background: #161622 !important;
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 16px;
    }

    .custom-series-table {
      width: 100%;
      min-width: 1050px;
      border-collapse: collapse;
      font-size: 13px;

      th {
        text-align: left;
        color: #a0a0b0;
        font-weight: 700;
        padding: 12px 14px;
        border-bottom: 1px solid #28283a;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.5px;
        white-space: nowrap;
        &.text-right { text-align: right; }
      }

      td {
        padding: 12px 14px;
        border-bottom: 1px solid #202030;
        vertical-align: middle;
        white-space: nowrap;
        &.text-right { text-align: right; }
      }

      tr:hover td { background: rgba(255, 255, 255, 0.02); }

      .poster-thumb {
        width: 44px;
        height: 60px;
        border-radius: 6px;
        overflow: hidden;
        background: #000000;
        img { width: 100%; height: 100%; object-fit: cover; }
      }

      .title-col {
        display: flex;
        flex-direction: column;
        .series-title { font-weight: 700; color: #ffffff; font-size: 14px; }
        .series-id { font-size: 10px; color: #a0a0b0; }
      }

      .album-btn {
        border-color: #ffab00 !important;
        color: #ffab00 !important;
        font-weight: 700;
        height: 40px;
        border-radius: 8px;
        mat-icon { margin-right: 6px; }
      }

      .type-tag {
        background: rgba(0, 210, 255, 0.15);
        color: #00d2ff;
        font-size: 10px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        &.micro { background: rgba(171, 71, 188, 0.2); color: #ab47bc; }
        &.album { background: rgba(255, 171, 0, 0.2); color: #ffab00; }
      }

      .lang-badge {
        background: #252538;
        color: #ffffff;
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .season-count { color: #00e676; font-weight: 700; }
      .ep-count { color: #ffab00; font-weight: 700; }

      .rating-chip {
        background: #34495e;
        color: #ffffff;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 4px;
        font-weight: 700;
      }

      .action-btn-group {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
      }
    }
  `]
})
export class SeriesListPage implements OnInit {
  private readonly seriesApiService = inject(SeriesApiService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly http = inject(HttpClient);

  seriesList: Series[] = [];
  availableLanguages: string[] = [];

  readonly formatLanguage = formatLanguage;
  readonly formatMaturityRating = formatMaturityRating;
  readonly getMaturityRatingBadgeClass = getMaturityRatingBadgeClass;

  selectedType = 'ALL';
  selectedLang = 'ALL';
  inspectingSeries: Series | null = null;

  totalElements = 0;
  pageSize = 20;
  currentPage = 0;
  searchQuery = '';
  loading = false;

  get filteredSeries(): Series[] {
    return this.seriesList.filter(item => {
      const matchType = this.selectedType === 'ALL' || item.contentType === this.selectedType;
      const matchLang = this.selectedLang === 'ALL' ||
        (item.originalLanguage && item.originalLanguage.trim().toLowerCase() === this.selectedLang.trim().toLowerCase());
      return matchType && matchLang;
    });
  }

  ngOnInit(): void {
    this.loadSeries();
    this.loadLanguages();
  }

  loadLanguages(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/languages`).subscribe({
      next: (res: any) => {
        const langs = res?.data ?? res?.result ?? res ?? [];
        if (Array.isArray(langs)) {
          langs.forEach((l: any) => {
            const name = l.name || l.code;
            if (name && !this.availableLanguages.includes(name)) {
              this.availableLanguages.push(name);
            }
          });
        }
      }
    });
  }

  loadSeries(): void {
    this.loading = true;
    this.seriesApiService.getSeries(this.currentPage, this.pageSize, this.searchQuery).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success && res.data) {
          this.seriesList = res.data.content || [];
          this.totalElements = res.data.totalElements || this.seriesList.length;
        } else {
          this.seriesList = [];
          this.totalElements = 0;
        }
      },
      error: () => {
        this.loading = false;
        this.seriesList = [];
        this.totalElements = 0;
      }
    });
  }

  filterByType(type: string): void {
    this.selectedType = type;
  }

  filterByLang(lang: string): void {
    this.selectedLang = lang;
  }

  onCreateNewSeries(): void {
    this.router.navigate(['/admin/series/new']);
  }

  onCreateNewAlbum(): void {
    this.router.navigate(['/admin/series/new'], { queryParams: { type: 'ALBUM' } });
  }

  onEditSeries(id: number | string): void {
    this.router.navigate([`/admin/series/${id}/edit`]);
  }

  onInspectSeries(series: Series): void {
    this.inspectingSeries = series;
  }

  async onDeleteSeries(series: Series): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Delete Series?',
      `Are you sure you want to delete "${series.title}"?`,
      'Yes, Delete'
    );
    if (ok) {
      if (series.id) {
        this.seriesApiService.deleteSeries(series.id).subscribe({
          next: () => {
            this.notificationService.success(`Deleted ${series.title}`);
            this.loadSeries();
          }
        });
      } else {
        this.seriesList = this.seriesList.filter(s => s.title !== series.title);
        this.notificationService.success(`Deleted ${series.title}`);
      }
    }
  }

  getPosterPlaceholder(item?: Series): string {
    return generatePosterPlaceholder(item?.title, item?.contentType, item?.originalLanguage);
  }

  onImgError(event: any, item?: Series): void {
    if (!event?.target) return;
    const currentSrc = event.target.src || '';
    const svgPlaceholder = this.getPosterPlaceholder(item);
    if (currentSrc !== svgPlaceholder) {
      event.target.src = svgPlaceholder;
    } else {
      event.target.src = 'assets/placeholder-poster.jpg';
    }
  }
}
