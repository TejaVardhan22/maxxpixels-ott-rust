import { Component, OnInit, OnDestroy, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Chart, registerables } from 'chart.js';
import {
  ProducerApiService,
  MovieAnalyticsItem,
} from '../../core/services/producer-api.service';
import { AuthStore } from '../../core/auth/auth.store';

interface ContentOverviewResponse {
  producerId: number | string | null;
  studioName: string;
  watchingNow: number;
  adsAvailable: boolean;
  viewsDataAvailable: boolean;
  contents: Array<{
    id: number | string;
    title: string;
    contentType: string;
    status: string;
    posterUrl?: string;
    totalViews: number;
    uniqueViews: number;
    adsRun: { preRoll: number; midRoll: number; postRoll: number; other: number; total: number };
    adsAvailable: boolean;
  }>;
  totals: {
    contentCount: number;
    totalViews: number;
    uniqueViews: number;
    adsRun: { preRoll: number; midRoll: number; postRoll: number; other: number; total: number };
  };
  dailyViews: Array<{ day: string; views: number }>;
  dailyAds: Array<{ day: string; preRoll: number; midRoll: number; postRoll: number; other: number; total: number }>;
}

Chart.register(...registerables);

@Component({
  selector: 'app-producer-content-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <div class="dash-wrap">
      <!-- Header -->
      <div class="dash-header">
        <div>
          <h1 class="dash-title">Content Dashboard</h1>
          <p class="dash-sub">
            {{ overview?.studioName || 'Producer Studio' }} · views &amp; VAST ad performance for your content
          </p>
        </div>
        <div class="header-actions">
          <span class="live-chip" [class.live-now]="(overview?.watchingNow ?? 0) > 0" [class.live-ok]="(overview?.watchingNow ?? 0) === 0 && overview?.viewsDataAvailable">
            <span class="dot"></span>
            {{ (overview?.watchingNow ?? 0) > 0
                ? ((overview?.watchingNow ?? 0) + ' watching now')
                : (overview?.viewsDataAvailable ? 'Live · auto-refresh 30s' : 'No data yet') }}
          </span>
          <button mat-icon-button (click)="load()" matTooltip="Refresh now">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Totals -->
      <div class="totals-row" *ngIf="!loading">
        <mat-card class="total-card">
          <mat-icon class="tc-icon purple">movie</mat-icon>
          <div>
            <div class="tc-value">{{ overview?.totals?.contentCount ?? 0 }}</div>
            <div class="tc-label">Your Content</div>
          </div>
        </mat-card>
        <mat-card class="total-card">
          <mat-icon class="tc-icon blue">visibility</mat-icon>
          <div>
            <div class="tc-value">{{ overview?.totals?.totalViews ?? 0 | number }}</div>
            <div class="tc-label">Total Views</div>
          </div>
        </mat-card>
        <mat-card class="total-card">
          <mat-icon class="tc-icon teal">person_search</mat-icon>
          <div>
            <div class="tc-value">{{ overview?.totals?.uniqueViews ?? 0 | number }}</div>
            <div class="tc-label">Unique Viewers</div>
          </div>
        </mat-card>
        <mat-card class="total-card">
          <mat-icon class="tc-icon gold">play_circle</mat-icon>
          <div>
            <div class="tc-value">{{ overview?.totals?.adsRun?.total ?? 0 | number }}</div>
            <div class="tc-label">Ads Run</div>
          </div>
        </mat-card>
      </div>

      <!-- Chart scope: pick a content to focus the day-wise charts -->
      <div class="scope-row" *ngIf="!loading && rows.length > 0">
        <mat-icon class="scope-icon">filter_list</mat-icon>
        <label class="scope-label" for="contentScope">Charts for</label>
        <select id="contentScope" class="scope-select" [(ngModel)]="selectedContentId" (change)="onScopeChange()">
          <option [ngValue]="null">All content</option>
          <option *ngFor="let r of rows" [ngValue]="r.id">{{ r.title }}</option>
        </select>
      </div>

      <!-- Charts -->
      <div class="charts-row" *ngIf="!loading">
        <mat-card class="chart-card">
          <mat-card-header>
            <div class="chart-title-row">
              <mat-icon>show_chart</mat-icon>
              <span>{{ scopeName() }} — views, last 30 days</span>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-body">
            <div class="chart-wrapper" *ngIf="overview?.viewsDataAvailable; else noViews">
              <canvas #viewsChart></canvas>
            </div>
            <ng-template #noViews>
              <div class="no-data"><mat-icon>bar_chart</mat-icon><span>No view data available yet</span></div>
            </ng-template>
          </mat-card-content>
        </mat-card>

        <mat-card class="chart-card">
          <mat-card-header>
            <div class="chart-title-row">
              <mat-icon>insert_chart</mat-icon>
              <span>{{ scopeName() }} — ads run, last 30 days</span>
            </div>
            <div class="legend-row" *ngIf="overview?.adsAvailable">
              <span class="legend pre">Pre-roll</span>
              <span class="legend mid">Mid-roll</span>
              <span class="legend post">Post-roll</span>
            </div>
          </mat-card-header>
          <mat-card-content class="chart-body">
            <div class="chart-wrapper" *ngIf="overview?.adsAvailable; else noAds">
              <canvas #adsChart></canvas>
            </div>
            <ng-template #noAds>
              <div class="no-data"><mat-icon>videocam_off</mat-icon><span>No ads have run on your content yet</span></div>
            </ng-template>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Content table -->
      <mat-card class="table-card" *ngIf="!loading">
        <mat-card-header>
          <div class="chart-title-row">
            <mat-icon>library_movies</mat-icon>
            <span>Your content</span>
          </div>
        </mat-card-header>
        <mat-card-content>
          <div class="table-scroll" *ngIf="rows.length > 0; else noContent">
            <table mat-table [dataSource]="rows" class="content-table">
              <ng-container matColumnDef="title">
                <th mat-header-cell *matHeaderCellDef>Content</th>
                <td mat-cell *matCellDef="let row">
                  <div class="title-cell">
                    <span class="c-title">{{ row.title }}</span>
                    <span class="c-type">{{ row.contentType }}</span>
                  </div>
                </td>
              </ng-container>
              <ng-container matColumnDef="totalViews">
                <th mat-header-cell *matHeaderCellDef class="num">Total Views</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.totalViews | number }}</td>
              </ng-container>
              <ng-container matColumnDef="uniqueViews">
                <th mat-header-cell *matHeaderCellDef class="num">Unique Views</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.uniqueViews | number }}</td>
              </ng-container>
              <ng-container matColumnDef="pre">
                <th mat-header-cell *matHeaderCellDef class="num">Pre-roll</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.adsRun.preRoll | number }}</td>
              </ng-container>
              <ng-container matColumnDef="mid">
                <th mat-header-cell *matHeaderCellDef class="num">Mid-roll</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.adsRun.midRoll | number }}</td>
              </ng-container>
              <ng-container matColumnDef="post">
                <th mat-header-cell *matHeaderCellDef class="num">Post-roll</th>
                <td mat-cell *matCellDef="let row" class="num">{{ row.adsRun.postRoll | number }}</td>
              </ng-container>
              <ng-container matColumnDef="total">
                <th mat-header-cell *matHeaderCellDef class="num">Ads Run</th>
                <td mat-cell *matCellDef="let row" class="num strong">{{ row.adsRun.total | number }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
          <ng-template #noContent>
            <div class="no-data">
              <mat-icon>movie_filter</mat-icon>
              <span>No content available — your published titles will appear here</span>
            </div>
          </ng-template>
        </mat-card-content>
      </mat-card>

      <!-- Loading -->
      <div class="loading-state" *ngIf="loading">
        <div class="spinner"></div>
        <span>Loading content analytics…</span>
      </div>
    </div>
  `,
  styles: [`
    .dash-wrap { max-width: 1400px; margin: 0 auto; }
    .dash-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
    .dash-title { margin: 0; font-size: 22px; font-weight: 800; color: #fff; }
    .dash-sub { margin: 4px 0 0; font-size: 13px; color: #9aa0b4; }
    .header-actions { display: flex; align-items: center; gap: 10px; }
    .live-chip {
      display: inline-flex; align-items: center; gap: 6px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.4px;
      color: #9aa0b4; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 4px 10px;
    }
    .live-chip .dot { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }
    .live-chip.live-ok .dot { background: #22c55e; }
    .live-chip.live-ok { color: #86efac; }
    .live-chip.live-now { color: #86efac; border-color: rgba(34, 197, 94, 0.45); }
    .live-chip.live-now .dot { background: #22c55e; animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
      50% { box-shadow: 0 0 0 5px rgba(34, 197, 94, 0); }
    }

    .totals-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .scope-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 14px; padding: 10px 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
    }
    .scope-icon { font-size: 18px; width: 18px; height: 18px; color: #9aa0b4; }
    .scope-label { font-size: 12px; font-weight: 700; letter-spacing: 0.4px; color: #9aa0b4; text-transform: uppercase; }
    .scope-select {
      background: #1a1c25; color: #ffffff;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 8px;
      padding: 6px 10px; font-size: 13px; font-weight: 600;
      min-width: 220px; outline: none; cursor: pointer;
    }
    .scope-select:focus { border-color: rgba(171, 71, 188, 0.6); }
    .total-card {
      flex-direction: row; align-items: center; gap: 14px; padding: 16px 18px !important;
      background: #1a1a24; border: 1px solid #2a2a38; border-radius: 14px; color: #fff;
    }
    .tc-icon { font-size: 30px; width: 30px; height: 30px; }
    .tc-icon.purple { color: #a78bfa; } .tc-icon.blue { color: #60a5fa; }
    .tc-icon.teal { color: #2dd4bf; } .tc-icon.gold { color: #fbbf24; }
    .tc-value { font-size: 22px; font-weight: 800; line-height: 1.1; }
    .tc-label { font-size: 11px; font-weight: 600; color: #9aa0b4; letter-spacing: 0.4px; margin-top: 2px; }

    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .chart-card, .table-card { background: #1a1a24; border: 1px solid #2a2a38; border-radius: 14px; color: #fff; }
    .chart-title-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #fff; }
    .chart-title-row mat-icon { color: #3498db; font-size: 20px; width: 20px; height: 20px; }
    .legend-row { display: flex; gap: 10px; margin-top: 6px; font-size: 11px; font-weight: 600; }
    .legend::before { content: '■'; margin-right: 4px; }
    .legend.pre { color: #60a5fa; } .legend.mid { color: #fbbf24; } .legend.post { color: #2dd4bf; }
    .chart-body { padding: 12px 16px 16px; }
    .chart-wrapper { position: relative; height: 260px; }

    .no-data {
      height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 10px; color: #6b7186; font-size: 13px; font-weight: 600;
    }
    .no-data mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.5; }

    .table-scroll { overflow-x: auto; }
    .content-table { width: 100%; background: transparent; }
    .content-table th { color: #9aa0b4; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }
    .content-table td { color: #e6e8f0; font-size: 13px; border-bottom-color: #2a2a38; }
    .content-table .num { text-align: right; }
    .content-table .strong { font-weight: 800; color: #fff; }
    .title-cell { display: flex; flex-direction: column; }
    .c-title { font-weight: 700; color: #fff; }
    .c-type { font-size: 11px; color: #6b7186; }

    .loading-state {
      display: flex; flex-direction: column; align-items: center; gap: 14px;
      padding: 80px 0; color: #9aa0b4; font-size: 13px; font-weight: 600;
    }
    .spinner {
      width: 34px; height: 34px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.15); border-top-color: #3498db;
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 960px) {
      .charts-row { grid-template-columns: 1fr; }
    }
  `],
})
export class ProducerContentDashboardPage implements OnInit, OnDestroy {
  @ViewChild('viewsChart') viewsChartEl?: ElementRef<HTMLCanvasElement>;
  @ViewChild('adsChart') adsChartEl?: ElementRef<HTMLCanvasElement>;

  private readonly api = inject(ProducerApiService);
  private readonly authStore = inject(AuthStore);

  overview: ContentOverviewResponse | null = null;
  rows: ContentOverviewResponse['contents'] = [];
  displayedColumns = ['title', 'totalViews', 'uniqueViews', 'pre', 'mid', 'post', 'total'];
  loading = true;
  /** Chart scope: null = all content; a content id = that title's day-wise series. */
  selectedContentId: number | null = null;
  private viewsChart?: Chart;
  private adsChart?: Chart;
  private lastLoadAt = 0;
  private refreshTimer?: ReturnType<typeof setInterval>;

  /** Name shown in the chart titles for the current chart scope. */
  scopeName(): string {
    if (this.selectedContentId == null) return 'All content';
    const row = this.rows.find((r) => String(r.id) === String(this.selectedContentId));
    return row?.title || 'Selected content';
  }

  onScopeChange(): void {
    // Bypass the debounce so switching content re-queries immediately.
    this.lastLoadAt = 0;
    this.load(true);
  }

  ngOnInit(): void {
    this.load();
    // Live dashboard: silent refresh every 30s (no spinner/chart flicker).
    this.refreshTimer = setInterval(() => this.load(true), 30_000);
  }

  ngOnDestroy(): void {
    this.viewsChart?.destroy();
    this.adsChart?.destroy();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  load(silent = false): void {
    // Debounce: navigation effect may fire this repeatedly.
    if (Date.now() - this.lastLoadAt < 800) return;
    this.lastLoadAt = Date.now();
    // Spinner only on the very first load — refreshes stay invisible.
    if (!silent && !this.overview) this.loading = true;
    this.api.getContentOverviewAnalytics(this.selectedContentId ?? undefined).subscribe({
      next: (res) => {
        this.overview = (res?.data ?? null) as ContentOverviewResponse | null;
        this.rows = this.overview?.contents ?? [];
        this.loading = false;
        // Let the DOM render canvases before drawing (first load only).
        setTimeout(() => this.renderCharts(), silent ? 0 : 60);
      },
      error: () => {
        if (!silent) {
          this.overview = null;
          this.rows = [];
          this.loading = false;
        }
      },
    });
  }

  private renderCharts(): void {
    if (!this.overview) return;
    const gridColor = 'rgba(255,255,255,0.07)';
    const tickColor = '#9aa0b4';

    // Day-wise views (line)
    if (this.viewsChartEl?.nativeElement && this.overview.viewsDataAvailable) {
      const labels = this.overview.dailyViews.map((d) => d.day.substring(5));
      const values = this.overview.dailyViews.map((d) => d.views);
      if (this.viewsChart) {
        // Update in place — avoids animation restart on the 30s refresh.
        this.viewsChart.data.labels = labels;
        (this.viewsChart.data.datasets[0].data as number[]) = values;
        this.viewsChart.update('none');
      } else {
        this.viewsChart = new Chart(this.viewsChartEl.nativeElement, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Views',
              data: values,
              borderColor: '#60a5fa',
              backgroundColor: 'rgba(96,165,250,0.15)',
              fill: true,
              tension: 0.35,
              pointRadius: 2,
              borderWidth: 2,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { ticks: { color: tickColor, maxTicksLimit: 10 }, grid: { color: gridColor } },
              y: { beginAtZero: true, ticks: { color: tickColor, precision: 0 }, grid: { color: gridColor } },
            },
          },
        });
      }
    }

    // Day-wise ads run by roll (stacked bars)
    if (this.adsChartEl?.nativeElement && this.overview.adsAvailable) {
      const labels = this.overview.dailyAds.map((d) => d.day.substring(5));
      const mk = (key: 'preRoll' | 'midRoll' | 'postRoll' | 'other') =>
        this.overview!.dailyAds.map((d) => d[key]);
      if (this.adsChart) {
        this.adsChart.data.labels = labels;
        const ds = this.adsChart.data.datasets;
        (ds[0].data as number[]) = mk('preRoll');
        (ds[1].data as number[]) = mk('midRoll');
        (ds[2].data as number[]) = mk('postRoll');
        (ds[3].data as number[]) = mk('other');
        this.adsChart.update('none');
      } else {
        this.adsChart = new Chart(this.adsChartEl.nativeElement, {
          type: 'bar',
          data: {
            labels,
            datasets: [
              { label: 'Pre-roll', data: mk('preRoll'), backgroundColor: 'rgba(96,165,250,0.8)', stack: 'ads' },
              { label: 'Mid-roll', data: mk('midRoll'), backgroundColor: 'rgba(251,191,36,0.8)', stack: 'ads' },
              { label: 'Post-roll', data: mk('postRoll'), backgroundColor: 'rgba(45,212,191,0.8)', stack: 'ads' },
              { label: 'Other', data: mk('other'), backgroundColor: 'rgba(154,160,180,0.6)', stack: 'ads' },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              x: { stacked: true, ticks: { color: tickColor, maxTicksLimit: 10 }, grid: { display: false } },
              y: { stacked: true, beginAtZero: true, ticks: { color: tickColor, precision: 0 }, grid: { color: gridColor } },
            },
          },
        });
      }
    }
  }
}
