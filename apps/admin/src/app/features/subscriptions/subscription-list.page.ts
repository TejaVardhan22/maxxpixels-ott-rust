import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PlanApiService, Plan } from '../../core/services/plan-api.service';
import { PaymentApiService } from '../../core/services/payment-api.service';
import { NotificationService } from '../../shared/services/notification.service';

const DAY_OPTIONS = [
  { count: 1, label: '1 Day Pass (24 Hours)' },
  { count: 2, label: '2 Days Pass' },
  { count: 3, label: '3 Days Pass' },
  { count: 4, label: '4 Days Pass' },
  { count: 5, label: '5 Days Pass' },
  { count: 6, label: '6 Days Pass' },
  { count: 7, label: '7 Days Pass (1 Week)' },
  { count: 8, label: '8 Days Pass' },
  { count: 9, label: '9 Days Pass' },
  { count: 10, label: '10 Days Pass' },
  { count: 11, label: '11 Days Pass' },
  { count: 12, label: '12 Days Pass' },
  { count: 13, label: '13 Days Pass' },
  { count: 14, label: '14 Days Pass (2 Weeks)' },
  { count: 15, label: '15 Days Pass' },
  { count: 20, label: '20 Days Pass' },
  { count: 30, label: '30 Days Pass (1 Month)' },
  { count: 45, label: '45 Days Pass' },
  { count: 60, label: '60 Days Pass (2 Months)' },
  { count: 90, label: '90 Days Pass (3 Months)' },
  { count: 180, label: '180 Days Pass (6 Months)' },
  { count: 365, label: '365 Days Pass (1 Year)' }
];

const MONTH_OPTIONS = [
  { count: 1, label: '1 Month Subscription' },
  { count: 2, label: '2 Months Subscription' },
  { count: 3, label: '3 Months (Quarterly)' },
  { count: 4, label: '4 Months Subscription' },
  { count: 5, label: '5 Months Subscription' },
  { count: 6, label: '6 Months (Half-Yearly)' },
  { count: 7, label: '7 Months Subscription' },
  { count: 8, label: '8 Months Subscription' },
  { count: 9, label: '9 Months Subscription' },
  { count: 10, label: '10 Months Subscription' },
  { count: 11, label: '11 Months Subscription' },
  { count: 12, label: '12 Months (1 Year Annual)' },
  { count: 18, label: '18 Months (1.5 Years)' },
  { count: 24, label: '24 Months (2 Years)' },
  { count: 36, label: '36 Months (3 Years)' }
];

const YEAR_OPTIONS = [
  { count: 1, label: '1 Year Pass (Annual)' },
  { count: 2, label: '2 Years Pass' },
  { count: 3, label: '3 Years Pass' },
  { count: 4, label: '4 Years Pass' },
  { count: 5, label: '5 Years Pass' },
  { count: 10, label: '10 Years Lifetime Pass' }
];

const ONE_TIME_OPTIONS = [
  { count: 1, label: 'One-Time Rental / Lifetime Access' }
];

