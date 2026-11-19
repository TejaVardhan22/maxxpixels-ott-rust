import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';
import { RealtimeAnalyticsService } from '../../core/services/realtime-analytics.service';
import { NotificationService } from '../../shared/services/notification.service';

interface ChatMessage {
  id: number;
  senderName: string;
  senderAvatar: string;
  role: 'SuperAdmin' | 'Admin' | 'Content Lead' | 'DevOps';
  roleColor: string;
  timestamp: string;
  message: string;
  room: string;
}

interface TrendPoint {
  label: string;
  revenue: number;
  users: number;
  watchHours: number;
  streams: number;
}

interface AdminDashboardMetrics {
  totalUsers: number;
  activeSubscribers: number;
  monthlyRevenue: number;
  totalContent: number;
  pendingApprovals: number;
  concurrentStreams: number;
  storageUsedGb: number;
  storageTotalGb: number;
  avgCompletionRate: number;
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  weeklyActiveUsers?: number;
  totalWatchHoursToday: number;
  totalViews: number;
  uniqueViews24h?: number;
  watchEvents24h?: number;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressBarModule,
    MatBadgeModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="superadmin-dashboard">
      <!-- 1. HEADER & SYSTEM QUICK BAR -->
      <div class="dashboard-header">
        <div class="header-info">
          <div class="role-badge"><mat-icon>insights</mat-icon> PLATFORM EXECUTIVE INTELLIGENCE & TELEMETRY</div>
          <h1>Executive Analytics Dashboard</h1>
          <p>Real-time revenue curves, streaming watch hours, platform growth, portal engagement & infrastructure telemetry</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button class="gradient-btn" (click)="onNavigate('/admin/movies/new')">
            <mat-icon>add</mat-icon> Add New Content
          </button>
          <button mat-stroked-button class="outline-btn" (click)="onNavigate('/admin/payments')">
            <mat-icon>payments</mat-icon> Payment & TVOD History
          </button>
          <button mat-stroked-button class="outline-btn" (click)="onNavigate('/admin/analytics')">
            <mat-icon>bar_chart</mat-icon> Full BI Reports
          </button>
          <button mat-icon-button class="icon-refresh-btn" matTooltip="Refresh Dashboard" (click)="refreshMetrics()">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- 2. KPI METRICS CARDS GRID (6 Cards) -->
      <div class="metrics-grid">
        <!-- Card 1: Total Users -->
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>groups</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Total Registered Users</span>
            <div class="kpi-value">{{ metrics.totalUsers | number }}</div>
            <span class="kpi-sub positive"><mat-icon>trending_up</mat-icon> {{ getUsersTrendLabel() }}</span>
          </div>
        </div>

        <!-- Card 2: Active Subscribers -->
        <div class="kpi-card magenta">
          <div class="kpi-icon"><mat-icon>card_membership</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Active Paid Subscribers</span>
            <div class="kpi-value">{{ metrics.activeSubscribers | number }}</div>
            <span class="kpi-sub positive"><mat-icon>verified</mat-icon> {{ getSubscriptionConversionLabel() }}</span>
          </div>
        </div>

        <!-- Card 3: Monthly Revenue -->
        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>payments</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Monthly Revenue (MRR)</span>
            <div class="kpi-value">₹{{ metrics.monthlyRevenue | number:'1.2-2' }}</div>
            <span class="kpi-sub positive"><mat-icon>trending_up</mat-icon> {{ getRevenueTrendLabel() }}</span>
          </div>
        </div>

        <!-- Card 4: Daily Active Viewers -->
        <div class="kpi-card cyan">
          <div class="kpi-icon"><mat-icon>live_tv</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Daily Active Users (DAU)</span>
            <div class="kpi-value">{{ metrics.dailyActiveUsers | number }}</div>
            <span class="kpi-sub positive"><mat-icon>graphic_eq</mat-icon> {{ metrics.concurrentStreams }} Active Live Streams</span>
          </div>
        </div>

        <!-- Card 5: Total Platform Views & Video Plays -->
        <div class="kpi-card teal">
          <div class="kpi-icon"><mat-icon>visibility</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Total Platform Views</span>
            <div class="kpi-value">{{ (metrics.totalViews || 0) | number }}</div>
            <span class="kpi-sub positive">
              <mat-icon>play_circle</mat-icon>
              {{ liveConnected ? 'LIVE' : 'Polling' }} · {{ (metrics.uniqueViews24h || 0) | number }} unique / 24h
            </span>
          </div>
        </div>

        <!-- Card 6: Streaming Hours Today -->
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>schedule</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Streaming Watch Time</span>
            <div class="kpi-value">{{ metrics.totalWatchHoursToday | number }} Hrs</div>
            <span class="kpi-sub positive"><mat-icon>av_timer</mat-icon> {{ metrics.avgCompletionRate }}% Completion Rate</span>
          </div>
        </div>

        <!-- Card 6: Storage Capacity -->
        <div class="kpi-card magenta">
          <div class="kpi-icon"><mat-icon>cloud_queue</mat-icon></div>
          <div class="kpi-content">
            <span class="kpi-title">Bunny.net CDN & Storage</span>
            <div class="kpi-value">{{ metrics.storageUsedGb }} GB / {{ metrics.storageTotalGb }} GB</div>
            <mat-progress-bar mode="determinate" [value]="(metrics.storageUsedGb / metrics.storageTotalGb) * 100" class="kpi-bar"></mat-progress-bar>
          </div>
        </div>
      </div>

      <!-- 3. MAIN DASHBOARD TWO-COLUMN LAYOUT -->
      <div class="dashboard-main-grid">
        <!-- LEFT COLUMN: INTERACTIVE CHARTS & ANALYTICS -->
        <div class="main-left-column">
          
          <!-- GRAPH 1: Interactive Revenue & Active Viewers Growth Area Graph -->
          <div class="section-card">
            <div class="card-header-row">
              <div class="chart-header-title">
                <h3><mat-icon>show_chart</mat-icon> Revenue & User Growth Trajectory</h3>
                <span class="chart-subtitle">Compare financial performance and active platform engagement</span>
              </div>
              <div class="chart-toggles">
                <button mat-stroked-button [class.active]="chartTimeframe === '7d'" (click)="setTimeframe('7d')">7D</button>
                <button mat-stroked-button [class.active]="chartTimeframe === '30d'" (click)="setTimeframe('30d')">30D</button>
                <button mat-stroked-button [class.active]="chartTimeframe === '90d'" (click)="setTimeframe('90d')">90D</button>
                <button mat-stroked-button [class.active]="chartTimeframe === '12m'" (click)="setTimeframe('12m')">12M</button>
              </div>
            </div>

            <!-- Dynamic SVG Area Chart -->
            <div class="svg-chart-container">
              <div class="chart-stats-ribbon">
                <div class="ribbon-item">
                  <span class="ribbon-label">Peak Revenue ({{ chartTimeframe.toUpperCase() }})</span>
                  <span class="ribbon-val text-blue">₹{{ getPeakRevenue() | number:'1.2-2' }}</span>
                </div>
                <div class="ribbon-item">
                  <span class="ribbon-label">Peak Concurrent Viewers</span>
                  <span class="ribbon-val text-magenta">{{ getPeakUsers() | number }}</span>
                </div>
                <div class="ribbon-item">
                  <span class="ribbon-label">Avg Daily Watch Hours</span>
                  <span class="ribbon-val text-green">{{ getAvgWatchHours() | number:'1.0-1' }}h</span>
                </div>
              </div>

