import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { NotificationService } from '../../shared/services/notification.service';
import { RealtimeAnalyticsService } from '../../core/services/realtime-analytics.service';
import { environment } from '../../../environments/environment';

export interface ContentLeaderboardItem {
  title: string;
  contentType: 'MOVIE' | 'SERIES' | 'LIVE' | string;
  totalViews: number;
  uniqueViews: number;
  adsEligible: boolean;
  uniqueViewsNeeded: number;
  watchHours: number;
  totalRevenue: number;
}

export interface DeviceShareItem {
  platform: string;
  percentage: number;
  activeSessions: number;
}

export interface TrendPoint {
  label: string;
  revenue: number;
  users: number;
  watchHours: number;
  streams: number;
}

export interface DetailedAnalytics {
  totalUsers: number;
  activeSubscribers: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  weeklyActiveUsers?: number;
  monthlyRevenue: number;
  totalWatchHoursToday: number;
  avgCompletionRate: number;
  bufferRatioPercentage: number;
  totalContent: number;
  pendingApprovals: number;
  failedPayments: number;
  concurrentStreams?: number;
  totalViews?: number;
  uniqueViews24h?: number;
  watchEvents24h?: number;
  topContent: ContentLeaderboardItem[];
  deviceBreakdown: DeviceShareItem[];
  timeSeriesTrends?: Record<string, TrendPoint[]>;
  arpu?: number;
  arppu?: number;
  revenueAttribution?: any;
  subscriptionMetrics?: any;
  paymentMetrics?: any;
  funnelMetrics?: any;
  geoMetrics?: any;
  engagementMetrics?: any;
  contentEngagement?: any;
}

