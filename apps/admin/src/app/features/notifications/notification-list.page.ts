import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { MediaUploadComponent } from '../../shared/components/media-upload/media-upload.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';
import { finalize } from 'rxjs';

const API = environment.apiBaseUrl;

export interface NotificationLogItem {
  id: string;
  userId?: string;
  channel: 'PUSH' | 'SMS' | 'WHATSAPP' | 'EMAIL';
  title?: string;
  message: string;
  recipientTarget?: string;
  status: 'SENT' | 'DELIVERED' | 'SIMULATED' | 'FAILED' | 'READ';
  errorDetails?: string;
  createdAt: string;
}

@Component({
  selector: 'app-notification-list-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatCardModule, MatInputModule, MatSelectModule, MatButtonModule,
    MatTabsModule, MatIconModule, MatProgressSpinnerModule,
    MatChipsModule, MatDividerModule, MatTableModule, MatTooltipModule,
    PermissionButtonComponent,
    MediaUploadComponent
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <div class="header-badge">
            <mat-icon>hub</mat-icon>
            <span>OMNICHANNEL MESSAGING ENGINE</span>
          </div>
          <h1 class="page-title">
            <mat-icon class="title-icon">campaign</mat-icon>
            Notification & Messaging Operations Center
          </h1>
          <p class="page-subtitle">
            Enterprise multi-channel dispatch suite for FCM Mobile Push, MSG91 Cellular SMS, WhatsApp Business, and Transactional Email.
          </p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="refresh-btn" (click)="loadHistory()">
            <mat-icon>refresh</mat-icon> Refresh Audit Logs
          </button>
        </div>
      </div>

      <mat-tab-group class="notif-tabs" animationDuration="200ms">

        <!-- ── TAB 1: Push Notification (FCM) ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">notifications_active</mat-icon>
            FCM Push Notification
          </ng-template>
          <div class="tab-content">
            <div class="two-col">

              <!-- Broadcast to Topic -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">wifi_tethering</mat-icon>
                  <mat-card-title>Topic Broadcast (All / Segmented Subscribers)</mat-card-title>
                  <mat-card-subtitle>Instant push to subscribed device topic pools</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="broadcastForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Target FCM Topic</mat-label>
                      <mat-select formControlName="topic">
                        <mat-option value="all_users">📢 All App Users (Global Broadcast)</mat-option>
                        <mat-option value="premium_subscribers">⭐ Premium / VIP Subscribers</mat-option>
                        <mat-option value="breaking_news">⚡ Breaking News & Announcements</mat-option>
                        <mat-option value="new_releases">🎬 New Movie & Web Series Releases</mat-option>
                        <mat-option value="live_sports">⚽ Live Sports & Streaming Events</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Push Title</mat-label>
                      <input matInput formControlName="title" placeholder="🔥 New Blockbuster Streaming Now!" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Message Body</mat-label>
                      <textarea matInput formControlName="message" rows="3" placeholder="Watch the latest 4K Ultra-HD release on MaxxPixels today." required></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Deep-link Target / Content Slug (Optional)</mat-label>
                      <input matInput formControlName="actionUrl" placeholder="e.g. /watch/salaar-part-1">
                    </mat-form-field>

                    <div class="upload-section">
                      <label class="field-label">Push Notification Banner Image (Rich Media)</label>
                      <app-media-upload
                        folder="notification"
                        label="Notification Image"
                        accept="image/*"
                        [initialUrl]="broadcastForm.value.imageUrl || ''"
                        (uploadComplete)="onImageUploaded('broadcast', $event)">
                      </app-media-upload>
                    </div>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="send"
                      [loading]="broadcastLoading()" (buttonClick)="onBroadcast()">
                      Broadcast FCM Push
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- Push to specific user -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">person</mat-icon>
                  <mat-card-title>Targeted Push to Specific User</mat-card-title>
                  <mat-card-subtitle>Direct device notification via User ID</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="userPushForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>User ID (UUID or Numeric)</mat-label>
                      <input matInput formControlName="userId" placeholder="e.g. 1001 or user UUID" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Title</mat-label>
                      <input matInput formControlName="title" placeholder="Your subscription renewal is ready" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Message</mat-label>
                      <textarea matInput formControlName="message" rows="3" placeholder="Click to explore the new plans." required></textarea>
                    </mat-form-field>

                    <div class="upload-section">
                      <label class="field-label">Push Notification Banner Image</label>
                      <app-media-upload
                        folder="notification"
                        label="Notification Image"
                        accept="image/*"
                        [initialUrl]="userPushForm.value.imageUrl || ''"
                        (uploadComplete)="onImageUploaded('user', $event)">
                      </app-media-upload>
                    </div>

                    <app-permission-button permission="CONTENT_CREATE" color="accent" icon="send"
                      [loading]="userPushLoading()" (buttonClick)="onPushToUser()">
                      Send Targeted Push
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

            </div>
          </div>
        </mat-tab>

        <!-- ── TAB 2: SMS Campaign (MSG91) ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">sms</mat-icon>
            MSG91 SMS Gateway
          </ng-template>
          <div class="tab-content">
            <div class="msg91-banner">
              <mat-icon>verified</mat-icon>
              <span>Powered by <strong>MSG91 Cellular Flow API v5</strong>. Integrated with DLT Principal Entity Headers and automatic fallback.</span>
            </div>
            <div class="two-col">

              <!-- Direct SMS -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">smartphone</mat-icon>
                  <mat-card-title>Send Direct SMS</mat-card-title>
                  <mat-card-subtitle>Single phone destination (E.164 with +91)</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="directSmsForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Phone Number</mat-label>
                      <input matInput formControlName="phoneNumber" placeholder="+918904204604" required>
                      <mat-hint>Include country code e.g. +91 or +1</mat-hint>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>MSG91 / DLT Template ID (Optional override)</mat-label>
                      <input matInput formControlName="dltTemplateId" placeholder="e.g. 64a8e... or Flow ID">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Sender ID / Header (Optional override)</mat-label>
                      <input matInput formControlName="dltHeaderId" placeholder="e.g. MAXXPX">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Message Content</mat-label>
                      <textarea matInput formControlName="message" rows="4" maxlength="160" required placeholder="Welcome to MaxxPixels OTT! Your account is active."></textarea>
                      <mat-hint align="end">{{ directSmsForm.get('message')?.value?.length || 0 }}/160 chars</mat-hint>
                    </mat-form-field>
                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="send"
                      [loading]="directSmsLoading()" (buttonClick)="onDirectSms()">
                      Send SMS via MSG91
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- Bulk SMS -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">group</mat-icon>
                  <mat-card-title>Bulk SMS Campaign Dispatch</mat-card-title>
                  <mat-card-subtitle>Paste multiple recipients (one phone per line)</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="bulkSmsForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Phone Numbers (one per line)</mat-label>
                      <textarea matInput formControlName="phoneNumbers" rows="4"
                        placeholder="+918904204604&#10;+919876543210&#10;+917890123456" required></textarea>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>MSG91 / DLT Template ID (Optional)</mat-label>
                      <input matInput formControlName="dltTemplateId" placeholder="e.g. 64a8e... or Flow ID">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Sender ID / Header (Optional)</mat-label>
                      <input matInput formControlName="dltHeaderId" placeholder="e.g. MAXXPX">
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>SMS Message</mat-label>
                      <textarea matInput formControlName="message" rows="3" maxlength="160" required placeholder="Weekend Movie Marathon on MaxxPixels! 50% discount on annual plan."></textarea>
                      <mat-hint align="end">{{ bulkSmsForm.get('message')?.value?.length || 0 }}/160 chars</mat-hint>
                    </mat-form-field>
                    <div class="recipient-count" *ngIf="bulkSmsRecipientCount() > 0">
                      <mat-icon>people</mat-icon>
                      <span>{{ bulkSmsRecipientCount() }} recipients target in queue</span>
                    </div>
                    <app-permission-button permission="CONTENT_CREATE" color="warn" icon="campaign"
                      [loading]="bulkSmsLoading()" (buttonClick)="onBulkSms()">
                      Launch Bulk SMS Campaign
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

            </div>
          </div>
        </mat-tab>

        <!-- ── TAB 3: WhatsApp Messaging ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">chat</mat-icon>
            WhatsApp Business
          </ng-template>
          <div class="tab-content">
            <div class="whatsapp-banner">
              <mat-icon>verified_user</mat-icon>
              <span>WhatsApp Cloud API enabled. Supports verified business profiles, template IDs, and interactive buttons.</span>
            </div>
            <div class="two-col">

              <!-- Direct WhatsApp -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon" style="color: #25D366;">chat</mat-icon>
                  <mat-card-title>Send Direct WhatsApp</mat-card-title>
                  <mat-card-subtitle>Direct outreach to a single subscriber</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="directWhatsappForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>WhatsApp Phone Number</mat-label>
                      <input matInput formControlName="phoneNumber" placeholder="+919999999999" required>
                      <mat-hint>Include country code e.g. +91</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Template ID / Name (Optional)</mat-label>
                      <input matInput formControlName="templateId" placeholder="maxxpixels_welcome_v1">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Message Text</mat-label>
                      <textarea matInput formControlName="message" rows="4" placeholder="Hello! Welcome to MaxxPixels. We have added new exclusive 4K content to your watchlist." required></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Media Image URL (Optional)</mat-label>
                      <input matInput formControlName="mediaUrl" placeholder="https://cdn.maxxpixels.tv/banners/welcome.jpg">
                    </mat-form-field>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="send"
                      [loading]="directWhatsappLoading()" (buttonClick)="onDirectWhatsapp()">
                      Send WhatsApp Message
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- Bulk WhatsApp -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon" style="color: #25D366;">groups</mat-icon>
                  <mat-card-title>Bulk WhatsApp Broadcast</mat-card-title>
                  <mat-card-subtitle>Blast campaign to multiple WhatsApp contacts</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="bulkWhatsappForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Recipient WhatsApp Numbers (one per line)</mat-label>
                      <textarea matInput formControlName="phoneNumbers" rows="4"
                        placeholder="+919999999999&#10;+918888888888&#10;+917777777777" required></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Template ID (Optional)</mat-label>
                      <input matInput formControlName="templateId" placeholder="maxxpixels_promo_v1">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Broadcast Message</mat-label>
                      <textarea matInput formControlName="message" rows="3" placeholder="Stream your favorite web series in 4K HDR today on MaxxPixels OTT!" required></textarea>
                    </mat-form-field>

                    <div class="recipient-count" *ngIf="bulkWhatsappRecipientCount() > 0">
                      <mat-icon>people</mat-icon>
                      <span>{{ bulkWhatsappRecipientCount() }} WhatsApp recipients</span>
                    </div>

                    <app-permission-button permission="CONTENT_CREATE" color="warn" icon="campaign"
                      [loading]="bulkWhatsappLoading()" (buttonClick)="onBulkWhatsapp()">
                      Launch Bulk WhatsApp Blast
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

            </div>
          </div>
        </mat-tab>

        <!-- ── TAB 4: Email SMTP ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">email</mat-icon>
            Email SMTP Delivery
          </ng-template>
          <div class="tab-content">
            <div class="two-col">

              <!-- Single Email -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">mark_email_read</mat-icon>
                  <mat-card-title>Send Single Transactional Email</mat-card-title>
                  <mat-card-subtitle>Branded responsive HTML delivery via SMTP</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="singleEmailForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Recipient Email Address</mat-label>
                      <input matInput type="email" formControlName="toEmail" placeholder="subscriber@example.com" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Email Subject</mat-label>
                      <input matInput formControlName="subject" placeholder="Welcome to MaxxPixels OTT VIP" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Email Message Content</mat-label>
                      <textarea matInput formControlName="body" rows="4" placeholder="Thank you for subscribing to MaxxPixels OTT. Enjoy unlimited streaming across all your devices." required></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Action Button Link URL (Optional)</mat-label>
                      <input matInput formControlName="actionUrl" placeholder="https://maxxpixels.com/watch">
                    </mat-form-field>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="send"
                      [loading]="singleEmailLoading()" (buttonClick)="onSingleEmail()">
                      Send Transactional Email
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- Bulk Email -->
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">mail_outline</mat-icon>
                  <mat-card-title>Bulk Email Campaign</mat-card-title>
                  <mat-card-subtitle>One email address per line</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="bulkEmailForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Recipient Email Addresses (one per line)</mat-label>
                      <textarea matInput formControlName="toEmails" rows="4"
                        placeholder="user1@example.com&#10;user2@example.com&#10;user3@example.com" required></textarea>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Campaign Subject</mat-label>
                      <input matInput formControlName="subject" placeholder="New Releases This Weekend on MaxxPixels" required>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Campaign Body / Announcement</mat-label>
                      <textarea matInput formControlName="body" rows="3" placeholder="Discover the hottest new releases, live cricket streaming, and 4K exclusive web series." required></textarea>
                    </mat-form-field>

                    <div class="recipient-count" *ngIf="bulkEmailRecipientCount() > 0">
                      <mat-icon>mail</mat-icon>
                      <span>{{ bulkEmailRecipientCount() }} email recipients queued</span>
                    </div>

                    <app-permission-button permission="CONTENT_CREATE" color="warn" icon="campaign"
                      [loading]="bulkEmailLoading()" (buttonClick)="onBulkEmail()">
                      Dispatch Bulk Email Blast
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

            </div>
          </div>
        </mat-tab>

        <!-- ── TAB 5: Multi-Channel Omni-Dispatch ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">hub</mat-icon>
            Omni-Channel Blast
          </ng-template>
          <div class="tab-content">
            <mat-card class="notif-card center-card">
              <mat-card-header>
                <mat-icon mat-card-avatar class="card-icon">all_inclusive</mat-icon>
                <mat-card-title>Omni-Channel Simultaneous Broadcast</mat-card-title>
                <mat-card-subtitle>Dispatches via Push + SMS + WhatsApp + Email simultaneously to a target subscriber</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <form [formGroup]="allChannelForm">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Target User ID</mat-label>
                    <input matInput formControlName="userId" placeholder="e.g. 1001 or user UUID" required>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Notification Title / Subject</mat-label>
                    <input matInput formControlName="title" placeholder="Important MaxxPixels Account Notice" required>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Message Body</mat-label>
                    <textarea matInput formControlName="message" rows="4" placeholder="Your subscription has been renewed. You can now access all VIP content." required></textarea>
                  </mat-form-field>

                  <div class="channel-chips">
                    <mat-chip-set>
                      <mat-chip color="primary" selected>🔔 FCM Push</mat-chip>
                      <mat-chip color="accent" selected>💬 MSG91 SMS</mat-chip>
                      <mat-chip style="background: rgba(37, 211, 102, 0.2); color: #25D366;" selected>📱 WhatsApp</mat-chip>
                      <mat-chip style="background: rgba(0, 210, 255, 0.2); color: #00d2ff;" selected>📧 Email SMTP</mat-chip>
                    </mat-chip-set>
                  </div>

                  <app-permission-button permission="CONTENT_CREATE" color="primary" icon="rocket_launch"
                    [loading]="allChannelLoading()" (buttonClick)="onAllChannels()">
                    Launch Omni-Channel Dispatch
                  </app-permission-button>
                </form>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- ── TAB 6: Gateway Health Diagnostics ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">sensors</mat-icon>
            Gateway Diagnostics
          </ng-template>
          <div class="tab-content">
            <div class="diagnostics-grid">
              
              <!-- FCM Card -->
              <div class="diag-card">
                <div class="diag-header">
                  <div class="diag-icon-box fcm"><mat-icon>notifications_active</mat-icon></div>
                  <div>
                    <h4>Firebase (FCM) Push</h4>
                    <span class="diag-status text-green">● Ready</span>
                  </div>
                </div>
                <p class="diag-desc">Google Firebase Cloud Messaging for Android, iOS & Web device push notifications.</p>
                <button mat-stroked-button color="primary" class="diag-action-btn" (click)="onTestGateway('FCM')">
                  <mat-icon>send</mat-icon> Test FCM Ping
                </button>
              </div>

              <!-- MSG91 SMS Card -->
              <div class="diag-card">
                <div class="diag-header">
                  <div class="diag-icon-box sms"><mat-icon>textsms</mat-icon></div>
                  <div>
                    <h4>MSG91 Cellular SMS</h4>
                    <span class="diag-status text-green">● Flow API v5</span>
                  </div>
                </div>
                <p class="diag-desc">High-throughput Indian cellular carrier gateway with DLT principal entity registration.</p>
                <button mat-stroked-button color="primary" class="diag-action-btn" (click)="onTestGateway('SMS')">
                  <mat-icon>phonelink_ring</mat-icon> Test SMS Delivery
                </button>
              </div>

              <!-- WhatsApp Card -->
              <div class="diag-card">
                <div class="diag-header">
                  <div class="diag-icon-box whatsapp"><mat-icon>chat</mat-icon></div>
                  <div>
                    <h4>WhatsApp Business</h4>
                    <span class="diag-status text-green">● Connected</span>
                  </div>
                </div>
                <p class="diag-desc">Verified WhatsApp Business Cloud integration for interactive rich messaging.</p>
                <button mat-stroked-button color="primary" class="diag-action-btn" (click)="onTestGateway('WHATSAPP')">
                  <mat-icon>outgoing_mail</mat-icon> Test WhatsApp Ping
                </button>
              </div>

              <!-- Email Card -->
              <div class="diag-card">
                <div class="diag-header">
                  <div class="diag-icon-box email"><mat-icon>email</mat-icon></div>
                  <div>
                    <h4>SMTP Email Gateway</h4>
                    <span class="diag-status text-green">● Port 587 TLS</span>
                  </div>
                </div>
                <p class="diag-desc">Transactional and campaign email delivery using responsive HTML templates.</p>
                <button mat-stroked-button color="primary" class="diag-action-btn" (click)="onTestGateway('EMAIL')">
                  <mat-icon>mark_email_read</mat-icon> Test SMTP Relay
                </button>
              </div>

            </div>
          </div>
        </mat-tab>

        <!-- ── TAB 7: Dispatch History & Audit Trail ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">history</mat-icon>
            Dispatch Audit Trail
          </ng-template>
          <div class="tab-content">
            <div class="history-controls">
              <div class="filter-chips">
                <span class="filter-label">Filter Channel:</span>
                <button mat-button [class.active-filter]="selectedChannelFilter === 'ALL'" (click)="setChannelFilter('ALL')">All</button>
                <button mat-button [class.active-filter]="selectedChannelFilter === 'PUSH'" (click)="setChannelFilter('PUSH')">Push</button>
                <button mat-button [class.active-filter]="selectedChannelFilter === 'SMS'" (click)="setChannelFilter('SMS')">SMS</button>
                <button mat-button [class.active-filter]="selectedChannelFilter === 'WHATSAPP'" (click)="setChannelFilter('WHATSAPP')">WhatsApp</button>
                <button mat-button [class.active-filter]="selectedChannelFilter === 'EMAIL'" (click)="setChannelFilter('EMAIL')">Email</button>
              </div>
              <button mat-button color="primary" (click)="loadHistory()">
                <mat-icon>sync</mat-icon> Refresh
              </button>
            </div>

            <div class="table-container">
              <div *ngIf="historyLoading()" class="loading-shade">
                <mat-spinner diameter="36"></mat-spinner>
              </div>

              <table mat-table [dataSource]="historyList()" class="notif-history-table">
                <!-- Channel Column -->
                <ng-container matColumnDef="channel">
                  <th mat-header-cell *matHeaderCellDef>Channel</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="channel-badge" [ngClass]="row.channel.toLowerCase()">
                      <mat-icon *ngIf="row.channel === 'PUSH'">notifications_active</mat-icon>
                      <mat-icon *ngIf="row.channel === 'SMS'">textsms</mat-icon>
                      <mat-icon *ngIf="row.channel === 'WHATSAPP'">chat</mat-icon>
                      <mat-icon *ngIf="row.channel === 'EMAIL'">email</mat-icon>
                      {{ row.channel }}
                    </span>
                  </td>
                </ng-container>

                <!-- Recipient Target Column -->
                <ng-container matColumnDef="recipientTarget">
                  <th mat-header-cell *matHeaderCellDef>Recipient / Target</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="target-text font-mono">{{ row.recipientTarget || row.userId || 'Global Topic' }}</span>
                  </td>
                </ng-container>

                <!-- Title / Message Column -->
                <ng-container matColumnDef="message">
                  <th mat-header-cell *matHeaderCellDef>Message Content</th>
                  <td mat-cell *matCellDef="let row">
                    <div class="msg-cell">
                      <strong *ngIf="row.title" class="msg-title">{{ row.title }}</strong>
                      <span class="msg-body">{{ row.message }}</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Status Column -->
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Status</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="status-badge" [ngClass]="row.status.toLowerCase()">
                      {{ row.status }}
                    </span>
                    <span *ngIf="row.errorDetails" class="err-hint" [matTooltip]="row.errorDetails">
                      <mat-icon>info</mat-icon>
                    </span>
                  </td>
                </ng-container>

                <!-- Created At Column -->
                <ng-container matColumnDef="createdAt">
                  <th mat-header-cell *matHeaderCellDef>Timestamp</th>
                  <td mat-cell *matCellDef="let row">
                    <span class="date-text">{{ row.createdAt | date:'short' }}</span>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

                <tr class="mat-row" *matNoDataRow>
                  <td class="mat-cell empty-cell" colspan="5">
                    <mat-icon>inbox</mat-icon>
                    <span>No notifications dispatched yet in this category.</span>
                  </td>
                </tr>
              </table>
            </div>
          </div>
        </mat-tab>

        <!-- ── TAB 8: Gateway Configuration & Encryption Vault ── -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">settings_suggest</mat-icon>
            Gateway Configuration
          </ng-template>
          <div class="tab-content">
            <div class="crypto-security-banner">
              <mat-icon class="crypto-icon">lock_person</mat-icon>
              <div>
                <strong>Zero-Knowledge Cryptographic Vault (AES-256-GCM + GORM ORM)</strong>
                <span>All third-party SMS, WhatsApp, FCM, and SMTP credentials are encrypted with Galois/Counter Mode authenticated ciphers and persisted in PostgreSQL.</span>
              </div>
            </div>

            <div class="config-grid">

              <!-- SMS Gateway Configuration -->
              <mat-card class="notif-card config-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon" style="color: #6c63ff;">sms</mat-icon>
                  <mat-card-title>SMS Gateway Provider</mat-card-title>
                  <mat-card-subtitle>Cellular SMS & DLT Principal Entity</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="smsConfigForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>SMS Provider</mat-label>
                      <mat-select formControlName="provider">
                        <mat-option value="msg91">MSG91 (Cellular Flow API v5)</mat-option>
                        <mat-option value="twilio">Twilio Programmable SMS</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Status</mat-label>
                      <mat-select formControlName="enabled">
                        <mat-option [value]="true">Enabled (Active)</mat-option>
                        <mat-option [value]="false">Disabled</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Auth Key / API Secret (Encrypted at Rest)</mat-label>
                      <input matInput type="password" formControlName="authKey" placeholder="Enter new key to update">
                      <mat-icon matSuffix class="lock-suffix">lock</mat-icon>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Sender ID / DLT Header</mat-label>
                      <input matInput formControlName="senderId" placeholder="e.g. MAXXPX">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>DLT Principal Entity ID</mat-label>
                      <input matInput formControlName="dltEntityId" placeholder="e.g. 1201159876543210">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Default Flow / Template ID</mat-label>
                      <input matInput formControlName="defaultTemplateId" placeholder="e.g. 64a8e9f2b1...">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Route</mat-label>
                      <input matInput formControlName="route" placeholder="4 (Transactional)">
                    </mat-form-field>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="save"
                      [loading]="configSaving() === 'SMS'" (buttonClick)="onSaveConfig('SMS')">
                      Save & Encrypt SMS Config
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- WhatsApp Business Cloud API -->
              <mat-card class="notif-card config-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon" style="color: #25D366;">chat</mat-icon>
                  <mat-card-title>WhatsApp Business Cloud API</mat-card-title>
                  <mat-card-subtitle>Meta Cloud API v18 Integration</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="whatsappConfigForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>WhatsApp Provider</mat-label>
                      <mat-select formControlName="provider">
                        <mat-option value="meta_cloud">Meta WhatsApp Cloud API v18</mat-option>
                        <mat-option value="twilio">Twilio WhatsApp Sandbox</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Status</mat-label>
                      <mat-select formControlName="enabled">
                        <mat-option [value]="true">Enabled (Active)</mat-option>
                        <mat-option [value]="false">Disabled</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Phone Number ID</mat-label>
                      <input matInput formControlName="phoneNumberId" placeholder="e.g. 104829104859102">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Permanent System Access Token</mat-label>
                      <input matInput type="password" formControlName="accessToken" placeholder="Enter new token to update">
                      <mat-icon matSuffix class="lock-suffix">lock</mat-icon>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>WhatsApp Business Account ID (WABA)</mat-label>
                      <input matInput formControlName="businessAccountId" placeholder="e.g. 294810294819">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Webhook Verify Token / Secret</mat-label>
                      <input matInput type="password" formControlName="webhookSecret" placeholder="Enter new secret to update">
                      <mat-icon matSuffix class="lock-suffix">lock</mat-icon>
                    </mat-form-field>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="save"
                      [loading]="configSaving() === 'WHATSAPP'" (buttonClick)="onSaveConfig('WHATSAPP')">
                      Save & Encrypt WhatsApp Config
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- Push Notification Settings (FCM) -->
              <mat-card class="notif-card config-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon" style="color: #ffab00;">notifications_active</mat-icon>
                  <mat-card-title>Firebase FCM Push Gateway</mat-card-title>
                  <mat-card-subtitle>Google Firebase HTTP v1 API</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="pushConfigForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Push Provider</mat-label>
                      <mat-select formControlName="provider">
                        <mat-option value="firebase_fcm">Google Firebase Cloud Messaging (HTTP v1)</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Status</mat-label>
                      <mat-select formControlName="enabled">
                        <mat-option [value]="true">Enabled (Active)</mat-option>
                        <mat-option [value]="false">Disabled</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Firebase Project ID</mat-label>
                      <input matInput formControlName="projectId" placeholder="e.g. maxxpixels-ott">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Default Broadcast Topic</mat-label>
                      <input matInput formControlName="defaultTopic" placeholder="e.g. all_users">
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Service Account JSON Key (AES-256 Encrypted)</mat-label>
                      <textarea matInput formControlName="serviceAccountJson" rows="3" placeholder='{"type": "service_account", ...}'></textarea>
                      <mat-icon matSuffix class="lock-suffix">lock</mat-icon>
                    </mat-form-field>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="save"
                      [loading]="configSaving() === 'PUSH'" (buttonClick)="onSaveConfig('PUSH')">
                      Save & Encrypt FCM Push Config
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

              <!-- SMTP Email Settings -->
              <mat-card class="notif-card config-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon" style="color: #00d2ff;">email</mat-icon>
                  <mat-card-title>SMTP Email Gateway</mat-card-title>
                  <mat-card-subtitle>Transactional & Campaign Relay</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <form [formGroup]="emailConfigForm">
                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Email Protocol / Provider</mat-label>
                      <mat-select formControlName="provider">
                        <mat-option value="smtp">Standard SMTP / STARTTLS Relay</mat-option>
                        <mat-option value="ses">Amazon SES</mat-option>
                        <mat-option value="sendgrid">Twilio SendGrid</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Status</mat-label>
                      <mat-select formControlName="enabled">
                        <mat-option [value]="true">Enabled (Active)</mat-option>
                        <mat-option [value]="false">Disabled</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <div class="row-2">
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>SMTP Host</mat-label>
                        <input matInput formControlName="host" placeholder="smtp.gmail.com">
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>Port</mat-label>
                        <input matInput type="number" formControlName="port" placeholder="587">
                      </mat-form-field>
                    </div>

                    <div class="row-2">
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>Sender Email</mat-label>
                        <input matInput type="email" formControlName="senderEmail" placeholder="noreply@maxxpixels.tv">
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>Sender Display Name</mat-label>
                        <input matInput formControlName="senderName" placeholder="MaxxPixels OTT">
                      </mat-form-field>
                    </div>

                    <div class="row-2">
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>SMTP Username</mat-label>
                        <input matInput formControlName="username" placeholder="smtp-user">
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="half-width">
                        <mat-label>SMTP Password (Encrypted)</mat-label>
                        <input matInput type="password" formControlName="password" placeholder="Enter new password to update">
                        <mat-icon matSuffix class="lock-suffix">lock</mat-icon>
                      </mat-form-field>
                    </div>

                    <mat-form-field appearance="outline" class="full-width">
                      <mat-label>Encryption Security</mat-label>
                      <mat-select formControlName="useTls">
                        <mat-option [value]="true">STARTTLS (Recommended, Port 587)</mat-option>
                        <mat-option [value]="false">Plaintext / Non-SSL (Port 25)</mat-option>
                      </mat-select>
                    </mat-form-field>

                    <app-permission-button permission="CONTENT_CREATE" color="primary" icon="save"
                      [loading]="configSaving() === 'EMAIL'" (buttonClick)="onSaveConfig('EMAIL')">
                      Save & Encrypt SMTP Config
                    </app-permission-button>
                  </form>
                </mat-card-content>
              </mat-card>

            </div>
          </div>
        </mat-tab>

        <!-- TAB 9: CRM Campaign Studio -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">campaign</mat-icon>
            CRM Campaign Studio
          </ng-template>
          <div class="tab-content">
            <div class="crypto-security-banner" style="background:rgba(108,99,255,0.08);border-color:rgba(108,99,255,0.35);color:#d7d4ff;">
              <mat-icon class="crypto-icon" style="color:#6c63ff;">insights</mat-icon>
              <div>
                <strong>Audience/CRM Operations Workspace (Additive)</strong>
                <span>Templates, segmentation planning, scheduling, A/B variants, frequency-capping policy, and campaign drafts are managed here. Dispatch uses existing notification APIs where supported; unsupported orchestration/enforcement remains planning metadata unless backend capabilities are added.</span>
              </div>
            </div>
            <div class="two-col" style="margin-bottom:20px;">
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">schedule_send</mat-icon>
                  <mat-card-title>Scheduling & Frequency Capping Controls</mat-card-title>
                  <mat-card-subtitle>Applied to next dispatch payloads when supported by channel endpoint</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div class="field-label">Global Scheduled Dispatch Time (ISO 8601, optional)</div>
                  <input type="datetime-local" [(ngModel)]="campaignScheduleAt" [ngModelOptions]="{standalone:true}" style="width:100%;margin-bottom:12px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:10px;">
                  <div style="font-size:12px;color:#a0a0b0;margin-bottom:12px;">Leave empty for immediate send. Backend scheduling support depends on channel/endpoint ('scheduledAt' is included when provided).</div>
                  <div class="field-label">Frequency Capping Policy (governance guidance)</div>
                  <textarea [(ngModel)]="campaignFrequencyCapPolicy" [ngModelOptions]="{standalone:true}" rows="3" style="width:100%;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:10px;margin-bottom:8px;"></textarea>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button mat-stroked-button color="primary" type="button" (click)="campaignForm.frequencyCap = campaignFrequencyCapPolicy">Apply to Campaign Draft</button>
                    <button mat-stroked-button type="button" (click)="exportCrmWorkspace()"><mat-icon>download</mat-icon> Export CRM Workspace</button>
                  </div>
                </mat-card-content>
              </mat-card>
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">rule</mat-icon>
                  <mat-card-title>Compliance & Send Readiness Checklist</mat-card-title>
                  <mat-card-subtitle>Governance checks before campaign dispatch</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input type="checkbox" [(ngModel)]="crmCompliance.consentVerified" (change)="saveCrmCompliance()"> Consent / opt-in verified for target audience</label>
                  <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input type="checkbox" [(ngModel)]="crmCompliance.dndScrubbed" (change)="saveCrmCompliance()"> Suppression/DND list scrubbed</label>
                  <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input type="checkbox" [(ngModel)]="crmCompliance.regionalPolicyChecked" (change)="saveCrmCompliance()"> Regional/channel policy (SMS/WhatsApp/email) checked</label>
                  <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input type="checkbox" [(ngModel)]="crmCompliance.unsubscribeFooterIncluded" (change)="saveCrmCompliance()"> Unsubscribe/STOP/preferences instructions included</label>
                  <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input type="checkbox" [(ngModel)]="crmCompliance.frequencyCapAcknowledged" (change)="saveCrmCompliance()"> Frequency cap reviewed</label>
                  <label style="display:flex;gap:8px;align-items:center;margin-bottom:8px;"><input type="checkbox" [(ngModel)]="crmCompliance.auditLogged" (change)="saveCrmCompliance()"> Campaign intent logged for audit/governance</label>
                  <textarea [(ngModel)]="crmCompliance.notes" (blur)="saveCrmCompliance()" [ngModelOptions]="{standalone:true}" rows="2" placeholder="Compliance notes / approvals / ticket reference" style="width:100%;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:10px;"></textarea>
                </mat-card-content>
              </mat-card>
            </div>
            <div class="two-col" style="margin-bottom:20px;">
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">description</mat-icon>
                  <mat-card-title>Message Templates Library</mat-card-title>
                  <mat-card-subtitle>Reusable templates for Push/SMS/WhatsApp/Email</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <input [(ngModel)]="templateForm.name" [ngModelOptions]="{standalone:true}" placeholder="Template name" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <select [(ngModel)]="templateForm.channel" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                      <option value="PUSH">Push</option><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="ALL">All Channels</option>
                    </select>
                  </div>
                  <input [(ngModel)]="templateForm.title" [ngModelOptions]="{standalone:true}" placeholder="Title/Subject (optional)" style="width:100%;margin-top:8px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                  <textarea [(ngModel)]="templateForm.message" [ngModelOptions]="{standalone:true}" rows="3" [placeholder]="'Message body / variables e.g. {{user_name}}, {{plan_name}}'" style="width:100%;margin-top:8px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;"></textarea>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <input [(ngModel)]="templateForm.actionUrl" [ngModelOptions]="{standalone:true}" placeholder="Action URL / deep link" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <input [(ngModel)]="templateForm.imageUrl" [ngModelOptions]="{standalone:true}" placeholder="Image/media URL" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                  </div>
                  <input [(ngModel)]="templateForm.tags" [ngModelOptions]="{standalone:true}" placeholder="Tags (retention, promo, transactional...)" style="width:100%;margin-top:8px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                  <div style="margin-top:10px;"><button mat-raised-button color="primary" type="button" (click)="upsertTemplate()"><mat-icon>save</mat-icon> Save Template</button></div>
                  <div style="margin-top:12px;max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:8px;">
                    <div *ngFor="let t of crmTemplates" style="background:#101018;border:1px solid #232332;border-radius:8px;padding:8px;">
                      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong style="font-size:12px;">{{t.name}}</strong><span style="font-size:10px;color:#00d2ff;">{{t.channel}}</span></div>
                      <div style="font-size:11px;color:#a0a0b0;margin:4px 0;">{{t.title || '(no title)'}} • {{t.updatedAt | date:'short'}}</div>
                      <div style="font-size:12px;color:#e6e9f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{t.message}}</div>
                      <div style="display:flex;gap:6px;margin-top:6px;"><button mat-button color="accent" type="button" (click)="applyTemplate(t)">Apply</button><button mat-button color="warn" type="button" (click)="deleteTemplate(t.id)">Delete</button></div>
                    </div>
                    <div *ngIf="!crmTemplates.length" style="font-size:12px;color:#8e8ea0;">No templates saved yet.</div>
                  </div>
                </mat-card-content>
              </mat-card>
              <mat-card class="notif-card">
                <mat-card-header>
                  <mat-icon mat-card-avatar class="card-icon">groups</mat-icon>
                  <mat-card-title>Audience Segmentation Planner</mat-card-title>
                  <mat-card-subtitle>Rule-based segment definitions and supported audience mapping</mat-card-subtitle>
                </mat-card-header>
                <mat-card-content>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <input [(ngModel)]="segmentForm.name" [ngModelOptions]="{standalone:true}" placeholder="Segment name" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <select [(ngModel)]="segmentForm.audience" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                      <option value="ALL">All Users (supported)</option>
                      <option value="SUBSCRIBERS">Subscribers/Premium (supported for push audience targeting where available)</option>
                      <option value="FREE">Free Users (planning/derived)</option>
                      <option value="CHURN_RISK">Churn Risk (planning)</option>
                      <option value="NEW_USERS">New Users (planning)</option>
                      <option value="LAPSED">Lapsed Users (planning)</option>
                    </select>
                  </div>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;">
                    <label><input type="checkbox" [checked]="segmentForm.channels.includes('PUSH')" (change)="toggleSegmentChannel('PUSH')"> Push</label>
                    <label><input type="checkbox" [checked]="segmentForm.channels.includes('SMS')" (change)="toggleSegmentChannel('SMS')"> SMS</label>
                    <label><input type="checkbox" [checked]="segmentForm.channels.includes('WHATSAPP')" (change)="toggleSegmentChannel('WHATSAPP')"> WhatsApp</label>
                    <label><input type="checkbox" [checked]="segmentForm.channels.includes('EMAIL')" (change)="toggleSegmentChannel('EMAIL')"> Email</label>
                  </div>
                  <textarea [(ngModel)]="segmentForm.rules" [ngModelOptions]="{standalone:true}" rows="3" placeholder="Segmentation rules (e.g. plan=FREE AND last_active>30d AND country=IN AND watched_genre=Sports)" style="width:100%;margin-top:8px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;"></textarea>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <input [(ngModel)]="segmentForm.estimatedReach" [ngModelOptions]="{standalone:true}" placeholder="Estimated reach / cohort size" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <input [(ngModel)]="segmentForm.notes" [ngModelOptions]="{standalone:true}" placeholder="Notes (data source, exclusions)" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                  </div>
                  <div style="margin-top:10px;"><button mat-raised-button color="primary" type="button" (click)="saveSegment()"><mat-icon>save</mat-icon> Save Segment</button></div>
                  <div style="margin-top:12px;max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:8px;">
                    <div *ngFor="let s of crmSegments" style="background:#101018;border:1px solid #232332;border-radius:8px;padding:8px;">
                      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;"><strong style="font-size:12px;">{{s.name}}</strong><span style="font-size:10px;color:#ffab00;">{{s.audience}}</span></div>
                      <div style="font-size:11px;color:#a0a0b0;margin:4px 0;">{{(s.channels||[]).join(', ') || 'No channels'}} • Reach: {{s.estimatedReach || 'N/A'}}</div>
                      <div style="font-size:12px;color:#e6e9f2;white-space:pre-wrap;">{{s.rules || 'No rules specified'}}</div>
                      <div style="display:flex;gap:6px;margin-top:6px;"><button mat-button color="accent" type="button" (click)="applySegment(s)">Use</button><button mat-button color="warn" type="button" (click)="deleteSegment(s.id)">Delete</button></div>
                    </div>
                    <div *ngIf="!crmSegments.length" style="font-size:12px;color:#8e8ea0;">No segments saved yet.</div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
            <mat-card class="notif-card" style="margin-bottom:20px;">
              <mat-card-header>
                <mat-icon mat-card-avatar class="card-icon">science</mat-icon>
                <mat-card-title>Campaign Planner, A/B Testing & Drafts</mat-card-title>
                <mat-card-subtitle>Plan variants, schedule, target segment/template, and track dispatch readiness</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;">
                  <input [(ngModel)]="campaignForm.name" [ngModelOptions]="{standalone:true}" placeholder="Campaign name" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                  <select [(ngModel)]="campaignForm.objective" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <option value="ENGAGEMENT">Engagement</option><option value="RETENTION">Retention</option><option value="WINBACK">Win-back</option><option value="SUBSCRIPTION">Subscription</option><option value="CONTENT_PROMO">Content Promo</option><option value="TRANSACTIONAL">Transactional</option>
                  </select>
                  <select [(ngModel)]="campaignForm.status" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="SENT">Sent</option><option value="PAUSED">Paused</option>
                  </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:8px;">
                  <select [(ngModel)]="campaignForm.segmentId" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <option value="">Segment (optional)</option>
                    <option *ngFor="let s of crmSegments" [value]="s.id">{{s.name}}</option>
                  </select>
                  <select [(ngModel)]="campaignForm.templateId" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <option value="">Template (optional)</option>
                    <option *ngFor="let t of crmTemplates" [value]="t.id">{{t.name}} ({{t.channel}})</option>
                  </select>
                  <input type="datetime-local" [(ngModel)]="campaignForm.scheduledAt" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px;font-size:12px;">
                  <label><input type="checkbox" [checked]="campaignForm.channels.includes('PUSH')" (change)="toggleCampaignChannel('PUSH')"> Push</label>
                  <label><input type="checkbox" [checked]="campaignForm.channels.includes('SMS')" (change)="toggleCampaignChannel('SMS')"> SMS</label>
                  <label><input type="checkbox" [checked]="campaignForm.channels.includes('WHATSAPP')" (change)="toggleCampaignChannel('WHATSAPP')"> WhatsApp</label>
                  <label><input type="checkbox" [checked]="campaignForm.channels.includes('EMAIL')" (change)="toggleCampaignChannel('EMAIL')"> Email</label>
                  <label><input type="checkbox" [(ngModel)]="campaignForm.abEnabled" [ngModelOptions]="{standalone:true}"> Enable A/B test</label>
                </div>
                <input [(ngModel)]="campaignForm.frequencyCap" [ngModelOptions]="{standalone:true}" placeholder="Frequency cap (e.g. 1/24h/user, 3/week)" style="width:100%;margin-top:8px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                <div *ngIf="campaignForm.abEnabled" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                  <textarea [(ngModel)]="campaignForm.variantA" [ngModelOptions]="{standalone:true}" rows="2" placeholder="Variant A: subject/message/CTA hypothesis" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;"></textarea>
                  <textarea [(ngModel)]="campaignForm.variantB" [ngModelOptions]="{standalone:true}" rows="2" placeholder="Variant B: subject/message/CTA hypothesis" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;"></textarea>
                </div>
                <textarea [(ngModel)]="campaignForm.notes" [ngModelOptions]="{standalone:true}" rows="2" placeholder="Campaign notes, success metrics, approval notes" style="width:100%;margin-top:8px;background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;"></textarea>
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                  <button mat-raised-button color="primary" type="button" (click)="saveCampaign()"><mat-icon>save</mat-icon> Save Campaign Draft</button>
                  <button mat-stroked-button type="button" (click)="campaignScheduleAt = campaignForm.scheduledAt || campaignScheduleAt"><mat-icon>schedule</mat-icon> Use Campaign Schedule</button>
                </div>
                <div style="margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;">
                  <div *ngFor="let c of crmCampaigns" style="background:#101018;border:1px solid #232332;border-radius:8px;padding:10px;">
                    <div style="display:flex;justify-content:space-between;gap:8px;"><strong style="font-size:12px;">{{c.name}}</strong><span style="font-size:10px;color:#00d2ff;">{{c.status}}</span></div>
                    <div style="font-size:11px;color:#a0a0b0;margin:4px 0;">{{c.objective}} • {{(c.channels||[]).join(', ')}} • {{c.abEnabled ? 'A/B' : 'Single'}} • Cap: {{c.frequencyCap}}</div>
                    <div style="font-size:11px;color:#a0a0b0;">Schedule: {{c.scheduledAt || 'Immediate / not set'}} | Last dispatch: {{c.lastDispatchedAt || '—'}}</div>
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                      <button mat-button color="accent" type="button" (click)="applyCampaign(c)">Load</button>
                      <button mat-button type="button" (click)="markCampaignSent(c)">Mark Sent/Scheduled</button>
                      <button mat-button color="warn" type="button" (click)="deleteCampaign(c.id)">Delete</button>
                    </div>
                  </div>
                  <div *ngIf="!crmCampaigns.length" style="font-size:12px;color:#8e8ea0;">No campaigns saved yet.</div>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
        <!-- TAB 10: Delivery Analytics & Compliance -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">analytics</mat-icon>
            Delivery Analytics & Compliance
          </ng-template>
          <div class="tab-content">
            <div class="history-controls" style="margin-bottom:12px;">
              <div class="filter-chips">
                <span class="filter-label">Analytics Window:</span>
                <button mat-button [class.active-filter]="deliveryAnalyticsWindow==='7d'" (click)="deliveryAnalyticsWindow='7d'">7 Days</button>
                <button mat-button [class.active-filter]="deliveryAnalyticsWindow==='30d'" (click)="deliveryAnalyticsWindow='30d'">30 Days</button>
                <button mat-button [class.active-filter]="deliveryAnalyticsWindow==='all'" (click)="deliveryAnalyticsWindow='all'">All Loaded</button>
              </div>
              <div style="display:flex;gap:8px;">
                <button mat-stroked-button color="primary" (click)="loadHistory()"><mat-icon>sync</mat-icon> Refresh History</button>
                <button mat-stroked-button color="primary" (click)="loadDevices()" [disabled]="devicesLoading()"><mat-icon>devices</mat-icon> {{ devicesLoading() ? 'Loading...' : 'Refresh Devices' }}</button>
              </div>
            </div>
            <div class="diagnostics-grid" style="margin-bottom:16px;">
              <div class="diag-card"><div class="diag-header"><div class="diag-icon-box fcm"><mat-icon>stacked_bar_chart</mat-icon></div><div><h4>Dispatch Volume</h4><span class="diag-status text-green">{{analyticsTotal}} events</span></div></div><p class="diag-desc">Total notification history records in selected window (from '/admin/notifications/history').</p></div>
              <div class="diag-card"><div class="diag-header"><div class="diag-icon-box email"><mat-icon>mark_email_read</mat-icon></div><div><h4>Delivered/Sent Rate</h4><span class="diag-status text-green">{{analyticsDeliveryRate}}%</span></div></div><p class="diag-desc">Delivered/Sent/Read/Simulated: {{analyticsDelivered}} • Failed: {{analyticsFailed}} (based on available status fields).</p></div>
              <div class="diag-card"><div class="diag-header"><div class="diag-icon-box whatsapp"><mat-icon>devices</mat-icon></div><div><h4>Registered Push Devices</h4><span class="diag-status text-green">{{deviceReachSummary.total}} devices</span></div></div><p class="diag-desc">Active FCM tokens: {{deviceReachSummary.activeTokens}} (from '/admin/notifications/devices'). Platform split below.</p></div>
              <div class="diag-card"><div class="diag-header"><div class="diag-icon-box sms"><mat-icon>unsubscribe</mat-icon></div><div><h4>Suppressions / Opt-outs</h4><span class="diag-status text-green">{{activeSuppressionsCount}} active</span></div></div><p class="diag-desc">Local suppression registry for compliance operations and manual send-prevention checks (backend enforcement integration may be required).</p></div>
            </div>
            <div class="two-col" style="margin-bottom:16px;">
              <mat-card class="notif-card">
                <mat-card-header><mat-icon mat-card-avatar class="card-icon">bar_chart</mat-icon><mat-card-title>Channel Delivery Analytics</mat-card-title><mat-card-subtitle>Counts by channel/status in selected window</mat-card-subtitle></mat-card-header>
                <mat-card-content>
                  <div *ngIf="analyticsByChannel.length; else noAnalytics" style="display:flex;flex-direction:column;gap:8px;">
                    <div *ngFor="let c of analyticsByChannel" style="background:#101018;border:1px solid #232332;border-radius:8px;padding:10px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;"><strong>{{c.channel}}</strong><span style="font-size:12px;color:#a0a0b0;">{{c.count}} events</span></div>
                      <div style="font-size:12px;color:#00e676;">Delivered/Sent: {{c.delivered}}</div>
                      <div style="font-size:12px;color:#ff8a80;">Failed: {{c.failed}}</div>
                    </div>
                  </div>
                  <ng-template #noAnalytics><div style="font-size:12px;color:#8e8ea0;">No history data loaded for analytics. Refresh history to populate.</div></ng-template>
                </mat-card-content>
              </mat-card>
              <mat-card class="notif-card">
                <mat-card-header><mat-icon mat-card-avatar class="card-icon">phone_iphone</mat-icon><mat-card-title>Reach & Failure Diagnostics</mat-card-title><mat-card-subtitle>Device platforms and recent failed/error events</mat-card-subtitle></mat-card-header>
                <mat-card-content>
                  <div style="margin-bottom:10px;">
                    <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Device Platforms</div>
                    <div *ngFor="let p of deviceReachSummary.platforms" style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid #232332;"><span>{{p.name}}</span><span style="color:#00d2ff;">{{p.count}}</span></div>
                    <div *ngIf="!deviceReachSummary.platforms.length" style="font-size:12px;color:#8e8ea0;">No device records loaded.</div>
                  </div>
                  <div>
                    <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Recent Failures / Errors</div>
                    <div *ngFor="let f of analyticsRecentFailures" style="background:#101018;border:1px solid #232332;border-radius:8px;padding:8px;margin-bottom:6px;">
                      <div style="font-size:11px;color:#ff8a80;font-weight:700;">{{f.channel}} • {{f.status}} • {{f.createdAt | date:'short'}}</div>
                      <div style="font-size:12px;color:#e6e9f2;">{{f.recipientTarget || f.userId || 'Target N/A'}}</div>
                      <div style="font-size:11px;color:#a0a0b0;">{{f.errorDetails || f.message}}</div>
                    </div>
                    <div *ngIf="!analyticsRecentFailures.length" style="font-size:12px;color:#8e8ea0;">No failed/error events in selected window.</div>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>
            <div class="two-col">
              <mat-card class="notif-card">
                <mat-card-header><mat-icon mat-card-avatar class="card-icon">unsubscribe</mat-icon><mat-card-title>Unsubscribe & Suppression Management</mat-card-title><mat-card-subtitle>Opt-out registry and compliance operations (local/admin-managed)</mat-card-subtitle></mat-card-header>
                <mat-card-content>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                    <input [(ngModel)]="suppressionForm.contact" [ngModelOptions]="{standalone:true}" placeholder="Email / phone / user ID / device token key" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                    <select [(ngModel)]="suppressionForm.channel" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                      <option value="ALL">All Channels</option><option value="PUSH">Push</option><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option>
                    </select>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
                    <select [(ngModel)]="suppressionForm.reason" [ngModelOptions]="{standalone:true}" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                      <option value="USER_OPT_OUT">User Opt-out / Unsubscribe</option><option value="STOP_KEYWORD">STOP Keyword (SMS/WhatsApp)</option><option value="BOUNCE_COMPLAINT">Bounce / Complaint</option><option value="LEGAL_REQUEST">Legal / Compliance Request</option><option value="MANUAL_HOLD">Manual Hold</option>
                    </select>
                    <input [(ngModel)]="suppressionForm.source" [ngModelOptions]="{standalone:true}" placeholder="Source (support, webhook, import)" style="background:#101018;border:1px solid #28283a;color:#fff;border-radius:8px;padding:8px;">
                  </div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                    <button mat-raised-button color="primary" type="button" (click)="addSuppression()"><mat-icon>person_add_disabled</mat-icon> Add Suppression</button>
                    <button mat-stroked-button type="button" (click)="exportSuppressionsCsv()" [disabled]="!crmSuppressions.length"><mat-icon>download</mat-icon> Export CSV</button>
                  </div>
                  <div style="margin-top:12px;max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:8px;">
                    <div *ngFor="let s of crmSuppressions" style="background:#101018;border:1px solid #232332;border-radius:8px;padding:8px;">
                      <div style="display:flex;justify-content:space-between;gap:8px;"><strong style="font-size:12px;">{{s.contact}}</strong><span style="font-size:10px;" [style.color]="s.active ? '#ffab00' : '#00e676'">{{s.active ? 'SUPPRESSED' : 'INACTIVE'}}</span></div>
                      <div style="font-size:11px;color:#a0a0b0;">{{s.channel}} • {{s.reason}} • {{s.source}} • {{s.createdAt | date:'short'}}</div>
                      <div style="display:flex;gap:6px;margin-top:6px;"><button mat-button type="button" (click)="toggleSuppression(s)">{{s.active ? 'Deactivate' : 'Activate'}}</button><button mat-button color="warn" type="button" (click)="deleteSuppression(s.id)">Delete</button></div>
                    </div>
                    <div *ngIf="!crmSuppressions.length" style="font-size:12px;color:#8e8ea0;">No suppression records yet.</div>
                  </div>
                </mat-card-content>
              </mat-card>
              <mat-card class="notif-card">
                <mat-card-header><mat-icon mat-card-avatar class="card-icon">verified_user</mat-icon><mat-card-title>Compliance & Preference Operations Guide</mat-card-title><mat-card-subtitle>End-to-end operational guidance for audience/CRM governance</mat-card-subtitle></mat-card-header>
                <mat-card-content>
                  <ul style="margin:0;padding-left:18px;color:#d9deea;font-size:12px;line-height:1.7;">
                    <li><strong>Consent & preferences:</strong> Maintain opt-in records per channel; honor unsubscribe/STOP/complaint signals promptly and update suppression registry.</li>
                    <li><strong>Segmentation governance:</strong> Validate segment rules and exclusions before dispatch; unsupported advanced targeting should be reviewed/exported for backend/data-team execution.</li>
                    <li><strong>Scheduling & frequency capping:</strong> Define send windows/timezones and per-user/channel caps; enforce in backend/worker for production-grade guarantees.</li>
                    <li><strong>A/B testing:</strong> Predefine success metrics (CTR/open/conversion/retention), sample split, and test duration; store variant hypotheses in campaign drafts.</li>
                    <li><strong>Delivery analytics:</strong> Monitor sent/delivered/failed trends and error reasons by channel; investigate gateway configs, templates, and recipient quality.</li>
                    <li><strong>Auditability:</strong> Export CRM workspace/suppressions and correlate with notification history/audit logs for compliance reviews.</li>
                  </ul>
                  <div style="margin-top:10px;font-size:11px;color:#a0a0b0;">Note: Some controls in this workspace are planning/governance aids (local persistence) where backend APIs/entities for full campaign orchestration, preference-center enforcement, and attribution analytics are not yet available.</div>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>
            </mat-tab-group>
    </div>
  `,
  styles: [`
    .page-container { padding: 24px; max-width: 1300px; margin: 0 auto; color: #ffffff; }
    
    .page-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
    }
    
    .header-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(108, 99, 255, 0.15); color: #00d2ff;
      font-size: 11px; font-weight: 800; padding: 4px 10px;
      border-radius: 6px; margin-bottom: 8px; letter-spacing: 0.5px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    
    .page-title {
      display: flex; align-items: center; gap: 12px;
      font-size: 26px; font-weight: 800; color: #ffffff; margin: 0 0 6px;
    }
    .title-icon { font-size: 32px; width: 32px; height: 32px; color: #6c63ff; }
    .page-subtitle { color: #9e9eb4; margin: 0; font-size: 13px; max-width: 800px; }

    .refresh-btn {
      color: #00d2ff !important; border-color: rgba(0, 210, 255, 0.4) !important;
      mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }
    }

    .notif-tabs ::ng-deep .mat-mdc-tab-header { background: #161624; border-radius: 12px 12px 0 0; }
    .notif-tabs ::ng-deep .mat-mdc-tab-body-wrapper { background: transparent; }
    .tab-icon { margin-right: 8px; font-size: 18px; }
    .tab-content { padding: 24px 0; }

    .msg91-banner, .whatsapp-banner {
      display: flex; align-items: center; gap: 10px;
      border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px;
    }
    .msg91-banner {
      background: rgba(108, 99, 255, 0.12); border: 1px solid rgba(108, 99, 255, 0.35); color: #b8b3ff;
      mat-icon { color: #6c63ff; }
    }
    .whatsapp-banner {
      background: rgba(37, 211, 102, 0.1); border: 1px solid rgba(37, 211, 102, 0.35); color: #a3f7c4;
      mat-icon { color: #25D366; }
    }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    @media (max-width: 860px) { .two-col { grid-template-columns: 1fr; } }

    .notif-card {
      background: #161624 !important; color: #ffffff !important;
      border-radius: 14px !important; border: 1px solid #28283c;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    }
    .center-card { max-width: 620px; margin: 0 auto; }
    .card-icon { color: #6c63ff; }

    mat-card-header { padding: 18px 18px 0; }
    mat-card-title { color: #ffffff !important; font-size: 16px !important; font-weight: 700 !important; }
    mat-card-subtitle { color: #9e9eb4 !important; font-size: 12px !important; }
    mat-card-content { padding: 18px; }

    .full-width { width: 100%; margin-bottom: 16px; }
    .upload-section { margin-bottom: 20px; }
    .field-label { display: block; font-size: 12px; font-weight: 600; color: #00d2ff; margin-bottom: 8px; }

    .recipient-count {
      display: flex; align-items: center; gap: 8px;
      color: #00e676; font-size: 13px; font-weight: 600; margin-bottom: 14px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .channel-chips { margin-bottom: 20px; }

    /* Diagnostics Tab Grid */
    .diagnostics-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px;
    }
    .diag-card {
      background: #161624; border: 1px solid #28283c; border-radius: 14px; padding: 20px;
      display: flex; flex-direction: column; justify-content: space-between;
      .diag-header {
        display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
        h4 { margin: 0; font-size: 16px; font-weight: 700; color: #ffffff; }
        .diag-status { font-size: 12px; font-weight: 600; }
        .text-green { color: #00e676; }
      }
      .diag-icon-box {
        width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
        mat-icon { font-size: 22px; width: 22px; height: 22px; }
        &.fcm { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
        &.sms { background: rgba(108, 99, 255, 0.15); color: #6c63ff; }
        &.whatsapp { background: rgba(37, 211, 102, 0.15); color: #25D366; }
        &.email { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
      }
      .diag-desc { font-size: 12px; color: #a0a0b0; margin-bottom: 18px; min-height: 36px; }
      .diag-action-btn {
        width: 100%; border-radius: 8px; font-weight: 600;
        mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
      }
    }

    /* History Table */
    .history-controls {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 16px; flex-wrap: wrap; gap: 12px;
      .filter-chips {
        display: flex; align-items: center; gap: 8px;
        .filter-label { font-size: 12px; color: #a0a0b0; font-weight: 600; }
        button {
          color: #a0a0b0; border-radius: 6px; font-size: 12px; height: 30px; line-height: 28px; padding: 0 10px;
          &.active-filter { background: rgba(108, 99, 255, 0.2); color: #00d2ff; font-weight: 700; }
        }
      }
    }

    .table-container {
      position: relative; background: #161624; border: 1px solid #28283c; border-radius: 12px; overflow: hidden;
    }
    .loading-shade {
      position: absolute; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(22, 22, 36, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10;
    }
    .notif-history-table {
      width: 100%; background: transparent; color: #ffffff;
      th { color: #a0a0b0; font-size: 12px; font-weight: 700; border-bottom: 1px solid #28283c; }
      td { color: #ffffff; font-size: 13px; border-bottom: 1px solid #1c1c2b; padding: 12px 16px; }
    }

    .channel-badge {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700;
      padding: 3px 8px; border-radius: 6px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.push { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
      &.sms { background: rgba(108, 99, 255, 0.15); color: #6c63ff; }
      &.whatsapp { background: rgba(37, 211, 102, 0.15); color: #25D366; }
      &.email { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
    }

    .status-badge {
      font-size: 10px; font-weight: 800; padding: 3px 7px; border-radius: 4px; text-transform: uppercase;
      &.delivered, &.sent { background: rgba(0, 230, 118, 0.15); color: #00e676; }
      &.simulated { background: rgba(0, 210, 255, 0.15); color: #00d2ff; }
      &.failed { background: rgba(255, 23, 68, 0.15); color: #ff1744; }
    }
    .err-hint { margin-left: 6px; color: #ffab00; cursor: pointer; mat-icon { font-size: 14px; width: 14px; height: 14px; } }

    .msg-cell { display: flex; flex-direction: column; gap: 2px; }
    .msg-title { font-size: 13px; color: #ffffff; }
    .msg-body { font-size: 12px; color: #a0a0b0; }
    .font-mono { font-family: monospace; font-size: 12px; color: #00d2ff; }
    .date-text { font-size: 12px; color: #7f879b; white-space: nowrap; }

    .empty-cell {
      text-align: center; padding: 32px 0; color: #7f879b;
      mat-icon { font-size: 32px; width: 32px; height: 32px; display: block; margin: 0 auto 8px; }
    }

    .crypto-security-banner {
      display: flex; align-items: center; gap: 14px;
      background: rgba(0, 230, 118, 0.08); border: 1px solid rgba(0, 230, 118, 0.35);
      border-radius: 12px; padding: 14px 18px; margin-bottom: 24px; color: #a3f7c4; font-size: 13px;
      .crypto-icon { color: #00e676; font-size: 28px; width: 28px; height: 28px; }
      strong { display: block; font-size: 14px; color: #ffffff; margin-bottom: 2px; }
    }

    .config-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 24px;
    }
    @media (max-width: 600px) {
      .config-grid { grid-template-columns: 1fr; }
    }
    .config-card { margin-bottom: 0; }
    .lock-suffix { color: #00e676; font-size: 18px; margin-right: 4px; }
    .row-2 { display: flex; gap: 14px; }
    .half-width { flex: 1; margin-bottom: 16px; }

    ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    ::ng-deep .mdc-text-field--outlined .mdc-notched-outline__notch { border-color: rgba(108,99,255,0.4) !important; }
  `]
})
export class NotificationListPage implements OnInit {
  private readonly fb    = inject(FormBuilder);
  private readonly http  = inject(HttpClient);
  private readonly toast = inject(NotificationService);

  // Loading signals
  broadcastLoading      = signal(false);
  userPushLoading       = signal(false);
  directSmsLoading      = signal(false);
  bulkSmsLoading        = signal(false);
  directWhatsappLoading = signal(false);
  bulkWhatsappLoading   = signal(false);
  singleEmailLoading    = signal(false);
  bulkEmailLoading      = signal(false);
  allChannelLoading     = signal(false);
  historyLoading        = signal(false);

  // Counts
  bulkSmsRecipientCount      = signal(0);
  bulkWhatsappRecipientCount = signal(0);
  bulkEmailRecipientCount    = signal(0);

  // History state
  historyList           = signal<NotificationLogItem[]>([]);
  selectedChannelFilter = 'ALL';
  displayedColumns      = ['channel', 'recipientTarget', 'message', 'status', 'createdAt'];

  // Form Groups
  broadcastForm = this.fb.group({
    topic:     ['all_users',  [Validators.required]],
    title:     ['',           [Validators.required]],
    message:   ['',           [Validators.required]],
    actionUrl: [''],
    imageUrl:  [''],
  });

  userPushForm = this.fb.group({
    userId:    ['', [Validators.required]],
    title:     ['', [Validators.required]],
    message:   ['', [Validators.required]],
    imageUrl:  [''],
  });

  directSmsForm = this.fb.group({
    phoneNumber:   ['', [Validators.required]],
    dltTemplateId: [''],
    dltHeaderId:   [''],
    message:       ['', [Validators.required, Validators.maxLength(160)]],
  });

  bulkSmsForm = this.fb.group({
    phoneNumbers:  ['', [Validators.required]],
    dltTemplateId: [''],
    dltHeaderId:   [''],
    message:       ['', [Validators.required, Validators.maxLength(160)]],
  });

  directWhatsappForm = this.fb.group({
    phoneNumber: ['', [Validators.required]],
    templateId:  [''],
    message:     ['', [Validators.required]],
    mediaUrl:    ['']
  });

  bulkWhatsappForm = this.fb.group({
    phoneNumbers: ['', [Validators.required]],
    templateId:   [''],
    message:      ['', [Validators.required]]
  });

  singleEmailForm = this.fb.group({
    toEmail:   ['', [Validators.required, Validators.email]],
    subject:   ['', [Validators.required]],
    body:      ['', [Validators.required]],
    actionUrl: ['']
  });

  bulkEmailForm = this.fb.group({
    toEmails: ['', [Validators.required]],
    subject:  ['', [Validators.required]],
    body:     ['', [Validators.required]]
  });

  allChannelForm = this.fb.group({
    userId:  ['', [Validators.required]],
    title:   ['', [Validators.required]],
    message: ['', [Validators.required]],
  });

  // Gateway Configuration Forms & Signals
  configLoading = signal(false);
  configSaving  = signal<string | null>(null);

  smsConfigForm = this.fb.group({
    provider:          ['msg91', Validators.required],
    enabled:           [true],
    authKey:           [''],
    senderId:          ['MAXXPX', Validators.required],
    dltEntityId:       [''],
    defaultTemplateId: [''],
    route:             ['4']
  });

  whatsappConfigForm = this.fb.group({
    provider:          ['meta_cloud', Validators.required],
    enabled:           [true],
    phoneNumberId:     ['', Validators.required],
    accessToken:       [''],
    businessAccountId: [''],
    webhookSecret:     ['']
  });

  pushConfigForm = this.fb.group({
    provider:           ['firebase_fcm', Validators.required],
    enabled:            [true],
    projectId:          ['', Validators.required],
    serviceAccountJson: [''],
    defaultTopic:       ['all_users']
  });

  emailConfigForm = this.fb.group({
    provider:    ['smtp', Validators.required],
    enabled:     [true],
    host:        ['smtp.gmail.com', Validators.required],
    port:        [587, Validators.required],
    senderEmail: ['noreply@maxxpixels.tv', [Validators.required, Validators.email]],
    senderName:  ['MaxxPixels OTT', Validators.required],
    username:    [''],
    password:    [''],
    useTls:      [true]
  });

  // CRM / Audience Operations (additive local workflow tooling + backend-backed history/devices where available)
  crmTemplates: Array<{ id: string; name: string; channel: 'PUSH'|'SMS'|'WHATSAPP'|'EMAIL'|'ALL'; title: string; message: string; actionUrl?: string; imageUrl?: string; tags?: string; updatedAt: string; }> = [];
  crmSegments: Array<{ id: string; name: string; audience: string; channels: string[]; rules: string; estimatedReach: string; notes: string; updatedAt: string; }> = [];
  crmCampaigns: Array<{ id: string; name: string; objective: string; segmentId?: string; templateId?: string; channels: string[]; scheduledAt?: string; frequencyCap: string; status: 'DRAFT'|'SCHEDULED'|'SENT'|'PAUSED'; abEnabled: boolean; variantA?: string; variantB?: string; notes?: string; updatedAt: string; lastDispatchedAt?: string; }> = [];
  crmSuppressions: Array<{ id: string; contact: string; channel: 'PUSH'|'SMS'|'WHATSAPP'|'EMAIL'|'ALL'; reason: string; source: string; active: boolean; createdAt: string; }> = [];
  crmCompliance = {
    consentVerified: false,
    dndScrubbed: false,
    regionalPolicyChecked: false,
    unsubscribeFooterIncluded: false,
    frequencyCapAcknowledged: false,
    auditLogged: false,
    notes: ''
  };
  templateForm = { name: '', channel: 'PUSH' as 'PUSH'|'SMS'|'WHATSAPP'|'EMAIL'|'ALL', title: '', message: '', actionUrl: '', imageUrl: '', tags: '' };
  segmentForm = { name: '', audience: 'ALL', channels: ['PUSH'] as string[], rules: '', estimatedReach: '', notes: '' };
  campaignForm = { name: '', objective: 'ENGAGEMENT', segmentId: '', templateId: '', channels: ['PUSH'] as string[], scheduledAt: '', frequencyCap: '1 per 24h per user', status: 'DRAFT' as 'DRAFT'|'SCHEDULED'|'SENT'|'PAUSED', abEnabled: false, variantA: '', variantB: '', notes: '' };
  suppressionForm = { contact: '', channel: 'ALL' as 'PUSH'|'SMS'|'WHATSAPP'|'EMAIL'|'ALL', reason: 'USER_OPT_OUT', source: 'MANUAL', active: true };
  campaignScheduleAt = '';
  campaignFrequencyCapPolicy = 'Default: 1 promotional message / 24h per user, 3 / week per channel (policy guidance; backend enforcement may vary).';
  devicesLoading = signal(false);
  registeredDevices = signal<any[]>([]);
  deliveryAnalyticsWindow: '7d'|'30d'|'all' = '30d';
  private readonly CRM_TEMPLATES_KEY = 'maxx_crm_notification_templates_v1';
  private readonly CRM_SEGMENTS_KEY = 'maxx_crm_notification_segments_v1';
  private readonly CRM_CAMPAIGNS_KEY = 'maxx_crm_notification_campaigns_v1';
  private readonly CRM_SUPPRESSIONS_KEY = 'maxx_crm_notification_suppressions_v1';
  private readonly CRM_COMPLIANCE_KEY = 'maxx_crm_notification_compliance_v1';

  constructor() {
    // SMS recipient tracker
    this.bulkSmsForm.get('phoneNumbers')?.valueChanges.subscribe(val => {
      const count = val ? val.split('\n').map(s => s.trim()).filter(s => s.length > 0).length : 0;
      this.bulkSmsRecipientCount.set(count);
    });

    // WhatsApp recipient tracker
    this.bulkWhatsappForm.get('phoneNumbers')?.valueChanges.subscribe(val => {
      const count = val ? val.split('\n').map(s => s.trim()).filter(s => s.length > 0).length : 0;
      this.bulkWhatsappRecipientCount.set(count);
    });

    // Email recipient tracker
    this.bulkEmailForm.get('toEmails')?.valueChanges.subscribe(val => {
      const count = val ? val.split('\n').map(s => s.trim()).filter(s => s.length > 0).length : 0;
      this.bulkEmailRecipientCount.set(count);
    });
  }

  ngOnInit(): void {
    this.loadHistory();
    this.loadConfig();
    this.loadCrmWorkspace();
    this.loadDevices();
  }

  onImageUploaded(target: 'broadcast' | 'user', url: string): void {
    if (target === 'broadcast') {
      this.broadcastForm.patchValue({ imageUrl: url });
      this.toast.success('Broadcast notification image uploaded!');
    } else {
      this.userPushForm.patchValue({ imageUrl: url });
      this.toast.success('User notification image uploaded!');
    }
  }

  onBroadcast(): void {
    if (this.broadcastForm.invalid) return;
    const { topic, title, message, actionUrl, imageUrl } = this.broadcastForm.value;
    this.broadcastLoading.set(true);
    this.http.post(`${API}/admin/notifications/push/topic`, { topic, title, message, actionUrl, imageUrl, scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('PUSH', topic || 'all_users') })
      .pipe(finalize(() => this.broadcastLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`FCM push broadcast sent to topic: ${topic}`); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Broadcast failed'),
      });
  }

  onPushToUser(): void {
    if (this.userPushForm.invalid) return;
    const { userId, title, message, imageUrl } = this.userPushForm.value;
    this.userPushLoading.set(true);
    this.http.post(`${API}/admin/notifications/push/user/${userId}`, { title, message, imageUrl, scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('PUSH', userId || '') })
      .pipe(finalize(() => this.userPushLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`Push notification sent to User ${userId}`); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Failed to send push'),
      });
  }

  onDirectSms(): void {
    if (this.directSmsForm.invalid) return;
    const { phoneNumber, dltTemplateId, dltHeaderId, message } = this.directSmsForm.value;
    this.directSmsLoading.set(true);
    this.http.post(`${API}/admin/notifications/sms/send`, { phoneNumber, dltTemplateId, dltHeaderId, message, scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('SMS', phoneNumber || '') })
      .pipe(finalize(() => this.directSmsLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`SMS dispatched via MSG91 to ${phoneNumber}`); this.directSmsForm.reset(); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'SMS failed'),
      });
  }

  onBulkSms(): void {
    if (this.bulkSmsForm.invalid) return;
    const raw           = this.bulkSmsForm.get('phoneNumbers')?.value ?? '';
    const phones        = raw.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const dltTemplateId = this.bulkSmsForm.get('dltTemplateId')?.value;
    const dltHeaderId   = this.bulkSmsForm.get('dltHeaderId')?.value;
    const message       = this.bulkSmsForm.get('message')?.value;
    if (phones.length === 0) { this.toast.error('Enter at least one phone number.'); return; }
    this.bulkSmsLoading.set(true);
    this.http.post(`${API}/admin/notifications/sms/bulk`, { phoneNumbers: phones, dltTemplateId, dltHeaderId, message, targetAudience: 'BULK_LIST', scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('SMS', 'bulk') })
      .pipe(finalize(() => this.bulkSmsLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`Bulk SMS dispatched via MSG91 to ${phones.length} numbers`); this.bulkSmsForm.reset(); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Bulk SMS failed'),
      });
  }

  onDirectWhatsapp(): void {
    if (this.directWhatsappForm.invalid) return;
    const { phoneNumber, templateId, message, mediaUrl } = this.directWhatsappForm.value;
    this.directWhatsappLoading.set(true);
    this.http.post(`${API}/admin/notifications/whatsapp/send`, { phoneNumber, templateId, message, mediaUrl, scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('WHATSAPP', phoneNumber || '') })
      .pipe(finalize(() => this.directWhatsappLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`WhatsApp message delivered to ${phoneNumber}`); this.directWhatsappForm.reset(); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'WhatsApp failed'),
      });
  }

  onBulkWhatsapp(): void {
    if (this.bulkWhatsappForm.invalid) return;
    const raw        = this.bulkWhatsappForm.get('phoneNumbers')?.value ?? '';
    const phones     = raw.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const templateId = this.bulkWhatsappForm.get('templateId')?.value;
    const message    = this.bulkWhatsappForm.get('message')?.value;
    if (phones.length === 0) { this.toast.error('Enter at least one phone number.'); return; }
    this.bulkWhatsappLoading.set(true);
    this.http.post(`${API}/admin/notifications/whatsapp/bulk`, { phoneNumbers: phones, templateId, message, targetAudience: 'BULK_LIST', scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('WHATSAPP', 'bulk') })
      .pipe(finalize(() => this.bulkWhatsappLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`Bulk WhatsApp blast sent to ${phones.length} recipients`); this.bulkWhatsappForm.reset(); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Bulk WhatsApp failed'),
      });
  }

  onSingleEmail(): void {
    if (this.singleEmailForm.invalid) return;
    const { toEmail, subject, body, actionUrl } = this.singleEmailForm.value;
    this.singleEmailLoading.set(true);
    this.http.post(`${API}/admin/notifications/email/send`, { toEmail, subject, body, actionUrl, scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('EMAIL', toEmail || '') })
      .pipe(finalize(() => this.singleEmailLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`Transactional email sent to ${toEmail}`); this.singleEmailForm.reset(); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Email failed'),
      });
  }

  onBulkEmail(): void {
    if (this.bulkEmailForm.invalid) return;
    const raw     = this.bulkEmailForm.get('toEmails')?.value ?? '';
    const emails  = raw.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
    const subject = this.bulkEmailForm.get('subject')?.value;
    const body    = this.bulkEmailForm.get('body')?.value;
    if (emails.length === 0) { this.toast.error('Enter at least one recipient email.'); return; }
    this.bulkEmailLoading.set(true);
    this.http.post(`${API}/admin/notifications/email/bulk`, { toEmails: emails, subject, body, targetAudience: 'BULK_LIST', scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('EMAIL', 'bulk') })
      .pipe(finalize(() => this.bulkEmailLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`Bulk Email campaign dispatched to ${emails.length} addresses`); this.bulkEmailForm.reset(); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Bulk Email failed'),
      });
  }

  onAllChannels(): void {
    if (this.allChannelForm.invalid) return;
    const { userId, title, message } = this.allChannelForm.value;
    this.allChannelLoading.set(true);
    this.http.post(`${API}/admin/notifications/all/user/${userId}`, { title, message, scheduledAt: this.campaignScheduleAt || undefined, crm: this.buildCrmDispatchContext('ALL', userId || '') })
      .pipe(finalize(() => this.allChannelLoading.set(false)))
      .subscribe({
        next:  () => { this.toast.success(`Omni-channel notification dispatched to User ${userId}`); this.loadHistory(); },
        error: e  => this.toast.error(e?.error?.message || 'Multi-channel send failed'),
      });
  }

  onTestGateway(channel: 'FCM' | 'SMS' | 'WHATSAPP' | 'EMAIL'): void {
    this.toast.info(`Testing ${channel} Gateway ping...`);
    this.http.post<any>(`${API}/admin/notifications/test`, {
      channel,
      testTarget: channel === 'SMS' ? '+919999999999' : (channel === 'EMAIL' ? 'admin@maxxpixels.com' : 'all_users'),
      message: 'Ping diagnostic from MaxxPixels Notification Operations Center'
    }).subscribe({
      next: (res) => {
        const d = res?.data || res;
        this.toast.success(`✅ ${channel} Gateway: [${d.status || 'OK'}] ${d.details || d.message || 'Operational'}`);
        this.loadHistory();
      },
      error: (err) => {
        this.toast.error(`❌ ${channel} Gateway Test Failed: ${err?.error?.message || err?.message}`);
      }
    });
  }

  setChannelFilter(channel: string): void {
    this.selectedChannelFilter = channel;
    this.loadHistory();
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.http.get<any>(`${API}/admin/notifications/history?channel=${this.selectedChannelFilter}&limit=200`)
      .pipe(finalize(() => this.historyLoading.set(false)))
      .subscribe({
        next: (res) => {
          const items = res?.data?.items || res?.data?.content || res?.data || [];
          this.historyList.set(items);
        },
        error: () => this.historyList.set([])
      });
  }

  loadConfig(): void {
    this.configLoading.set(true);
    this.http.get<any>(`${API}/admin/notifications/config`)
      .pipe(finalize(() => this.configLoading.set(false)))
      .subscribe({
        next: (res) => {
          const d = res?.data || res?.result || {};
          if (d.sms) {
            this.smsConfigForm.patchValue({
              provider:          d.sms.provider || 'msg91',
              enabled:           d.sms.is_enabled ?? true,
              authKey:           d.sms.auth_key || '',
              senderId:          d.sms.sender_id || '',
              dltEntityId:       d.sms.dlt_entity_id || '',
              defaultTemplateId: d.sms.flow_id || '',
              route:             d.sms.route || '4'
            });
          }
          if (d.whatsapp) {
            this.whatsappConfigForm.patchValue({
              provider:          d.whatsapp.provider || 'meta_cloud',
              enabled:           d.whatsapp.is_enabled ?? true,
              phoneNumberId:     d.whatsapp.phone_number_id || '',
              accessToken:       d.whatsapp.access_token || '',
              businessAccountId: d.whatsapp.business_account_id || '',
              webhookSecret:     d.whatsapp.webhook_secret || ''
            });
          }
          if (d.push) {
            this.pushConfigForm.patchValue({
              provider:           d.push.provider || 'firebase_fcm',
              enabled:            d.push.is_enabled ?? true,
              projectId:          d.push.project_id || '',
              serviceAccountJson: d.push.service_account_json || '',
              defaultTopic:       d.push.default_topic || 'all_users'
            });
          }
          if (d.email) {
            this.emailConfigForm.patchValue({
              provider:    d.email.provider || 'smtp',
              enabled:     d.email.is_enabled ?? true,
              host:        d.email.host || '',
              port:        d.email.port || 587,
              senderEmail: d.email.sender_email || '',
              senderName:  d.email.sender_name || '',
              username:    d.email.username || '',
              password:    d.email.password || '',
              useTls:      d.email.enable_tls ?? true
            });
          }
        },
        error: () => {}
      });
  }

  onSaveConfig(channel: 'SMS' | 'WHATSAPP' | 'PUSH' | 'EMAIL'): void {
    let payload: any = {};
    if (channel === 'SMS') {
      const v = this.smsConfigForm.value;
      payload = {
        provider:            v.provider,
        is_enabled:          v.enabled,
        auth_key:            v.authKey,
        sender_id:           v.senderId,
        dlt_entity_id:       v.dltEntityId,
        default_template_id: v.defaultTemplateId,
        route:               v.route
      };
    } else if (channel === 'WHATSAPP') {
      const v = this.whatsappConfigForm.value;
      payload = {
        provider:            v.provider,
        is_enabled:          v.enabled,
        phone_number_id:     v.phoneNumberId,
        access_token:        v.accessToken,
        business_account_id: v.businessAccountId,
        webhook_secret:      v.webhookSecret
      };
    } else if (channel === 'PUSH') {
      const v = this.pushConfigForm.value;
      payload = {
        provider:             v.provider,
        is_enabled:           v.enabled,
        project_id:           v.projectId,
        service_account_json: v.serviceAccountJson,
        default_topic:        v.defaultTopic
      };
    } else if (channel === 'EMAIL') {
      const v = this.emailConfigForm.value;
      payload = {
        provider:     v.provider,
        is_enabled:   v.enabled,
        host:         v.host,
        port:         Number(v.port),
        sender_email: v.senderEmail,
        sender_name:  v.senderName,
        username:     v.username,
        password:     v.password,
        enable_tls:   v.useTls
      };
    }

    this.configSaving.set(channel);
    this.http.post(`${API}/admin/notifications/config/${channel}`, payload)
      .pipe(finalize(() => this.configSaving.set(null)))
      .subscribe({
        next: () => {
          this.toast.success(`🔒 ${channel} credentials encrypted with AES-256-GCM and stored safely in PostgreSQL`);
          this.loadConfig();
        },
        error: (err) => {
          this.toast.error(err?.error?.message || `Failed to save ${channel} configuration`);
        }
      });
  }
  private safeParse<T>(key: string, fallback: T): T {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch { return fallback; }
  }
  private safeSave(key: string, value: any): void {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  loadCrmWorkspace(): void {
    this.crmTemplates = this.safeParse(this.CRM_TEMPLATES_KEY, []);
    this.crmSegments = this.safeParse(this.CRM_SEGMENTS_KEY, []);
    this.crmCampaigns = this.safeParse(this.CRM_CAMPAIGNS_KEY, []);
    this.crmSuppressions = this.safeParse(this.CRM_SUPPRESSIONS_KEY, []);
    this.crmCompliance = { ...this.crmCompliance, ...this.safeParse(this.CRM_COMPLIANCE_KEY, {}) };
  }
  saveCrmTemplates(): void { this.safeSave(this.CRM_TEMPLATES_KEY, this.crmTemplates); }
  saveCrmSegments(): void { this.safeSave(this.CRM_SEGMENTS_KEY, this.crmSegments); }
  saveCrmCampaigns(): void { this.safeSave(this.CRM_CAMPAIGNS_KEY, this.crmCampaigns); }
  saveCrmSuppressions(): void { this.safeSave(this.CRM_SUPPRESSIONS_KEY, this.crmSuppressions); }
  saveCrmCompliance(): void { this.safeSave(this.CRM_COMPLIANCE_KEY, this.crmCompliance); }
  loadDevices(): void {
    this.devicesLoading.set(true);
    this.http.get<any>(`${API}/admin/notifications/devices`).pipe(finalize(() => this.devicesLoading.set(false))).subscribe({
      next: (res) => {
        const d = res?.data ?? res ?? [];
        this.registeredDevices.set(Array.isArray(d) ? d : (d.items || d.content || []));
      },
      error: () => this.registeredDevices.set([])
    });
  }
  upsertTemplate(): void {
    const name = (this.templateForm.name || '').trim();
    const message = (this.templateForm.message || '').trim();
    if (!name || !message) { this.toast.error('Template name and message are required.'); return; }
    const now = new Date().toISOString();
    const existingIdx = this.crmTemplates.findIndex(t => t.name.toLowerCase() === name.toLowerCase() && t.channel === this.templateForm.channel);
    const item = { id: existingIdx >= 0 ? this.crmTemplates[existingIdx].id : `tpl_${Date.now()}`, name, channel: this.templateForm.channel, title: (this.templateForm.title||'').trim(), message, actionUrl: (this.templateForm.actionUrl||'').trim(), imageUrl: (this.templateForm.imageUrl||'').trim(), tags: (this.templateForm.tags||'').trim(), updatedAt: now };
    if (existingIdx >= 0) this.crmTemplates[existingIdx] = item; else this.crmTemplates.unshift(item);
    this.saveCrmTemplates();
    this.toast.success(existingIdx >= 0 ? 'Template updated.' : 'Template saved.');
  }
  applyTemplate(t: any): void {
    if (!t) return;
    if (t.channel === 'PUSH' || t.channel === 'ALL') { this.broadcastForm.patchValue({ title: t.title || '', message: t.message || '', actionUrl: t.actionUrl || '', imageUrl: t.imageUrl || '' }); this.userPushForm.patchValue({ title: t.title || '', message: t.message || '', imageUrl: t.imageUrl || '' }); }
    if (t.channel === 'SMS' || t.channel === 'ALL') { this.directSmsForm.patchValue({ message: t.message || '' }); this.bulkSmsForm.patchValue({ message: t.message || '' }); }
    if (t.channel === 'WHATSAPP' || t.channel === 'ALL') { this.directWhatsappForm.patchValue({ message: t.message || '', mediaUrl: t.imageUrl || '' }); this.bulkWhatsappForm.patchValue({ message: t.message || '' }); }
    if (t.channel === 'EMAIL' || t.channel === 'ALL') { this.singleEmailForm.patchValue({ subject: t.title || '', body: t.message || '', actionUrl: t.actionUrl || '' }); this.bulkEmailForm.patchValue({ subject: t.title || '', body: t.message || '' }); }
    this.toast.success(`Template "${t.name}" applied to matching channel forms.`);
  }
  deleteTemplate(id: string): void { this.crmTemplates = this.crmTemplates.filter(t => t.id !== id); this.saveCrmTemplates(); }
  toggleSegmentChannel(ch: string): void {
    const set = new Set(this.segmentForm.channels || []);
    if (set.has(ch)) set.delete(ch); else set.add(ch);
    this.segmentForm.channels = Array.from(set);
  }
  saveSegment(): void {
    const name = (this.segmentForm.name || '').trim();
    if (!name) { this.toast.error('Segment name is required.'); return; }
    const now = new Date().toISOString();
    const existingIdx = this.crmSegments.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    const item = { id: existingIdx >= 0 ? this.crmSegments[existingIdx].id : `seg_${Date.now()}`, name, audience: this.segmentForm.audience, channels: [...(this.segmentForm.channels || [])], rules: (this.segmentForm.rules||'').trim(), estimatedReach: (this.segmentForm.estimatedReach||'').trim(), notes: (this.segmentForm.notes||'').trim(), updatedAt: now };
    if (existingIdx >= 0) this.crmSegments[existingIdx] = item; else this.crmSegments.unshift(item);
    this.saveCrmSegments();
    this.toast.success(existingIdx >= 0 ? 'Segment updated.' : 'Segment saved.');
  }
  applySegment(s: any): void {
    if (!s) return;
    if (s.audience) this.broadcastForm.patchValue({ topic: s.audience === 'SUBSCRIBERS' ? 'premium_subscribers' : 'all_users' });
    this.toast.info(`Segment "${s.name}" selected for planning (audience: ${s.audience || 'N/A'}). Unsupported advanced rules are stored as planning metadata.`);
  }
  deleteSegment(id: string): void { this.crmSegments = this.crmSegments.filter(s => s.id !== id); this.saveCrmSegments(); }
  toggleCampaignChannel(ch: string): void {
    const set = new Set(this.campaignForm.channels || []);
    if (set.has(ch)) set.delete(ch); else set.add(ch);
    this.campaignForm.channels = Array.from(set);
  }
  saveCampaign(): void {
    const name = (this.campaignForm.name || '').trim();
    if (!name) { this.toast.error('Campaign name is required.'); return; }
    const now = new Date().toISOString();
    const existingIdx = this.crmCampaigns.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    const item = { id: existingIdx >= 0 ? this.crmCampaigns[existingIdx].id : `cmp_${Date.now()}`, name, objective: this.campaignForm.objective, segmentId: this.campaignForm.segmentId || undefined, templateId: this.campaignForm.templateId || undefined, channels: [...(this.campaignForm.channels || [])], scheduledAt: this.campaignForm.scheduledAt || undefined, frequencyCap: this.campaignForm.frequencyCap || '1 per 24h per user', status: this.campaignForm.status, abEnabled: !!this.campaignForm.abEnabled, variantA: this.campaignForm.variantA || '', variantB: this.campaignForm.variantB || '', notes: this.campaignForm.notes || '', updatedAt: now, lastDispatchedAt: existingIdx >= 0 ? this.crmCampaigns[existingIdx].lastDispatchedAt : undefined };
    if (existingIdx >= 0) this.crmCampaigns[existingIdx] = item; else this.crmCampaigns.unshift(item);
    this.saveCrmCampaigns();
    this.toast.success(existingIdx >= 0 ? 'Campaign updated.' : 'Campaign draft saved.');
  }
  applyCampaign(c: any): void {
    if (!c) return;
    this.campaignForm = { ...this.campaignForm, name: c.name, objective: c.objective || 'ENGAGEMENT', segmentId: c.segmentId || '', templateId: c.templateId || '', channels: [...(c.channels || [])], scheduledAt: c.scheduledAt || '', frequencyCap: c.frequencyCap || this.campaignFrequencyCapPolicy, status: c.status || 'DRAFT', abEnabled: !!c.abEnabled, variantA: c.variantA || '', variantB: c.variantB || '', notes: c.notes || '' };
    this.campaignScheduleAt = c.scheduledAt || this.campaignScheduleAt;
    const tpl = this.crmTemplates.find(t => t.id === c.templateId);
    const seg = this.crmSegments.find(s => s.id === c.segmentId);
    if (tpl) this.applyTemplate(tpl);
    if (seg) this.applySegment(seg);
    this.toast.info(`Campaign "${c.name}" loaded into planner.`);
  }
  markCampaignSent(c: any): void {
    if (!c) return;
    c.status = c.scheduledAt ? 'SCHEDULED' : 'SENT';
    c.lastDispatchedAt = new Date().toISOString();
    c.updatedAt = c.lastDispatchedAt;
    this.saveCrmCampaigns();
  }
  deleteCampaign(id: string): void { this.crmCampaigns = this.crmCampaigns.filter(c => c.id !== id); this.saveCrmCampaigns(); }
  buildCrmDispatchContext(channel: string, target: string): any {
    const activeCampaign = this.crmCampaigns.find(c => c.name === this.campaignForm.name) || null;
    return {
      plannedAt: new Date().toISOString(),
      channel,
      target,
      scheduledAt: this.campaignScheduleAt || null,
      campaign: activeCampaign ? { id: activeCampaign.id, name: activeCampaign.name, status: activeCampaign.status, segmentId: activeCampaign.segmentId || null, abEnabled: !!activeCampaign.abEnabled } : null,
      frequencyCap: this.campaignForm.frequencyCap || this.campaignFrequencyCapPolicy,
      compliance: this.crmCompliance
    };
  }
  addSuppression(): void {
    const contact = (this.suppressionForm.contact || '').trim();
    if (!contact) { this.toast.error('Contact (email/phone/user ID/token) is required.'); return; }
    const item = { id: `sup_${Date.now()}`, contact, channel: this.suppressionForm.channel, reason: this.suppressionForm.reason, source: this.suppressionForm.source || 'MANUAL', active: !!this.suppressionForm.active, createdAt: new Date().toISOString() };
    this.crmSuppressions.unshift(item);
    this.saveCrmSuppressions();
    this.suppressionForm.contact = '';
    this.toast.success('Suppression/preference entry saved.');
  }
  toggleSuppression(s: any): void { s.active = !s.active; this.saveCrmSuppressions(); }
  deleteSuppression(id: string): void { this.crmSuppressions = this.crmSuppressions.filter(s => s.id !== id); this.saveCrmSuppressions(); }
  exportSuppressionsCsv(): void {
    const header = ['Contact','Channel','Reason','Source','Active','CreatedAt'];
    const rows = this.crmSuppressions.map(s => [s.contact, s.channel, s.reason, s.source, String(s.active), s.createdAt]);
    const csv = [header, ...rows].map(r => r.map(c => this.escapeCsv(String(c ?? ''))).join(',')).join('\n');
    this.downloadTextFile(csv, `notification-suppressions-${Date.now()}.csv`, 'text/csv;charset=utf-8;');
  }
  exportCrmWorkspace(): void {
    const payload = { exportedAt: new Date().toISOString(), templates: this.crmTemplates, segments: this.crmSegments, campaigns: this.crmCampaigns, suppressions: this.crmSuppressions, compliance: this.crmCompliance };
    this.downloadTextFile(JSON.stringify(payload, null, 2), `crm-notifications-workspace-${Date.now()}.json`, 'application/json');
  }
  private downloadTextFile(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  private escapeCsv(v: string): string { return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
  get filteredHistoryForAnalytics(): NotificationLogItem[] {
    const now = Date.now();
    const days = this.deliveryAnalyticsWindow === '7d' ? 7 : (this.deliveryAnalyticsWindow === '30d' ? 30 : 36500);
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return this.historyList().filter(h => {
      const t = new Date(h.createdAt || 0).getTime();
      return !t || t >= cutoff;
    });
  }
  get analyticsTotal(): number { return this.filteredHistoryForAnalytics.length; }
  get analyticsDelivered(): number { return this.filteredHistoryForAnalytics.filter(h => ['SENT','DELIVERED','READ','SIMULATED'].includes((h.status||'').toUpperCase())).length; }
  get analyticsFailed(): number { return this.filteredHistoryForAnalytics.filter(h => (h.status||'').toUpperCase() === 'FAILED').length; }
  get analyticsDeliveryRate(): number { return this.analyticsTotal ? Math.round((this.analyticsDelivered / this.analyticsTotal) * 100) : 0; }
  get analyticsByChannel(): Array<{channel:string; count:number; delivered:number; failed:number}> {
    const map = new Map<string, {channel:string; count:number; delivered:number; failed:number}>();
    for (const h of this.filteredHistoryForAnalytics) {
      const ch = (h.channel || 'UNKNOWN').toUpperCase();
      if (!map.has(ch)) map.set(ch, {channel: ch, count: 0, delivered: 0, failed: 0});
      const row = map.get(ch)!; row.count++;
      const st = (h.status||'').toUpperCase();
      if (['SENT','DELIVERED','READ','SIMULATED'].includes(st)) row.delivered++;
      if (st === 'FAILED') row.failed++;
    }
    return Array.from(map.values()).sort((a,b) => b.count - a.count);
  }
  get analyticsRecentFailures(): NotificationLogItem[] {
    return this.filteredHistoryForAnalytics.filter(h => (h.status||'').toUpperCase() === 'FAILED' || !!h.errorDetails).slice(0, 10);
  }
  get deviceReachSummary(): { total: number; activeTokens: number; platforms: Array<{name:string; count:number}> } {
    const devices = this.registeredDevices() || [];
    const platformMap = new Map<string, number>();
    let activeTokens = 0;
    for (const d of devices) {
      const p = (d.platform || d.deviceType || 'UNKNOWN').toString();
      platformMap.set(p, (platformMap.get(p) || 0) + 1);
      if (d.hasFcmToken || d.fcmToken || d.fcm_token) activeTokens++;
    }
    const platforms = Array.from(platformMap.entries()).map(([name,count]) => ({name, count})).sort((a,b)=>b.count-a.count);
    return { total: devices.length, activeTokens, platforms };
  }
  get activeSuppressionsCount(): number { return this.crmSuppressions.filter(s => s.active).length; }

}
