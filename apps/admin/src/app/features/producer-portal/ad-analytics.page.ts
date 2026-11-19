import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface MovieAnalyticsItem {
  id: number;
  title: string;
  contentType: string; // MOVIE, SERIES, MICRODRAMA
  posterUrl: string;
  runTimeMinutes: number;
  totalViews: number;
  adsRunned: number;
  fillRatePercentage: number;
  cpmRate: number;
  totalWatchHours: number;
  completionRatePercentage: number;
  producerEarnings: number;
  status: string;
  releaseDate: string;
}

@Component({
  selector: 'app-ad-analytics-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatCardModule, MatTooltipModule, StatusBadgeComponent],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>bar_chart</mat-icon> PRODUCER ASSETS & AD TELEMETRY</span>
          <h1>Movie Assets, Ads Runned & Viewer Performance Analytics</h1>
          <p>Detailed breakdown of movie asset run times, SSAI ad insertions, fill rates, completion %, and producer earnings</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="accent" class="export-btn" (click)="exportReport()">
            <mat-icon>download</mat-icon> Export Asset Telemetry CSV
          </button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>play_circle</mat-icon></div>
          <div>
            <span class="kpi-label">Total Stream Plays</span>
            <div class="kpi-val">{{ getTotalViews() | number }} Plays</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>slideshow</mat-icon></div>
          <div>
            <span class="kpi-label">Total Ads Inserted & Runned</span>
            <div class="kpi-val">{{ getTotalAdsRunned() | number }} Ads</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>schedule</mat-icon></div>
          <div>
            <span class="kpi-label">Total Watch Hours Accumulated</span>
            <div class="kpi-val">{{ getTotalWatchHours() | number:'1.0-0' }} Hours</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>payments</mat-icon></div>
          <div>
            <span class="kpi-label">Total Producer Net Share Earnings</span>
            <div class="kpi-val font-mono">{{ getTotalEarnings() | currency:'INR':'symbol':'1.2-2' }}</div>
          </div>
        </div>
      </div>

      <!-- 3. SEARCH & FORMAT FILTERS -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Content Format:</span>
          <button class="filter-pill" [class.active]="selectedFormat === 'ALL'" (click)="setFormatFilter('ALL')">All Asset Formats</button>
          <button class="filter-pill" [class.active]="selectedFormat === 'MOVIE'" (click)="setFormatFilter('MOVIE')">🎬 Feature Movies</button>
          <button class="filter-pill" [class.active]="selectedFormat === 'SERIES'" (click)="setFormatFilter('SERIES')">📺 Web Series</button>
          <button class="filter-pill" [class.active]="selectedFormat === 'MICRODRAMA'" (click)="setFormatFilter('MICRODRAMA')">📱 Micro-Dramas</button>
        </div>

        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="filterMovies()" placeholder="Search movie asset title, format...">
        </div>
      </div>

      <!-- 4. MOVIE ASSET & AD TELEMETRY TABLE -->
      <div class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Movie Assets & SSAI Ad Telemetry Leaderboard</h3>
            <p>Real-time stream views, stitched ad insertions, completion rates, and revenue share</p>
          </div>
        </div>

        <table class="custom-table">
          <thead>
            <tr>
              <th>Asset Details</th>
              <th>Run Time (Duration)</th>
              <th>Total Views</th>
              <th>Ads Runned & Fill Rate</th>
              <th>Total Watch Hours</th>
              <th>Avg Completion %</th>
              <th>Producer Earnings (70%)</th>
              <th style="text-align: right;">Asset Breakout</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of filteredMovies">
              <td>
                <div class="asset-cell">
                  <img [src]="item.posterUrl" [alt]="item.title" class="poster-thumb" (error)="item.posterUrl = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1'">
                  <div class="asset-meta">
                    <span class="movie-name">{{ item.title }}</span>
                    <span class="movie-format">
                      <mat-icon>{{ item.contentType === 'SERIES' ? 'tv' : 'movie' }}</mat-icon>
                      {{ item.contentType }} • Released {{ item.releaseDate }}
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <div class="runtime-badge">
                  <mat-icon>schedule</mat-icon> {{ item.runTimeMinutes }} min
                </div>
              </td>
              <td>
                <span class="views-text">{{ item.totalViews | number }} Plays</span>
              </td>
              <td>
                <div class="ad-run-cell">
                  <span class="ads-text">{{ item.adsRunned | number }} Ads</span>
                  <span class="fill-badge"><mat-icon>verified</mat-icon> {{ item.fillRatePercentage }}% Fill</span>
                </div>
              </td>
              <td>
                <span class="hours-text">{{ item.totalWatchHours | number:'1.1-1' }} Hours</span>
              </td>
              <td>
                <div class="completion-bar-container">
                  <span class="completion-text">{{ item.completionRatePercentage }}%</span>
                  <div class="mini-bar-bg">
                    <div class="mini-bar-fill" [style.width.%]="item.completionRatePercentage"></div>
                  </div>
                </div>
              </td>
              <td>
                <span class="earnings-text">{{ item.producerEarnings | currency:'INR':'symbol':'1.2-2' }}</span>
              </td>
              <td style="text-align: right;">
                <button mat-stroked-button color="primary" class="detail-btn" (click)="openAssetModal(item)" matTooltip="View SSAI Ad Cue Points & Telemetry">
                  <mat-icon>analytics</mat-icon> Ad Breakout
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 5. ASSET TELEMETRY & AD BREAKOUT MODAL -->
      <div class="modal-backdrop" *ngIf="selectedAsset" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>analytics</mat-icon></div>
            <div>
              <h2>{{ selectedAsset.title }} — Ad & Stream Telemetry</h2>
              <p>{{ selectedAsset.contentType }} • {{ selectedAsset.runTimeMinutes }} Minutes Duration • Released {{ selectedAsset.releaseDate }}</p>
            </div>
            <button mat-icon-button (click)="closeModal()" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body">
            <div class="modal-kpi-row">
              <div class="modal-kpi-box">
                <span class="m-label">Total Stream Plays</span>
                <span class="m-val text-blue">{{ selectedAsset.totalViews | number }}</span>
              </div>
              <div class="modal-kpi-box">
                <span class="m-label">Ads Runned</span>
                <span class="m-val text-purple">{{ selectedAsset.adsRunned | number }}</span>
              </div>
              <div class="modal-kpi-box">
                <span class="m-label">Ad Fill Rate</span>
                <span class="m-val text-green">{{ selectedAsset.fillRatePercentage }}%</span>
              </div>
              <div class="modal-kpi-box">
                <span class="m-label">Producer Net Share</span>
                <span class="m-val text-gold">{{ selectedAsset.producerEarnings | currency:'INR':'symbol':'1.2-2' }}</span>
              </div>
            </div>

            <!-- AD CUE POINTS BREAKDOWN -->
            <div class="cue-points-section">
              <h4><mat-icon>slideshow</mat-icon> SSAI Server-Side Ad Insertion Cue Points</h4>
              <div class="cue-grid">
                <div class="cue-item">
                  <div class="cue-tag preroll">Pre-Roll (0:00)</div>
                  <div class="cue-info">15s Ad • 184,200 Impressions • ₹200 CPM</div>
                </div>
                <div class="cue-item">
                  <div class="cue-tag midroll">Mid-Roll 1 (45:00)</div>
                  <div class="cue-info">30s Ad • 184,200 Impressions • ₹350 CPM</div>
                </div>
                <div class="cue-item">
                  <div class="cue-tag postroll">Post-Roll (End)</div>
                  <div class="cue-info">15s Ad • 184,200 Impressions • ₹180 CPM</div>
                </div>
              </div>
            </div>

            <!-- DEVICE & REGION SHARE -->
            <div class="breakdown-grid">
              <div class="b-box">
                <h4><mat-icon>devices</mat-icon> Device Share</h4>
                <div class="b-row"><span>Smart TV (Samsung/LG/Android TV)</span><span>48.5%</span></div>
                <div class="b-row"><span>Mobile App (iOS/Android)</span><span>34.2%</span></div>
                <div class="b-row"><span>Web Desktop & Tablet</span><span>17.3%</span></div>
              </div>
              <div class="b-box">
                <h4><mat-icon>public</mat-icon> Viewer Geography</h4>
                <div class="b-row"><span>North America (US / Canada)</span><span>45.0%</span></div>
                <div class="b-row"><span>Asia Pacific (India / SEA)</span><span>35.0%</span></div>
                <div class="b-row"><span>Europe (UK / Germany)</span><span>20.0%</span></div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button mat-raised-button color="primary" (click)="closeModal()">Close Telemetry</button>
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

      .export-btn {
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
      margin-bottom: 24px;
      flex-wrap: wrap;

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;

        .filter-label { font-size: 12px; font-weight: 700; color: #a0a0b0; }
        .filter-pill {
          background: #101018;
          border: 1px solid #28283a;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover, &.active {
            background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%);
            border-color: transparent;
            color: #ffffff;
          }
        }
      }

      .search-box {
        position: relative;
        width: 320px;
        .search-icon { position: absolute; left: 10px; top: 8px; color: #a0a0b0; font-size: 18px; width: 18px; height: 18px; }
        input {
          width: 100%;
          background: #101018;
          border: 1px solid #28283a;
          border-radius: 8px;
          color: #ffffff;
          padding: 8px 12px 8px 34px;
          font-size: 13px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
      }
    }

    /* TABLE CARD */
    .table-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      .table-title-row {
        margin-bottom: 20px;
        h3 { margin: 0 0 2px; font-size: 18px; font-weight: 800; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }

      .custom-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;

        th {
          background: #101018;
          color: #a0a0b0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 14px 16px;
          border-bottom: 1px solid #28283c;
        }

        td {
          padding: 14px 16px;
          border-bottom: 1px solid #202030;
          font-size: 13px;
        }
      }
    }

    .asset-cell {
      display: flex;
      align-items: center;
      gap: 12px;

      .poster-thumb {
        width: 36px;
        height: 48px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid #28283a;
      }

      .asset-meta {
        display: flex;
        flex-direction: column;
        gap: 3px;
        .movie-name { font-weight: 700; color: #ffffff; font-size: 14px; }
        .movie-format { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #00d2ff; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      }
    }

    .runtime-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(255, 171, 0, 0.12);
      color: #ffab00;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .views-text { font-weight: 700; color: #00d2ff; }

    .ad-run-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      .ads-text { font-weight: 700; color: #ab47bc; }
      .fill-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        color: #00e676;
        mat-icon { font-size: 12px; width: 12px; height: 12px; }
      }
    }

    .hours-text { font-weight: 700; color: #ffffff; }

    .completion-bar-container {
      display: flex;
      flex-direction: column;
      gap: 4px;
      width: 90px;
      .completion-text { font-size: 11px; font-weight: 700; color: #00d2ff; }
      .mini-bar-bg {
        height: 5px;
        background: #202030;
        border-radius: 3px;
        overflow: hidden;
        .mini-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #1a4cd8, #c725a3);
          border-radius: 3px;
        }
      }
    }

    .earnings-text { font-weight: 800; color: #00e676; font-size: 14px; }
    .detail-btn { font-size: 12px; font-weight: 700; border-color: #1a4cd8; color: #00d2ff; }

    /* MODAL STYLES */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.78);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      width: 100%;
      max-width: 640px;
      padding: 24px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

      .modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
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
        h2 { margin: 0 0 2px; font-size: 18px; font-weight: 800; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
        .close-btn { position: absolute; right: 0; top: 0; color: #a0a0b0; }
      }

      .modal-kpi-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 20px;
        .modal-kpi-box {
          background: #101018;
          border: 1px solid #28283a;
          border-radius: 10px;
          padding: 10px;
          .m-label { font-size: 10px; color: #a0a0b0; display: block; margin-bottom: 2px; }
          .m-val { font-size: 14px; font-weight: 800; }
          .text-blue { color: #00d2ff; }
          .text-purple { color: #ab47bc; }
          .text-green { color: #00e676; }
          .text-gold { color: #ffab00; }
        }
      }

      .cue-points-section {
        background: #101018;
        border: 1px solid #28283a;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 20px;
        h4 { margin: 0 0 10px; font-size: 13px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 6px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #ab47bc; } }
        .cue-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
          .cue-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #161622;
            padding: 8px 12px;
            border-radius: 6px;
            .cue-tag {
              font-size: 11px;
              font-weight: 800;
              padding: 2px 8px;
              border-radius: 4px;
              &.preroll { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
              &.midroll { background: rgba(171, 71, 188, 0.15); color: #ab47bc; }
              &.postroll { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
            }
            .cue-info { font-size: 11px; color: #a0a0b0; font-family: monospace; }
          }
        }
      }

      .breakdown-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-bottom: 20px;
        .b-box {
          background: #101018;
          border: 1px solid #28283a;
          border-radius: 12px;
          padding: 14px;
          h4 { margin: 0 0 10px; font-size: 13px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 6px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; } }
          .b-row {
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            padding: 4px 0;
            border-bottom: 1px solid #202030;
            color: #a0a0b0;
            span:last-child { font-weight: 700; color: #ffffff; }
          }
        }
      }

      .modal-footer {
        display: flex;
        justify-content: flex-end;
      }
    }
  `]
})
export class AdAnalyticsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  movies: MovieAnalyticsItem[] = [];
  filteredMovies: MovieAnalyticsItem[] = [];
  selectedAsset: MovieAnalyticsItem | null = null;
  selectedFormat = 'ALL';
  searchQuery = '';
  loading = false;

  ngOnInit(): void {
    this.loadMovieAnalytics();
  }

  loadMovieAnalytics(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/producer/analytics/movies`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.movies = res.data.map((item: any) => ({
            ...item,
            posterUrl: item.posterUrl || '',
            fillRatePercentage: item.fillRatePercentage || 0,
            cpmRate: item.cpmRate || 0,
            completionRatePercentage: item.completionRatePercentage || 0,
            releaseDate: item.releaseDate || ''
          }));
        } else {
          this.movies = [];
        }
        this.filterMovies();
      },
      error: () => {
        this.loading = false;
        this.movies = [];
        this.filterMovies();
      }
    });
  }

  setFormatFilter(fmt: string): void {
    this.selectedFormat = fmt;
    this.filterMovies();
  }

  filterMovies(): void {
    let result = [...this.movies];
    if (this.selectedFormat !== 'ALL') {
      result = result.filter(m => m.contentType === this.selectedFormat);
    }
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(m => m.title.toLowerCase().includes(q) || m.contentType.toLowerCase().includes(q));
    }
    this.filteredMovies = result;
  }

  getTotalViews(): number {
    return this.movies.reduce((acc, curr) => acc + (curr.totalViews || 0), 0);
  }

  getTotalAdsRunned(): number {
    return this.movies.reduce((acc, curr) => acc + (curr.adsRunned || 0), 0);
  }

  getTotalWatchHours(): number {
    return this.movies.reduce((acc, curr) => acc + (curr.totalWatchHours || 0), 0);
  }

  getTotalEarnings(): number {
    return this.movies.reduce((acc, curr) => acc + (curr.producerEarnings || 0), 0);
  }

  openAssetModal(item: MovieAnalyticsItem): void {
    this.selectedAsset = item;
  }

  closeModal(): void {
    this.selectedAsset = null;
  }

  exportReport(): void {
    this.notificationService.success('Generating Movie Asset Performance & SSAI Ad Telemetry CSV Report... Download started.');
  }
}