@Component({
  selector: 'app-analytics-dashboard-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, PermissionButtonComponent],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER & REPORT EXPORTS -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>bar_chart</mat-icon> BUSINESS INTELLIGENCE & PLATFORM TELEMETRY</span>
          <h1>Platform Insights, Performance & Revenue Analytics</h1>
          <p>DAU/MAU trends, watch time completion, device telemetry, top content leaderboards & financial reports</p>
        </div>
        <div class="action-buttons">
          <app-permission-button permission="REPORT_EXPORT" color="primary" icon="download" (buttonClick)="downloadReport('csv')">
            Export CSV Report
          </app-permission-button>
          <app-permission-button permission="REPORT_EXPORT" color="accent" icon="picture_as_pdf" (buttonClick)="downloadReport('pdf')">
            Export PDF Report
          </app-permission-button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KEY METRICS CARDS -->
      <div class="metrics-grid">
        <div class="metric-card cyan">
          <div class="card-icon"><mat-icon>sensors</mat-icon></div>
          <div>
            <span class="label">Live Active Streams</span>
            <h2>{{ (analytics?.concurrentStreams || 0) | number }}</h2>
            <span class="sub-growth green">
              <mat-icon>online_prediction</mat-icon>
              {{ liveConnected ? 'LIVE' : 'Polling' }} · {{ (analytics?.uniqueViews24h || 0) | number }} unique views / 24h
            </span>
          </div>
        </div>

        <div class="metric-card gold">
          <div class="card-icon"><mat-icon>monetization_on</mat-icon></div>
          <div>
            <span class="label">Monthly Recurring Revenue (MRR)</span>
            <h2>₹{{ (analytics?.monthlyRevenue || 0) | number:'1.2-2' }}</h2>
            <span class="sub-growth green"><mat-icon>trending_up</mat-icon> Active Subscriptions</span>
          </div>
        </div>

        <div class="metric-card blue">
          <div class="card-icon"><mat-icon>group</mat-icon></div>
          <div>
            <span class="label">Daily Active Users (DAU)</span>
            <h2>{{ (analytics?.dailyActiveUsers || 0) | number }}</h2>
            <span class="sub-growth green"><mat-icon>trending_up</mat-icon> Real-time Active</span>
          </div>
        </div>

        <div class="metric-card purple">
          <div class="card-icon"><mat-icon>schedule</mat-icon></div>
          <div>
            <span class="label">Total Play Hours Today</span>
            <h2>{{ (analytics?.totalWatchHoursToday || 0) | number }} Hrs</h2>
            <span class="sub-growth green"><mat-icon>verified</mat-icon> QoE Streaming Telemetry</span>
          </div>
        </div>

        <div class="metric-card green">
          <div class="card-icon"><mat-icon>check_circle</mat-icon></div>
          <div>
            <span class="label">Average Completion Rate</span>
            <h2>{{ analytics?.avgCompletionRate || 0 }}%</h2>
            <span class="sub-growth"><mat-icon>av_timer</mat-icon> Session Completion Ratio</span>
          </div>
        </div>
      </div>

      <!-- 3. TIMEFRAME FILTER BAR -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Time Period:</span>
          <button class="filter-pill" [class.active]="selectedTimeframe === '7d'" (click)="setTimeframe('7d')">Last 7 Days</button>
          <button class="filter-pill" [class.active]="selectedTimeframe === '30d'" (click)="setTimeframe('30d')">Last 30 Days</button>
          <button class="filter-pill" [class.active]="selectedTimeframe === '90d'" (click)="setTimeframe('90d')">Last 90 Days</button>
          <button class="filter-pill" [class.active]="selectedTimeframe === 'ytd'" (click)="setTimeframe('ytd')">Year to Date (YTD)</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">Platform Jurisdiction:</span>
          <button class="filter-pill active">Global (All Regions)</button>
        </div>
      </div>

      <!-- 4. VISUAL CHARTS & PLATFORM BREAKDOWN SECTION -->
      <div class="charts-row">
        <!-- REVENUE & SUBSCRIBER GROWTH CHART -->
        <div class="chart-card flex-2">
          <div class="chart-header">
            <div>
              <h3>Revenue & Engagement Trend</h3>
              <p>Revenue (₹), active users and watch hours for {{ getTimeframeLabel() }}</p>
            </div>
            <span class="live-pill"><span class="dot"></span> LIVE TELEMETRY</span>
          </div>

          <div class="svg-container">
            <svg viewBox="0 0 700 180" class="analytics-svg" *ngIf="chartPoints.length; else noChartData">
              <defs>
                <linearGradient id="maxxGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#1a4cd8" stop-opacity="0.9"/>
                  <stop offset="50%" stop-color="#c725a3" stop-opacity="0.9"/>
                  <stop offset="100%" stop-color="#ffab00" stop-opacity="0.9"/>
                </linearGradient>
                <linearGradient id="maxxGradientUsers" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#00d2ff" stop-opacity="0.8"/>
                  <stop offset="100%" stop-color="#00e676" stop-opacity="0.8"/>
                </linearGradient>
                <linearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#c725a3" stop-opacity="0.28"/>
                  <stop offset="100%" stop-color="#121124" stop-opacity="0.0"/>
                </linearGradient>
              </defs>

              <!-- Grid Lines -->
              <line x1="0" y1="40" x2="700" y2="40" stroke="#252538" stroke-dasharray="4"/>
              <line x1="0" y1="90" x2="700" y2="90" stroke="#252538" stroke-dasharray="4"/>
              <line x1="0" y1="140" x2="700" y2="140" stroke="#252538" stroke-dasharray="4"/>

              <!-- Filled Area (Revenue) -->
              <path [attr.d]="getAreaPath('revenue')" fill="url(#fillGradient)"/>

              <!-- Revenue Line -->
              <path [attr.d]="getLinePath('revenue')" fill="none" stroke="url(#maxxGradient)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- Users Line -->
              <path [attr.d]="getLinePath('users')" fill="none" stroke="url(#maxxGradientUsers)" stroke-width="2.5" stroke-dasharray="5,4" stroke-linecap="round" stroke-linejoin="round"/>

              <!-- Data Points -->
              <g *ngFor="let p of chartPoints; let i = index">
                <circle [attr.cx]="getChartX(i)" [attr.cy]="getChartY(p.revenue, 'revenue')" r="4.5" fill="#ffffff" stroke="#c725a3" stroke-width="2"></circle>
                <circle [attr.cx]="getChartX(i)" [attr.cy]="getChartY(p.users, 'users')" r="3.5" fill="#ffffff" stroke="#00d2ff" stroke-width="2"></circle>
              </g>
            </svg>
            <ng-template #noChartData>
              <div style="padding: 32px; text-align: center; color: #a0a0b0; font-size: 13px;">
                No trend data available for this timeframe yet.
              </div>
            </ng-template>

            <div class="chart-labels" *ngIf="chartPoints.length">
              <span *ngFor="let p of chartPoints">{{ p.label }}</span>
            </div>
            <div class="chart-legend-row" *ngIf="chartPoints.length">
              <span class="legend-item"><span class="legend-dot rev"></span> Revenue (₹)</span>
              <span class="legend-item"><span class="legend-dot users"></span> Active Users</span>
              <span class="legend-item muted">Watch hours and streams included in exports</span>
            </div>
          </div>
        </div>

        <!-- DEVICE & PLATFORM BREAKDOWN -->
        <div class="chart-card flex-1">
          <div class="chart-header">
            <div>
              <h3>Device & Platform Share</h3>
              <p>Active playback session distribution</p>
            </div>
          </div>

          <div class="device-progress-list">
            <div *ngIf="!analytics?.deviceBreakdown?.length" style="padding: 24px; text-align: center; color: #a0a0b0; font-size: 13px;">
              No device playback session telemetry recorded yet.
            </div>
            <div *ngFor="let d of analytics?.deviceBreakdown" class="device-item">
              <div class="dev-meta">
                <span class="dev-name"><mat-icon>tv</mat-icon> {{ d.platform }}</span>
                <span class="dev-pct">{{ d.percentage }}%</span>
              </div>
              <div class="bar-bg">
                <div class="bar-fill" [style.width.%]="d.percentage"></div>
              </div>
              <span class="dev-sub">{{ d.activeSessions | number }} Active Sessions</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 5. TOP PERFORMING CONTENT LEADERBOARD TABLE -->
      <div class="table-card">
        <div class="table-header-title">
          <mat-icon color="accent">leaderboard</mat-icon>
          <div>
            <h3>Top Performing Content Leaderboard</h3>
            <p>Highest engagement, watch hours & TVOD revenue per content title</p>
          </div>
        </div>

        <table class="custom-table">
          <thead>
            <tr>
              <th>Rank & Title</th>
              <th>Content Format</th>
              <th>Total Play Views</th>
              <th>Unique Viewers</th>
              <th>Watch Hours</th>
              <th>TVOD Revenue</th>
              <th>VAST Ads</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="!analytics?.topContent?.length">
              <td colspan="7" style="padding: 32px; text-align: center; color: #a0a0b0; font-size: 14px;">
                No top performing content recorded for this timeframe.
              </td>
            </tr>
            <tr *ngFor="let item of analytics?.topContent; let i = index">
              <td>
                <div class="content-rank-cell">
                  <span class="rank-badge" [class.gold-rank]="i === 0" [class.silver-rank]="i === 1" [class.bronze-rank]="i === 2">#{{ i + 1 }}</span>
                  <span class="title-text">{{ item.title }}</span>
                </div>
              </td>
              <td>
                <span class="format-chip" [class.series]="item.contentType === 'SERIES'">
                  <mat-icon>{{ item.contentType === 'SERIES' ? 'tv' : 'movie' }}</mat-icon>
                  {{ item.contentType }}
                </span>
              </td>
              <td>
                <span class="val-text">{{ item.totalViews | number }} Plays</span>
              </td>
              <td>
                <span class="val-text teal-text">{{ item.uniqueViews | number }}</span>
              </td>
              <td>
                <span class="val-text purple-text">{{ item.watchHours | number }} Hours</span>
              </td>
              <td>
                <span class="val-text gold-text">₹{{ item.totalRevenue | number:'1.2-2' }}</span>
              </td>
              <td>
                <span class="ad-elig-chip" [class.eligible]="item.adsEligible" [class.pending]="!item.adsEligible">
                  <mat-icon>{{ item.adsEligible ? 'check_circle' : 'hourglass_top' }}</mat-icon>
                  {{ item.adsEligible ? 'Ads Live' : (item.uniqueViewsNeeded | number) + ' more needed' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 6. METRICS DEPTH: MONETIZATION, SUBSCRIPTIONS, PAYMENTS, FUNNEL, GEO, ENGAGEMENT -->
      <div class="table-card" style="margin-top: 24px;">
        <div class="table-header-title">
          <mat-icon color="accent">insights</mat-icon>
          <div>
            <h3>Executive Metrics Depth (Hotstar/Aha/Netflix-style Admin Intelligence)</h3>
            <p>ARPU/ARPPU, WAU, revenue attribution, churn & plan mix, payment health, funnel, geo and engagement cohorts</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
          <div style="background:#101018;border:1px solid #28283a;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#a0a0b0;">WAU (7d)</div><div style="font-size:22px;font-weight:800;">{{ (analytics?.weeklyActiveUsers || 0) | number }}</div><div style="font-size:11px;color:#00d2ff;">MAU {{ (analytics?.monthlyActiveUsers || 0) | number }}</div></div>
          <div style="background:#101018;border:1px solid #28283a;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#a0a0b0;">ARPU</div><div style="font-size:22px;font-weight:800;">₹{{ (analytics?.arpu || 0) | number:'1.2-2' }}</div><div style="font-size:11px;color:#ffab00;">ARPPU ₹{{ (analytics?.arppu || 0) | number:'1.2-2' }}</div></div>
          <div style="background:#101018;border:1px solid #28283a;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#a0a0b0;">Churn Rate (Proxy)</div><div style="font-size:22px;font-weight:800;">{{ (analytics?.subscriptionMetrics?.churnRate || 0) | number:'1.1-1' }}%</div><div style="font-size:11px;color:#c725a3;">Cancelled {{ (analytics?.subscriptionMetrics?.cancelled || 0) | number }}</div></div>
          <div style="background:#101018;border:1px solid #28283a;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#a0a0b0;">Payment Success</div><div style="font-size:22px;font-weight:800;">{{ (analytics?.paymentMetrics?.successRate || 0) | number:'1.1-1' }}%</div><div style="font-size:11px;color:#00e676;">Collected ₹{{ (analytics?.paymentMetrics?.totalCollected || 0) | number:'1.0-0' }}</div></div>
          <div style="background:#101018;border:1px solid #28283a;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#a0a0b0;">Retention (30d)</div><div style="font-size:22px;font-weight:800;">{{ (analytics?.engagementMetrics?.retentionRate30d || 0) | number:'1.1-1' }}%</div><div style="font-size:11px;color:#00d2ff;">Returning {{ (analytics?.engagementMetrics?.returningUsers30d || 0) | number }}</div></div>
          <div style="background:#101018;border:1px solid #28283a;border-radius:10px;padding:12px;"><div style="font-size:11px;color:#a0a0b0;">Signup → Paid</div><div style="font-size:22px;font-weight:800;">{{ (analytics?.funnelMetrics?.signupToPaidRate || 0) | number:'1.1-1' }}%</div><div style="font-size:11px;color:#00e676;">Paying {{ (analytics?.funnelMetrics?.payingUsers || 0) | number }}</div></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
          <div style="background:#101018;border:1px solid #28283a;border-radius:12px;padding:14px;">
            <h4 style="margin:0 0 10px;font-size:14px;">Revenue Attribution</h4>
            <table class="custom-table"><tbody>
              <tr><td>SVOD (Monthly)</td><td class="val-text gold-text">₹{{ (analytics?.revenueAttribution?.monthly?.svod || 0) | number:'1.2-2' }}</td></tr>
              <tr><td>TVOD (Monthly)</td><td class="val-text">₹{{ (analytics?.revenueAttribution?.monthly?.tvod || 0) | number:'1.2-2' }}</td></tr>
              <tr><td>Ads (Monthly)</td><td class="val-text">₹{{ (analytics?.revenueAttribution?.monthly?.ads || 0) | number:'1.2-2' }}</td></tr>
              <tr><td><strong>Total (Monthly)</strong></td><td class="val-text teal-text"><strong>₹{{ (analytics?.revenueAttribution?.monthly?.total || 0) | number:'1.2-2' }}</strong></td></tr>
            </tbody></table>
            <div style="font-size:11px;color:#a0a0b0;margin-top:8px;">Lifetime: SVOD ₹{{ (analytics?.revenueAttribution?.lifetime?.svod || 0) | number:'1.0-0' }} • TVOD ₹{{ (analytics?.revenueAttribution?.lifetime?.tvod || 0) | number:'1.0-0' }} • Ads ₹{{ (analytics?.revenueAttribution?.lifetime?.ads || 0) | number:'1.0-0' }}</div>
          </div>

          <div style="background:#101018;border:1px solid #28283a;border-radius:12px;padding:14px;">
            <h4 style="margin:0 0 10px;font-size:14px;">Subscriptions & Funnel</h4>
            <table class="custom-table"><tbody>
              <tr><td>Active / Expired / Cancelled</td><td>{{ (analytics?.subscriptionMetrics?.active || 0) }} / {{ (analytics?.subscriptionMetrics?.expired || 0) }} / {{ (analytics?.subscriptionMetrics?.cancelled || 0) }}</td></tr>
              <tr><td>New / Renewals (Month)</td><td>{{ (analytics?.subscriptionMetrics?.newThisMonth || 0) }} / {{ (analytics?.subscriptionMetrics?.renewalsThisMonth || 0) }}</td></tr>
              <tr><td>Engaged Users (7d)</td><td>{{ (analytics?.funnelMetrics?.engagedUsers7d || 0) | number }}</td></tr>
              <tr><td>Signup → Active Rate</td><td>{{ (analytics?.funnelMetrics?.signupToActiveRate || 0) | number:'1.1-1' }}%</td></tr>
              <tr><td>Signup → Paid Rate</td><td>{{ (analytics?.funnelMetrics?.signupToPaidRate || 0) | number:'1.1-1' }}%</td></tr>
            </tbody></table>
            <div *ngIf="analytics?.subscriptionMetrics?.planMix?.length" style="margin-top:8px;font-size:12px;">
              <div style="color:#a0a0b0;margin-bottom:4px;">Top Plan Mix</div>
              <div *ngFor="let p of analytics?.subscriptionMetrics?.planMix | slice:0:4" style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid #202030;"><span>{{ $any(p).planName || ('Plan #' + $any(p).planId) }}</span><span style="color:#00e676;font-weight:700;">{{ $any(p).activeSubscribers || 0 }} active</span></div>
            </div>
          </div>

          <div style="background:#101018;border:1px solid #28283a;border-radius:12px;padding:14px;">
            <h4 style="margin:0 0 10px;font-size:14px;">Payments, Refunds & Failures</h4>
            <table class="custom-table"><tbody>
              <tr><td>Success / Failed / Pending</td><td>{{ (analytics?.paymentMetrics?.success || 0) }} / {{ (analytics?.paymentMetrics?.failed || 0) }} / {{ (analytics?.paymentMetrics?.pending || 0) }}</td></tr>
              <tr><td>Refunded Transactions</td><td>{{ (analytics?.paymentMetrics?.refunded || 0) }}</td></tr>
              <tr><td>Refund Amount</td><td>₹{{ (analytics?.paymentMetrics?.refundAmount || 0) | number:'1.2-2' }}</td></tr>
              <tr><td>Total Collected</td><td>₹{{ (analytics?.paymentMetrics?.totalCollected || 0) | number:'1.2-2' }}</td></tr>
            </tbody></table>
            <div *ngIf="analytics?.paymentMetrics?.failureReasons?.length" style="margin-top:8px;font-size:12px;">
              <div style="color:#a0a0b0;margin-bottom:4px;">Top Failure Reasons</div>
              <div *ngFor="let f of analytics?.paymentMetrics?.failureReasons | slice:0:5" style="display:flex;justify-content:space-between;padding:3px 0;border-top:1px solid #202030;"><span style="max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ $any(f).reason }}</span><span style="color:#ffab00;font-weight:700;">{{ $any(f).count }}</span></div>
            </div>
          </div>

          <div style="background:#101018;border:1px solid #28283a;border-radius:12px;padding:14px;">
            <h4 style="margin:0 0 10px;font-size:14px;">Geo, Engagement & Content Cohorts</h4>
            <div style="font-size:12px;color:#a0a0b0;margin-bottom:8px;">Avg session {{ (analytics?.engagementMetrics?.avgSessionDurationMinutes || 0) | number:'1.1-1' }} min • Buffer ratio {{ (analytics?.engagementMetrics?.bufferRatioPercentage || 0) | number:'1.1-1' }}%</div>
            <div *ngIf="analytics?.geoMetrics?.topMarkets?.length" style="margin-bottom:10px;">
              <div style="color:#a0a0b0;font-size:12px;margin-bottom:4px;">Top Markets</div>
              <div *ngFor="let m of analytics?.geoMetrics?.topMarkets | slice:0:5" style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid #202030;"><span>{{ $any(m).market || 'UNKNOWN' }}</span><span style="color:#00d2ff;font-weight:700;">{{ $any(m).eventsOrUsers | number }}</span></div>
            </div>
            <div *ngIf="analytics?.contentEngagement?.byContentType?.length">
              <div style="color:#a0a0b0;font-size:12px;margin-bottom:4px;">Engagement by Content Type</div>
              <div *ngFor="let c of analytics?.contentEngagement?.byContentType | slice:0:5" style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid #202030;"><span>{{ $any(c).contentType }}</span><span style="color:#ffab00;font-weight:700;">{{ $any(c).views | number }} views / {{ $any(c).watchHours | number }}h</span></div>
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

      .action-buttons { display: flex; gap: 10px; }
    }

    /* KEY METRICS CARDS */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 14px;

      .card-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        background: #202030;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
      }

      .label { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 2px; }
      h2 { font-size: 24px; font-weight: 800; margin: 0 0 4px; color: #ffffff; }

      .sub-growth {
        font-size: 11px;
        font-weight: 700;
        color: #a0a0b0;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
        &.green { color: #00e676; }
      }

      &.gold .card-icon { color: #ffab00; }
      &.blue .card-icon { color: #00d2ff; }
      &.cyan .card-icon { color: #00d2ff; }
      &.purple .card-icon { color: #ab47bc; }
      &.green .card-icon { color: #00e676; }
    }

    /* FILTER BAR */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 24px;
      flex-wrap: wrap;

      .filter-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;

        .filter-label { font-size: 12px; font-weight: 700; color: #a0a0b0; margin-right: 2px; }
        .filter-pill {
          background: #101018;
          border: 1px solid #28283a;
          color: #ffffff;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover, &.active { background: #e50914; border-color: #e50914; color: #ffffff; }
        }
      }
    }

    /* CHARTS ROW */
    .charts-row {
      display: flex;
      gap: 20px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }

    .chart-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      &.flex-2 { flex: 2; min-width: 320px; }
      &.flex-1 { flex: 1; min-width: 260px; }

      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;

        h3 { margin: 0 0 2px; font-size: 16px; font-weight: 800; color: #ffffff; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 230, 118, 0.15);
          color: #00e676;
          border: 1px solid #00e676;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 4px;

          .dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #00e676;
            animation: pulse 1.5s infinite;
          }
        }
      }

      .svg-container {
        position: relative;
        .analytics-svg { width: 100%; height: auto; display: block; }
        .chart-labels {
          display: flex;
          justify-content: space-between;
          gap: 6px;
          font-size: 11px;
          color: #a0a0b0;
          margin-top: 8px;
          span { flex: 1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        }
        .chart-legend-row {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 10px;
          font-size: 11px;
          color: #a0a0b0;
          .legend-item { display: inline-flex; align-items: center; gap: 6px; }
          .legend-item.muted { color: #7f889c; }
          .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
          .legend-dot.rev { background: linear-gradient(90deg, #1a4cd8, #ffab00); }
          .legend-dot.users { background: linear-gradient(90deg, #00d2ff, #00e676); }
        }
      }

      .device-progress-list {
        display: flex;
        flex-direction: column;
        gap: 14px;

        .device-item {
          .dev-meta {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            margin-bottom: 4px;
            .dev-name { font-weight: 700; display: flex; align-items: center; gap: 6px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #00d2ff; } }
            .dev-pct { font-weight: 800; color: #ffab00; }
          }

          .bar-bg {
            background: #101018;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid #28283a;

            .bar-fill {
              height: 100%;
              background: linear-gradient(90deg, #1a4cd8, #c725a3, #ffab00);
              border-radius: 4px;
            }
          }

          .dev-sub { font-size: 10px; color: #a0a0b0; margin-top: 2px; display: block; }
        }
      }
    }

    /* LEADERBOARD TABLE */
    .table-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 16px;
      padding: 20px;

      .table-header-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        h3 { margin: 0 0 2px; font-size: 16px; font-weight: 800; }
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
          padding: 12px 14px;
          border-bottom: 1px solid #28283a;
        }

        td {
          padding: 12px 14px;
          border-bottom: 1px solid #202030;
          font-size: 13px;
        }
      }
    }

    .content-rank-cell {
      display: flex;
      align-items: center;
      gap: 10px;

      .rank-badge {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        background: #202030;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 11px;
        color: #ffffff;

        &.gold-rank { background: rgba(255, 171, 0, 0.2); color: #ffab00; border: 1px solid #ffab00; }
        &.silver-rank { background: rgba(0, 210, 255, 0.2); color: #00d2ff; border: 1px solid #00d2ff; }
        &.bronze-rank { background: rgba(171, 71, 188, 0.2); color: #ab47bc; border: 1px solid #ab47bc; }
      }

      .title-text { font-weight: 700; color: #ffffff; }
    }

    .format-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #101018;
      border: 1px solid #28283a;
      color: #00d2ff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.series { border-color: #ab47bc; color: #ab47bc; }
    }

    .val-text { font-weight: 700; color: #ffffff; }
    .purple-text { color: #ab47bc; }
    .gold-text { color: #ffab00; }
    .teal-text { color: #2dd4bf; }
    .ad-elig-chip {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
      border-radius: 12px; padding: 3px 9px; white-space: nowrap;
    }
    .ad-elig-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .ad-elig-chip.eligible { color: #86efac; background: rgba(34, 197, 94, 0.12); }
    .ad-elig-chip.pending { color: #fbbf24; background: rgba(251, 191, 36, 0.12); }

    .perf-bar-box {
      display: flex;
      align-items: center;
      gap: 8px;

      .perf-bar {
        height: 6px;
        background: linear-gradient(90deg, #1a4cd8, #00e676);
        border-radius: 3px;
        min-width: 60px;
      }
      .perf-pct { font-size: 11px; font-weight: 700; color: #a0a0b0; }
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(1.2); }
      100% { opacity: 1; transform: scale(1); }
    }
  `]
})
export class AnalyticsDashboardPage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly realtimeAnalytics = inject(RealtimeAnalyticsService);

  private refreshTimer: any;

  analytics: DetailedAnalytics | null = {
    totalUsers: 0,
    activeSubscribers: 0,
    dailyActiveUsers: 0,
    monthlyActiveUsers: 0,
    weeklyActiveUsers: 0,
    monthlyRevenue: 0.0,
    totalWatchHoursToday: 0.0,
    avgCompletionRate: 0,
    bufferRatioPercentage: 0.0,
    totalContent: 0,
    pendingApprovals: 0,
    failedPayments: 0,
    concurrentStreams: 0,
    totalViews: 0,
    uniqueViews24h: 0,
    watchEvents24h: 0,
    topContent: [],
    deviceBreakdown: [],
    timeSeriesTrends: {},
    arpu: 0,
    arppu: 0,
    revenueAttribution: { monthly: { svod: 0, tvod: 0, ads: 0, total: 0 }, lifetime: { svod: 0, tvod: 0, ads: 0 } },
    subscriptionMetrics: { active: 0, expired: 0, cancelled: 0, trial: 0, newThisMonth: 0, renewalsThisMonth: 0, churnRate: 0, planMix: [] },
    paymentMetrics: { success: 0, failed: 0, refunded: 0, pending: 0, successRate: 0, totalCollected: 0, refundAmount: 0, failureReasons: [] },
    funnelMetrics: { registeredUsers: 0, engagedUsers7d: 0, activeUsers30d: 0, payingUsers: 0, activeSubscribers: 0, signupToActiveRate: 0, signupToPaidRate: 0 },
    geoMetrics: { topMarkets: [] },
    engagementMetrics: { avgSessionDurationMinutes: 0, avgCompletionRate: 0, returningUsers30d: 0, retentionRate30d: 0, bufferRatioPercentage: 0 },
    contentEngagement: { byContentType: [], topEngagedTitles: [] }
  };
  selectedTimeframe = '30d';
  loading = false;
  liveConnected = false;
  private disconnectLiveAnalytics?: () => void;

  ngOnInit(): void {
    this.loadAnalytics();
    this.disconnectLiveAnalytics = this.realtimeAnalytics.connect(
      (counters) => {
        this.analytics = {
          ...(this.analytics || ({} as DetailedAnalytics)),
          totalViews: counters.totalViews,
          uniqueViews24h: counters.uniqueViews24h,
          watchEvents24h: counters.watchEvents24h,
          concurrentStreams: counters.activeStreams,
        };
      },
      (connected) => {
        this.liveConnected = connected;
      },
    );
    // Polling remains as a fallback if SSE is unavailable or the stream drops.
    this.refreshTimer = setInterval(() => {
      this.loadAnalytics();
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.disconnectLiveAnalytics?.();
  }

  loadAnalytics(): void {
    this.loading = true;
    this.http
      .get<any>(`${environment.apiBaseUrl}/admin/analytics?timeframe=${this.selectedTimeframe}`)
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success && res.data) {
            this.analytics = {
              ...(this.analytics || ({} as DetailedAnalytics)),
              ...res.data,
              topContent: res.data.topContent || [],
              deviceBreakdown: res.data.deviceBreakdown || [],
              timeSeriesTrends: res.data.timeSeriesTrends || res.data.time_series_trends || {},
              revenueAttribution: res.data.revenueAttribution || res.data.revenue_attribution || this.analytics?.revenueAttribution,
              subscriptionMetrics: res.data.subscriptionMetrics || res.data.subscription_metrics || this.analytics?.subscriptionMetrics,
              paymentMetrics: res.data.paymentMetrics || res.data.payment_metrics || this.analytics?.paymentMetrics,
              funnelMetrics: res.data.funnelMetrics || res.data.funnel_metrics || this.analytics?.funnelMetrics,
              geoMetrics: res.data.geoMetrics || res.data.geo_metrics || this.analytics?.geoMetrics,
              engagementMetrics: res.data.engagementMetrics || res.data.engagement_metrics || this.analytics?.engagementMetrics,
              contentEngagement: res.data.contentEngagement || res.data.content_engagement || this.analytics?.contentEngagement,
            };
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  setTimeframe(tf: string): void {
    this.selectedTimeframe = tf;
    this.loadAnalytics();
  }

  get chartTrendKey(): string {
    if (this.selectedTimeframe === 'ytd') return '12m';
    return this.selectedTimeframe;
  }

  get chartPoints(): TrendPoint[] {
    const trends = this.analytics?.timeSeriesTrends || {};
    const points = trends[this.chartTrendKey] || trends['30d'] || trends['7d'] || [];
    return Array.isArray(points) ? points : [];
  }

  getChartX(index: number): number {
    const n = this.chartPoints.length;
    if (n <= 1) return 350;
    const left = 20;
    const right = 680;
    return left + (index * (right - left)) / (n - 1);
  }

  getChartY(value: number, metric: 'revenue' | 'users'): number {
    const vals = this.chartPoints.map((p) => Number(metric === 'revenue' ? p.revenue : p.users) || 0);
    const max = Math.max(1, ...vals);
    const top = 30;
    const bottom = 150;
    const ratio = Math.min(1, Math.max(0, (Number(value) || 0) / max));
    return bottom - ratio * (bottom - top);
  }

  getLinePath(metric: 'revenue' | 'users'): string {
    const pts = this.chartPoints;
    if (!pts.length) return '';
    return pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${this.getChartX(i).toFixed(1)},${this.getChartY(metric === 'revenue' ? p.revenue : p.users, metric).toFixed(1)}`)
      .join(' ');
  }

  getAreaPath(metric: 'revenue' | 'users'): string {
    const pts = this.chartPoints;
    if (!pts.length) return '';
    const line = pts
      .map((p, i) => `${i === 0 ? 'L' : 'L'}${this.getChartX(i).toFixed(1)},${this.getChartY(metric === 'revenue' ? p.revenue : p.users, metric).toFixed(1)}`)
      .join(' ');
    const firstX = this.getChartX(0).toFixed(1);
    const lastX = this.getChartX(pts.length - 1).toFixed(1);
    return `M${firstX},160 ${line.replace(/^L/, 'L')} L${lastX},160 Z`;
  }

  getTimeframeLabel(): string {
    switch (this.selectedTimeframe) {
      case '7d':
        return 'last 7 days';
      case '30d':
        return 'last 30 days';
      case '90d':
        return 'last 90 days';
      case 'ytd':
        return 'year to date';
      default:
        return this.selectedTimeframe;
    }
  }

  downloadReport(format: string): void {
    if (!this.analytics) {
      this.notificationService.info('No analytics data available to export yet.');
      return;
    }

    if (format === 'csv') {
      const csv = this.buildCsvReport();
      this.downloadBlob(csv, `maxxpixels-analytics-${this.selectedTimeframe}-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
      this.notificationService.success('CSV analytics report downloaded.');
      return;
    }

    if (format === 'pdf') {
      this.openPrintableReport();
      this.notificationService.success('Printable analytics report opened. Use your browser to save as PDF.');
      return;
    }

    this.notificationService.info(`Unsupported export format: ${format}`);
  }

  private buildCsvReport(): string {
    const a = this.analytics!;
    const rows: string[][] = [];
    const push = (section: string, metric: string, value: string | number) => rows.push([section, metric, String(value ?? '')]);

    push('Summary', 'Timeframe', this.getTimeframeLabel());
    push('Summary', 'Total Users', a.totalUsers || 0);
    push('Summary', 'Active Subscribers', a.activeSubscribers || 0);
    push('Summary', 'Daily Active Users', a.dailyActiveUsers || 0);
    push('Summary', 'Weekly Active Users', a.weeklyActiveUsers || 0);
    push('Summary', 'Monthly Active Users', a.monthlyActiveUsers || 0);
    push('Summary', 'Monthly Revenue (INR)', a.monthlyRevenue || 0);
    push('Summary', 'ARPU (INR)', a.arpu || 0);
    push('Summary', 'ARPPU (INR)', a.arppu || 0);
    push('Summary', 'Total Watch Hours Today', a.totalWatchHoursToday || 0);
    push('Summary', 'Average Completion Rate (%)', a.avgCompletionRate || 0);
    push('Summary', 'Buffer Ratio (%)', a.bufferRatioPercentage || 0);
    push('Summary', 'Concurrent Streams', a.concurrentStreams || 0);
    push('Summary', 'Pending Approvals', a.pendingApprovals || 0);
    push('Summary', 'Failed Payments', a.failedPayments || 0);

    push('RevenueAttributionMonthly', 'SVOD', a.revenueAttribution?.monthly?.svod || 0);
    push('RevenueAttributionMonthly', 'TVOD', a.revenueAttribution?.monthly?.tvod || 0);
    push('RevenueAttributionMonthly', 'Ads', a.revenueAttribution?.monthly?.ads || 0);
    push('RevenueAttributionMonthly', 'Total', a.revenueAttribution?.monthly?.total || 0);

    push('Subscriptions', 'Active', a.subscriptionMetrics?.active || 0);
    push('Subscriptions', 'Expired', a.subscriptionMetrics?.expired || 0);
    push('Subscriptions', 'Cancelled', a.subscriptionMetrics?.cancelled || 0);
    push('Subscriptions', 'Trial', a.subscriptionMetrics?.trial || 0);
    push('Subscriptions', 'NewThisMonth', a.subscriptionMetrics?.newThisMonth || 0);
    push('Subscriptions', 'RenewalsThisMonth', a.subscriptionMetrics?.renewalsThisMonth || 0);
    push('Subscriptions', 'ChurnRate(%)', a.subscriptionMetrics?.churnRate || 0);

    push('Payments', 'Success', a.paymentMetrics?.success || 0);
    push('Payments', 'Failed', a.paymentMetrics?.failed || 0);
    push('Payments', 'Refunded', a.paymentMetrics?.refunded || 0);
    push('Payments', 'Pending', a.paymentMetrics?.pending || 0);
    push('Payments', 'SuccessRate(%)', a.paymentMetrics?.successRate || 0);
    push('Payments', 'TotalCollected', a.paymentMetrics?.totalCollected || 0);
    push('Payments', 'RefundAmount', a.paymentMetrics?.refundAmount || 0);

    push('Funnel', 'RegisteredUsers', a.funnelMetrics?.registeredUsers || 0);
    push('Funnel', 'EngagedUsers7d', a.funnelMetrics?.engagedUsers7d || 0);
    push('Funnel', 'ActiveUsers30d', a.funnelMetrics?.activeUsers30d || 0);
    push('Funnel', 'PayingUsers', a.funnelMetrics?.payingUsers || 0);
    push('Funnel', 'ActiveSubscribers', a.funnelMetrics?.activeSubscribers || 0);
    push('Funnel', 'SignupToActiveRate(%)', a.funnelMetrics?.signupToActiveRate || 0);
    push('Funnel', 'SignupToPaidRate(%)', a.funnelMetrics?.signupToPaidRate || 0);

    push('Engagement', 'AvgSessionDurationMinutes', a.engagementMetrics?.avgSessionDurationMinutes || 0);
    push('Engagement', 'RetentionRate30d(%)', a.engagementMetrics?.retentionRate30d || 0);
    push('Engagement', 'ReturningUsers30d', a.engagementMetrics?.returningUsers30d || 0);

    rows.push([]);
    rows.push(['Trend', 'Label', 'Revenue', 'Users', 'WatchHours', 'Streams']);
    for (const p of this.chartPoints) {
      rows.push(['Trend', p.label, String(p.revenue ?? 0), String(p.users ?? 0), String(p.watchHours ?? 0), String(p.streams ?? 0)]);
    }

    rows.push([]);
    rows.push(['RevenuePlanMix', 'PlanName', 'BillingPeriod', 'ActiveSubscribers', 'TotalSubscribers', 'MonthlyRevenue']);
    for (const p of (a.subscriptionMetrics?.planMix || [])) {
      rows.push(['RevenuePlanMix', p.planName || `Plan #${p.planId || ''}`, p.billingPeriod || '', String(p.activeSubscribers || 0), String(p.totalSubscribers || 0), String(p.monthlyRevenue || 0)]);
    }

    rows.push([]);
    rows.push(['PaymentFailureReason', 'Reason', 'Count']);
    for (const f of (a.paymentMetrics?.failureReasons || [])) {
      rows.push(['PaymentFailureReason', f.reason || 'Unknown', String(f.count || 0)]);
    }

    rows.push([]);
    rows.push(['GeoMarket', 'Market', 'EventsOrUsers']);
    for (const m of (a.geoMetrics?.topMarkets || [])) {
      rows.push(['GeoMarket', m.market || 'UNKNOWN', String(m.eventsOrUsers || 0)]);
    }

    rows.push([]);
    rows.push(['ContentEngagementType', 'ContentType', 'Titles', 'Views', 'WatchHours']);
    for (const c of (a.contentEngagement?.byContentType || [])) {
      rows.push(['ContentEngagementType', c.contentType || '', String(c.titles || 0), String(c.views || 0), String(c.watchHours || 0)]);
    }

    rows.push([]);
    rows.push(['Device', 'Platform', 'Percentage', 'ActiveSessions']);
    for (const d of a.deviceBreakdown || []) {
      rows.push(['Device', d.platform, String(d.percentage ?? 0), String(d.activeSessions ?? 0)]);
    }

    rows.push([]);
    rows.push(['TopContent', 'Title', 'Type', 'TotalViews', 'UniqueViews', 'WatchHours', 'Revenue', 'AdsEligible', 'UniqueViewsNeeded']);
    for (const c of a.topContent || []) {
      rows.push([
        'TopContent',
        c.title || '',
        c.contentType || '',
        String(c.totalViews ?? 0),
        String(c.uniqueViews ?? 0),
        String(c.watchHours ?? 0),
        String(c.totalRevenue ?? 0),
        String(c.adsEligible ? 'YES' : 'NO'),
        String(c.uniqueViewsNeeded ?? 0),
      ]);
    }

    return rows.map((r) => r.map((cell) => this.escapeCsv(cell)).join(',')).join('\n');
  }

  private escapeCsv(value: string): string {
    const s = String(value ?? '');
    if (/[",\n]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  private downloadBlob(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private openPrintableReport(): void {
    const a = this.analytics!;
    const trendRows = this.chartPoints
      .map((p) => `<tr><td>${p.label}</td><td>₹${Number(p.revenue || 0).toFixed(2)}</td><td>${p.users || 0}</td><td>${p.watchHours || 0}</td><td>${p.streams || 0}</td></tr>`)
      .join('');
    const deviceRows = (a.deviceBreakdown || [])
      .map((d) => `<tr><td>${d.platform}</td><td>${d.percentage}%</td><td>${d.activeSessions}</td></tr>`)
      .join('');
    const contentRows = (a.topContent || [])
      .map((c, i) => `<tr><td>${i + 1}</td><td>${this.escapeHtml(c.title)}</td><td>${c.contentType}</td><td>${c.totalViews}</td><td>${c.uniqueViews}</td><td>${c.watchHours}</td><td>₹${Number(c.totalRevenue || 0).toFixed(2)}</td></tr>`)
      .join('');
    const planRows = (a.subscriptionMetrics?.planMix || [])
      .map((p: any) => `<tr><td>${this.escapeHtml(p.planName || ('Plan #' + (p.planId || '')))}</td><td>${this.escapeHtml(p.billingPeriod || '')}</td><td>${p.activeSubscribers || 0}</td><td>${p.totalSubscribers || 0}</td><td>₹${Number(p.monthlyRevenue || 0).toFixed(2)}</td></tr>`)
      .join('');
    const failureRows = (a.paymentMetrics?.failureReasons || [])
      .map((f: any) => `<tr><td>${this.escapeHtml(f.reason || 'Unknown')}</td><td>${f.count || 0}</td></tr>`)
      .join('');
    const geoRows = (a.geoMetrics?.topMarkets || [])
      .map((m: any) => `<tr><td>${this.escapeHtml(m.market || 'UNKNOWN')}</td><td>${m.eventsOrUsers || 0}</td></tr>`)
      .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>MaxxPixels Analytics Report</title>
      <style>
        body{font-family:Arial,sans-serif;padding:24px;color:#111}
        h1,h2{margin:0 0 8px} p{margin:0 0 16px;color:#444}
        table{width:100%;border-collapse:collapse;margin:12px 0 24px}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
        th{background:#f5f5f5} .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px}
        .card{border:1px solid #ddd;padding:10px;border-radius:6px} .label{font-size:11px;color:#666} .val{font-size:16px;font-weight:700}
      </style></head><body>
      <h1>MaxxPixels Analytics Report</h1>
      <p>Timeframe: ${this.escapeHtml(this.getTimeframeLabel())} • Generated: ${new Date().toLocaleString()}</p>
      <div class="grid">
        <div class="card"><div class="label">Monthly Revenue</div><div class="val">₹${Number(a.monthlyRevenue || 0).toFixed(2)}</div></div>
        <div class="card"><div class="label">ARPU / ARPPU</div><div class="val">₹${Number(a.arpu || 0).toFixed(2)} / ₹${Number(a.arppu || 0).toFixed(2)}</div></div>
        <div class="card"><div class="label">DAU / WAU / MAU</div><div class="val">${a.dailyActiveUsers || 0} / ${a.weeklyActiveUsers || 0} / ${a.monthlyActiveUsers || 0}</div></div>
        <div class="card"><div class="label">Concurrent Streams</div><div class="val">${a.concurrentStreams || 0}</div></div>
        <div class="card"><div class="label">Churn / Retention</div><div class="val">${Number(a.subscriptionMetrics?.churnRate || 0).toFixed(1)}% / ${Number(a.engagementMetrics?.retentionRate30d || 0).toFixed(1)}%</div></div>
        <div class="card"><div class="label">Payment Success</div><div class="val">${Number(a.paymentMetrics?.successRate || 0).toFixed(1)}%</div></div>
      </div>

      <h2>Revenue Attribution (Monthly)</h2>
      <table><thead><tr><th>SVOD</th><th>TVOD</th><th>Ads</th><th>Total</th></tr></thead><tbody><tr><td>₹${Number(a.revenueAttribution?.monthly?.svod || 0).toFixed(2)}</td><td>₹${Number(a.revenueAttribution?.monthly?.tvod || 0).toFixed(2)}</td><td>₹${Number(a.revenueAttribution?.monthly?.ads || 0).toFixed(2)}</td><td>₹${Number(a.revenueAttribution?.monthly?.total || 0).toFixed(2)}</td></tr></tbody></table>

      <h2>Subscriptions & Funnel</h2>
      <table><thead><tr><th>Active</th><th>Expired</th><th>Cancelled</th><th>New (Month)</th><th>Renewals (Month)</th><th>Signup→Paid</th></tr></thead><tbody><tr><td>${a.subscriptionMetrics?.active || 0}</td><td>${a.subscriptionMetrics?.expired || 0}</td><td>${a.subscriptionMetrics?.cancelled || 0}</td><td>${a.subscriptionMetrics?.newThisMonth || 0}</td><td>${a.subscriptionMetrics?.renewalsThisMonth || 0}</td><td>${Number(a.funnelMetrics?.signupToPaidRate || 0).toFixed(1)}%</td></tr></tbody></table>

      <h2>Plan Mix</h2>
      <table><thead><tr><th>Plan</th><th>Billing</th><th>Active Subs</th><th>Total Subs</th><th>Monthly Revenue</th></tr></thead><tbody>${planRows || '<tr><td colspan="5">No data</td></tr>'}</tbody></table>

      <h2>Payments & Failure Reasons</h2>
      <table><thead><tr><th>Success</th><th>Failed</th><th>Refunded</th><th>Pending</th><th>Refund Amount</th></tr></thead><tbody><tr><td>${a.paymentMetrics?.success || 0}</td><td>${a.paymentMetrics?.failed || 0}</td><td>${a.paymentMetrics?.refunded || 0}</td><td>${a.paymentMetrics?.pending || 0}</td><td>₹${Number(a.paymentMetrics?.refundAmount || 0).toFixed(2)}</td></tr></tbody></table>
      <table><thead><tr><th>Failure Reason</th><th>Count</th></tr></thead><tbody>${failureRows || '<tr><td colspan="2">No failures recorded</td></tr>'}</tbody></table>

      <h2>Geo Markets</h2>
      <table><thead><tr><th>Market</th><th>Events/Users</th></tr></thead><tbody>${geoRows || '<tr><td colspan="2">No geo telemetry</td></tr>'}</tbody></table>

      <h2>Trend (${this.escapeHtml(this.chartTrendKey.toUpperCase())})</h2>
      <table><thead><tr><th>Label</th><th>Revenue</th><th>Users</th><th>Watch Hours</th><th>Streams</th></tr></thead><tbody>${trendRows || '<tr><td colspan="5">No data</td></tr>'}</tbody></table>
      <h2>Device & Platform Share</h2>
      <table><thead><tr><th>Platform</th><th>Share</th><th>Active Sessions</th></tr></thead><tbody>${deviceRows || '<tr><td colspan="3">No data</td></tr>'}</tbody></table>
      <h2>Top Content</h2>
      <table><thead><tr><th>#</th><th>Title</th><th>Type</th><th>Views</th><th>Unique</th><th>Watch Hours</th><th>Revenue</th></tr></thead><tbody>${contentRows || '<tr><td colspan="7">No data</td></tr>'}</tbody></table>
      <script>window.onload=()=>window.print();</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      this.notificationService.info('Popup blocked. Please allow popups to open the printable PDF report.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  private escapeHtml(value: string): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
