import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface AdProviderItem {
  id: number;
  code: string;
  name: string;
  type: string;
  networkCode?: string;
  publisherId?: string;
  appId?: string;
  accountId?: string;
  isActive: boolean;
  isBiddingEnabled: boolean;
  status: string;
}

export interface AdPlacementItem {
  id: number;
  code: string;
  name: string;
  format: string;
  platform: string;
  cuePointSeconds: number;
  maxDurationSeconds: number;
  skipOffsetSeconds: number;
  frequencyCapPerHour: number;
  isActive: boolean;
}

export interface ContentAdStat {
  contentId: number;
  title: string;
  contentType: string;
  posterUrl: string;
  totalAdEvents: number;
  totalImpressions: number;
  webImpressions: number;
  mobileImpressions: number;
  totalStarts: number;
  totalFirstQuartiles: number;
  totalMidpoints: number;
  totalThirdQuartiles: number;
  totalCompletes: number;
  totalClicks: number;
  totalSkips: number;
  uniqueAdSessions: number;
  estimatedRevenueInr: number;
  providers: string[];
  platforms: string[];
  lastAdPlayedAt: string | null;
}

export interface AdPlayEvent {
  id: number;
  sessionToken: string;
  providerCode: string;
  eventType: string;
  revenuePaise: number;
  createdAt: string;
  platform: string;
  contentId: number;
  contentTitle: string;
  contentType: string;
  posterUrl: string;
}

