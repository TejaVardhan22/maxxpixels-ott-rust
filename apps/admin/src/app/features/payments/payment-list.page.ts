import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { PaymentApiService, PaymentTransaction, RevenueMetrics } from '../../core/services/payment-api.service';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-payment-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatPaginatorModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. HEADER ROW -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>account_balance_wallet</mat-icon> FINANCIAL & PAYMENT OPERATIONS</span>
          <h1>Payment Transactions & TVOD Module History</h1>
          <p>Audit Razorpay, Stripe, Apple IAP & TVOD pay-per-view rentals, track payment dates, inspect payloads, and manage refunds</p>
        </div>

        <div class="header-tabs">
          <button class="tab-btn" [class.active]="activeTab === 'ALL'" (click)="setActiveTab('ALL')">
            <mat-icon>receipt_long</mat-icon> All Transactions
          </button>
          <button class="tab-btn tvod-tab" [class.active]="activeTab === 'TVOD_ONLY'" (click)="setActiveTab('TVOD_ONLY')">
            <mat-icon>movie</mat-icon> TVOD Rentals Only
          </button>
          <button class="tab-btn direct-tab" [class.active]="activeTab === 'TVOD_DIRECT'" (click)="setActiveTab('TVOD_DIRECT')">
            <mat-icon>storefront</mat-icon> Content Purchases DB
          </button>
        </div>
      </div>

      <!-- 2. REVENUE KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <mat-icon class="kpi-icon">monetization_on</mat-icon>
          <div>
            <span class="kpi-label">Gross Revenue</span>
            <div class="kpi-val">₹{{ (metrics?.totalRevenue || 0).toLocaleString() }}.00</div>
            <span class="kpi-sub green-text">Total Platform Collections</span>
          </div>
        </div>

        <div class="kpi-card gold">
          <mat-icon class="kpi-icon">movie</mat-icon>
          <div>
            <span class="kpi-label">TVOD PPV Revenue</span>
            <div class="kpi-val">₹{{ (metrics?.tvodRevenue || 0).toLocaleString() }}.00</div>
            <span class="kpi-sub gold-text">{{ (metrics?.tvodTransactions || metrics?.totalContentPurchases || 0) }} Rentals ({{ metrics?.activeTvodRentals || 0 }} Active)</span>
          </div>
        </div>

        <div class="kpi-card cyan">
          <mat-icon class="kpi-icon">card_membership</mat-icon>
          <div>
            <span class="kpi-label">SVOD Subscription Revenue</span>
            <div class="kpi-val">₹{{ (metrics?.subscriptionRevenue || (metrics?.totalRevenue || 0)).toLocaleString() }}.00</div>
            <span class="kpi-sub cyan-text">{{ (metrics?.subscriptionTransactions || 0) }} Subscription Orders</span>
          </div>
        </div>

        <div class="kpi-card blue">
          <mat-icon class="kpi-icon">check_circle</mat-icon>
          <div>
            <span class="kpi-label">Successful Transactions</span>
            <div class="kpi-val">{{ (metrics?.totalTransactions || 0).toLocaleString() }} Orders</div>
            <span class="kpi-sub green-text">{{ metrics ? metrics.successRate : 100 }}% Success Rate</span>
          </div>
        </div>
      </div>

      <!-- 3. ADVANCED FILTER BAR WITH DATE RANGE -->
      <div class="filter-card">
        <!-- Filter Row 1: Order Type & Date Presets -->
        <div class="filter-subrow">
          <div class="filter-group">
            <span class="filter-label"><mat-icon class="mini-icon">category</mat-icon> Order Type:</span>
            <button class="filter-pill" [class.active]="selectedType === 'ALL'" (click)="setTypeFilter('ALL')">All Types</button>
            <button class="filter-pill tvod-pill" [class.active]="selectedType === 'TVOD'" (click)="setTypeFilter('TVOD')">
              <mat-icon class="btn-icon">movie</mat-icon> TVOD Rentals
            </button>
            <button class="filter-pill svod-pill" [class.active]="selectedType === 'SUBSCRIPTION'" (click)="setTypeFilter('SUBSCRIPTION')">
              <mat-icon class="btn-icon">card_membership</mat-icon> Subscriptions
            </button>
          </div>

          <!-- Date Filters -->
          <div class="filter-group date-filter-group">
            <span class="filter-label"><mat-icon class="mini-icon">event</mat-icon> Payment Date:</span>
            <button class="filter-pill date-pill" [class.active]="datePreset === 'ALL'" (click)="setDatePreset('ALL')">All Time</button>
            <button class="filter-pill date-pill" [class.active]="datePreset === 'TODAY'" (click)="setDatePreset('TODAY')">Today</button>
            <button class="filter-pill date-pill" [class.active]="datePreset === 'WEEK'" (click)="setDatePreset('WEEK')">Last 7 Days</button>
            <button class="filter-pill date-pill" [class.active]="datePreset === 'MONTH'" (click)="setDatePreset('MONTH')">Last 30 Days</button>

            <!-- Custom Date Inputs -->
            <div class="date-picker-box">
              <input type="date" [(ngModel)]="startDate" (change)="onDateInputChange()" title="Start Date" class="date-input">
              <span class="date-sep">to</span>
              <input type="date" [(ngModel)]="endDate" (change)="onDateInputChange()" title="End Date" class="date-input">
              <button *ngIf="startDate || endDate" mat-icon-button color="warn" (click)="resetDates()" matTooltip="Clear date filter" class="clear-date-btn">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          </div>
        </div>

        <div class="filter-divider"></div>

        <!-- Filter Row 2: Gateway, Status & Search -->
        <div class="filter-subrow">
          <div class="filter-group" *ngIf="activeTab !== 'TVOD_DIRECT'">
            <span class="filter-label"><mat-icon class="mini-icon">account_balance</mat-icon> Gateway:</span>
            <button class="filter-pill" [class.active]="selectedGateway === 'ALL'" (click)="setGatewayFilter('ALL')">All</button>
            <button class="filter-pill" [class.active]="selectedGateway === 'RAZORPAY'" (click)="setGatewayFilter('RAZORPAY')">Razorpay</button>
            <button class="filter-pill" [class.active]="selectedGateway === 'STRIPE'" (click)="setGatewayFilter('STRIPE')">Stripe</button>
            <button class="filter-pill" [class.active]="selectedGateway === 'CASHFREE'" (click)="setGatewayFilter('CASHFREE')">Cashfree</button>
            <button class="filter-pill" [class.active]="selectedGateway === 'APPLE_IAP'" (click)="setGatewayFilter('APPLE_IAP')">Apple IAP</button>
          </div>

          <div class="filter-group">
            <span class="filter-label"><mat-icon class="mini-icon">verified</mat-icon> Status:</span>
            <button class="filter-pill status-pill" [class.active]="selectedStatus === 'ALL'" (click)="setStatusFilter('ALL')">All</button>
            <button class="filter-pill status-pill success" [class.active]="selectedStatus === 'SUCCESS'" (click)="setStatusFilter('SUCCESS')">Success / Active</button>
            <button class="filter-pill status-pill warn" [class.active]="selectedStatus === 'FAILED'" (click)="setStatusFilter('FAILED')">Failed / Expired</button>
            <button class="filter-pill status-pill refunded" [class.active]="selectedStatus === 'REFUNDED'" (click)="setStatusFilter('REFUNDED')">Refunded</button>
          </div>

          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" [(ngModel)]="searchQuery" (input)="onSearchChange()" placeholder="Search ID, email, or content title...">
          </div>
        </div>
      </div>

      <!-- 4. GATEWAY & TVOD INSPECTOR MODAL -->
      <div *ngIf="inspectingTransaction" class="modal-backdrop">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title-info">
              <mat-icon [color]="inspectingTransaction.orderType === 'TVOD' ? 'accent' : 'primary'">receipt</mat-icon>
              <div>
                <h3>{{ inspectingTransaction.orderType === 'TVOD' ? 'TVOD Rental & Payment Audit' : 'Subscription Gateway Payload & Receipt' }}</h3>
                <span class="sub-id">Ref: {{ inspectingTransaction.transactionId }}</span>
              </div>
            </div>
            <button mat-icon-button (click)="inspectingTransaction = null"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body">
            <div class="inspector-grid">
              <div class="inspector-item">
                <span class="label">Transaction Ref:</span>
                <span class="val mono">{{ inspectingTransaction.transactionId }}</span>
              </div>
              <div class="inspector-item">
                <span class="label">Order Type:</span>
                <span class="val">
                  <span *ngIf="inspectingTransaction.orderType === 'TVOD'" class="type-pill tvod">🎬 TVOD PPV RENTAL</span>
                  <span *ngIf="inspectingTransaction.orderType !== 'TVOD'" class="type-pill svod">💳 SUBSCRIPTION</span>
                </span>
              </div>
              <div class="inspector-item">
                <span class="label">Item / Content:</span>
                <span class="val bold-white">{{ inspectingTransaction.contentTitle || inspectingTransaction.planName }}</span>
              </div>
              <div class="inspector-item">
                <span class="label">Amount Paid:</span>
                <span class="val gold-text">₹{{ inspectingTransaction.amount }} {{ inspectingTransaction.currency }}</span>
              </div>
              <div class="inspector-item">
                <span class="label">Payment Date & Time:</span>
                <span class="val">{{ inspectingTransaction.createdAt | date:'dd MMM yyyy, hh:mm:ss a' }}</span>
              </div>
              <div class="inspector-item" *ngIf="inspectingTransaction.validUntil">
                <span class="label">Rental Expiry Date:</span>
                <span class="val" [class.green-text]="inspectingTransaction.isRentalActive" [class.warn-text]="!inspectingTransaction.isRentalActive">
                  {{ inspectingTransaction.validUntil | date:'dd MMM yyyy, hh:mm:ss a' }}
                  <span class="badge-mini" [class.active]="inspectingTransaction.isRentalActive">
                    {{ inspectingTransaction.isRentalActive ? 'ACTIVE' : 'EXPIRED' }}
                  </span>
                </span>
              </div>
              <div class="inspector-item">
                <span class="label">Customer Email:</span>
                <span class="val">{{ inspectingTransaction.userEmail || '-' }}</span>
              </div>
              <div class="inspector-item">
                <span class="label">Customer Phone:</span>
                <span class="val">{{ inspectingTransaction.userPhone || '-' }}</span>
              </div>
              <div class="inspector-item">
                <span class="label">Payment Gateway:</span>
                <span class="val">{{ inspectingTransaction.gateway }}</span>
              </div>
              <div class="inspector-item">
                <span class="label">Status:</span>
                <span class="val" [class.green-text]="inspectingTransaction.status === 'SUCCESS' || inspectingTransaction.status === 'ACTIVE'" [class.warn-text]="inspectingTransaction.status === 'FAILED' || inspectingTransaction.status === 'EXPIRED' || inspectingTransaction.status === 'REFUNDED'">{{ inspectingTransaction.status }}</span>
              </div>
              <div class="inspector-item" *ngIf="inspectingTransaction.failureReason || inspectingTransaction.errorDescription || inspectingTransaction.errorCode">
                <span class="label">Failure / Error Reason:</span>
                <span class="val" style="color:#ff8a80; font-weight:700;">{{ inspectingTransaction.failureReason || inspectingTransaction.errorDescription || inspectingTransaction.errorCode }}</span>
              </div>
              <div class="inspector-item" *ngIf="inspectingTransaction.refundedAmount !== undefined && inspectingTransaction.refundedAmount !== null">
                <span class="label">Refunded Amount:</span>
                <span class="val" style="color:#ffab00; font-weight:700;">₹{{ inspectingTransaction.refundedAmount }} {{ inspectingTransaction.currency }}</span>
              </div>
              <div class="inspector-item" *ngIf="inspectingTransaction.paymentMethod || inspectingTransaction.providerPaymentId || inspectingTransaction.providerOrderId">
                <span class="label">Provider / Payment Ref:</span>
                <span class="val mono">{{ inspectingTransaction.paymentMethod || '-' }} • {{ inspectingTransaction.providerPaymentId || inspectingTransaction.providerOrderId || inspectingTransaction.orderId || '-' }}</span>
              </div>
            </div>

            <div class="json-payload-box">
              <span class="json-label"><mat-icon>code</mat-icon> Transaction / Support Debug Payload</span>
              <pre class="json-code">{{ getWebhookJsonPayload(inspectingTransaction) }}</pre>
            </div>
          </div>

          <div class="modal-footer">
            <button mat-stroked-button color="basic" (click)="inspectingTransaction = null">Close</button>
            <button mat-raised-button color="warn" (click)="triggerRefundModal(inspectingTransaction)" *ngIf="inspectingTransaction.status === 'SUCCESS'">
              <mat-icon>settings_backup_restore</mat-icon> Initiate Gateway Refund
            </button>
          </div>
        </div>
      </div>

      <!-- 5. REFUND REASON MODAL -->
      <div *ngIf="refundTarget" class="modal-backdrop">
        <div class="modal-card refund-modal">
          <div class="modal-header">
            <div class="modal-title-info">
              <mat-icon color="warn">settings_backup_restore</mat-icon>
              <h3>Process Gateway Refund</h3>
            </div>
            <button mat-icon-button (click)="refundTarget = null"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body">
            <p class="refund-warning">
              <mat-icon color="warn">warning</mat-icon>
              You are issuing a direct full refund of <strong>₹{{ refundTarget.amount }} {{ refundTarget.currency }}</strong> via gateway <strong>{{ refundTarget.gateway }}</strong>.
            </p>

            <mat-form-field appearance="outline" class="full-width custom-field">
              <mat-label>Refund Reason / Audit Note *</mat-label>
              <mat-select [(ngModel)]="refundReason">
                <mat-option value="Customer Requested - Change of Mind">Customer Requested - Change of Mind</mat-option>
                <mat-option value="Accidental Double Renewal">Accidental Double Renewal / Double Rental</mat-option>
                <mat-option value="Playback Quality Issues">Playback Quality / Buffering Complaint</mat-option>
                <mat-option value="Fraudulent Chargeback Avoidance">Fraudulent Chargeback Avoidance</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="modal-footer">
            <button mat-stroked-button color="basic" (click)="refundTarget = null">Cancel</button>
            <button mat-raised-button color="warn" class="submit-btn" (click)="confirmRefund()">
              <mat-icon>check_circle</mat-icon> Confirm & Issue Refund
            </button>
          </div>
        </div>
      </div>

      <!-- 6. SUPPORT, DUNNING & RECOVERY INSIGHTS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:16px;">
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="font-size:11px;color:#a0a0b0;font-weight:700;margin-bottom:4px;">Failed / Expired (Loaded View)</div>
          <div style="font-size:22px;font-weight:800;color:#ff8a80;">{{ supportFailedCount }}</div>
          <div style="font-size:11px;color:#a0a0b0;">Use for dunning, retry outreach, and gateway diagnostics</div>
        </div>
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="font-size:11px;color:#a0a0b0;font-weight:700;margin-bottom:4px;">Refunded Transactions (Loaded View)</div>
          <div style="font-size:22px;font-weight:800;color:#ffab00;">{{ supportRefundedCount }}</div>
          <div style="font-size:11px;color:#a0a0b0;">Track refunds, chargeback-risk indicators, and support resolutions</div>
        </div>
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="font-size:11px;color:#a0a0b0;font-weight:700;margin-bottom:4px;">Pending / Processing (Loaded View)</div>
          <div style="font-size:22px;font-weight:800;color:#00d2ff;">{{ supportPendingCount }}</div>
          <div style="font-size:11px;color:#a0a0b0;">Monitor stuck payments and follow-up with customers</div>
        </div>
        <div style="background:#161622;border:1px solid #28283a;border-radius:10px;padding:14px;">
          <div style="font-size:11px;color:#a0a0b0;font-weight:700;margin-bottom:6px;">Top Failure Reasons (Loaded View)</div>
          <div *ngIf="supportFailureReasons.length; else noFailureReasons" style="display:flex;flex-direction:column;gap:4px;">
            <div *ngFor="let f of supportFailureReasons" style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
              <span style="color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:75%;" [title]="f.reason">{{ f.reason }}</span>
              <span style="color:#ffab00;font-weight:700;">{{ f.count }}</span>
            </div>
          </div>
          <ng-template #noFailureReasons><div style="font-size:12px;color:#7f8c8d;">No failure reasons in current view.</div></ng-template>
        </div>
      </div>

      <!-- 7. DATA TABLE CARD -->
      <mat-card class="table-card">
        <div class="table-top-bar">
          <div class="table-title">
            <mat-icon>{{ activeTab === 'TVOD_DIRECT' ? 'storefront' : 'receipt_long' }}</mat-icon>
            <span>{{ activeTab === 'TVOD_DIRECT' ? 'TVOD Direct Content Purchases' : (selectedType === 'TVOD' ? 'TVOD Pay-Per-View Movie Rentals' : 'Payment Transactions History') }}</span>
            <span class="count-badge">{{ totalElements }} records</span>
          </div>
          <div class="date-range-indicator" *ngIf="startDate || endDate">
            <mat-icon class="range-icon">date_range</mat-icon>
            <span>Showing: {{ startDate || 'Beginning' }} &rarr; {{ endDate || 'Now' }}</span>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-payment-table">
            <thead>
              <tr>
                <th>Transaction Ref</th>
                <th>Type</th>
                <th>Content / Plan Title</th>
                <th>Customer</th>
                <th>Gateway</th>
                <th>Amount</th>
                <th>Payment Date & Time</th>
                <th>Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredPayments">
                <!-- 1. Ref -->
                <td>
                  <div class="code-box" (click)="copyTransactionId(item.transactionId)" matTooltip="Click to Copy Ref">
                    <span class="code-text">{{ item.transactionId }}</span>
                    <mat-icon class="copy-icon">content_copy</mat-icon>
                  </div>
                </td>

                <!-- 2. Type -->
                <td>
                  <span *ngIf="item.orderType === 'TVOD'" class="type-pill tvod">
                    <mat-icon class="pill-icon">movie</mat-icon> TVOD
                  </span>
                  <span *ngIf="item.orderType !== 'TVOD'" class="type-pill svod">
                    <mat-icon class="pill-icon">card_membership</mat-icon> SVOD
                  </span>
                </td>

                <!-- 3. Content / Plan Title -->
                <td>
                  <div class="plan-info">
                    <span class="plan-tag" [class.tvod-title]="item.orderType === 'TVOD'">
                      {{ item.contentTitle || item.planName || 'Standard Subscription' }}
                    </span>
                    <span *ngIf="item.validityHours" class="validity-sub">
                      <mat-icon class="clock-icon">schedule</mat-icon> {{ item.validityHours }}h Rental Access
                    </span>
                  </div>
                </td>

                <!-- 4. Customer -->
                <td>
                  <div class="user-info">
                    <div class="user-avatar" [class.tvod-user]="item.orderType === 'TVOD'">
                      <mat-icon>{{ item.orderType === 'TVOD' ? 'videocam' : 'person' }}</mat-icon>
                    </div>
                    <div>
                      <span class="user-email">{{ item.userEmail || item.userName || 'Subscriber' }}</span>
                      <span class="user-phone">{{ item.userPhone || '-' }}</span>
                    </div>
                  </div>
                </td>

                <!-- 5. Gateway -->
                <td>
                  <span class="gateway-badge" [ngClass]="item.gateway.toLowerCase()">
                    <mat-icon class="gw-icon">payment</mat-icon> {{ item.gateway }}
                  </span>
                </td>

                <!-- 6. Amount -->
                <td><span class="amount-val">₹{{ item.amount }} {{ item.currency }}</span></td>

                <!-- 7. Payment Date & Rental Expiry -->
                <td>
                  <div class="date-cell">
                    <div class="date-main">
                      <mat-icon class="date-icon">event</mat-icon>
                      <span>{{ item.createdAt | date:'dd MMM yyyy, hh:mm a' }}</span>
                    </div>
                    <div *ngIf="item.orderType === 'TVOD' && item.validUntil" class="rental-expiry" [class.active-expiry]="item.isRentalActive">
                      <mat-icon class="timer-icon">timer</mat-icon>
                      <span>Expires: {{ item.validUntil | date:'dd MMM, hh:mm a' }}</span>
                    </div>
                  </div>
                </td>

                <!-- 8. Status -->
                <td>
                  <app-status-badge [status]="item.status"></app-status-badge>
                  <div *ngIf="item.failureReason || item.errorDescription || item.errorCode" style="margin-top:4px;font-size:10px;color:#ff8a80;line-height:1.3;max-width:220px;">
                    {{ item.failureReason || item.errorDescription || item.errorCode }}
                  </div>
                  <div *ngIf="item.refundedAmount" style="margin-top:4px;font-size:10px;color:#ffab00;font-weight:700;">
                    Refunded: ₹{{ item.refundedAmount }}
                  </div>
                </td>

                <!-- 9. Actions -->
                <td class="text-right">
                  <div class="action-btn-group">
                    <button mat-icon-button color="accent" (click)="inspectTransaction(item)" matTooltip="Inspect Payload & TVOD Details">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="triggerRefundModal(item)" *ngIf="item.status === 'SUCCESS'" matTooltip="Initiate Refund">
                      <mat-icon>settings_backup_restore</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>

              <tr *ngIf="filteredPayments.length === 0 && !loading">
                <td colspan="9" class="empty-state">
                  <mat-icon class="empty-icon">search_off</mat-icon>
                  <p>No transactions found matching your criteria</p>
                  <span class="empty-sub">Try adjusting your date range or filters</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <mat-paginator
          [length]="totalElements"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
          class="custom-paginator">
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 4px; }

    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
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
    }

    .header-tabs {
      display: flex;
      gap: 8px;
      background: #161622;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid #28283a;

      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        color: #a0a0b0;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;

        mat-icon { font-size: 16px; width: 16px; height: 16px; }

        &:hover { color: #ffffff; background: rgba(255, 255, 255, 0.05); }

        &.active {
          background: #00d2ff;
          color: #000000;
          font-weight: 700;
        }

        &.tvod-tab.active {
          background: #ffab00;
          color: #000000;
        }

        &.direct-tab.active {
          background: #e040fb;
          color: #000000;
        }
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
      .kpi-sub { font-size: 11px; font-weight: 600; display: block; margin-top: 2px; }
      .green-text { color: #00e676; }
      .gold-text { color: #ffab00; }
      .cyan-text { color: #00d2ff; }
      .purple-text { color: #ab47bc; }
      .text-muted { color: #a0a0b0; }

      &.green .kpi-icon { color: #00e676; }
      &.gold .kpi-icon { color: #ffab00; }
      &.cyan .kpi-icon { color: #00d2ff; }
      &.blue .kpi-icon { color: #2979ff; }
    }

    /* FILTER CARD */
    .filter-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .filter-subrow {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }

      .filter-divider {
        height: 1px;
        background: #232332;
        width: 100%;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;

        .filter-label {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 700;
          color: #a0a0b0;
          margin-right: 4px;
          .mini-icon { font-size: 14px; width: 14px; height: 14px; color: #00d2ff; }
        }

        .filter-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: #101018;
          border: 1px solid #28283a;
          color: #ffffff;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          .btn-icon { font-size: 13px; width: 13px; height: 13px; }

          &:hover, &.active { background: #00d2ff; border-color: #00d2ff; color: #000000; }

          &.tvod-pill.active { background: #ffab00; border-color: #ffab00; color: #000000; }
          &.svod-pill.active { background: #00d2ff; border-color: #00d2ff; color: #000000; }
          &.date-pill.active { background: #7c4dff; border-color: #7c4dff; color: #ffffff; }
        }

        .status-pill {
          &.success.active { background: #00e676; color: #000; border-color: #00e676; }
          &.warn.active { background: #ff5252; color: #fff; border-color: #ff5252; }
          &.refunded.active { background: #ffab00; color: #000; border-color: #ffab00; }
        }
      }

      .date-picker-box {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #101018;
        border: 1px solid #28283a;
        padding: 2px 8px;
        border-radius: 6px;

        .date-input {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 11px;
          padding: 4px;
          &:focus { outline: none; }
        }

        .date-sep { font-size: 11px; color: #a0a0b0; }
        .clear-date-btn { width: 22px; height: 22px; line-height: 22px; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
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
          height: 34px;
          font-size: 12px;
          width: 250px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
      }
    }

    /* TYPE PILLS */
    .type-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 4px;
      letter-spacing: 0.4px;
      .pill-icon { font-size: 12px; width: 12px; height: 12px; }

      &.tvod {
        background: rgba(255, 171, 0, 0.15);
        color: #ffab00;
        border: 1px solid rgba(255, 171, 0, 0.4);
      }
      &.svod {
        background: rgba(0, 210, 255, 0.15);
        color: #00d2ff;
        border: 1px solid rgba(0, 210, 255, 0.4);
      }
    }

    /* TABLE */
    .table-card {
      background: #161622;
      border: 1px solid #28283a;
      border-radius: 12px;
      overflow: hidden;
      padding: 0;

      .table-top-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 20px;
        border-bottom: 1px solid #28283a;

        .table-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
          mat-icon { color: #00d2ff; font-size: 18px; width: 18px; height: 18px; }
          .count-badge { font-size: 11px; background: #202030; color: #a0a0b0; padding: 2px 8px; border-radius: 10px; }
        }

        .date-range-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #7c4dff;
          background: rgba(124, 77, 255, 0.12);
          padding: 4px 10px;
          border-radius: 6px;
          border: 1px solid rgba(124, 77, 255, 0.3);
          .range-icon { font-size: 14px; width: 14px; height: 14px; }
        }
      }
    }

    .table-responsive { overflow-x: auto; }

    .custom-payment-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;

      th {
        background: #121218;
        color: #a0a0b0;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 12px 16px;
        border-bottom: 1px solid #28283a;
      }

      td {
        padding: 12px 16px;
        border-bottom: 1px solid #20202e;
        font-size: 13px;
        vertical-align: middle;
      }

      tr:hover td { background: #1a1a28; }

      .code-box {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #101018;
        border: 1px solid #28283a;
        padding: 3px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-family: monospace;
        font-size: 11px;
        color: #00d2ff;
        &:hover { border-color: #00d2ff; }
        .copy-icon { font-size: 12px; width: 12px; height: 12px; color: #a0a0b0; }
      }

      .plan-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        .plan-tag {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          &.tvod-title { color: #ffab00; }
        }
        .validity-sub {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 10px;
          color: #a0a0b0;
          .clock-icon { font-size: 11px; width: 11px; height: 11px; }
        }
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: 10px;

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #202030;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00d2ff;
          mat-icon { font-size: 16px; width: 16px; height: 16px; }

          &.tvod-user { background: rgba(255, 171, 0, 0.15); color: #ffab00; }
        }

        .user-email { display: block; font-size: 12px; font-weight: 600; color: #ffffff; }
        .user-phone { display: block; font-size: 11px; color: #a0a0b0; }
      }

      .gateway-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        .gw-icon { font-size: 13px; width: 13px; height: 13px; }

        &.razorpay { background: rgba(2, 136, 209, 0.2); color: #0288d1; border: 1px solid #0288d1; }
        &.stripe { background: rgba(103, 114, 229, 0.2); color: #6772e5; border: 1px solid #6772e5; }
        &.cashfree { background: rgba(0, 230, 118, 0.2); color: #00e676; border: 1px solid #00e676; }
        &.apple_iap { background: rgba(255, 255, 255, 0.2); color: #ffffff; border: 1px solid #ffffff; }
        &.tvod_store { background: rgba(224, 64, 251, 0.2); color: #e040fb; border: 1px solid #e040fb; }
      }

      .amount-val { font-size: 13px; font-weight: 800; color: #00e676; }

      .date-cell {
        display: flex;
        flex-direction: column;
        gap: 3px;

        .date-main {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #ffffff;
          .date-icon { font-size: 13px; width: 13px; height: 13px; color: #00d2ff; }
        }

        .rental-expiry {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #a0a0b0;
          .timer-icon { font-size: 11px; width: 11px; height: 11px; }

          &.active-expiry { color: #00e676; }
        }
      }

      .empty-state {
        text-align: center;
        padding: 40px;
        color: #a0a0b0;
        .empty-icon { font-size: 40px; width: 40px; height: 40px; color: #404050; margin-bottom: 6px; }
        p { font-size: 14px; font-weight: 600; margin: 0; color: #ffffff; }
        .empty-sub { font-size: 12px; }
      }

      .action-btn-group {
        display: flex;
        justify-content: flex-end;
        gap: 4px;
      }
    }

    /* MODAL */
    .modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(8px);
      z-index: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;

      .modal-card {
        background: #1a1a28;
        border: 1px solid #303045;
        border-radius: 12px;
        width: 100%;
        max-width: 680px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #28283a;

          .modal-title-info {
            display: flex;
            align-items: center;
            gap: 12px;
            h3 { margin: 0; font-size: 16px; font-weight: 700; color: #ffffff; }
            .sub-id { font-size: 11px; color: #a0a0b0; font-family: monospace; }
          }
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;

          .inspector-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 18px;

            .inspector-item {
              background: #121218;
              padding: 10px 14px;
              border-radius: 8px;
              border: 1px solid #232332;
              .label { font-size: 11px; color: #a0a0b0; display: block; margin-bottom: 2px; }
              .val { font-size: 13px; color: #ffffff; font-weight: 600; }
              .mono { font-family: monospace; font-size: 12px; color: #00d2ff; }
              .bold-white { color: #ffffff; font-weight: 700; }
              .gold-text { color: #ffab00; font-weight: 700; }
              .green-text { color: #00e676; }
              .warn-text { color: #ff5252; }
              .badge-mini {
                display: inline-block;
                padding: 1px 5px;
                border-radius: 3px;
                font-size: 9px;
                margin-left: 4px;
                background: rgba(255, 82, 82, 0.2);
                color: #ff5252;
                &.active { background: rgba(0, 230, 118, 0.2); color: #00e676; }
              }
            }
          }

          .json-payload-box {
            background: #0c0c12;
            border: 1px solid #28283a;
            border-radius: 8px;
            padding: 12px;

            .json-label {
              display: flex;
              align-items: center;
              gap: 6px;
              font-size: 11px;
              font-weight: 700;
              color: #a0a0b0;
              margin-bottom: 8px;
              mat-icon { font-size: 14px; width: 14px; height: 14px; color: #00d2ff; }
            }

            .json-code {
              font-family: monospace;
              font-size: 11px;
              color: #00d2ff;
              margin: 0;
              white-space: pre-wrap;
              word-break: break-all;
              max-height: 200px;
              overflow-y: auto;
            }
          }
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #28283a;
        }
      }
    }

    ::ng-deep .custom-paginator {
      background: transparent !important;
      color: #a0a0b0 !important;
      .mat-mdc-paginator-range-label, .mat-mdc-select-value { color: #a0a0b0 !important; }
    }
  `]
})
export class PaymentListPage implements OnInit {
  private readonly paymentApiService = inject(PaymentApiService);
  private readonly notificationService = inject(NotificationService);

  payments: PaymentTransaction[] = [];
  metrics: RevenueMetrics | null = null;

  activeTab: 'ALL' | 'TVOD_ONLY' | 'TVOD_DIRECT' = 'ALL';
  selectedType = 'ALL';
  selectedGateway = 'ALL';
  selectedStatus = 'ALL';
  datePreset = 'ALL';
  startDate = '';
  endDate = '';
  searchQuery = '';

  totalElements = 0;
  pageSize = 20;
  currentPage = 0;
  loading = false;

  inspectingTransaction: PaymentTransaction | null = null;
  refundTarget: PaymentTransaction | null = null;
  refundReason = 'Customer Requested - Change of Mind';

  get filteredPayments(): PaymentTransaction[] {
    return this.payments.filter(p => {
      const q = (this.searchQuery || '').toLowerCase();
      const matchSearch = !q ||
        (p.transactionId || '').toLowerCase().includes(q) ||
        (p.userEmail || '').toLowerCase().includes(q) ||
        (p.userPhone || '').toLowerCase().includes(q) ||
        (p.userName || '').toLowerCase().includes(q) ||
        (p.contentTitle || '').toLowerCase().includes(q) ||
        (p.planName || '').toLowerCase().includes(q) ||
        String(p.userId || '').includes(q) ||
        (p.failureReason || '').toLowerCase().includes(q);

      const matchGw = this.selectedGateway === 'ALL' || p.gateway === this.selectedGateway;
      const matchStatus = this.selectedStatus === 'ALL' ||
        p.status === this.selectedStatus ||
        (this.selectedStatus === 'SUCCESS' && (p.status === 'PAID' || p.status === 'ACTIVE')) ||
        (this.selectedStatus === 'FAILED' && p.status === 'EXPIRED');

      const matchType = this.selectedType === 'ALL' ||
        (this.selectedType === 'TVOD' && p.orderType === 'TVOD') ||
        (this.selectedType === 'SUBSCRIPTION' && p.orderType !== 'TVOD');

      return matchSearch && matchGw && matchStatus && matchType;
    });
  }

  get supportFailedCount(): number {
    return this.filteredPayments.filter(p => p.status === 'FAILED' || p.status === 'EXPIRED').length;
  }

  get supportRefundedCount(): number {
    return this.filteredPayments.filter(p => p.status === 'REFUNDED' || (p.refundedAmount || 0) > 0).length;
  }

  get supportPendingCount(): number {
    return this.filteredPayments.filter(p => p.status === 'PENDING' || p.status === 'CREATED' || p.status === 'INITIATED' || p.status === 'PROCESSING').length;
  }

  get supportFailureReasons(): { reason: string; count: number }[] {
    const map = new Map<string, number>();
    for (const p of this.filteredPayments) {
      if (!(p.status === 'FAILED' || p.status === 'EXPIRED')) continue;
      const reason = (p.failureReason || p.errorDescription || p.errorCode || 'Unknown failure reason').trim() || 'Unknown failure reason';
      map.set(reason, (map.get(reason) || 0) + 1);
    }
    return Array.from(map.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }

  ngOnInit(): void {
    this.loadAnalytics();
    this.loadPayments();
  }

  loadAnalytics(): void {
    this.paymentApiService.getAnalytics().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.metrics = res.data;
        }
      }
    });
  }

  loadPayments(): void {
    this.loading = true;

    if (this.activeTab === 'TVOD_DIRECT') {
      this.paymentApiService.getTvodPurchases(this.currentPage, this.pageSize, this.searchQuery, this.startDate, this.endDate).subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success && res.data) {
            const raw: any[] = res.data.content || (res.data as any).items || (Array.isArray(res.data) ? res.data : []);
            this.payments = raw.map((p: any) => this.normalizeTransaction(p, 'TVOD'));
            this.totalElements = res.data.totalElements || (res.data as any).total || this.payments.length;
          }
        },
        error: () => { this.loading = false; }
      });
      return;
    }

    const effectiveType = this.activeTab === 'TVOD_ONLY' ? 'TVOD' : this.selectedType;
    const gwParam = this.selectedGateway === 'ALL' ? '' : this.selectedGateway;

    this.paymentApiService.getPayments(
      this.currentPage,
      this.pageSize,
      this.searchQuery,
      gwParam,
      effectiveType,
      this.startDate,
      this.endDate
    ).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          const raw: any[] = res.data.content || (res.data as any).items || (Array.isArray(res.data) ? res.data : []);
          this.payments = raw.map((p: any) => this.normalizeTransaction(p));
          this.totalElements = res.data.totalElements || (res.data as any).total || this.payments.length;
        }
      },
      error: () => { this.loading = false; }
    });
  }

  private normalizeTransaction(p: any, forcedType?: string): PaymentTransaction {
    const isTvod = forcedType === 'TVOD' ||
      p.orderType === 'TVOD' ||
      p.order_type === 'TVOD' ||
      p.order_type === 'RENTAL' ||
      p.itemType === 'TVOD_RENTAL' ||
      (p.contentId && p.contentId > 0) ||
      (p.planName && String(p.planName).toLowerCase().startsWith('tvod'));

    const created = p.createdAt || p.created_at || p.purchasedAt || p.purchased_at || new Date().toISOString();
    const validUntil = p.validUntil || p.valid_until;
    let isActiveRental = p.isRentalActive;
    if (isActiveRental === undefined && validUntil) {
      isActiveRental = new Date(validUntil).getTime() > Date.now();
    }

    const statusRaw = (p.status || (isActiveRental ? 'ACTIVE' : 'SUCCESS')).toString().toUpperCase();
    const failureReason = p.failureReason || p.failure_reason || p.errorDescription || p.error_description || p.errorCode || p.error_code || '';

    return {
      id: Number(p.id),
      transactionId: p.providerPaymentId || p.provider_payment_id || p.transactionId || p.transaction_id || p.orderId || p.order_id || `TXN-${p.id}`,
      orderId: p.orderId || p.order_id || p.payment_order_id || '',
      gateway: (p.gateway || p.provider || p.paymentMethod || p.payment_method || (forcedType === 'TVOD' ? 'TVOD_STORE' : 'RAZORPAY')).toString().toUpperCase(),
      amount: p.amount !== undefined ? Number(p.amount) : (p.price !== undefined ? Number(p.price) : 0),
      currency: p.currency || 'INR',
      status: statusRaw,
      orderType: isTvod ? 'TVOD' : 'SUBSCRIPTION',
      contentTitle: p.contentTitle || p.content_title || (isTvod ? p.planName : undefined),
      contentId: p.contentId || p.content_id,
      validUntil: validUntil,
      validityHours: p.validityHours || p.validity_hours || (isTvod ? 48 : undefined),
      isRentalActive: isActiveRental,
      purchaseType: p.purchaseType || p.purchase_type || (isTvod ? 'RENT' : undefined),
      userEmail: p.userEmail || p.user_email || p.email || p.customerEmail || '',
      userPhone: p.userPhone || p.user_phone || p.phone || p.phoneNumber || p.phone_number || p.customerPhone || '',
      userName: p.userName || p.user_name || p.name || p.customerName || '',
      userId: p.userId || p.user_id,
      planName: p.planTitle || p.planName || p.plan_name || (isTvod ? 'Movie Rental' : 'VIP Subscription'),
      createdAt: created,
      purchasedAt: created,
      failureReason: failureReason || undefined,
      errorDescription: p.errorDescription || p.error_description || undefined,
      errorCode: p.errorCode || p.error_code || undefined,
      refundedAmount: p.refundedAmount !== undefined ? Number(p.refundedAmount) : (p.refunded_amount !== undefined ? Number(p.refunded_amount) : undefined),
      providerPaymentId: p.providerPaymentId || p.provider_payment_id || undefined,
      providerOrderId: p.providerOrderId || p.provider_order_id || undefined,
      paymentMethod: p.paymentMethod || p.payment_method || undefined,
    };
  }

  setActiveTab(tab: 'ALL' | 'TVOD_ONLY' | 'TVOD_DIRECT'): void {
    this.activeTab = tab;
    if (tab === 'TVOD_ONLY') {
      this.selectedType = 'TVOD';
    } else if (tab === 'ALL') {
      this.selectedType = 'ALL';
    }
    this.currentPage = 0;
    this.loadPayments();
  }

  setTypeFilter(type: string): void {
    this.selectedType = type;
    this.currentPage = 0;
    this.loadPayments();
  }

  setGatewayFilter(gw: string): void {
    this.selectedGateway = gw;
    this.currentPage = 0;
    this.loadPayments();
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status;
  }

  setDatePreset(preset: string): void {
    this.datePreset = preset;
    const now = new Date();

    if (preset === 'TODAY') {
      const todayStr = now.toISOString().split('T')[0];
      this.startDate = todayStr;
      this.endDate = todayStr;
    } else if (preset === 'WEEK') {
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      this.startDate = past.toISOString().split('T')[0];
      this.endDate = now.toISOString().split('T')[0];
    } else if (preset === 'MONTH') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      this.startDate = past.toISOString().split('T')[0];
      this.endDate = now.toISOString().split('T')[0];
    } else {
      this.startDate = '';
      this.endDate = '';
    }

    this.currentPage = 0;
    this.loadPayments();
  }

  onDateInputChange(): void {
    this.datePreset = 'CUSTOM';
    this.currentPage = 0;
    this.loadPayments();
  }

  resetDates(): void {
    this.datePreset = 'ALL';
    this.startDate = '';
    this.endDate = '';
    this.currentPage = 0;
    this.loadPayments();
  }

  onSearchChange(): void {
    this.currentPage = 0;
    this.loadPayments();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadPayments();
  }

  copyTransactionId(ref: string): void {
    navigator.clipboard.writeText(ref);
    this.notificationService.success(`Copied transaction ref "${ref}" to clipboard!`);
  }

  inspectTransaction(item: PaymentTransaction): void {
    this.inspectingTransaction = item;
  }

  triggerRefundModal(item: PaymentTransaction): void {
    this.inspectingTransaction = null;
    this.refundTarget = item;
    this.refundReason = 'Customer Requested - Change of Mind';
  }

  confirmRefund(): void {
    if (!this.refundTarget) return;

    const target = this.refundTarget;
    this.paymentApiService.processRefund(target.id, this.refundReason).subscribe({
      next: (res) => {
        if (res.success) {
          target.status = 'REFUNDED';
          this.notificationService.success(`Refund of ₹${target.amount} issued cleanly via ${target.gateway}!`);
          this.refundTarget = null;
          this.loadAnalytics();
        }
      }
    });
  }

  getWebhookJsonPayload(item: PaymentTransaction): string {
    return JSON.stringify({
      transactionId: item.transactionId,
      orderId: item.orderId,
      orderType: item.orderType,
      status: item.status,
      gateway: item.gateway,
      amount: item.amount,
      currency: item.currency,
      userId: item.userId ?? null,
      userName: item.userName || null,
      userEmail: item.userEmail || null,
      userPhone: item.userPhone || null,
      planName: item.planName || null,
      contentTitle: item.contentTitle || null,
      contentId: item.contentId ?? null,
      failureReason: item.failureReason || item.errorDescription || item.errorCode || null,
      refundedAmount: item.refundedAmount ?? null,
      providerPaymentId: item.providerPaymentId || null,
      providerOrderId: item.providerOrderId || null,
      paymentMethod: item.paymentMethod || null,
      validUntil: item.validUntil || null,
      validityHours: item.validityHours ?? null,
      isRentalActive: item.isRentalActive ?? null,
      createdAt: item.createdAt || null,
      purchasedAt: item.purchasedAt || null
    }, null, 2);
  }
}