@Component({
  selector: 'app-subscription-list-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER & ACTIONS -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>monetization_on</mat-icon> MONETIZATION & SUBSCRIPTION TIERS</span>
          <h1>Subscription Plans & Monetization Tiering</h1>
          <p>Configure 1-Day Passes, One-Time Rentals, Non-Rechargeable Single-Use Tiers & Annual Passes</p>
        </div>
        <div class="header-actions" style="display:flex; gap:10px; flex-wrap:wrap;">
          <button mat-stroked-button color="accent" (click)="router.navigate(['/admin/coupons'])">
            <mat-icon>card_giftcard</mat-icon> Coupons & Offers
          </button>
          <button mat-stroked-button color="primary" (click)="router.navigate(['/admin/payments'])">
            <mat-icon>receipt_long</mat-icon> Payments & Refunds
          </button>
          <button mat-raised-button color="primary" class="add-btn" (click)="openCreateModal()">
            <mat-icon>add</mat-icon> Create New Subscription Plan
          </button>
        </div>
      </div>

      <!-- 2. REVENUE & SUBSCRIBER KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <mat-icon class="kpi-icon">card_membership</mat-icon>
          <div>
            <span class="kpi-label">Active / Total Subscription Plans</span>
            <div class="kpi-val">{{ activePlansCount }} / {{ plans.length }} Tiers</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <mat-icon class="kpi-icon">groups</mat-icon>
          <div>
            <span class="kpi-label">Total Active Subscribers</span>
            <div class="kpi-val">{{ activeSubscribers | number }} Members</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <mat-icon class="kpi-icon">attach_money</mat-icon>
          <div>
            <span class="kpi-label">Monthly Recurring Revenue (MRR)</span>
            <div class="kpi-val">₹{{ totalRevenue | number:'1.2-2' }}</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <mat-icon class="kpi-icon">trending_up</mat-icon>
          <div>
            <span class="kpi-label">Average Revenue Per User (ARPU)</span>
            <div class="kpi-val">₹{{ arpu | number:'1.0-0' }} / Subscriber</div>
          </div>
        </div>
      </div>

      <!-- 3. SUBSCRIBER OPS & SUPPORT SHORTCUTS (Additive) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:18px;">
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#00d2ff;">support_agent</mat-icon> Subscriber Support Ops</div>
          <div style="font-size:12px;color:#a0a0b0;line-height:1.5;">Use <strong style="color:#fff;">Payments & Refunds</strong> for transaction failures, refund processing, and dunning follow-up. Use <strong style="color:#fff;">Users</strong> for account status, entitlement checks, device revocation, and support notes.</div>
        </div>
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#ffab00;">card_giftcard</mat-icon> Promotions & Coupon Ops</div>
          <div style="font-size:12px;color:#a0a0b0;line-height:1.5;">Manage discount codes, free-gift vouchers, per-user limits, and plan-specific offers in <strong style="color:#fff;">Coupons & Offers</strong>. Useful for retention campaigns and support compensation flows.</div>
          <div style="margin-top:8px;"><button mat-stroked-button color="accent" (click)="router.navigate(['/admin/coupons'])"><mat-icon>open_in_new</mat-icon> Open Coupons</button></div>
        </div>
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;"><mat-icon style="font-size:18px;width:18px;height:18px;color:#00e676;">insights</mat-icon> Plan & Billing Coverage</div>
          <div style="font-size:12px;color:#a0a0b0;line-height:1.5;">Active plans: <strong style="color:#fff;">{{ activePlansCount }}</strong> • Autopay-enabled: <strong style="color:#fff;">{{ autopayPlansCount }}</strong> • Single-use tiers: <strong style="color:#fff;">{{ singleUsePlansCount }}</strong></div>
          <div style="font-size:11px;color:#8e8ea0;margin-top:6px;">Subscriber-level lifecycle management (renewals/cancellations/manual grants) depends on available backend admin subscription APIs; this page currently manages plan/catalog ops and monetization configuration.</div>
        </div>
      </div>

      <!-- 4. FILTER BAR & VIEW TOGGLE -->
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Billing Cycle:</span>
          <button class="filter-pill" [class.active]="selectedBilling === 'ALL'" (click)="setBillingFilter('ALL')">All Cycles</button>
          <button class="filter-pill" [class.active]="selectedBilling === 'DAILY'" (click)="setBillingFilter('DAILY')">1 Day Pass</button>
          <button class="filter-pill" [class.active]="selectedBilling === 'ONE_TIME'" (click)="setBillingFilter('ONE_TIME')">One-Time Rental</button>
          <button class="filter-pill" [class.active]="selectedBilling === 'MONTHLY'" (click)="setBillingFilter('MONTHLY')">Monthly</button>
          <button class="filter-pill" [class.active]="selectedBilling === 'ANNUAL'" (click)="setBillingFilter('ANNUAL')">Annual</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">Autopay / Billing:</span>
          <button class="filter-pill" [class.active]="selectedAutopay === 'ALL'" (click)="selectedAutopay = 'ALL'">All</button>
          <button class="filter-pill" [class.active]="selectedAutopay === 'AUTOPAY'" (click)="selectedAutopay = 'AUTOPAY'">🔄 Autopay (Auto-Renew)</button>
          <button class="filter-pill" [class.active]="selectedAutopay === 'PREPAID'" (click)="selectedAutopay = 'PREPAID'">💳 Prepaid (Manual)</button>
        </div>

        <div class="filter-group">
          <span class="filter-label">Resolution:</span>
          <button class="filter-pill" [class.active]="selectedRes === 'ALL'" (click)="setResFilter('ALL')">All Resolutions</button>
          <button class="filter-pill" [class.active]="selectedRes === '4K_UHD'" (click)="setResFilter('4K_UHD')">4K Ultra HD</button>
          <button class="filter-pill" [class.active]="selectedRes === '1080p'" (click)="setResFilter('1080p')">1080p Full HD</button>
          <button class="filter-pill" [class.active]="selectedRes === '720p'" (click)="setResFilter('720p')">720p Mobile</button>
        </div>

        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" placeholder="Search plan tier name...">
        </div>
      </div>

      <!-- 4. PLAN CARDS GRID VIEW -->
      <div class="plans-cards-grid">
        <div *ngFor="let plan of filteredPlans" class="plan-tier-card" [class.inactive-card]="!plan.active">
          <div class="card-top-bar">
            <span class="tier-code-tag">{{ plan.code }}</span>
            <span class="autopay-badge" *ngIf="plan.autopayEnabled !== false"><mat-icon>autorenew</mat-icon> AUTOPAY</span>
            <span class="prepaid-badge" *ngIf="plan.autopayEnabled === false"><mat-icon>account_balance_wallet</mat-icon> PREPAID</span>
            <span class="single-use-badge" *ngIf="plan.singleUseOnly"><mat-icon>lock</mat-icon> 1-TIME SINGLE USE</span>
            <app-status-badge [status]="plan.active ? 'PUBLISHED' : 'DRAFT'"></app-status-badge>
          </div>

          <div class="tier-main-info">
            <h3 class="tier-title">{{ plan.name }}</h3>
            <div class="tier-price-box">
              <span class="currency-symbol">₹</span>
              <span class="price-val">{{ plan.price }}</span>
              <span class="period-text">{{ formatBillingPeriodLabel(plan.billingPeriod) }}</span>
            </div>
          </div>

          <div class="feature-checklist">
            <div class="feat-item" [class.highlight-autopay]="plan.autopayEnabled !== false">
              <mat-icon [color]="plan.autopayEnabled !== false ? 'primary' : 'warn'">{{ plan.autopayEnabled !== false ? 'autorenew' : 'payment' }}</mat-icon>
              <span>Recurring Billing: <strong [class.text-green]="plan.autopayEnabled !== false">{{ plan.autopayEnabled !== false ? 'Autopay Enabled (Auto-Debit / e-Mandate)' : 'Prepaid Pass (Manual Recharge)' }}</strong></span>
            </div>
            <div class="feat-item font-mono" *ngIf="plan.razorpayPlanId">
              <mat-icon color="accent">receipt</mat-icon>
              <span>Razorpay Plan ID: <strong class="text-cyan">{{ plan.razorpayPlanId }}</strong></span>
            </div>
            <div class="feat-item" *ngIf="plan.singleUseOnly">
              <mat-icon color="warn">block</mat-icon>
              <span>Recharge Rule: <strong class="red-text">Single Use Only (Cannot Recharge Later)</strong></span>
            </div>
            <div class="feat-item">
              <mat-icon color="accent">hd</mat-icon>
              <span>Max Quality: <strong>{{ plan.maxResolution }}</strong></span>
            </div>
            <div class="feat-item">
              <mat-icon color="accent">devices</mat-icon>
              <span>Screen Limit: <strong>{{ plan.maxDevices }} Device(s)</strong></span>
            </div>
            <div class="feat-item">
              <mat-icon color="accent">tv</mat-icon>
              <span>Concurrent Streams: <strong>{{ plan.maxConcurrentStreams }} Stream(s)</strong></span>
            </div>
            <div class="feat-item" [class.dim]="plan.adsEnabled">
              <mat-icon [color]="plan.adsEnabled ? 'warn' : 'primary'">{{ plan.adsEnabled ? 'campaign' : 'block' }}</mat-icon>
              <span>Ads Experience: <strong>{{ plan.adsEnabled ? 'Ad-Supported' : 'Ad-Free VIP' }}</strong></span>
            </div>
            <div class="feat-item" [class.dim]="!plan.downloadsEnabled">
              <mat-icon [color]="plan.downloadsEnabled ? 'primary' : 'warn'">{{ plan.downloadsEnabled ? 'download' : 'download_off' }}</mat-icon>
              <span>Offline Video Downloads: <strong>{{ plan.downloadsEnabled ? 'Enabled' : 'Disabled' }}</strong></span>
            </div>
            <div class="feat-item" *ngIf="plan.trialDays && plan.trialDays > 0">
              <mat-icon color="primary">star</mat-icon>
              <span>Free Trial: <strong>{{ plan.trialDays }}-Days Free Trial</strong></span>
            </div>
          </div>

          <div class="card-footer-actions">
            <button mat-icon-button color="accent" (click)="onToggleStatus(plan)" [matTooltip]="plan.active ? 'Disable Tier' : 'Enable Tier'">
              <mat-icon>{{ plan.active ? 'toggle_on' : 'toggle_off' }}</mat-icon>
            </button>
            <button mat-flat-button color="primary" class="btn-edit-plan" (click)="openEditModal(plan)">
              <mat-icon>edit</mat-icon> Edit Tier
            </button>
            <button mat-icon-button color="warn" (click)="onDeletePlan(plan)" matTooltip="Delete Tier">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- 5. CREATE / EDIT SUBSCRIPTION PLAN MODAL -->
      <div *ngIf="showModal" class="modal-backdrop" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-info">
              <mat-icon color="accent">card_membership</mat-icon>
              <h3>{{ editingPlanId ? 'Edit Subscription Tier' : 'Create New Subscription Plan' }}</h3>
            </div>
            <button mat-icon-button (click)="closeModal()"><mat-icon>close</mat-icon></button>
          </div>

          <form [formGroup]="planForm" (ngSubmit)="onSavePlan()" class="modal-form">
            <div class="modal-body-scroll">
              <mat-form-field appearance="outline" class="full-width custom-field">
              <mat-label>Subscription Plan Name *</mat-label>
              <input matInput formControlName="name" placeholder="e.g. 1-Day Event VIP Pass or Premium 4K Ultra" required>
            </mat-form-field>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Plan Code (Unique Identifer)</mat-label>
                  <input matInput formControlName="code" placeholder="e.g. DAY_7_PASS" style="text-transform: uppercase;">
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Billing Period Unit *</mat-label>
                  <mat-select formControlName="billingUnit" (selectionChange)="onBillingUnitChange($event.value)">
                    <mat-option value="DAY">📅 Day(s) Pass</mat-option>
                    <mat-option value="MONTH">🗓️ Month(s) Subscription</mat-option>
                    <mat-option value="YEAR">🏆 Year(s) Annual Pass</mat-option>
                    <mat-option value="ONE_TIME">🎟️ One-Time Rental / Lifetime</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row" *ngIf="planForm.value.billingUnit !== 'ONE_TIME'">
              <div class="full-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Select Duration Number / Count (e.g. 7 Days, 30 Days, 3 Months) *</mat-label>
                  <mat-select formControlName="billingCount">
                    <mat-option *ngFor="let opt of currentDurationOptions" [value]="opt.count">
                      {{ opt.label }}
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Price Amount (₹ INR) *</mat-label>
                  <input matInput type="number" formControlName="price" placeholder="e.g. 49 or 499" required>
                  <span matSuffix class="gold-text">₹</span>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Max Stream Resolution</mat-label>
                  <mat-select formControlName="maxResolution">
                    <mat-option value="720p">720p Mobile HD</mat-option>
                    <mat-option value="1080p">1080p Full HD</mat-option>
                    <mat-option value="4K_UHD">4K Ultra HD + HDR</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Max Devices Allowed</mat-label>
                  <input matInput type="number" formControlName="maxDevices" placeholder="e.g. 1 or 2">
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Concurrent Streams</mat-label>
                  <input matInput type="number" formControlName="maxConcurrentStreams" placeholder="e.g. 1 or 2">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Free Trial Days</mat-label>
                  <input matInput type="number" formControlName="trialDays" placeholder="e.g. 0 or 7">
                </mat-form-field>
              </div>

              <div class="half-width toggle-col">
                <mat-slide-toggle formControlName="adsEnabled" color="warn">
                  Contains Ads (AVOD Tier)
                </mat-slide-toggle>
                <mat-slide-toggle formControlName="downloadsEnabled" color="primary">
                  Offline Video Downloads
                </mat-slide-toggle>
              </div>
            </div>

            <!-- RECURRING AUTOPAY / E-MANDATE CONFIGURATION -->
            <div class="autopay-config-box">
              <div class="autopay-toggle-header">
                <mat-slide-toggle formControlName="autopayEnabled" color="primary">
                  <span class="toggle-title">🔄 Enable Recurring Autopay (Auto-Debit / e-Mandate)</span>
                </mat-slide-toggle>
              </div>
              <p class="toggle-hint">
                When enabled, subscriber checkout will initialize recurring subscription auto-debit (UPI Autopay, Cards, NetBanking e-Mandates) renewing automatically each billing cycle until cancelled.
              </p>
              <div class="form-row" *ngIf="planForm.value.autopayEnabled" style="margin-top: 10px;">
                <div class="full-width">
                  <mat-form-field appearance="outline" class="full-width custom-field">
                    <mat-label>Razorpay Subscription Plan ID (Optional e.g. plan_N123456789)</mat-label>
                    <input matInput formControlName="razorpayPlanId" placeholder="e.g. plan_MAXX_MONTHLY_149">
                    <mat-icon matSuffix matTooltip="Used for automated Razorpay Subscriptions / e-Mandate schedules">autorenew</mat-icon>
                  </mat-form-field>
                </div>
              </div>
            </div>

            <div class="single-use-toggle-box">
              <mat-slide-toggle formControlName="singleUseOnly" color="warn">
                Single-Use Only (User Cannot Re-Charge Later)
              </mat-slide-toggle>
              <p class="toggle-hint">Once redeemed by a user, this plan becomes permanently unavailable for future re-charges.</p>
            </div>

            <div class="toggle-row">
              <mat-slide-toggle formControlName="active" color="accent">
                Active & Live for Subscribers
              </mat-slide-toggle>
            </div>
          </div>

          <div class="modal-footer">
            <button mat-stroked-button color="basic" type="button" (click)="closeModal()">Cancel</button>
            <button mat-raised-button color="warn" class="submit-btn" type="submit" [disabled]="planForm.invalid">
              <mat-icon>check_circle</mat-icon> {{ editingPlanId ? 'Update Tier' : 'Publish Subscription Plan' }}
            </button>
          </div>
        </form>
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

      &.green .kpi-icon { color: #00e676; }
      &.blue .kpi-icon { color: #00d2ff; }
      &.gold .kpi-icon { color: #ffab00; }
      &.purple .kpi-icon { color: #ab47bc; }
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

      .search-box {
        position: relative;
        display: flex;
        align-items: center;

        .search-icon { position: absolute; left: 10px; color: #a0a0b0; font-size: 18px; width: 18px; height: 18px; }
        input {
          background: #101018;
          border: 1px solid #28283a;
          border-radius: 6px;
          color: #ffffff;
          padding: 0 12px 0 34px;
          height: 36px;
          font-size: 12px;
          width: 220px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
      }
    }

    /* PLAN TIER GRID */
    .plans-cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .plan-tier-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 16px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.25s ease;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);

      &:hover {
        transform: translateY(-4px);
        border-color: #00d2ff;
        box-shadow: 0 12px 32px rgba(0, 210, 255, 0.2);
      }

      &.inactive-card {
        opacity: 0.6;
        border-style: dashed;
      }

      .card-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        gap: 6px;
        flex-wrap: wrap;

        .tier-code-tag {
          font-family: monospace;
          font-size: 11px;
          font-weight: 800;
          color: #00d2ff;
          background: #101018;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #202030;
        }

        .autopay-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(0, 230, 118, 0.18);
          border: 1px solid #00e676;
          color: #00e676;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          mat-icon { font-size: 12px; width: 12px; height: 12px; }
        }

        .prepaid-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(255, 171, 0, 0.18);
          border: 1px solid #ffab00;
          color: #ffab00;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          mat-icon { font-size: 12px; width: 12px; height: 12px; }
        }

        .single-use-badge {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: rgba(255, 82, 82, 0.2);
          border: 1px solid #ff5252;
          color: #ff5252;
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          mat-icon { font-size: 12px; width: 12px; height: 12px; }
        }
      }

      .tier-main-info {
        margin-bottom: 16px;
        padding-bottom: 14px;
        border-bottom: 1px solid #252538;

        .tier-title { font-size: 18px; font-weight: 800; margin: 0 0 8px; color: #ffffff; }

        .tier-price-box {
          display: flex;
          align-items: baseline;
          gap: 2px;
          .currency-symbol { font-size: 18px; font-weight: 700; color: #ffab00; }
          .price-val { font-size: 32px; font-weight: 900; color: #ffffff; }
          .period-text { font-size: 12px; color: #a0a0b0; margin-left: 4px; }
        }
      }

      .feature-checklist {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;

        .feat-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #ffffff;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
          &.dim { opacity: 0.6; }
          &.highlight-autopay {
            background: rgba(0, 210, 255, 0.08);
            border: 1px solid rgba(0, 210, 255, 0.25);
            padding: 6px 10px;
            border-radius: 6px;
          }
          .red-text { color: #ff5252; }
          .text-green { color: #00e676; }
          .text-cyan { color: #00d2ff; }
          .code-text { font-family: monospace; }
        }
      }

      .card-footer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid #252538;
        padding-top: 14px;

        .btn-edit-plan { flex: 1; height: 38px; font-weight: 700; border-radius: 8px; }
      }
    }

    /* MODAL DIALOG */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.82);
      backdrop-filter: blur(8px);
      z-index: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;

      .modal-card {
        background: #161622;
        border: 1px solid #28283a;
        border-radius: 16px;
        width: 100%;
        max-width: 580px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7);
        overflow: hidden;

        .modal-header {
          background: #101018;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #28283a;
          flex-shrink: 0;

          .modal-title-info {
            display: flex;
            align-items: center;
            gap: 10px;
            h3 { margin: 0; font-size: 16px; font-weight: 700; color: #ffffff; }
          }
        }

        .modal-form {
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          min-height: 0;
          overflow: hidden;

          .modal-body-scroll {
            padding: 20px 24px;
            overflow-y: auto;
            flex: 1 1 auto;
            max-height: calc(90vh - 130px);

            &::-webkit-scrollbar {
              width: 6px;
            }
            &::-webkit-scrollbar-track {
              background: #161622;
            }
            &::-webkit-scrollbar-thumb {
              background: #28283a;
              border-radius: 3px;
            }
            &::-webkit-scrollbar-thumb:hover {
              background: #3e3e58;
            }
          }

          .full-width { width: 100%; margin-bottom: 12px; display: block; }
          .form-row { display: flex; gap: 12px; }
          .half-width { flex: 1; }
          .gold-text { font-weight: 800; color: #ffab00; margin-right: 8px; }

          .toggle-col { display: flex; flex-direction: column; gap: 8px; justify-content: center; }

          .autopay-config-box {
            background: rgba(0, 210, 255, 0.08);
            border: 1px solid rgba(0, 210, 255, 0.3);
            border-radius: 10px;
            padding: 12px 16px;
            margin: 12px 0;
            .toggle-title { font-weight: 700; color: #00d2ff; }
            .toggle-hint { margin: 6px 0 0; font-size: 11px; color: #a0a0b0; line-height: 1.4; }
          }

          .single-use-toggle-box {
            background: rgba(255, 82, 82, 0.1);
            border: 1px solid rgba(255, 82, 82, 0.3);
            border-radius: 8px;
            padding: 10px 14px;
            margin: 12px 0;
            .toggle-hint { margin: 4px 0 0; font-size: 11px; color: #a0a0b0; }
          }
          .toggle-row { margin: 12px 0 10px; }

          .modal-footer {
            flex-shrink: 0;
            background: #101018;
            border-top: 1px solid #28283a;
            padding: 14px 20px;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            button { height: 42px; padding: 0 20px; border-radius: 8px; font-weight: 700; }
            .submit-btn { background-color: #e50914 !important; color: #ffffff !important; }
          }
        }
      }
    }
  `]
})
export class SubscriptionListPage implements OnInit {
  private readonly planApiService = inject(PlanApiService);
  private readonly paymentApiService = inject(PaymentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  readonly router = inject(Router);

  get activePlansCount(): number {
    return this.plans.filter(p => !!p.active).length;
  }

  get autopayPlansCount(): number {
    return this.plans.filter(p => p.autopayEnabled !== false).length;
  }

  get singleUsePlansCount(): number {
    return this.plans.filter(p => !!p.singleUseOnly).length;
  }

  plans: Plan[] = [];
  activeSubscribers = 0;
  totalRevenue = 0;
  arpu = 0;

  selectedBilling = 'ALL';
  selectedAutopay = 'ALL';
  selectedRes = 'ALL';
  searchQuery = '';
  loading = false;
  showModal = false;
  editingPlanId: number | string | null = null;

  planForm = this.fb.group({
    name: ['', [Validators.required]],
    code: [''],
    billingUnit: ['DAY', [Validators.required]],
    billingCount: [1, [Validators.required]],
    price: [49, [Validators.required, Validators.min(0.01)]],
    maxResolution: ['1080p', [Validators.required]],
    maxDevices: [2, [Validators.required, Validators.min(1)]],
    maxConcurrentStreams: [1, [Validators.required, Validators.min(1)]],
    adsEnabled: [false],
    downloadsEnabled: [true],
    trialDays: [0],
    singleUseOnly: [false],
    autopayEnabled: [true],
    razorpayPlanId: [''],
    active: [true]
  });

  get currentDurationOptions(): { count: number; label: string }[] {
    const unit = this.planForm.get('billingUnit')?.value || 'DAY';
    switch (unit) {
      case 'DAY': return DAY_OPTIONS;
      case 'MONTH': return MONTH_OPTIONS;
      case 'YEAR': return YEAR_OPTIONS;
      case 'ONE_TIME': return ONE_TIME_OPTIONS;
      default: return DAY_OPTIONS;
    }
  }

  onBillingUnitChange(newUnit: string): void {
    if (newUnit === 'ONE_TIME') {
      this.planForm.patchValue({ billingCount: 1, autopayEnabled: false });
    } else {
      const opts = this.currentDurationOptions;
      if (opts.length > 0) {
        this.planForm.patchValue({ billingCount: opts[0].count });
      }
    }
  }

  private parseCache = new Map<string, { unit: string; count: number }>();

  parseBillingPeriod(periodStr: string | null | undefined): { unit: string; count: number } {
    if (!periodStr) return { unit: 'DAY', count: 1 };
    const clean = periodStr.trim().toUpperCase();
    if (this.parseCache.has(clean)) {
      return this.parseCache.get(clean)!;
    }

    let result = { unit: 'DAY', count: 1 };
    if (clean === 'ONE_TIME' || clean === 'LIFETIME' || clean === 'RENTAL') {
      result = { unit: 'ONE_TIME', count: 1 };
    } else if (clean === 'DAILY' || clean === 'DAY_1' || clean === '1_DAY' || clean === '1DAY') {
      result = { unit: 'DAY', count: 1 };
    } else if (clean === 'WEEKLY' || clean === 'DAY_7' || clean === '7_DAYS' || clean === '7DAYS') {
      result = { unit: 'DAY', count: 7 };
    } else if (clean === 'MONTHLY' || clean === 'MONTH_1' || clean === '1_MONTH' || clean === '1MONTH') {
      result = { unit: 'MONTH', count: 1 };
    } else if (clean === 'QUARTERLY' || clean === 'MONTH_3' || clean === '3_MONTHS' || clean === '3MONTHS') {
      result = { unit: 'MONTH', count: 3 };
    } else if (clean === 'ANNUAL' || clean === 'YEARLY' || clean === 'YEAR_1' || clean === '1_YEAR' || clean === '1YEAR') {
      result = { unit: 'YEAR', count: 1 };
    } else {
      const dayMatch = clean.match(/^DAY_?(\d+)$/) || clean.match(/^(\d+)_?DAYS?$/);
      if (dayMatch) {
        result = { unit: 'DAY', count: parseInt(dayMatch[1], 10) };
      } else {
        const monthMatch = clean.match(/^MONTH_?(\d+)$/) || clean.match(/^(\d+)_?MONTHS?$/);
        if (monthMatch) {
          result = { unit: 'MONTH', count: parseInt(monthMatch[1], 10) };
        } else {
          const yearMatch = clean.match(/^YEAR_?(\d+)$/) || clean.match(/^(\d+)_?YEARS?$/);
          if (yearMatch) {
            result = { unit: 'YEAR', count: parseInt(yearMatch[1], 10) };
          }
        }
      }
    }

    this.parseCache.set(clean, result);
    return result;
  }

  getComputedBillingPeriod(): string {
    const unit = this.planForm.value.billingUnit;
    const count = Number(this.planForm.value.billingCount || 1);

    if (unit === 'ONE_TIME') return 'ONE_TIME';
    if (unit === 'DAY') {
      if (count === 1) return 'DAILY';
      if (count === 7) return 'WEEKLY';
      return `DAY_${count}`;
    }
    if (unit === 'MONTH') {
      if (count === 1) return 'MONTHLY';
      if (count === 3) return 'QUARTERLY';
      return `MONTH_${count}`;
    }
    if (unit === 'YEAR') {
      if (count === 1) return 'ANNUAL';
      return `YEAR_${count}`;
    }
    return 'MONTHLY';
  }

  get filteredPlans(): Plan[] {
    return this.plans.filter(p => {
      const matchSearch = !this.searchQuery || p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) || p.code.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      let matchBilling = true;
      if (this.selectedBilling !== 'ALL') {
        const parsed = this.parseBillingPeriod(p.billingPeriod);
        if (this.selectedBilling === 'DAILY') matchBilling = parsed.unit === 'DAY' && parsed.count === 1;
        else if (this.selectedBilling === 'WEEKLY') matchBilling = parsed.unit === 'DAY' && parsed.count === 7;
        else if (this.selectedBilling === 'ONE_TIME') matchBilling = parsed.unit === 'ONE_TIME';
        else if (this.selectedBilling === 'MONTHLY') matchBilling = parsed.unit === 'MONTH' && parsed.count === 1;
        else if (this.selectedBilling === 'ANNUAL') matchBilling = parsed.unit === 'YEAR' || (parsed.unit === 'MONTH' && parsed.count === 12) || (parsed.unit === 'DAY' && parsed.count === 365);
      }

      let matchAutopay = true;
      if (this.selectedAutopay === 'AUTOPAY') {
        matchAutopay = p.autopayEnabled !== false;
      } else if (this.selectedAutopay === 'PREPAID') {
        matchAutopay = p.autopayEnabled === false;
      }

      const matchRes = this.selectedRes === 'ALL' || p.maxResolution === this.selectedRes;
      return matchSearch && matchBilling && matchAutopay && matchRes;
    });
  }

  ngOnInit(): void {
    this.loadPlans();
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    this.paymentApiService.getAnalytics().subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this.totalRevenue = res.data.totalRevenue || 0;
          this.activeSubscribers = res.data.activeSubscribersCount || res.data.totalTransactions || 0;
          this.arpu = res.data.arpu || (this.activeSubscribers > 0 ? Math.round(this.totalRevenue / this.activeSubscribers) : 0);
        }
      }
    });
  }

  normalizePlan(p: any): Plan {
    return {
      id: p.id,
      name: p.name || '',
      code: p.code || '',
      billingPeriod: p.billingPeriod || p.billing_period || 'MONTH_1',
      price: Number(p.price || 0),
      currency: p.currency || 'INR',
      maxResolution: p.maxResolution || p.max_resolution || '1080p',
      maxDevices: Number(p.maxDevices || p.max_devices || 2),
      maxConcurrentStreams: Number(p.maxConcurrentStreams || p.maxStreams || p.max_streams || 1),
      adsEnabled: p.adsEnabled !== undefined ? p.adsEnabled : !!p.ads_enabled,
      downloadsEnabled: p.downloadsEnabled !== undefined ? p.downloadsEnabled : true,
      trialDays: Number(p.trialDays || 0),
      singleUseOnly: !!p.singleUseOnly,
      autopayEnabled: p.autopayEnabled !== undefined ? p.autopayEnabled : (p.autopay_enabled !== undefined ? p.autopay_enabled : (p.autoRenew !== undefined ? p.autoRenew : true)),
      razorpayPlanId: p.razorpayPlanId || p.razorpay_plan_id || '',
      active: p.active !== undefined ? p.active : (p.is_active !== undefined ? p.is_active : true)
    };
  }

  loadPlans(): void {
    this.loading = true;
    this.planApiService.getPlans(0, 50, this.searchQuery).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          const rawPlans: any[] = res.data.content || (Array.isArray(res.data) ? res.data : []);
          this.plans = rawPlans.map(p => this.normalizePlan(p));
        } else {
          this.plans = [];
        }
      },
      error: () => {
        this.loading = false;
        this.plans = [];
      }
    });
  }

  setBillingFilter(period: string): void {
    this.selectedBilling = period;
  }

  setResFilter(res: string): void {
    this.selectedRes = res;
  }

  onSearchChange(): void {
    this.loadPlans();
  }

  openCreateModal(): void {
    this.editingPlanId = null;
    this.planForm.reset({
      name: '',
      code: '',
      billingUnit: 'DAY',
      billingCount: 1,
      price: 49,
      maxResolution: '1080p',
      maxDevices: 2,
      maxConcurrentStreams: 1,
      adsEnabled: false,
      downloadsEnabled: true,
      trialDays: 0,
      singleUseOnly: false,
      autopayEnabled: true,
      razorpayPlanId: '',
      active: true
    });
    this.showModal = true;
  }

  openEditModal(plan: Plan): void {
    this.editingPlanId = plan.id || null;
    const normalized = this.normalizePlan(plan);
    const parsed = this.parseBillingPeriod(normalized.billingPeriod);
    this.planForm.patchValue({
      name: normalized.name,
      code: normalized.code,
      billingUnit: parsed.unit,
      billingCount: parsed.count,
      price: normalized.price,
      maxResolution: normalized.maxResolution,
      maxDevices: normalized.maxDevices,
      maxConcurrentStreams: normalized.maxConcurrentStreams,
      adsEnabled: normalized.adsEnabled,
      downloadsEnabled: normalized.downloadsEnabled,
      trialDays: normalized.trialDays,
      singleUseOnly: normalized.singleUseOnly,
      autopayEnabled: normalized.autopayEnabled !== undefined ? normalized.autopayEnabled : true,
      razorpayPlanId: normalized.razorpayPlanId || '',
      active: normalized.active
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  onToggleStatus(plan: Plan): void {
    if (plan.id) {
      this.planApiService.toggleStatus(plan.id).subscribe({
        next: () => {
          plan.active = !plan.active;
          this.notificationService.success(`Plan "${plan.name}" status updated!`);
          this.loadPlans();
        },
        error: (err) => {
          this.notificationService.error(err?.message || 'Failed to update plan status');
        }
      });
    } else {
      plan.active = !plan.active;
      this.notificationService.success(`Plan "${plan.name}" status updated!`);
    }
  }

  async onDeletePlan(plan: Plan): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Delete Subscription Plan?',
      `Are you sure you want to soft-delete subscription plan "${plan.name}"?`,
      'Yes, Delete'
    );
    if (ok) {
      if (plan.id) {
        this.planApiService.deletePlan(plan.id).subscribe({
          next: (res: any) => {
            const payload = res?.data ?? res;
            if (payload?.deactivated) {
              this.notificationService.success(
                payload?.message || `Plan "${plan.name}" is in use and has been deactivated instead.`
              );
              this.loadPlans();
            } else {
              this.plans = this.plans.filter(p => p.id !== plan.id);
              this.notificationService.success(`Plan "${plan.name}" deleted!`);
            }
          },
          error: (err) => {
            this.notificationService.error(err?.error?.message || err?.message || 'Failed to delete plan');
          }
        });
      } else {
        this.plans = this.plans.filter(p => p.code !== plan.code);
        this.notificationService.success(`Plan "${plan.name}" deleted!`);
      }
    }
  }

  onSavePlan(): void {
    if (this.planForm.invalid) return;

    const val = this.planForm.value;
    const computedPeriod = this.getComputedBillingPeriod();
    const dto: Plan = {
      name: val.name!.trim(),
      code: val.code ? val.code.trim().toUpperCase() : val.name!.toUpperCase().replace(/[^A-Z0-9]/g, '_'),
      billingPeriod: computedPeriod,
      price: Number(val.price),
      currency: 'INR',
      maxResolution: val.maxResolution!,
      maxDevices: Number(val.maxDevices || 2),
      maxConcurrentStreams: Number(val.maxConcurrentStreams || 1),
      adsEnabled: !!val.adsEnabled,
      downloadsEnabled: !!val.downloadsEnabled,
      trialDays: Number(val.trialDays || 0),
      singleUseOnly: !!val.singleUseOnly,
      autopayEnabled: !!val.autopayEnabled,
      razorpayPlanId: val.razorpayPlanId ? val.razorpayPlanId.trim() : '',
      active: !!val.active
    };

    if (this.editingPlanId) {
      this.planApiService.updatePlan(this.editingPlanId, dto).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success(`Subscription plan "${dto.name}" updated!`);
            this.closeModal();
            this.loadPlans();
          }
        },
        error: (err) => {
          this.notificationService.error(err?.message || 'Failed to update plan');
        }
      });
    } else {
      this.planApiService.createPlan(dto).subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success(`Subscription plan "${dto.name}" published!`);
            this.closeModal();
            this.loadPlans();
          }
        },
        error: (err) => {
          this.notificationService.error(err?.message || 'Failed to publish plan');
        }
      });
    }
  }

  formatBillingPeriodLabel(period: string): string {
    const parsed = this.parseBillingPeriod(period);
    if (parsed.unit === 'ONE_TIME') return '(One-Time Rental / Lifetime)';
    if (parsed.unit === 'DAY') {
      return parsed.count === 1 ? '/ 1 Day Pass (24 Hours)' : `/ ${parsed.count} Days Pass`;
    }
    if (parsed.unit === 'MONTH') {
      return parsed.count === 1 ? '/ Month' : `/ ${parsed.count} Months`;
    }
    if (parsed.unit === 'YEAR') {
      return parsed.count === 1 ? '/ Year (Annual)' : `/ ${parsed.count} Years`;
    }
    return `/ ${period.toLowerCase()}`;
  }
}