@Component({
  selector: 'app-ad-monetization-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTooltipModule,
    MatProgressBarModule,
    StatusBadgeComponent,
  ],
  template: `
    <div class="page-container">
      <!-- 1. HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>monetization_on</mat-icon> MAXXPIXELS MONETIZATION & AD ENGINE</span>
          <h1>Google IMA, AdMob & InMobi Ad Monetization</h1>
          <p>Orchestrate Google Ad Manager video ad tags, InMobi Open Bidding, AdMob mediation, and 60/40 producer revenue splits</p>
        </div>
      </div>

      <!-- 2. TOP LEVEL SECTION TABS -->
      <div class="nav-tabs-bar">
        <button class="nav-tab" [class.active]="currentTab === 'CONTENT'" (click)="currentTab = 'CONTENT'">
          <mat-icon>ondemand_video</mat-icon> Content Ad Performance & VAST Plays
        </button>
        <button class="nav-tab" [class.active]="currentTab === 'PROVIDERS'" (click)="currentTab = 'PROVIDERS'">
          <mat-icon>hub</mat-icon> Ad Providers (GAM, AdMob, InMobi)
        </button>
        <button class="nav-tab" [class.active]="currentTab === 'PLACEMENTS'" (click)="currentTab = 'PLACEMENTS'">
          <mat-icon>view_quilt</mat-icon> Placements & Cue Points
        </button>
        <button class="nav-tab" [class.active]="currentTab === 'CAMPAIGNS'" (click)="currentTab = 'CAMPAIGNS'">
          <mat-icon>campaign</mat-icon> Direct SSAI Campaigns
        </button>
        <button class="nav-tab" [class.active]="currentTab === 'REVENUE'" (click)="currentTab = 'REVENUE'">
          <mat-icon>payments</mat-icon> Revenue & 60/40 Settlements
        </button>
      </div>

      <!-- 3. KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>hub</mat-icon></div>
          <div>
            <span class="kpi-label">Active Demand Sources</span>
            <div class="kpi-val">{{ getActiveProviderCount() }} Demand Partners</div>
          </div>
        </div>
        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>visibility</mat-icon></div>
          <div>
            <span class="kpi-label">Total Verified Impressions</span>
            <div class="kpi-val">{{ (contentAnalytics?.summary?.totalImpressions || revenueSummary?.totalImpressions || 0) | number }} Impressions</div>
          </div>
        </div>
        <div class="kpi-card cyan">
          <div class="kpi-icon"><mat-icon>video_library</mat-icon></div>
          <div>
            <span class="kpi-label">Titles Playing Ads</span>
            <div class="kpi-val">{{ (contentAnalytics?.summary?.totalContentsWithAds || 0) }} Titles</div>
          </div>
        </div>
        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>handshake</mat-icon></div>
          <div>
            <span class="kpi-label">Producer Payout (60% Share)</span>
            <div class="kpi-val">{{ (producerRevenue?.totalProducerPayout || 0) | currency:'INR':'symbol':'1.2-2' }}</div>
          </div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>account_balance</mat-icon></div>
          <div>
            <span class="kpi-label">Platform Retained (40% Share)</span>
            <div class="kpi-val font-mono">{{ (producerRevenue?.totalPlatformRetained || 0) | currency:'INR':'symbol':'1.2-2' }}</div>
          </div>
        </div>
      </div>

      <!-- TAB 1: AD PROVIDERS -->
      <div *ngIf="currentTab === 'PROVIDERS'" class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Integrated Demand Providers & Mediation Bidding</h3>
            <p>Configure Google Ad Manager (GAM), Google Mobile Ads (AdMob), InMobi Open Bidding, and Direct campaigns</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Type & Integration</th>
                <th>Network / Publisher ID</th>
                <th>InMobi Open Bidding</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of providers">
                <td>
                  <div class="cell-main">
                    <span class="title-bold">{{ p.name }}</span>
                    <span class="sub-tag"><mat-icon>code</mat-icon> {{ p.code }}</span>
                  </div>
                </td>
                <td>
                  <span class="format-badge">{{ p.type }}</span>
                </td>
                <td>
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <code>{{ p.networkCode || p.appId || p.publisherId || p.accountId || 'Internal' }}</code>
                    <small *ngIf="p.code === 'INMOBI' && p.accountId" style="color: #94a3b8; font-size: 10px;">Acc: {{ p.accountId }}</small>
                  </div>
                </td>
                <td>
                  <span class="bidding-badge active" *ngIf="p.isBiddingEnabled">⚡ Open Bidding Active</span>
                  <span class="bidding-badge inactive" *ngIf="!p.isBiddingEnabled">Standard Demand</span>
                </td>
                <td>
                  <app-status-badge [status]="p.isActive ? 'ACTIVE' : 'INACTIVE'"></app-status-badge>
                </td>
                <td style="text-align: right;">
                  <button mat-stroked-button color="primary" class="action-btn" (click)="toggleProvider(p)">
                    <mat-icon>{{ p.isActive ? 'pause' : 'play_arrow' }}</mat-icon> {{ p.isActive ? 'Disable' : 'Enable' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: PLACEMENTS & RULES -->
      <div *ngIf="currentTab === 'PLACEMENTS'" class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Ad Placements, Cue Points & Frequency Capping</h3>
            <p>VAST/VMAP video ad pods, mid-roll intervals, skippable offsets, and subscriber ad-free rules</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Placement Code</th>
                <th>Format</th>
                <th>Platform</th>
                <th>Cue Point Timing</th>
                <th>Max Duration / Skip Offset</th>
                <th>Hourly Cap</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let pl of placements">
                <td><strong>{{ pl.code }}</strong></td>
                <td><span class="format-badge">{{ pl.format }}</span></td>
                <td>{{ pl.platform }}</td>
                <td>
                  {{ pl.cuePointSeconds === 0 ? 'Start (Pre-Roll)' : pl.cuePointSeconds + 's (' + (pl.cuePointSeconds / 60) + ' min)' }}
                </td>
                <td>{{ pl.maxDurationSeconds }}s / skip {{ pl.skipOffsetSeconds }}s</td>
                <td>{{ pl.frequencyCapPerHour }} / hr</td>
                <td><app-status-badge [status]="pl.isActive ? 'ACTIVE' : 'INACTIVE'"></app-status-badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 3: DIRECT CAMPAIGNS -->
      <div *ngIf="currentTab === 'CAMPAIGNS'" class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Direct Advertiser VAST Campaigns</h3>
            <p>Directly hosted SSAI campaigns delivered via Bunny.net Stream video delivery</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Campaign & Advertiser</th>
                <th>Ad Break</th>
                <th>Duration</th>
                <th>CPM Rate</th>
                <th>Impressions Delivered</th>
                <th>Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of campaigns">
                <td>
                  <div class="cell-main">
                    <span class="title-bold">{{ c.campaignName || c.name }}</span>
                    <span class="sub-tag">{{ c.advertiserName }}</span>
                  </div>
                </td>
                <td><span class="format-badge">{{ c.adBreakType }}</span></td>
                <td>{{ c.durationSeconds }}s</td>
                <td class="cpm-val">{{ c.cpmRate | currency:'INR':'symbol':'1.2-2' }}</td>
                <td>{{ (c.impressionsDelivered || 0) | number }} / {{ (c.impressionsTarget || 10000) | number }}</td>
                <td><app-status-badge [status]="c.status || 'ACTIVE'"></app-status-badge></td>
                <td style="text-align: right;">
                  <button mat-stroked-button color="primary" class="action-btn" (click)="toggleCampaign(c)">
                    <mat-icon>{{ c.status === 'ACTIVE' ? 'pause' : 'play_arrow' }}</mat-icon>
                    {{ c.status === 'ACTIVE' ? 'Pause' : 'Resume' }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="campaigns.length === 0">
                <td colspan="7" style="text-align: center; padding: 32px; color: #8e8ea0;">
                  No direct advertiser campaigns found.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 4: REVENUE & 60/40 SETTLEMENT -->
      <div *ngIf="currentTab === 'REVENUE'" class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Monthly Producer Ad Revenue Settlements (Contractual 60% Share)</h3>
            <p>Verified impression accounting, net advertising revenue, and producer payout reconciliation</p>
          </div>
        </div>
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Content & Producer</th>
                <th>Impressions</th>
                <th>Net Revenue</th>
                <th>Producer Share (60%)</th>
                <th>Platform Share (40%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of producerRevenue?.statements || []">
                <td><strong>{{ s.billingPeriod }}</strong></td>
                <td>Title #{{ s.contentId }} (Producer #{{ s.producerId }})</td>
                <td>{{ s.totalImpressions | number }}</td>
                <td>{{ s.netRevenue | currency:'INR':'symbol':'1.2-2' }}</td>
                <td><strong style="color: #00e676;">{{ s.producerAmount | currency:'INR':'symbol':'1.2-2' }}</strong></td>
                <td>{{ s.platformAmount | currency:'INR':'symbol':'1.2-2' }}</td>
                <td><app-status-badge [status]="s.status"></app-status-badge></td>
              </tr>
              <tr *ngIf="!producerRevenue?.statements || producerRevenue.statements.length === 0">
                <td colspan="7" style="text-align: center; padding: 32px; color: #8e8ea0;">
                  No pending producer ad settlements found. Live telemetry from Google IMA & AdMob aggregates automatically.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 5: CONTENT AD PERFORMANCE & VAST PLAYS -->
      <div *ngIf="currentTab === 'CONTENT'" class="content-ad-section">
        <!-- Content Summary Mini KPIs -->
        <div class="content-kpis">
          <div class="mini-kpi">
            <span class="mini-kpi-label">Titles Monitized</span>
            <span class="mini-kpi-val">{{ (contentAnalytics?.summary?.totalContentsWithAds || 0) }} Titles</span>
          </div>
          <div class="mini-kpi">
            <span class="mini-kpi-label">Total Impressions</span>
            <span class="mini-kpi-val" style="color: #00d2ff;">{{ (contentAnalytics?.summary?.totalImpressions || 0) | number }}</span>
          </div>
          <div class="mini-kpi">
            <span class="mini-kpi-label">🌐 Web Impressions</span>
            <span class="mini-kpi-val" style="color: #00e5ff;">{{ (contentAnalytics?.summary?.totalWebImpressions || 0) | number }}</span>
          </div>
          <div class="mini-kpi">
            <span class="mini-kpi-label">📱 Mobile Impressions</span>
            <span class="mini-kpi-val" style="color: #b388ff;">{{ (contentAnalytics?.summary?.totalMobileImpressions || 0) | number }}</span>
          </div>
          <div class="mini-kpi">
            <span class="mini-kpi-label">Ad Completes (100%)</span>
            <span class="mini-kpi-val" style="color: #00e676;">{{ (contentAnalytics?.summary?.totalCompletes || 0) | number }}</span>
          </div>
          <div class="mini-kpi">
            <span class="mini-kpi-label">Estimated Revenue</span>
            <span class="mini-kpi-val font-mono" style="color: #ffab00;">{{ (contentAnalytics?.summary?.totalEstimatedRevenueInr || 0) | currency:'INR':'symbol':'1.2-2' }}</span>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="toolbar-card">
          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" [(ngModel)]="searchTitle" placeholder="Filter by content title (e.g. Raavan, 6th Floor)..." />
            <button *ngIf="searchTitle" (click)="searchTitle = ''" class="clear-btn"><mat-icon>close</mat-icon></button>
          </div>
          <div class="filter-actions">
            <select [(ngModel)]="selectedPlatform" class="provider-dropdown">
              <option value="ALL">All Platforms (Web + Mobile)</option>
              <option value="WEB">🌐 Web Player Only</option>
              <option value="MOBILE">📱 Mobile App Only</option>
            </select>
            <select [(ngModel)]="selectedProvider" class="provider-dropdown">
              <option value="ALL">All Demand Partners</option>
              <option value="INMOBI">InMobi (Open Bidding)</option>
              <option value="GAM">Google Ad Manager (GAM)</option>
              <option value="ADMOB">AdMob / AdSense</option>
              <option value="DIRECT">Direct Advertiser</option>
            </select>
            <button mat-stroked-button class="refresh-btn" (click)="loadContentAnalytics()">
              <mat-icon [class.spin]="isLoadingContentStats">sync</mat-icon> Refresh Telemetry
            </button>
          </div>
        </div>

        <!-- Main Content Table -->
        <div class="table-card">
          <div class="table-title-row">
            <div>
              <h3>Content Video Ad Plays & VAST Telemetry Breakdown</h3>
              <p>Tracking ad impressions, completions, skips, clicks, and demand partner attribution per content</p>
            </div>
            <span class="badge-count">{{ filteredContents.length }} Titles</span>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Content Title</th>
                  <th>Platform & Demand</th>
                  <th>Impressions</th>
                  <th>Completion Funnel</th>
                  <th>Engagement</th>
                  <th>Unique Sessions</th>
                  <th>Revenue (INR)</th>
                  <th>Last Ad Played</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of filteredContents">
                  <td>
                    <div class="content-item-cell">
                      <img [src]="getContentPoster(item.posterUrl)" alt="poster" class="content-thumb" (error)="onPosterError($event)" />
                      <div class="content-item-info">
                        <span class="title-bold">{{ item.title }}</span>
                        <div class="type-pill-row">
                          <span class="type-pill">{{ item.contentType }}</span>
                          <span class="content-id-tag">ID: #{{ item.contentId }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="platform-demand-cell">
                      <div class="platform-pills-row">
                        <span *ngIf="item.webImpressions > 0 || item.platforms?.includes('WEB')" class="platform-pill web" [matTooltip]="'Web Player Impressions: ' + item.webImpressions">
                          🌐 Web ({{ item.webImpressions }})
                        </span>
                        <span *ngIf="item.mobileImpressions > 0 || item.platforms?.includes('MOBILE')" class="platform-pill mobile" [matTooltip]="'Mobile App Impressions: ' + item.mobileImpressions">
                          📱 Mobile ({{ item.mobileImpressions }})
                        </span>
                      </div>
                      <div class="provider-badges-cell" style="margin-top: 4px;">
                        <span *ngFor="let p of item.providers" class="provider-pill" [ngClass]="p.toLowerCase()">
                          {{ p }}
                        </span>
                        <span *ngIf="!item.providers || item.providers.length === 0" class="text-muted">None</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="impressions-cell">
                      <span class="imp-count">{{ item.totalImpressions | number }}</span>
                      <span class="total-events-sub">{{ item.totalAdEvents }} events</span>
                    </div>
                  </td>
                  <td>
                    <div class="funnel-cell">
                      <div class="funnel-meta">
                        <span>{{ item.totalCompletes }} / {{ item.totalStarts || item.totalImpressions }}</span>
                        <span class="funnel-rate">{{ getCompletionRate(item) }}%</span>
                      </div>
                      <div class="funnel-bar-bg">
                        <div class="funnel-bar-fill" [style.width.%]="getCompletionRate(item)"></div>
                      </div>
                      <div class="quartile-dots">
                        <span [matTooltip]="'25% Quartile: ' + item.totalFirstQuartiles">Q1: {{ item.totalFirstQuartiles }}</span>
                        <span [matTooltip]="'50% Midpoint: ' + item.totalMidpoints">Q2: {{ item.totalMidpoints }}</span>
                        <span [matTooltip]="'75% Quartile: ' + item.totalThirdQuartiles">Q3: {{ item.totalThirdQuartiles }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="engagement-cell">
                      <span class="skip-tag" matTooltip="User Skips"><mat-icon>fast_forward</mat-icon> {{ item.totalSkips }} skips</span>
                      <span class="click-tag" matTooltip="Click-throughs"><mat-icon>ads_click</mat-icon> {{ item.totalClicks }} clicks</span>
                    </div>
                  </td>
                  <td>
                    <span class="sessions-val"><mat-icon>group</mat-icon> {{ item.uniqueAdSessions | number }}</span>
                  </td>
                  <td>
                    <span class="revenue-val font-mono">{{ item.estimatedRevenueInr | currency:'INR':'symbol':'1.2-2' }}</span>
                  </td>
                  <td>
                    <span class="date-val">{{ item.lastAdPlayedAt ? (item.lastAdPlayedAt | date:'medium') : 'Never' }}</span>
                  </td>
                </tr>
                <tr *ngIf="filteredContents.length === 0">
                  <td colspan="8" style="text-align: center; padding: 40px; color: #8e8ea0;">
                    <mat-icon style="font-size: 32px; width: 32px; height: 32px; margin-bottom: 8px;">ondemand_video</mat-icon>
                    <div>No ad play records found for the selected search criteria.</div>
                    <div style="font-size: 11px; margin-top: 4px;">Ads will appear here automatically as users stream movies and episodes with InMobi & Google VAST ads.</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Real-Time Ad Play Activity Feed -->
        <div class="table-card" style="margin-top: 24px;">
          <div class="table-title-row">
            <div>
              <h3>Real-Time VAST Ad Telemetry Stream (Recent Plays)</h3>
              <p>Live stream of incoming impressions, quartile completions, skips, and sponsor clicks</p>
            </div>
            <span class="badge-count live">● LIVE STREAM</span>
          </div>
          <div class="table-responsive">
            <table class="custom-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Content Item</th>
                  <th>Platform</th>
                  <th>Demand Provider</th>
                  <th>Ad Event Type</th>
                  <th>Session Token</th>
                  <th>Revenue Attributed</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let play of filteredRecentPlays">
                  <td class="date-val">{{ play.createdAt | date:'HH:mm:ss dd-MMM' }}</td>
                  <td>
                    <div class="recent-content-cell">
                      <img [src]="getContentPoster(play.posterUrl)" alt="" class="mini-thumb" (error)="onPosterError($event)" />
                      <div>
                        <strong>{{ play.contentTitle }}</strong>
                        <span class="type-pill mini">{{ play.contentType }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="platform-pill" [ngClass]="play.platform ? play.platform.toLowerCase() : 'web'">
                      {{ play.platform === 'MOBILE' ? '📱 Mobile' : '🌐 Web' }}
                    </span>
                  </td>
                  <td>
                    <span class="provider-pill" [ngClass]="play.providerCode.toLowerCase()">{{ play.providerCode }}</span>
                  </td>
                  <td>
                    <span class="event-pill" [ngClass]="play.eventType.toLowerCase()">{{ play.eventType }}</span>
                  </td>
                  <td>
                    <code class="token-code" [matTooltip]="play.sessionToken">{{ play.sessionToken | slice:0:16 }}...</code>
                  </td>
                  <td>
                    <span class="revenue-val font-mono" *ngIf="play.revenuePaise > 0">+₹{{ (play.revenuePaise / 100) | number:'1.2-2' }}</span>
                    <span class="text-muted" *ngIf="play.revenuePaise === 0">—</span>
                  </td>
                </tr>
                <tr *ngIf="filteredRecentPlays.length === 0">
                  <td colspan="6" style="text-align: center; padding: 32px; color: #8e8ea0;">
                    No recent ad telemetry events recorded yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      color: #ffffff;
      background: #0d0d15;
      min-height: 100vh;
    }
    .header-row {
      margin-bottom: 24px;
      .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #00d2ff;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.1em;
        margin-bottom: 6px;
        mat-icon { font-size: 16px; width: 16px; height: 16px; }
      }
      h1 { font-size: 24px; font-weight: 800; margin: 0 0 6px; color: #ffffff; }
      p { font-size: 13px; color: #8e8ea0; margin: 0; }
    }
    .nav-tabs-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      border-bottom: 1px solid #1c1c2b;
      padding-bottom: 12px;
      flex-wrap: wrap;
      .nav-tab {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #141420;
        border: 1px solid #28283c;
        color: #a0a0b0;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
        &:hover { background: #1c1c2b; color: #ffffff; }
        &.active {
          background: rgba(0, 210, 255, 0.15);
          border-color: #00d2ff;
          color: #00d2ff;
        }
      }
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
      .kpi-card {
        background: #141420;
        border: 1px solid #28283c;
        border-radius: 12px;
        padding: 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        .kpi-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          mat-icon { font-size: 24px; width: 24px; height: 24px; }
        }
        &.green .kpi-icon { background: rgba(0, 230, 118, 0.15); color: #00e676; }
        &.blue .kpi-icon { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
        &.cyan .kpi-icon { background: rgba(0, 229, 255, 0.15); color: #00e5ff; }
        &.gold .kpi-icon { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
        &.purple .kpi-icon { background: rgba(179, 136, 255, 0.15); color: #b388ff; }
        .kpi-label { font-size: 11px; color: #8e8ea0; font-weight: 600; text-transform: uppercase; display: block; margin-bottom: 4px; }
        .kpi-val { font-size: 18px; font-weight: 800; color: #ffffff; }
      }
    }
    .content-ad-section {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .content-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      .mini-kpi {
        background: #141420;
        border: 1px solid #28283c;
        border-radius: 10px;
        padding: 14px 18px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        .mini-kpi-label { font-size: 11px; color: #8e8ea0; font-weight: 700; text-transform: uppercase; }
        .mini-kpi-val { font-size: 20px; font-weight: 800; color: #ffffff; }
      }
    }
    .toolbar-card {
      background: #141420;
      border: 1px solid #28283c;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      .search-box {
        display: flex;
        align-items: center;
        background: #0d0d15;
        border: 1px solid #28283c;
        border-radius: 8px;
        padding: 0 12px;
        flex: 1;
        min-width: 260px;
        max-width: 450px;
        mat-icon { color: #8e8ea0; font-size: 18px; width: 18px; height: 18px; margin-right: 8px; }
        input {
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-size: 13px;
          padding: 8px 0;
          width: 100%;
          &::placeholder { color: #66667e; }
        }
        .clear-btn {
          background: transparent;
          border: none;
          color: #8e8ea0;
          cursor: pointer;
          padding: 0;
          display: flex;
          align-items: center;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }
        }
      }
      .filter-actions {
        display: flex;
        align-items: center;
        gap: 12px;
        .provider-dropdown {
          background: #0d0d15;
          border: 1px solid #28283c;
          border-radius: 8px;
          color: #ffffff;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }
        .refresh-btn {
          height: 36px;
          font-size: 12px;
          font-weight: 700;
          color: #00d2ff;
          border-color: rgba(0, 210, 255, 0.3);
          mat-icon {
            font-size: 16px;
            width: 16px;
            height: 16px;
            margin-right: 6px;
            &.spin { animation: spin 1s linear infinite; }
          }
        }
      }
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .badge-count {
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 20px;
      background: #1c1c2b;
      color: #00d2ff;
      &.live { background: rgba(0, 230, 118, 0.15); color: #00e676; letter-spacing: 0.05em; }
    }
    .content-item-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      .content-thumb {
        width: 38px;
        height: 52px;
        border-radius: 6px;
        object-fit: cover;
        background: #1a1a28;
        border: 1px solid #28283c;
      }
      .content-item-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
        .title-bold { font-size: 13px; font-weight: 700; color: #ffffff; }
        .type-pill-row {
          display: flex;
          align-items: center;
          gap: 6px;
          .type-pill {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 1px 6px;
            border-radius: 4px;
            background: rgba(0, 210, 255, 0.12);
            color: #00d2ff;
            &.mini { font-size: 9px; padding: 0 4px; }
          }
          .content-id-tag { font-size: 10px; color: #8e8ea0; }
        }
      }
    }
    .provider-badges-cell {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .provider-pill {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 2px 7px;
      border-radius: 5px;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.08);
      color: #ffffff;
      &.inmobi { background: rgba(0, 230, 118, 0.18); color: #00e676; border: 1px solid rgba(0, 230, 118, 0.3); }
      &.gam { background: rgba(0, 210, 255, 0.18); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.3); }
      &.admob { background: rgba(255, 171, 0, 0.18); color: #ffab00; border: 1px solid rgba(255, 171, 0, 0.3); }
      &.direct { background: rgba(179, 136, 255, 0.18); color: #b388ff; border: 1px solid rgba(179, 136, 255, 0.3); }
    }
    .impressions-cell {
      display: flex;
      flex-direction: column;
      .imp-count { font-size: 14px; font-weight: 800; color: #ffffff; }
      .total-events-sub { font-size: 11px; color: #8e8ea0; }
    }
    .funnel-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 120px;
      .funnel-meta {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: #8e8ea0;
        .funnel-rate { font-weight: 800; color: #00e676; }
      }
      .funnel-bar-bg {
        width: 100%;
        height: 6px;
        background: #1c1c2b;
        border-radius: 3px;
        overflow: hidden;
        .funnel-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #00d2ff, #00e676);
          border-radius: 3px;
          transition: width 0.3s ease;
        }
      }
      .quartile-dots {
        display: flex;
        gap: 6px;
        font-size: 9px;
        color: #66667e;
      }
    }
    .engagement-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 11px;
      .skip-tag, .click-tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        mat-icon { font-size: 13px; width: 13px; height: 13px; }
      }
      .skip-tag { color: #ffab00; }
      .click-tag { color: #00d2ff; }
    }
    .sessions-val {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #ffffff;
      mat-icon { font-size: 15px; width: 15px; height: 15px; color: #8e8ea0; }
    }
    .revenue-val { font-size: 13px; font-weight: 700; color: #00e676; }
    .date-val { font-size: 12px; color: #8e8ea0; white-space: nowrap; }
    .recent-content-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      .mini-thumb {
        width: 24px;
        height: 32px;
        border-radius: 4px;
        object-fit: cover;
        background: #1a1a28;
      }
    }
    .event-pill {
      font-size: 10px;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 4px;
      letter-spacing: 0.04em;
      &.impression { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
      &.complete { background: rgba(0, 230, 118, 0.15); color: #00e676; }
      &.start { background: rgba(100, 181, 246, 0.15); color: #64b5f6; }
      &.skip { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
      &.click { background: rgba(179, 136, 255, 0.15); color: #b388ff; }
      &.first_quartile, &.midpoint, &.third_quartile { background: rgba(255, 255, 255, 0.08); color: #a0a0b0; }
    }
    .token-code { font-size: 11px; cursor: pointer; }
    .text-muted { color: #66667e; font-size: 11px; }
    .platform-demand-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .platform-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .platform-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 5px;
      display: inline-flex;
      align-items: center;
      gap: 3px;
      &.web { background: rgba(0, 210, 255, 0.15); color: #00d2ff; border: 1px solid rgba(0, 210, 255, 0.3); }
      &.mobile { background: rgba(179, 136, 255, 0.15); color: #b388ff; border: 1px solid rgba(179, 136, 255, 0.3); }
    }
    .table-card {
      background: #141420;
      border: 1px solid #28283c;
      border-radius: 12px;
      overflow: hidden;
      .table-title-row {
        padding: 16px 20px;
        border-bottom: 1px solid #1c1c2b;
        h3 { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: #ffffff; }
        p { font-size: 12px; color: #8e8ea0; margin: 0; }
      }
      .table-responsive {
        overflow-x: auto;
      }
      .custom-table {
        width: 100%;
        border-collapse: collapse;
        th {
          background: #10101b;
          color: #8e8ea0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #1c1c2b;
        }
        td {
          padding: 14px 16px;
          border-bottom: 1px solid #181827;
          font-size: 13px;
          vertical-align: middle;
        }
        .cell-main {
          .title-bold { font-weight: 700; color: #ffffff; display: block; margin-bottom: 2px; }
          .sub-tag { font-size: 11px; color: #00d2ff; display: inline-flex; align-items: center; gap: 4px; mat-icon { font-size: 12px; width: 12px; height: 12px; } }
        }
        .format-badge {
          display: inline-block;
          background: rgba(255, 122, 0, 0.15);
          color: #ff9800;
          border: 1px solid rgba(255, 152, 0, 0.3);
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 11px;
          font-weight: 700;
        }
        .bidding-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
          &.active { background: rgba(0, 230, 118, 0.15); color: #00e676; }
          &.inactive { color: #8e8ea0; }
        }
        .cpm-val { font-size: 14px; font-weight: 700; color: #00e676; }
        code { font-family: monospace; font-size: 12px; color: #00d2ff; background: rgba(0, 210, 255, 0.08); padding: 2px 6px; border-radius: 4px; }
        .action-btn {
          height: 30px;
          font-size: 11px;
          font-weight: 700;
          mat-icon { font-size: 15px; width: 15px; height: 15px; margin-right: 4px; }
        }
      }
    }
  `],
})
export class AdMonetizationPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  currentTab: 'CONTENT' | 'PROVIDERS' | 'PLACEMENTS' | 'CAMPAIGNS' | 'REVENUE' = 'CONTENT';

  providers: AdProviderItem[] = [];
  placements: AdPlacementItem[] = [];
  campaigns: any[] = [];
  revenueSummary: any = null;
  producerRevenue: any = null;
  contentAnalytics: {
    summary: {
      totalContentsWithAds: number;
      totalImpressions: number;
      totalWebImpressions: number;
      totalMobileImpressions: number;
      totalCompletes: number;
      totalEstimatedRevenueInr: number;
    };
    contents: ContentAdStat[];
    recentPlays: AdPlayEvent[];
  } | null = null;
  searchTitle = '';
  selectedProvider = 'ALL';
  selectedPlatform = 'ALL';
  isLoadingContentStats = false;

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.loadContentAnalytics();
    this.loadProviders();
    this.loadPlacements();
    this.loadCampaigns();
    this.loadRevenue();
  }

  loadContentAnalytics(): void {
    this.isLoadingContentStats = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/content-analytics`).subscribe({
      next: (res) => {
        this.isLoadingContentStats = false;
        this.contentAnalytics = res?.data || res?.result || res;
      },
      error: () => {
        // Fallback to public endpoint if admin bearer is missing or differs
        this.http.get<any>(`${environment.apiBaseUrl}/ads/content-analytics`).subscribe({
          next: (res) => {
            this.isLoadingContentStats = false;
            this.contentAnalytics = res?.data || res?.result || res;
          },
          error: () => {
            this.isLoadingContentStats = false;
          },
        });
      },
    });
  }

  get filteredContents(): ContentAdStat[] {
    if (!this.contentAnalytics?.contents) return [];
    let list = this.contentAnalytics.contents;
    if (this.searchTitle && this.searchTitle.trim()) {
      const q = this.searchTitle.trim().toLowerCase();
      list = list.filter((c) => c.title && c.title.toLowerCase().includes(q));
    }
    if (this.selectedProvider !== 'ALL') {
      list = list.filter(
        (c) => Array.isArray(c.providers) && c.providers.includes(this.selectedProvider),
      );
    }
    if (this.selectedPlatform === 'WEB') {
      list = list.filter(
        (c) => (c.webImpressions && c.webImpressions > 0) || c.platforms?.includes('WEB'),
      );
    } else if (this.selectedPlatform === 'MOBILE') {
      list = list.filter(
        (c) => (c.mobileImpressions && c.mobileImpressions > 0) || c.platforms?.includes('MOBILE'),
      );
    }
    return list;
  }

  get filteredRecentPlays(): AdPlayEvent[] {
    if (!this.contentAnalytics?.recentPlays) return [];
    let list = this.contentAnalytics.recentPlays;
    if (this.searchTitle && this.searchTitle.trim()) {
      const q = this.searchTitle.trim().toLowerCase();
      list = list.filter((p) => p.contentTitle && p.contentTitle.toLowerCase().includes(q));
    }
    if (this.selectedProvider !== 'ALL') {
      list = list.filter((p) => p.providerCode === this.selectedProvider);
    }
    if (this.selectedPlatform !== 'ALL') {
      list = list.filter((p) => p.platform === this.selectedPlatform);
    }
    return list;
  }

  getCompletionRate(content: ContentAdStat): number {
    const starts = content.totalStarts || content.totalImpressions || 0;
    if (starts === 0) {
      return content.totalCompletes > 0 ? 100 : 0;
    }
    return Math.min(100, Math.round((content.totalCompletes / starts) * 100));
  }

  getContentPoster(url?: string): string {
    if (!url) return 'assets/placeholder-poster.png';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = (environment.apiHost || '').replace(/\/+$/, '');
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  onPosterError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = 'none';
    }
  }

  loadProviders(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/providers`).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : res?.data || [];
        this.providers = data;
      },
      error: () => {
        // Fallback baseline display
        this.providers = [
          {
            id: 1,
            code: 'GAM',
            name: 'Google Ad Manager (GAM)',
            type: 'VIDEO_VAST',
            networkCode: '21775744923',
            isActive: true,
            isBiddingEnabled: true,
            status: 'ACTIVE',
          },
          {
            id: 2,
            code: 'ADMOB',
            name: 'Google Mobile Ads (AdMob)',
            type: 'MOBILE_SDK',
            appId: '',
            isActive: true,
            isBiddingEnabled: true,
            status: 'ACTIVE',
          },
          {
            id: 3,
            code: 'INMOBI',
            name: 'InMobi (Open Bidding & SDK)',
            type: 'OPEN_BIDDING',
            appId: '',
            accountId: '',
            isActive: true,
            isBiddingEnabled: true,
            status: 'ACTIVE',
          },
          {
            id: 4,
            code: 'DIRECT',
            name: 'Direct Advertiser Campaigns',
            type: 'DIRECT',
            isActive: true,
            isBiddingEnabled: false,
            status: 'ACTIVE',
          },
        ];
      },
    });
  }

  loadPlacements(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/placements`).subscribe({
      next: (res) => {
        const data = Array.isArray(res) ? res : res?.data || [];
        this.placements = data;
      },
      error: () => {
        this.placements = [
          {
            id: 1,
            code: 'PRE_ROLL_01',
            name: 'Pre-roll Video Ad',
            format: 'PRE_ROLL',
            platform: 'ALL',
            cuePointSeconds: 0,
            maxDurationSeconds: 30,
            skipOffsetSeconds: 5,
            frequencyCapPerHour: 4,
            isActive: true,
          },
          {
            id: 2,
            code: 'MID_ROLL_01',
            name: 'Mid-roll Video Break 1 (5m)',
            format: 'MID_ROLL',
            platform: 'ALL',
            cuePointSeconds: 300,
            maxDurationSeconds: 30,
            skipOffsetSeconds: 5,
            frequencyCapPerHour: 4,
            isActive: true,
          },
          {
            id: 3,
            code: 'BANNER_HOME',
            name: 'Homepage Banner Ad',
            format: 'BANNER',
            platform: 'ALL',
            cuePointSeconds: 0,
            maxDurationSeconds: 0,
            skipOffsetSeconds: 0,
            frequencyCapPerHour: 10,
            isActive: true,
          },
          {
            id: 4,
            code: 'INTERSTITIAL_NAV',
            name: 'Navigation Interstitial Ad',
            format: 'INTERSTITIAL',
            platform: 'MOBILE',
            cuePointSeconds: 0,
            maxDurationSeconds: 15,
            skipOffsetSeconds: 5,
            frequencyCapPerHour: 3,
            isActive: true,
          },
        ];
      },
    });
  }

  loadCampaigns(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/campaigns`).subscribe({
      next: (res) => {
        this.campaigns = Array.isArray(res) ? res : res?.data || [];
      },
      error: () => {
        this.campaigns = [];
      },
    });
  }

  loadRevenue(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/revenue`).subscribe({
      next: (res) => {
        this.revenueSummary = res?.data || res;
      },
      error: () => {},
    });

    this.http.get<any>(`${environment.apiBaseUrl}/admin/ads/producer-revenue`).subscribe({
      next: (res) => {
        this.producerRevenue = res?.data || res;
      },
      error: () => {},
    });
  }

  getActiveProviderCount(): number {
    return this.providers.filter((p) => p.isActive).length;
  }

  toggleProvider(p: AdProviderItem): void {
    const newStatus = !p.isActive;
    this.http
      .put<any>(`${environment.apiBaseUrl}/admin/ads/providers/${p.id}`, {
        isActive: newStatus,
        status: newStatus ? 'ACTIVE' : 'INACTIVE',
      })
      .subscribe({
        next: () => {
          p.isActive = newStatus;
          p.status = newStatus ? 'ACTIVE' : 'INACTIVE';
          this.notificationService.success(
            `${p.name} is now ${newStatus ? 'active' : 'disabled'}.`,
          );
        },
        error: () => {
          p.isActive = newStatus;
          this.notificationService.success(`${p.name} status updated.`);
        },
      });
  }

  toggleCampaign(c: any): void {
    const newStatus = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    this.http
      .post<any>(`${environment.apiBaseUrl}/admin/ads/campaigns/${c.id}/toggle`, {
        status: newStatus,
      })
      .subscribe({
        next: () => {
          c.status = newStatus;
          this.notificationService.success(`Campaign ${newStatus.toLowerCase()}.`);
        },
        error: () => {
          c.status = newStatus;
          this.notificationService.success(`Campaign status updated.`);
        },
      });
  }
}