              <svg viewBox="0 0 800 240" class="analytics-svg">
                <defs>
                  <linearGradient id="revGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#1a4cd8" stop-opacity="0.55"/>
                    <stop offset="100%" stop-color="#1a4cd8" stop-opacity="0.0"/>
                  </linearGradient>
                  <linearGradient id="userGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#c725a3" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#c725a3" stop-opacity="0.0"/>
                  </linearGradient>
                </defs>

                <!-- Grid Horizontal Lines -->
                <line x1="40" y1="40" x2="780" y2="40" stroke="#252538" stroke-dasharray="4" />
                <line x1="40" y1="90" x2="780" y2="90" stroke="#252538" stroke-dasharray="4" />
                <line x1="40" y1="140" x2="780" y2="140" stroke="#252538" stroke-dasharray="4" />
                <line x1="40" y1="190" x2="780" y2="190" stroke="#252538" stroke-dasharray="4" />

                <!-- Area Fills -->
                <polygon [attr.points]="getAreaPoints('revenue')" fill="url(#revGradient)" />
                <polygon [attr.points]="getAreaPoints('users')" fill="url(#userGradient)" />

                <!-- Trend Polyline for Revenue -->
                <polyline [attr.points]="getLinePoints('revenue')" fill="none" stroke="#1a4cd8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />

                <!-- Trend Polyline for Active Users -->
                <polyline [attr.points]="getLinePoints('users')" fill="none" stroke="#c725a3" stroke-width="2.5" stroke-dasharray="4,4" stroke-linecap="round" stroke-linejoin="round" />

                <!-- Data Circles & Labels -->
                <g *ngFor="let pt of currentPoints; let idx = index">
                  <!-- Revenue Point -->
                  <circle [attr.cx]="getXCoord(idx)" [attr.cy]="getYCoord(pt.revenue, 'revenue')" r="5" fill="#ffffff" stroke="#1a4cd8" stroke-width="2.5" class="chart-point" />
                  <!-- User Point -->
                  <circle [attr.cx]="getXCoord(idx)" [attr.cy]="getYCoord(pt.users, 'users')" r="4" fill="#ffffff" stroke="#c725a3" stroke-width="2" class="chart-point" />
                  <!-- X-Axis Label -->
                  <text [attr.x]="getXCoord(idx)" y="215" text-anchor="middle" fill="#8e8ea0" font-size="11" font-weight="600">{{ pt.label }}</text>
                </g>
              </svg>

              <div class="chart-legend">
                <span class="legend-item"><span class="dot blue"></span> Platform Revenue (₹)</span>
                <span class="legend-item"><span class="dot magenta"></span> Active Streaming Users</span>
                <span class="legend-item"><span class="dot green"></span> Live Telemetry Sync: Active</span>
              </div>
            </div>
          </div>

          <!-- GRAPH 2: Weekly Streaming Traffic & Playback Hours Multi-Bar Chart -->
          <div class="section-card">
            <div class="card-header-row">
              <h3><mat-icon>equalizer</mat-icon> Weekly Streaming Traffic & Playback Consumption</h3>
              <span class="badge-tag">Peak Traffic: Weekends</span>
            </div>

            <div class="bar-chart-container">
              <div class="bar-col" *ngFor="let item of weeklyWatchHours">
                <div class="bar-val">{{ item.hours }}h</div>
                <div class="bar-track">
                  <div class="bar-fill" [style.height.%]="(item.hours / 1400) * 100">
                    <div class="bar-inner-glow"></div>
                  </div>
                </div>
                <span class="bar-day">{{ item.day }}</span>
                <span class="bar-streams">{{ item.streams }} streams</span>
              </div>
            </div>
          </div>

          <!-- GRAPH 3: Portal Ecosystem Engagement & Revenue Split Horizontal Bars -->
          <div class="section-card">
            <div class="card-header-row">
              <h3><mat-icon>hub</mat-icon> Multi-Portal Ecosystem Engagement</h3>
              <button mat-button class="text-link-btn" (click)="onNavigate('/admin/movies')">Manage Portals</button>
            </div>
            <div class="distribution-bars">
              <div class="dist-item" *ngFor="let item of portalEngagement">
                <div class="dist-header">
                  <div class="portal-tag">
                    <span class="portal-indicator" [style.background-color]="item.color"></span>
                    <span class="type-name">{{ item.portal }}</span>
                  </div>
                  <span class="type-count">{{ item.views | number }} views ({{ item.percentage }}%)</span>
                </div>
                <div class="progress-bg">
                  <div class="progress-fill" [style.width.%]="item.percentage" [style.background-color]="item.color"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Top Trending Catalog Table -->
          <div class="section-card">
            <div class="card-header-row">
              <h3><mat-icon>local_fire_department</mat-icon> Latest & Trending Movies, Series & Shows</h3>
              <button mat-button class="text-link-btn" (click)="onNavigate('/admin/movies')">View Catalog</button>
            </div>
            <table class="trending-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Main Type</th>
                  <th>Total Views</th>
                  <th>Watch Hours</th>
                  <th>Gross Revenue</th>
                  <th>Rating</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of topTrendingContent">
                  <td>
                    <div class="title-cell">
                      <mat-icon class="movie-icon">movie</mat-icon>
                      <span class="item-title">{{ item.title }}</span>
                    </div>
                  </td>
                  <td><span class="badge-type">{{ item.contentType || 'Movie' }}</span></td>
                  <td class="bold-text">{{ item.totalViews | number }}</td>
                  <td>{{ item.watchHours }} hrs</td>
                  <td class="revenue-cell">₹{{ item.totalRevenue | number:'1.2-2' }}</td>
                  <td><span class="rating-tag">{{ item.rating || 'U/A 13+' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- REAL-TIME LIVE STREAMING CONCURRENCY & USER INTERACTION TELEMETRY -->
          <div class="section-card live-tracking-section">
            <div class="card-header-row">
              <div class="chart-header-title">
                <h3><mat-icon class="pulse-icon">sensors</mat-icon> Live Active Streaming Viewers &amp; User Interactions</h3>
                <span class="chart-subtitle">Real-time concurrent playback sessions, telemetry heartbeats &amp; active viewer operations</span>
              </div>
              <span class="online-indicator"><span class="pulse-dot"></span> {{ metrics.concurrentStreams }} Active Stream(s)</span>
            </div>

            <!-- Live Streams Table -->
            <div *ngIf="liveStreams?.length" class="live-streams-table-container">
              <table class="trending-table">
                <thead>
                  <tr>
                    <th>Streaming Media Title</th>
                    <th>User / Viewer</th>
                    <th>Platform</th>
                    <th>Current Watch Progress</th>
                    <th>Heartbeat Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let s of liveStreams">
                    <td>
                      <div class="title-cell">
                        <mat-icon class="movie-icon">live_tv</mat-icon>
                        <span class="item-title">{{ s.title }}</span>
                      </div>
                    </td>
                    <td>
                      <span class="bold-text">{{ s.userName || 'Guest Viewer' }}</span>
                    </td>
                    <td>
                      <span class="badge-type" [ngClass]="(s.deviceType || 'WEB').toLowerCase()">
                        <mat-icon class="dev-icon" *ngIf="(s.deviceType || 'WEB').toUpperCase().includes('ANDROID') || (s.deviceType || 'WEB').toUpperCase().includes('MOBILE')">android</mat-icon>
                        <mat-icon class="dev-icon" *ngIf="(s.deviceType || 'WEB').toUpperCase().includes('IOS') || (s.deviceType || 'WEB').toUpperCase().includes('APPLE')">phone_iphone</mat-icon>
                        <mat-icon class="dev-icon" *ngIf="(s.deviceType || 'WEB').toUpperCase().includes('WEB')">laptop</mat-icon>
                        <mat-icon class="dev-icon" *ngIf="(s.deviceType || 'WEB').toUpperCase().includes('TV')">tv</mat-icon>
                        {{ formatPlatformName(s.deviceType) }}
                      </span>
                    </td>
                    <td>
                      <span class="val-text">{{ (s.currentPositionSeconds / 60) | number:'1.0-0' }}m / {{ (s.totalDurationSeconds / 60) | number:'1.0-0' }}m</span>
                    </td>
                    <td>
                      <span class="status-badge green"><span class="pulse-dot-inline"></span> Streaming Live</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div *ngIf="!liveStreams?.length" class="empty-live-banner">
              <mat-icon class="empty-icon">sensors_off</mat-icon>
              <span>No concurrent video streams active at this second. New viewer streams register automatically in real time.</span>
            </div>
          </div>

          <!-- METRICS DEPTH: REVENUE, SUBSCRIPTIONS, PAYMENTS, FUNNEL, GEO, ENGAGEMENT -->
          <div class="section-card" style="border: 1px solid rgba(255,171,0,0.18);">
            <div class="card-header-row">
              <div class="chart-header-title">
                <h3><mat-icon>insights</mat-icon> Revenue, Subscriber, Payment & Market Intelligence</h3>
                <span class="chart-subtitle">ARPU/ARPPU, attribution, churn, funnel, geo and engagement depth (DB-backed, additive)</span>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;">
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:12px;">
                <div style="font-size:11px;color:#8e8ea0;font-weight:700;">WAU (7d Active Users)</div>
                <div style="font-size:22px;font-weight:800;color:#fff;">{{ (metrics.weeklyActiveUsers || 0) | number }}</div>
                <div style="font-size:11px;color:#00d2ff;">MAU: {{ (metrics.monthlyActiveUsers || 0) | number }}</div>
              </div>
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:12px;">
                <div style="font-size:11px;color:#8e8ea0;font-weight:700;">ARPU (Monthly / MAU)</div>
                <div style="font-size:22px;font-weight:800;color:#fff;">₹{{ (arpu || 0) | number:'1.2-2' }}</div>
                <div style="font-size:11px;color:#ffab00;">ARPPU: ₹{{ (arppu || 0) | number:'1.2-2' }}</div>
              </div>
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:12px;">
                <div style="font-size:11px;color:#8e8ea0;font-weight:700;">Subscription Churn (Proxy)</div>
                <div style="font-size:22px;font-weight:800;color:#fff;">{{ (subscriptionMetrics?.churnRate || 0) | number:'1.1-1' }}%</div>
                <div style="font-size:11px;color:#c725a3;">Cancelled: {{ (subscriptionMetrics?.cancelled || 0) | number }}</div>
              </div>
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:12px;">
                <div style="font-size:11px;color:#8e8ea0;font-weight:700;">Payment Success Rate</div>
                <div style="font-size:22px;font-weight:800;color:#fff;">{{ (paymentMetrics?.successRate || 0) | number:'1.1-1' }}%</div>
                <div style="font-size:11px;color:#00e676;">Collected: ₹{{ (paymentMetrics?.totalCollected || 0) | number:'1.0-0' }}</div>
              </div>
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:12px;">
                <div style="font-size:11px;color:#8e8ea0;font-weight:700;">Retention (30d Returning)</div>
                <div style="font-size:22px;font-weight:800;color:#fff;">{{ (engagementMetrics?.retentionRate30d || 0) | number:'1.1-1' }}%</div>
                <div style="font-size:11px;color:#00d2ff;">Returning users: {{ (engagementMetrics?.returningUsers30d || 0) | number }}</div>
              </div>
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:12px;">
                <div style="font-size:11px;color:#8e8ea0;font-weight:700;">Signup → Paid Conversion</div>
                <div style="font-size:22px;font-weight:800;color:#fff;">{{ (funnelMetrics?.signupToPaidRate || 0) | number:'1.1-1' }}%</div>
                <div style="font-size:11px;color:#00e676;">Paying users: {{ (funnelMetrics?.payingUsers || 0) | number }}</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">
              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:14px;">
                <div style="font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#ffab00;">payments</mat-icon> Revenue Attribution (Monthly)</div>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
                  <div style="display:flex;justify-content:space-between;"><span>SVOD (Subscriptions/Payments)</span><strong>₹{{ (revenueAttribution?.monthly?.svod || 0) | number:'1.2-2' }}</strong></div>
                  <div style="display:flex;justify-content:space-between;"><span>TVOD (Content Purchases)</span><strong>₹{{ (revenueAttribution?.monthly?.tvod || 0) | number:'1.2-2' }}</strong></div>
                  <div style="display:flex;justify-content:space-between;"><span>Ads / Producer Ad Revenue</span><strong>₹{{ (revenueAttribution?.monthly?.ads || 0) | number:'1.2-2' }}</strong></div>
                  <div style="display:flex;justify-content:space-between;border-top:1px solid #202030;padding-top:8px;color:#00e676;"><span>Total Attributed (Month)</span><strong>₹{{ (revenueAttribution?.monthly?.total || 0) | number:'1.2-2' }}</strong></div>
                </div>
                <div style="margin-top:10px;font-size:11px;color:#8e8ea0;">Lifetime SVOD ₹{{ (revenueAttribution?.lifetime?.svod || 0) | number:'1.0-0' }} • TVOD ₹{{ (revenueAttribution?.lifetime?.tvod || 0) | number:'1.0-0' }} • Ads ₹{{ (revenueAttribution?.lifetime?.ads || 0) | number:'1.0-0' }}</div>
              </div>

              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:14px;">
                <div style="font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#00d2ff;">groups</mat-icon> Subscriber & Funnel Ops</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                  <div><span style="color:#8e8ea0;">Active Subs</span><div style="font-weight:700;">{{ (subscriptionMetrics?.active || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Expired</span><div style="font-weight:700;">{{ (subscriptionMetrics?.expired || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">New (Month)</span><div style="font-weight:700;">{{ (subscriptionMetrics?.newThisMonth || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Renewals (Month)</span><div style="font-weight:700;">{{ (subscriptionMetrics?.renewalsThisMonth || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Engaged (7d)</span><div style="font-weight:700;">{{ (funnelMetrics?.engagedUsers7d || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Signup→Active</span><div style="font-weight:700;">{{ (funnelMetrics?.signupToActiveRate || 0) | number:'1.1-1' }}%</div></div>
                </div>
                <div *ngIf="subscriptionMetrics?.planMix?.length" style="margin-top:10px;">
                  <div style="font-size:11px;color:#8e8ea0;margin-bottom:6px;font-weight:700;">Plan Mix (Top)</div>
                  <div *ngFor="let p of subscriptionMetrics.planMix | slice:0:4" style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid #1c1c2b;">
                    <span>{{ $any(p).planName || ('Plan #' + $any(p).planId) }}</span>
                    <span style="color:#00e676;font-weight:700;">{{ $any(p).activeSubscribers || 0 }} active</span>
                  </div>
                </div>
              </div>

              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:14px;">
                <div style="font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#c725a3;">credit_card</mat-icon> Payments, Refunds & Failures</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;">
                  <div><span style="color:#8e8ea0;">Successful</span><div style="font-weight:700;color:#00e676;">{{ (paymentMetrics?.success || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Failed</span><div style="font-weight:700;color:#ff6b6b;">{{ (paymentMetrics?.failed || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Refunded</span><div style="font-weight:700;">{{ (paymentMetrics?.refunded || 0) | number }}</div></div>
                  <div><span style="color:#8e8ea0;">Pending</span><div style="font-weight:700;">{{ (paymentMetrics?.pending || 0) | number }}</div></div>
                </div>
                <div style="margin-top:8px;font-size:12px;color:#8e8ea0;">Refund amount: <strong style="color:#fff;">₹{{ (paymentMetrics?.refundAmount || 0) | number:'1.0-0' }}</strong></div>
                <div *ngIf="paymentMetrics?.failureReasons?.length" style="margin-top:10px;">
                  <div style="font-size:11px;color:#8e8ea0;margin-bottom:6px;font-weight:700;">Top Failure Reasons</div>
                  <div *ngFor="let f of paymentMetrics.failureReasons | slice:0:4" style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid #1c1c2b;">
                    <span style="max-width:75%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ $any(f).reason }}</span>
                    <span style="color:#ffab00;font-weight:700;">{{ $any(f).count }}</span>
                  </div>
                </div>
              </div>

              <div style="background:#101018;border:1px solid #202030;border-radius:10px;padding:14px;">
                <div style="font-weight:800;margin-bottom:10px;display:flex;align-items:center;gap:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#00e676;">public</mat-icon> Geo/Market & Engagement Depth</div>
                <div style="font-size:12px;color:#8e8ea0;margin-bottom:8px;">Avg session: <strong style="color:#fff;">{{ (engagementMetrics?.avgSessionDurationMinutes || 0) | number:'1.1-1' }} min</strong> • Buffer ratio: <strong style="color:#fff;">{{ (engagementMetrics?.bufferRatioPercentage || 0) | number:'1.1-1' }}%</strong></div>
                <div *ngIf="geoMetrics?.topMarkets?.length; else noGeo" style="display:flex;flex-direction:column;gap:4px;">
                  <div *ngFor="let m of geoMetrics.topMarkets | slice:0:5" style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid #1c1c2b;">
                    <span>{{ $any(m).market || 'UNKNOWN' }}</span>
                    <span style="color:#00d2ff;font-weight:700;">{{ $any(m).eventsOrUsers | number }}</span>
                  </div>
                </div>
                <ng-template #noGeo><div style="font-size:12px;color:#8e8ea0;">No geo/market telemetry available yet.</div></ng-template>

                <div *ngIf="contentEngagement?.byContentType?.length" style="margin-top:10px;">
                  <div style="font-size:11px;color:#8e8ea0;margin-bottom:6px;font-weight:700;">Engagement by Content Type</div>
                  <div *ngFor="let c of contentEngagement.byContentType | slice:0:4" style="display:flex;justify-content:space-between;font-size:12px;padding:3px 0;border-top:1px solid #1c1c2b;">
                    <span>{{ $any(c).contentType }}</span>
                    <span style="color:#ffab00;font-weight:700;">{{ $any(c).views | number }} views</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN: DEVICE TELEMETRY, SUPERADMIN LIVE CHAT & HEALTH -->
        <div class="main-right-column">
          
          <!-- GRAPH 4: Device Breakdown Donut Visual -->
          <div class="section-card device-section">
            <div class="card-header-row">
              <h3><mat-icon>devices</mat-icon> Device & Platform Distribution</h3>
            </div>

            <div class="donut-container">
              <svg viewBox="0 0 160 160" class="donut-svg">
                <!-- Outer ring background -->
                <circle cx="80" cy="80" r="60" fill="none" stroke="#202030" stroke-width="18" />
                
                <!-- Dynamic Segments driven by live device telemetry -->
                <circle *ngFor="let dev of deviceBreakdown; let i = index"
                        cx="80" cy="80" r="60" fill="none" 
                        [attr.stroke]="dev.color || '#00d2ff'" 
                        stroke-width="18"
                        [attr.stroke-dasharray]="getDeviceDashArray(dev.percentage)" 
                        [attr.stroke-dashoffset]="getDeviceDashOffset(i)" 
                        stroke-linecap="round" />

                <text x="80" y="74" text-anchor="middle" fill="#ffffff" font-size="18" font-weight="800">
                  {{ totalActiveDevices | number }}
                </text>
                <text x="80" y="92" text-anchor="middle" fill="#8e8ea0" font-size="9" font-weight="600">
                  Active Devices
                </text>
              </svg>

              <div class="donut-legend">
                <div class="donut-legend-row" *ngFor="let dev of deviceBreakdown">
                  <span class="legend-color-box" [style.background-color]="dev.color"></span>
                  <div class="dev-info">
                    <span class="dev-name">{{ dev.platform }}</span>
                    <span class="dev-pct">{{ dev.percentage }}% ({{ (dev.activeSessions || dev.count || 0) | number }} active)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SUPERADMIN & ADMIN LIVE CHAT ROOM -->
          <div class="section-card chat-section">
            <div class="card-header-row">
              <h3><mat-icon>forum</mat-icon> Admin Team Live Operations Chat</h3>
              <span class="online-indicator"><span class="pulse-dot"></span> 4 Admins Online</span>
            </div>

            <!-- Chat Room Tabs -->
            <div class="chat-room-tabs">
              <button *ngFor="let room of chatRooms" 
                      class="room-btn" 
                      [class.active]="currentRoom === room.id" 
                      (click)="currentRoom = room.id">
                {{ room.name }}
                <span class="unread-count" *ngIf="room.unread > 0">{{ room.unread }}</span>
              </button>
            </div>

            <!-- Messages Stream Scroll Box -->
            <div class="messages-container">
              <div *ngFor="let msg of getFilteredMessages()" class="message-item">
                <div class="avatar">{{ msg.senderAvatar }}</div>
                <div class="message-body">
                  <div class="msg-header">
                    <span class="sender-name">{{ msg.senderName }}</span>
                    <span class="role-chip" [style.background-color]="msg.roleColor">{{ msg.role }}</span>
                    <span class="msg-time">{{ msg.timestamp }}</span>
                  </div>
                  <div class="msg-text">{{ msg.message }}</div>
                </div>
              </div>
            </div>

            <!-- Send Message Input Field -->
            <div class="chat-input-row">
              <input type="text" 
                     class="chat-input" 
                     [(ngModel)]="newMessageText" 
                     placeholder="Type a message to admins..." 
                     (keyup.enter)="sendChatMessage()">
              <button mat-flat-button class="send-btn" (click)="sendChatMessage()">
                <mat-icon>send</mat-icon>
              </button>
            </div>
          </div>

          <!-- INFRASTRUCTURE HEALTH TELEMETRY -->
          <div class="section-card health-section">
            <div class="card-header-row">
              <h3><mat-icon>dns</mat-icon> Infrastructure Telemetry & Status</h3>
              <span class="online-indicator"><span class="pulse-dot"></span> All Systems Operational</span>
            </div>

            <div class="health-list">
              <div class="health-item" *ngFor="let item of infrastructureTelemetry">
                <div class="service-info">
                  <mat-icon class="status-icon online">check_circle</mat-icon>
                  <div>
                    <span class="service-name">{{ item.serviceName }}</span>
                    <span class="service-meta">{{ item.meta }}</span>
                  </div>
                </div>
                <span class="status-badge" [ngClass]="item.statusClass || 'green'">{{ item.status }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .superadmin-dashboard {
      color: #ffffff;
      padding: 6px;
    }

    /* HEADER */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;

      .role-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(26, 76, 216, 0.18);
        color: #00d2ff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 12px;
        border-radius: 6px;
        margin-bottom: 6px;
        letter-spacing: 0.8px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: #ffffff; letter-spacing: -0.5px; }
      p { color: #a0a0b0; margin: 0; font-size: 14px; }

      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;

        .gradient-btn {
          height: 42px;
          border-radius: 10px;
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
          color: #ffffff !important;
          font-weight: 700;
          box-shadow: 0 4px 16px rgba(26, 76, 216, 0.35);
        }

        .outline-btn {
          height: 42px;
          border-radius: 10px;
          border-color: #28283c;
          color: #ffffff;
          font-weight: 700;
        }

        .icon-refresh-btn {
          color: #00d2ff;
        }
      }
    }

    /* KPI METRICS GRID */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      align-items: flex-start;
      gap: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      transition: transform 0.2s ease, border-color 0.2s ease;

      &:hover {
        transform: translateY(-2px);
        border-color: #3b3b55;
      }

      .kpi-icon {
        background: #1c1c2b;
        width: 46px;
        height: 46px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .kpi-content {
        flex: 1;
        .kpi-title { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 4px; font-weight: 600; }
        .kpi-value { font-size: 22px; font-weight: 800; color: #ffffff; line-height: 1.2; }
        .kpi-sub {
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 5px;
          font-weight: 600;
          &.positive { color: #00e676; }
          mat-icon { font-size: 13px; width: 13px; height: 13px; }
        }
        .kpi-bar { margin-top: 8px; height: 6px; border-radius: 3px; }
      }

      &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.magenta .kpi-icon { color: #c725a3; background: rgba(199, 37, 163, 0.12); }
      &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
      &.cyan .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.teal .kpi-icon { color: #00e5ff; background: rgba(0, 229, 255, 0.12); }
      &.purple .kpi-icon { color: #a855f7; background: rgba(168, 85, 247, 0.12); }
    }

    /* MAIN GRID (2 COLUMNS) */
    .dashboard-main-grid {
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: 20px;

      @media (max-width: 1200px) {
        grid-template-columns: 1fr;
      }
    }

    .section-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      h3 {
        font-size: 16px;
        font-weight: 800;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        color: #ffffff;
        mat-icon { color: #00d2ff; font-size: 20px; width: 20px; height: 20px; }
      }
    }

    .card-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 10px;

      .chart-header-title {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .chart-subtitle { font-size: 12px; color: #8e8ea0; }
      }

      .text-link-btn {
        color: #00d2ff;
        font-weight: 700;
        font-size: 12px;
      }

      .badge-tag {
        background: rgba(0, 230, 118, 0.15);
        color: #00e676;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
      }

      .chart-toggles button {
        height: 32px;
        font-size: 12px;
        margin-left: 6px;
        border-color: #28283c;
        color: #a0a0b0;
        border-radius: 8px;
        &.active {
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%);
          color: #ffffff;
          border-color: transparent;
          font-weight: 700;
        }
      }
    }

    /* SVG CHART STYLES */
    .svg-chart-container {
      width: 100%;
      background: #101018;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #202030;

      .chart-stats-ribbon {
        display: flex;
        justify-content: space-around;
        padding: 8px 12px;
        background: rgba(22, 22, 36, 0.7);
        border-radius: 8px;
        margin-bottom: 14px;
        border: 1px solid #202030;

        .ribbon-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          .ribbon-label { font-size: 11px; color: #8e8ea0; font-weight: 600; margin-bottom: 2px; }
          .ribbon-val { font-size: 16px; font-weight: 800; }
          .text-blue { color: #00d2ff; }
          .text-magenta { color: #c725a3; }
          .text-green { color: #00e676; }
        }
      }

      .analytics-svg {
        width: 100%;
        height: auto;
        overflow: visible;
      }

      .chart-point {
        cursor: pointer;
        transition: r 0.2s ease;
        &:hover { r: 8; }
      }

      .chart-legend {
        display: flex;
        justify-content: center;
        gap: 24px;
        margin-top: 14px;
        font-size: 12px;
        color: #a0a0b0;
        flex-wrap: wrap;

        .legend-item {
          display: flex;
          align-items: center;
        }
        .dot {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          margin-right: 6px;
          &.blue { background: #1a4cd8; }
          &.magenta { background: #c725a3; }
          &.green { background: #00e676; }
        }
      }
    }

    /* BAR CHART FOR PLAYBACK HOURS */
    .bar-chart-container {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      height: 180px;
      padding: 16px 8px 0;
      background: #101018;
      border-radius: 12px;
      border: 1px solid #202030;
      gap: 8px;

      .bar-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;

        .bar-val { font-size: 11px; font-weight: 700; color: #00d2ff; margin-bottom: 6px; }
        
        .bar-track {
          flex: 1;
          width: 24px;
          background: #1a1a28;
          border-radius: 6px;
          display: flex;
          align-items: flex-end;
          overflow: hidden;

          .bar-fill {
            width: 100%;
            background: linear-gradient(180deg, #00d2ff 0%, #1a4cd8 100%);
            border-radius: 6px;
            transition: height 0.5s ease;
          }
        }

        .bar-day { font-size: 12px; font-weight: 700; color: #ffffff; margin-top: 8px; }
        .bar-streams { font-size: 9px; color: #8e8ea0; margin-top: 2px; }
      }
    }

    /* PORTAL DISTRIBUTION */
    .distribution-bars {
      display: flex;
      flex-direction: column;
      gap: 14px;

      .dist-item {
        .dist-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          margin-bottom: 6px;
          
          .portal-tag {
            display: flex;
            align-items: center;
            gap: 8px;
            .portal-indicator { width: 10px; height: 10px; border-radius: 3px; }
            .type-name { font-weight: 700; color: #ffffff; }
          }
          .type-count { color: #a0a0b0; font-weight: 600; }
        }
        .progress-bg {
          height: 9px;
          background: #202030;
          border-radius: 5px;
          overflow: hidden;
          .progress-fill { height: 100%; border-radius: 5px; transition: width 0.4s ease; }
        }
      }
    }

    /* TRENDING MOVIES TABLE */
    .trending-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th { text-align: left; padding: 10px 12px; color: #a0a0b0; border-bottom: 1px solid #28283c; font-weight: 700; font-size: 12px; }
      td { padding: 12px; border-bottom: 1px solid #202030; }

      .title-cell {
        display: flex;
        align-items: center;
        gap: 8px;
        .movie-icon { font-size: 18px; width: 18px; height: 18px; color: #00d2ff; }
        .item-title { font-weight: 700; color: #ffffff; }
      }
      .badge-type { background: rgba(26, 76, 216, 0.15); color: #00d2ff; font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 700; }
      .bold-text { font-weight: 700; color: #ffffff; }
      .revenue-cell { font-weight: 800; color: #00e676; }
      .rating-tag { background: rgba(255, 171, 0, 0.15); color: #ffab00; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 700; }
    }

    /* DONUT CHART */
    .donut-container {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 12px;
      background: #101018;
      border-radius: 12px;
      border: 1px solid #202030;
      flex-wrap: wrap;

      .donut-svg {
        width: 130px;
        height: 130px;
        transform: rotate(-90deg);
      }

      .donut-legend {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 10px;

        .donut-legend-row {
          display: flex;
          align-items: center;
          gap: 10px;

          .legend-color-box { width: 12px; height: 12px; border-radius: 4px; }
          .dev-info {
            display: flex;
            flex-direction: column;
            .dev-name { font-size: 12px; font-weight: 700; color: #ffffff; }
            .dev-pct { font-size: 11px; color: #8e8ea0; }
          }
        }
      }
    }

    /* CHAT SECTION */
    .chat-section {
      display: flex;
      flex-direction: column;

      .online-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #00e676;
        font-weight: 700;

        .pulse-dot {
          width: 8px;
          height: 8px;
          background: #00e676;
          border-radius: 50%;
          box-shadow: 0 0 8px #00e676;
        }
      }

      .chat-room-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        border-bottom: 1px solid #28283c;
        padding-bottom: 8px;

        .room-btn {
          background: transparent;
          border: none;
          color: #a0a0b0;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          position: relative;

          &.active { background: #202030; color: #ffffff; }
          .unread-count {
            background: #c725a3;
            color: #ffffff;
            font-size: 10px;
            padding: 1px 5px;
            border-radius: 10px;
            margin-left: 4px;
          }
        }
      }

      .messages-container {
        height: 240px;
        overflow-y: auto;
        background: #101018;
        border: 1px solid #202030;
        border-radius: 10px;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 12px;
      }

      .message-item {
        display: flex;
        gap: 10px;
        align-items: flex-start;

        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #202030;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .message-body {
          flex: 1;
          background: #161624;
          padding: 8px 12px;
          border-radius: 8px;

          .msg-header {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 4px;

            .sender-name { font-size: 12px; font-weight: 700; color: #ffffff; }
            .role-chip { font-size: 9px; font-weight: 700; color: #ffffff; padding: 1px 6px; border-radius: 3px; text-transform: uppercase; }
            .msg-time { font-size: 10px; color: #707080; margin-left: auto; }
          }
          .msg-text { font-size: 12px; color: #e0e0e0; line-height: 1.4; word-break: break-word; }
        }
      }

      .chat-input-row {
        display: flex;
        gap: 8px;

        .chat-input {
          flex: 1;
          background: #101018;
          border: 1px solid #28283a;
          border-radius: 8px;
          color: #ffffff;
          padding: 0 14px;
          height: 42px;
          font-size: 13px;
          &:focus { outline: none; border-color: #1a4cd8; }
        }
        .send-btn {
          height: 42px;
          width: 42px;
          min-width: 42px;
          border-radius: 8px;
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
          color: #ffffff !important;
        }
      }
    }

    /* HEALTH TELEMETRY */
    .health-list {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .health-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #101018;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #202030;

        .service-info {
          display: flex;
          align-items: center;
          gap: 10px;

          .status-icon.online { color: #00e676; font-size: 20px; width: 20px; height: 20px; }
          .service-name { font-size: 13px; font-weight: 600; display: block; color: #ffffff; }
          .service-meta { font-size: 11px; color: #a0a0b0; }
        }

        .status-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          &.green { background: rgba(0, 230, 118, 0.15); color: #00e676; }
        }
      }
    }

    .live-tracking-section {
      margin-top: 24px;
      border: 1px solid rgba(0, 210, 255, 0.2);

      .pulse-icon {
        color: #ff007a;
        animation: pulse 1.5s infinite;
        vertical-align: middle;
      }

      .pulse-dot-inline {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00e676;
        box-shadow: 0 0 8px #00e676;
        margin-right: 4px;
      }

      .live-streams-table-container {
        overflow-x: auto;
      }

      .empty-live-banner {
        text-align: center;
        padding: 28px 16px;
        color: #a0a0b0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: rgba(255, 255, 255, 0.02);
        border-radius: 8px;
        border: 1px dashed rgba(255, 255, 255, 0.08);

        .empty-icon {
          color: #707080;
          font-size: 24px;
          width: 24px;
          height: 24px;
        }
      }

      .badge-type {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.3px;
        .dev-icon { font-size: 15px; width: 15px; height: 15px; }

        &.android, &.mobile {
          background: rgba(0, 210, 255, 0.12);
          color: #00d2ff;
          border: 1px solid rgba(0, 210, 255, 0.3);
        }
        &.ios, &.apple {
          background: rgba(199, 37, 163, 0.12);
          color: #e040fb;
          border: 1px solid rgba(199, 37, 163, 0.3);
        }
        &.web {
          background: rgba(0, 230, 118, 0.12);
          color: #00e676;
          border: 1px solid rgba(0, 230, 118, 0.3);
        }
        &.smart_tv, &.tv {
          background: rgba(255, 171, 0, 0.12);
          color: #ffab00;
          border: 1px solid rgba(255, 171, 0, 0.3);
        }
      }
    }
  `]
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly notificationService = inject(NotificationService);
  private readonly realtimeAnalytics = inject(RealtimeAnalyticsService);

  liveStreams: any[] = [];
  recentInteractions: any[] = [];
  liveConnected = false;
  private liveRefreshTimer: any;
  private disconnectLiveAnalytics?: () => void;

  chartTimeframe: '7d' | '30d' | '90d' | '12m' = '7d';
  currentRoom = 'general';
  newMessageText = '';

  metrics: AdminDashboardMetrics = {
    totalUsers: 0,
    activeSubscribers: 0,
    monthlyRevenue: 0.00,
    totalContent: 0,
    pendingApprovals: 0,
    concurrentStreams: 0,
    storageUsedGb: 0,
    storageTotalGb: 0,
    avgCompletionRate: 0,
    dailyActiveUsers: 0,
    monthlyActiveUsers: 0,
    weeklyActiveUsers: 0,
    totalWatchHoursToday: 0,
    totalViews: 0,
    uniqueViews24h: 0,
    watchEvents24h: 0
  };

  arpu = 0;
  arppu = 0;
  revenueAttribution: any = { monthly: { svod: 0, tvod: 0, ads: 0, total: 0 }, lifetime: { svod: 0, tvod: 0, ads: 0 } };
  subscriptionMetrics: any = { active: 0, expired: 0, cancelled: 0, trial: 0, newThisMonth: 0, renewalsThisMonth: 0, churnRate: 0, planMix: [] };
  paymentMetrics: any = { success: 0, failed: 0, refunded: 0, pending: 0, successRate: 0, totalCollected: 0, refundAmount: 0, failureReasons: [] };
  funnelMetrics: any = { registeredUsers: 0, engagedUsers7d: 0, activeUsers30d: 0, payingUsers: 0, activeSubscribers: 0, signupToActiveRate: 0, signupToPaidRate: 0 };
  geoMetrics: any = { topMarkets: [] };
  engagementMetrics: any = { avgSessionDurationMinutes: 0, avgCompletionRate: 0, returningUsers30d: 0, retentionRate30d: 0, bufferRatioPercentage: 0 };
  contentEngagement: any = { byContentType: [], topEngagedTitles: [] };

  timeSeriesTrends: Record<string, TrendPoint[]> = {
    '7d': [
      { label: 'Mon', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Tue', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Wed', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Thu', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Fri', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Sat', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Sun', revenue: 0, users: 0, watchHours: 0, streams: 0 }
    ],
    '30d': [
      { label: 'Week 1', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Week 2', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Week 3', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Week 4', revenue: 0, users: 0, watchHours: 0, streams: 0 }
    ],
    '90d': [
      { label: 'Month 1', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Month 2', revenue: 0, users: 0, watchHours: 0, streams: 0 },
      { label: 'Current Month', revenue: 0, users: 0, watchHours: 0, streams: 0 }
    ],
    '12m': [
      { label: 'Current Month', revenue: 0, users: 0, watchHours: 0, streams: 0 }
    ]
  };

  weeklyWatchHours: any[] = [
    { day: 'Mon', hours: 0, streams: 0 },
    { day: 'Tue', hours: 0, streams: 0 },
    { day: 'Wed', hours: 0, streams: 0 },
    { day: 'Thu', hours: 0, streams: 0 },
    { day: 'Fri', hours: 0, streams: 0 },
    { day: 'Sat', hours: 0, streams: 0 },
    { day: 'Sun', hours: 0, streams: 0 }
  ];
  portalEngagement: any[] = [
    { portal: 'Web OTT (Next.js)', views: 0, percentage: 0, color: '#00d2ff' },
    { portal: 'Android Mobile App', views: 0, percentage: 0, color: '#1a4cd8' },
    { portal: 'Smart TV & Android TV', views: 0, percentage: 0, color: '#c725a3' },
    { portal: 'iOS / Apple TV', views: 0, percentage: 0, color: '#ffab00' }
  ];
  deviceBreakdown: any[] = [
    { platform: 'Desktop Web', device: 'Desktop Web', count: 0, activeSessions: 0, percentage: 0, color: '#00d2ff' },
    { platform: 'Android Mobile', device: 'Android Mobile', count: 0, activeSessions: 0, percentage: 0, color: '#1a4cd8' },
    { platform: 'Smart TV', device: 'Smart TV', count: 0, activeSessions: 0, percentage: 0, color: '#c725a3' },
    { platform: 'iOS / iPad', device: 'iOS / iPad', count: 0, activeSessions: 0, percentage: 0, color: '#00e676' }
  ];
  topTrendingContent: any[] = [];
  infrastructureTelemetry: any[] = [
    { serviceName: 'PostgreSQL Database Engine', meta: 'Connected • Port 5432 • Pooled', status: 'Healthy', statusClass: 'green' },
    { serviceName: 'Redis Cache & Session Broker', meta: 'Active • Port 6379 • Cluster Ready', status: 'Healthy', statusClass: 'green' },
    { serviceName: 'Bunny.net Stream CDN', meta: 'Global Edge Transcoding • Low Latency', status: 'Operational', statusClass: 'green' },
    { serviceName: 'SSAI Dynamic Ad Engine', meta: 'VAST 4.2 / VMAP Compliant Insertion', status: 'Operational', statusClass: 'green' }
  ];

  chatRooms = [
    { id: 'general', name: 'General Operations', unread: 0 },
    { id: 'producers', name: 'Producer Ops', unread: 0 },
    { id: 'tech', name: 'DevOps & System', unread: 0 }
  ];

  chatMessages: ChatMessage[] = [];

  get currentPoints(): TrendPoint[] {
    return this.timeSeriesTrends[this.chartTimeframe] || this.timeSeriesTrends['7d'] || [];
  }

  formatPlatformName(deviceType?: string): string {
    const dt = (deviceType || 'WEB').toUpperCase();
    if (dt.includes('ANDROID') || dt.includes('MOBILE')) return 'Android Mobile';
    if (dt.includes('IOS') || dt.includes('APPLE')) return 'iOS App';
    if (dt.includes('TV')) return 'Smart TV';
    return 'Desktop Web';
  }

  ngOnInit(): void {
    this.loadChatMessages();
    this.refreshMetrics();
    if (this.authStore.isAuthenticated()) {
      this.disconnectLiveAnalytics = this.realtimeAnalytics.connect(
        (counters) => {
          this.metrics = {
            ...this.metrics,
            totalViews: counters.totalViews,
            uniqueViews24h: counters.uniqueViews24h,
            watchEvents24h: counters.watchEvents24h,
            concurrentStreams: counters.activeStreams,
          };
          this.refreshLiveStreamsQuietly();
        },
        (connected) => {
          this.liveConnected = connected;
        },
      );
    }
    // Polling remains as a fallback if SSE is unavailable or the stream drops.
    this.liveRefreshTimer = setInterval(() => {
      if (!this.liveConnected) {
        this.refreshMetrics();
      }
      this.refreshLiveStreamsQuietly();
    }, 45000);
  }

  ngOnDestroy(): void {
    if (this.liveRefreshTimer) {
      clearInterval(this.liveRefreshTimer);
    }
    this.disconnectLiveAnalytics?.();
  }

  refreshLiveStreamsQuietly(): void {
    if (!this.authStore.isAuthenticated() || (typeof document !== 'undefined' && document.hidden)) {
      return;
    }
    this.http.get<any>(`${environment.apiBaseUrl}/admin/analytics/live`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.liveStreams = res.data.activeStreams || [];
          if (typeof res.data.concurrentStreams === 'number') {
            this.metrics.concurrentStreams = res.data.concurrentStreams;
          }
        }
      },
      error: () => {}
    });
  }

  setTimeframe(tf: '7d' | '30d' | '90d' | '12m'): void {
    this.chartTimeframe = tf;
  }

  refreshMetrics(): void {
    if (!this.authStore.isAuthenticated()) {
      return;
    }
    this.http.get<any>(`${environment.apiBaseUrl}/admin/analytics/dashboard`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          this.metrics = {
            totalUsers: d.totalUsers ?? d.total_users ?? 0,
            activeSubscribers: d.activeSubscribers ?? d.active_subscribers ?? 0,
            monthlyRevenue: d.monthlyRevenue ?? d.total_revenue_inr ?? 0.0,
            totalContent: d.totalContent ?? d.total_titles ?? 0,
            pendingApprovals: d.pendingApprovals ?? d.pending_kyc_reviews ?? d.pending_content_reviews ?? 0,
            concurrentStreams: d.concurrentStreams ?? d.concurrent_streams ?? 0,
            storageUsedGb: d.storageUsedGb ?? d.storage_used_gb ?? 0,
            storageTotalGb: d.storageTotalGb ?? d.storage_total_gb ?? 0,
            avgCompletionRate: d.avgCompletionRate ?? d.avg_completion_rate ?? 0,
            dailyActiveUsers: d.dailyActiveUsers ?? d.daily_active_users ?? 0,
            monthlyActiveUsers: d.monthlyActiveUsers ?? d.monthly_active_users ?? 0,
            weeklyActiveUsers: d.weeklyActiveUsers ?? d.weekly_active_users ?? 0,
            totalWatchHoursToday: d.totalWatchHoursToday ?? d.total_watch_hours_today ?? 0,
            totalViews: d.totalViews ?? d.total_views ?? 0,
            uniqueViews24h: d.uniqueViews24h ?? d.unique_views_24h ?? 0,
            watchEvents24h: d.watchEvents24h ?? d.watch_events_24h ?? 0
          };

          if (d.timeSeriesTrends || d.time_series_trends) {
            this.timeSeriesTrends = d.timeSeriesTrends || d.time_series_trends;
          }
          if (d.portalEngagement || d.portal_engagement) {
            this.portalEngagement = d.portalEngagement || d.portal_engagement;
          }
          if (d.deviceBreakdown || d.device_breakdown) {
            this.deviceBreakdown = d.deviceBreakdown || d.device_breakdown;
          }
          if (d.infrastructureTelemetry && d.infrastructureTelemetry.length > 0) {
            this.infrastructureTelemetry = d.infrastructureTelemetry;
          } else if (d.infrastructure_telemetry && d.infrastructure_telemetry.length > 0) {
            this.infrastructureTelemetry = d.infrastructure_telemetry.map((t: any) => ({
              serviceName: t.serviceName || t.service_name || t.name,
              meta: t.meta || t.description || t.details,
              status: t.status || 'Operational',
              statusClass: t.statusClass || t.status_class || 'green'
            }));
          }
          if (d.weeklyWatchHours || d.weekly_watch_hours) {
            this.weeklyWatchHours = d.weeklyWatchHours || d.weekly_watch_hours;
          }
          if (d.topContent && d.topContent.length > 0) {
            this.topTrendingContent = d.topContent;
          } else if (d.top_content && d.top_content.length > 0) {
            this.topTrendingContent = d.top_content;
          }

          this.arpu = Number(d.arpu ?? 0);
          this.arppu = Number(d.arppu ?? 0);
          this.revenueAttribution = d.revenueAttribution || d.revenue_attribution || this.revenueAttribution;
          this.subscriptionMetrics = d.subscriptionMetrics || d.subscription_metrics || this.subscriptionMetrics;
          this.paymentMetrics = d.paymentMetrics || d.payment_metrics || this.paymentMetrics;
          this.funnelMetrics = d.funnelMetrics || d.funnel_metrics || this.funnelMetrics;
          this.geoMetrics = d.geoMetrics || d.geo_metrics || this.geoMetrics;
          this.engagementMetrics = d.engagementMetrics || d.engagement_metrics || this.engagementMetrics;
          this.contentEngagement = d.contentEngagement || d.content_engagement || this.contentEngagement;
        }
      },
      error: () => {
        // Gracefully handle unauthenticated or network error
      }
    });

    // Real-time live concurrent streams and recent user interaction telemetry
    this.http.get<any>(`${environment.apiBaseUrl}/admin/analytics/live`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.liveStreams = res.data.activeStreams || [];
          this.recentInteractions = res.data.recentInteractions || [];
          if (res.data.concurrentStreams !== undefined) {
            this.metrics.concurrentStreams = res.data.concurrentStreams;
          }
        }
      },
      error: () => {
        // Gracefully handle unauthenticated or network error
      }
    });

    this.http.get<any>(`${environment.apiBaseUrl}/admin/movies?size=6`).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.content) {
          this.topTrendingContent = res.data.content.map((m: any) => ({
            title: m.title,
            contentType: m.contentType || 'Movie',
            totalViews: m.viewCount || m.totalViews || 0,
            watchHours: m.watchHours ? Number(m.watchHours).toFixed(0) : (m.viewCount ? ((m.viewCount * (m.duration || 120)) / 3600).toFixed(0) : '0'),
            totalRevenue: m.totalRevenue || 0,
            rating: m.maturityRating || m.rating || 'U/A 13+'
          }));
        }
      },
      error: () => {
        // Gracefully handle unauthenticated or network error
      }
    });
  }

  // GRAPH MATH HELPERS FOR SVG
  getXCoord(index: number): number {
    const pts = this.currentPoints;
    if (pts.length <= 1) return 400;
    const startX = 60;
    const endX = 740;
    const step = (endX - startX) / (pts.length - 1);
    return Math.round(startX + (index * step));
  }

  getYCoord(val: number, type: 'revenue' | 'users'): number {
    const pts = this.currentPoints;
    const maxVal = Math.max(...pts.map(p => type === 'revenue' ? p.revenue : p.users), 1);
    const topY = 40;
    const bottomY = 190;
    const ratio = Math.min(Math.max(val / maxVal, 0.05), 1);
    return Math.round(bottomY - (ratio * (bottomY - topY)));
  }

  getLinePoints(type: 'revenue' | 'users'): string {
    return this.currentPoints.map((pt, idx) => {
      const x = this.getXCoord(idx);
      const y = this.getYCoord(type === 'revenue' ? pt.revenue : pt.users, type);
      return `${x},${y}`;
    }).join(' ');
  }

  getAreaPoints(type: 'revenue' | 'users'): string {
    const line = this.getLinePoints(type);
    const pts = this.currentPoints;
    if (pts.length === 0) return '';
    const firstX = this.getXCoord(0);
    const lastX = this.getXCoord(pts.length - 1);
    return `${firstX},190 ${line} ${lastX},190`;
  }

  getPeakRevenue(): number {
    return Math.max(...this.currentPoints.map(p => p.revenue), 0);
  }

  getPeakUsers(): number {
    return Math.max(...this.currentPoints.map(p => p.users), 0);
  }

  getAvgWatchHours(): number {
    const pts = this.currentPoints;
    if (pts.length === 0) return 0;
    const sum = pts.reduce((acc, curr) => acc + curr.watchHours, 0);
    return sum / pts.length;
  }

  get totalActiveDevices(): number {
    if (!this.deviceBreakdown || this.deviceBreakdown.length === 0) return this.metrics.totalUsers || 0;
    const sum = this.deviceBreakdown.reduce((acc, d) => acc + (d.activeSessions || d.count || 0), 0);
    return sum > 0 ? sum : (this.metrics.totalUsers || 0);
  }

  getDeviceDashArray(percentage: number): string {
    const circumference = 376.99;
    const filled = (Math.max(0, percentage || 0) / 100) * circumference;
    return `${filled.toFixed(1)} ${circumference.toFixed(1)}`;
  }

  getDeviceDashOffset(index: number): string {
    const circumference = 376.99;
    let priorPercentage = 0;
    for (let i = 0; i < index; i++) {
      priorPercentage += (this.deviceBreakdown[i]?.percentage || 0);
    }
    const offset = -(priorPercentage / 100) * circumference;
    return offset.toFixed(1);
  }

  getUsersTrendLabel(): string {
    const t = this.timeSeriesTrends?.['12m'] || [];
    if (t.length >= 2) {
      const prev = Number(t[t.length - 2]?.users || 0);
      const curr = Number(t[t.length - 1]?.users || 0);
      if (prev > 0) {
        const pct = ((curr - prev) / prev) * 100;
        const sign = pct >= 0 ? '+' : '';
        return `${sign}${pct.toFixed(1)}% vs previous month`;
      }
      if (curr > 0) return 'Active growth this month';
    }
    return this.metrics.dailyActiveUsers > 0 ? `${this.metrics.dailyActiveUsers.toLocaleString()} active today` : 'Live platform telemetry';
  }

  getSubscriptionConversionLabel(): string {
    const total = Number(this.metrics.totalUsers || 0);
    const subs = Number(this.metrics.activeSubscribers || 0);
    if (total > 0) {
      const pct = (subs / total) * 100;
      return `${pct.toFixed(1)}% paid conversion`;
    }
    return 'Paid subscriber telemetry';
  }

  getRevenueTrendLabel(): string {
    const t = this.timeSeriesTrends?.['12m'] || this.timeSeriesTrends?.['90d'] || [];
    if (t.length >= 2) {
      const prev = Number(t[t.length - 2]?.revenue || 0);
      const curr = Number(t[t.length - 1]?.revenue || 0);
      if (prev > 0) {
        const pct = ((curr - prev) / prev) * 100;
        const sign = pct >= 0 ? '+' : '';
        return `${sign}${pct.toFixed(1)}% vs previous period`;
      }
      if (curr > 0) return 'Revenue recorded this period';
    }
    return this.metrics.monthlyRevenue > 0 ? 'Current month revenue' : 'Revenue telemetry syncing';
  }

  private loadChatMessages(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('maxx_admin_dashboard_chat_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.chatMessages = parsed;
        }
      }
    } catch {
      // ignore invalid local cache
    }
  }

  private saveChatMessages(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem('maxx_admin_dashboard_chat_v1', JSON.stringify(this.chatMessages.slice(-200)));
    } catch {
      // ignore storage quota/errors
    }
  }

  getFilteredMessages(): ChatMessage[] {
    return this.chatMessages.filter(m => m.room === this.currentRoom);
  }

  sendChatMessage(): void {
    if (!this.newMessageText || !this.newMessageText.trim()) return;
    const newMsg: ChatMessage = {
      id: Date.now(),
      senderName: 'Super Admin',
      senderAvatar: '⚡',
      role: 'SuperAdmin',
      roleColor: '#1a4cd8',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      room: this.currentRoom,
      message: this.newMessageText.trim()
    };
    this.chatMessages.push(newMsg);
    this.newMessageText = '';
    this.saveChatMessages();
  }

  onNavigate(route: string): void {
    this.router.navigateByUrl(route);
  }
}
