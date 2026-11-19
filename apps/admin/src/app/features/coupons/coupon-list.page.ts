import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { CouponApiService, Coupon } from '../../core/services/coupon-api.service';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-coupon-list-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatProgressBarModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>card_giftcard</mat-icon> PROMOTIONS &amp; VOUCHERS</span>
          <h1>Coupons &amp; Gift Vouchers</h1>
          <p>Create discount codes, 100% free gift vouchers, per-user limits, expiry schedules, and plan-specific offers</p>
        </div>
        <button mat-raised-button class="add-btn" (click)="openCreateForm()">
          <mat-icon>add</mat-icon> New Coupon
        </button>
      </div>

      <!-- 2. KPI STRIP -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-icon green"><mat-icon>local_offer</mat-icon></div>
          <div>
            <span class="kpi-label">Active Coupons</span>
            <div class="kpi-val">{{ activeCouponCount }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon blue"><mat-icon>shopping_bag</mat-icon></div>
          <div>
            <span class="kpi-label">Total Redemptions</span>
            <div class="kpi-val">{{ totalRedemptionsCount }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon gold"><mat-icon>card_giftcard</mat-icon></div>
          <div>
            <span class="kpi-label">Total Vouchers</span>
            <div class="kpi-val">{{ coupons.length }}</div>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon crimson"><mat-icon>trending_up</mat-icon></div>
          <div>
            <span class="kpi-label">Max Active Offer</span>
            <div class="kpi-val">{{ maxActiveDiscountText }}</div>
          </div>
        </div>
      </div>

      <!-- 3. QUICK PRESET BAR -->
      <div class="preset-bar">
        <span class="preset-label"><mat-icon>bolt</mat-icon> Quick Create:</span>
        <button type="button" class="preset-chip" (click)="openPreset('FREE100', 'PERCENTAGE', 100, 0, 100, 1)">+ 100% Free Gift Voucher</button>
        <button type="button" class="preset-chip" (click)="openPreset('FESTIVE50', 'PERCENTAGE', 50, 99, 500, 1)">+ 50% Festive Offer</button>
        <button type="button" class="preset-chip" (click)="openPreset('SAVE50', 'FIXED', 50, 149, 1000, 1)">+ Flat ₹50 Off</button>
      </div>

      <!-- 4. INLINE CREATE / EDIT COUPON CARD (No blocking popup modal) -->
      <div class="inline-editor-card" *ngIf="showForm">
        <div class="inline-editor-header">
          <div>
            <h3>{{ editingCouponId ? 'Edit Coupon Code' : 'Create Promotional Coupon / Voucher' }}</h3>
            <p>100% off coupons automatically activate the selected plan with ₹0 checkout (Netflix/Hotstar/Aha gift flow)</p>
          </div>
          <button mat-icon-button type="button" (click)="closeForm()"><mat-icon>close</mat-icon></button>
        </div>

        <form [formGroup]="couponForm" (ngSubmit)="onSaveCoupon()">
          <div class="inline-grid">
            <mat-form-field appearance="outline">
              <mat-label>Coupon Code *</mat-label>
              <input matInput formControlName="code" placeholder="e.g. AHA100FREE" style="text-transform: uppercase;" required>
              <button type="button" mat-icon-button matSuffix (click)="generateRandomCode()" matTooltip="Generate Random Code">
                <mat-icon>auto_awesome</mat-icon>
              </button>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Discount Type *</mat-label>
              <mat-select formControlName="discountType">
                <mat-option value="PERCENTAGE">Percentage (%)</mat-option>
                <mat-option value="FIXED">Flat Amount (₹)</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Discount Value *</mat-label>
              <input matInput type="number" formControlName="discountValue" min="1" required>
              <span matSuffix class="suffix-txt">{{ couponForm.value.discountType === 'PERCENTAGE' ? '%' : '₹' }}</span>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Max Discount Cap (₹, Optional)</mat-label>
              <input matInput type="number" formControlName="maxDiscountAmount" min="0" placeholder="No cap">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Min Order Amount (₹)</mat-label>
              <input matInput type="number" formControlName="minimumAmount" min="0" placeholder="0">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Total Usage Limit</mat-label>
              <input matInput type="number" formControlName="usageLimit" min="1" placeholder="e.g. 500">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Max Uses Per User *</mat-label>
              <input matInput type="number" formControlName="usagePerUser" min="1" placeholder="1" required>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Expiry Date &amp; Time (Optional)</mat-label>
              <input matInput type="datetime-local" formControlName="validUntil">
            </mat-form-field>

            <mat-form-field appearance="outline" class="span-2">
              <mat-label>Restrict to Plan (Optional)</mat-label>
              <mat-select formControlName="applicablePlanId">
                <mat-option [value]="null">All Subscription Plans &amp; Rentals</mat-option>
                <mat-option *ngFor="let p of plans" [value]="p.id">{{ p.name }} (₹{{ p.price }})</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="span-2">
              <mat-label>Campaign Description (Optional)</mat-label>
              <input matInput formControlName="description" placeholder="e.g. Diwali 50% off on Annual Plan">
            </mat-form-field>
          </div>

          <div class="inline-footer">
            <mat-slide-toggle formControlName="active" color="warn">Active &amp; Redeemable</mat-slide-toggle>
            <div class="inline-actions">
              <button type="button" mat-stroked-button (click)="closeForm()">Cancel</button>
              <button type="submit" mat-raised-button class="add-btn" [disabled]="couponForm.invalid || saving">
                <mat-icon>check_circle</mat-icon> {{ saving ? 'Saving...' : (editingCouponId ? 'Update Coupon' : 'Publish Coupon') }}
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- 5. FILTER & SEARCH BAR -->
      <div class="filter-bar">
        <div class="filter-group">
          <button type="button" class="filter-pill" [class.active]="selectedFilter === 'ALL'" (click)="setFilter('ALL')">All</button>
          <button type="button" class="filter-pill" [class.active]="selectedFilter === 'ACTIVE'" (click)="setFilter('ACTIVE')">Active</button>
          <button type="button" class="filter-pill" [class.active]="selectedFilter === 'PERCENTAGE'" (click)="setFilter('PERCENTAGE')">Percentage</button>
          <button type="button" class="filter-pill" [class.active]="selectedFilter === 'FIXED'" (click)="setFilter('FIXED')">Fixed ₹</button>
        </div>
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="applyFilters()" placeholder="Search coupon code or campaign...">
        </div>
      </div>

      <!-- 6. COUPONS TABLE -->
      <div class="table-card">
        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>Code &amp; Plan</th>
                <th>Offer</th>
                <th>Limits</th>
                <th>Validity</th>
                <th>Redemptions</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredCoupons">
                <td>
                  <div class="code-box" (click)="copyCode(item.code)" matTooltip="Click to copy code">
                    <span class="code-text">{{ item.code }}</span>
                    <mat-icon>content_copy</mat-icon>
                  </div>
                  <div class="plan-hint" *ngIf="item.applicablePlanId">
                    Plan: {{ getPlanName(item.applicablePlanId) }}
                  </div>
                </td>
                <td>
                  <span class="discount-badge" [class.fixed]="item.discountType === 'FIXED'">
                    {{ item.discountType === 'PERCENTAGE' ? (item.discountValue + '% OFF') : ('₹' + item.discountValue + ' OFF') }}
                  </span>
                  <div class="sub-hint" *ngIf="getMinAmount(item) > 0">Min ₹{{ getMinAmount(item) }}</div>
                </td>
                <td>
                  <div class="sub-hint">{{ item.usagePerUser || 1 }} / user</div>
                  <div class="sub-hint" *ngIf="item.maxDiscountAmount || item.maximumDiscount">
                    Cap ₹{{ item.maxDiscountAmount || item.maximumDiscount }}
                  </div>
                </td>
                <td>
                  <span class="sub-hint" *ngIf="item.validUntil">{{ item.validUntil | date:'MMM d, y, h:mm a' }}</span>
                  <span class="sub-hint" *ngIf="!item.validUntil">No Expiry</span>
                </td>
                <td>
                  <div class="usage-col">
                    <span class="usage-text">
                      {{ item.usedCount || 0 }} / {{ item.usageLimit || '∞' }}
                      <span class="rem-tag" *ngIf="item.usageLimit" [class.exhausted]="getRemaining(item) === 0">
                        {{ getRemaining(item) === 0 ? 'EXHAUSTED' : (getRemaining(item) + ' left') }}
                      </span>
                    </span>
                    <mat-progress-bar *ngIf="item.usageLimit" mode="determinate" [value]="getUsagePercent(item)"></mat-progress-bar>
                  </div>
                </td>
                <td>
                  <app-status-badge [status]="isCouponActive(item) ? 'ACTIVE' : 'INACTIVE'"></app-status-badge>
                </td>
                <td style="text-align: right;">
                  <div class="action-buttons">
                    <button mat-icon-button (click)="onToggleStatus(item)" [matTooltip]="isCouponActive(item) ? 'Disable' : 'Enable'">
                      <mat-icon [style.color]="isCouponActive(item) ? '#10b981' : '#64748b'">
                        {{ isCouponActive(item) ? 'toggle_on' : 'toggle_off' }}
                      </mat-icon>
                    </button>
                    <button mat-icon-button (click)="openEditForm(item)" matTooltip="Edit Coupon">
                      <mat-icon style="color:#94a3b8;">edit</mat-icon>
                    </button>
                    <button mat-icon-button (click)="onDeleteCoupon(item)" matTooltip="Deactivate Coupon">
                      <mat-icon style="color:#ef4444;">delete_outline</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredCoupons.length === 0">
                <td colspan="7" class="empty-state">No coupons found. Click a Quick Create button above to add one.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { color: #f1f5f9; padding: 4px; max-width: 1360px; margin: 0 auto; }
    .header-row {
      display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
      .category-tag {
        display: inline-flex; align-items: center; gap: 6px; background: rgba(229, 9, 20, 0.14);
        color: #f43f5e; font-size: 11px; font-weight: 800; padding: 5px 10px; border-radius: 6px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 26px; font-weight: 800; margin: 8px 0 4px; color: #fff; }
      p { margin: 0; font-size: 13px; color: #94a3b8; }
    }
    .add-btn {
      background: linear-gradient(135deg, #e50914, #f43f5e) !important;
      color: #fff !important; font-weight: 800 !important; border-radius: 10px !important; height: 42px;
    }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 18px; }
    .kpi-card {
      background: #12141e; border: 1px solid #222638; border-radius: 14px; padding: 16px 18px;
      display: flex; align-items: center; gap: 14px;
      .kpi-icon {
        width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
        &.green { background: rgba(16, 185, 129, 0.14); color: #34d399; }
        &.blue { background: rgba(56, 189, 248, 0.14); color: #38bdf8; }
        &.gold { background: rgba(245, 158, 11, 0.14); color: #fbbf24; }
        &.crimson { background: rgba(229, 9, 20, 0.14); color: #f43f5e; }
      }
      .kpi-label { font-size: 12px; color: #94a3b8; display: block; }
      .kpi-val { font-size: 22px; font-weight: 800; color: #fff; }
    }

    .preset-bar {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      background: #12141e; border: 1px solid #222638; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px;
      .preset-label {
        display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 800; color: #94a3b8;
        mat-icon { font-size: 16px; width: 16px; height: 16px; color: #fbbf24; }
      }
      .preset-chip {
        background: #1a1e2e; border: 1px solid #2c3148; color: #e2e8f0; border-radius: 999px;
        padding: 6px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
        &:hover { border-color: #e50914; background: rgba(229, 9, 20, 0.14); color: #fff; }
      }
    }

    .inline-editor-card {
      background: #141724; border: 1px solid rgba(229, 9, 20, 0.45); border-radius: 16px;
      padding: 20px 22px; margin-bottom: 18px;
      .inline-editor-header {
        display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;
        h3 { margin: 0 0 3px; font-size: 16px; font-weight: 800; color: #fff; }
        p { margin: 0; font-size: 12px; color: #94a3b8; }
      }
      .inline-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
      .span-2 { grid-column: span 2; }
      .suffix-txt { color: #94a3b8; font-weight: 700; padding-right: 6px; }
      .inline-footer {
        display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
        padding-top: 8px; border-top: 1px solid #222638;
      }
      .inline-actions { display: flex; gap: 10px; }
    }

    .filter-bar {
      display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
      background: #12141e; border: 1px solid #222638; border-radius: 12px; padding: 10px 14px; margin-bottom: 16px;
      .filter-group { display: flex; gap: 6px; }
      .filter-pill {
        background: #1a1d2d; border: 1px solid #2a2f45; color: #94a3b8; border-radius: 999px;
        padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer;
        &.active { background: #e50914; border-color: #e50914; color: #fff; }
      }
      .search-box {
        display: flex; align-items: center; gap: 8px; background: #0d0f17; border: 1px solid #2a2f45;
        border-radius: 9px; padding: 0 12px; height: 36px; min-width: 250px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
        input { background: transparent; border: none; outline: none; color: #fff; font-size: 13px; width: 100%; }
      }
    }

    .table-card { background: #12141e; border: 1px solid #222638; border-radius: 16px; overflow: hidden; }
    .table-responsive { overflow-x: auto; }
    .custom-table {
      width: 100%; border-collapse: collapse;
      th {
        text-align: left; padding: 13px 16px; font-size: 11px; font-weight: 800; text-transform: uppercase;
        letter-spacing: 0.6px; color: #64748b; border-bottom: 1px solid #222638;
      }
      td { padding: 13px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); vertical-align: middle; }
    }
    .code-box {
      display: inline-flex; align-items: center; gap: 6px; background: #1a1e2e; border: 1px dashed #3a4160;
      border-radius: 8px; padding: 5px 10px; cursor: pointer;
      .code-text { font-family: monospace; font-size: 13px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #94a3b8; }
      &:hover { border-color: #e50914; }
    }
    .plan-hint { font-size: 11px; color: #38bdf8; margin-top: 4px; }
    .discount-badge {
      display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 800;
      background: rgba(16, 185, 129, 0.15); color: #34d399;
      &.fixed { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
    }
    .sub-hint { font-size: 12px; color: #94a3b8; }
    .usage-col {
      min-width: 130px;
      .usage-text { font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
      .rem-tag {
        font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 999px;
        background: rgba(56, 189, 248, 0.14); color: #7dd3fc;
        &.exhausted { background: rgba(239, 68, 68, 0.16); color: #f87171; }
      }
    }
    .action-buttons { display: inline-flex; align-items: center; gap: 2px; }
    .empty-state { text-align: center; padding: 40px; color: #64748b; font-size: 13px; }

    @media (max-width: 1024px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .inline-editor-card .inline-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class CouponListPage implements OnInit {
  private readonly couponApi = inject(CouponApiService);
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notification = inject(NotificationService);

  coupons: Coupon[] = [];
  filteredCoupons: Coupon[] = [];
  plans: any[] = [];

  selectedFilter = 'ALL';
  searchQuery = '';
  showForm = false;
  saving = false;
  editingCouponId: number | string | null = null;

  couponForm = this.fb.group({
    code: ['', [Validators.required]],
    discountType: ['PERCENTAGE', [Validators.required]],
    discountValue: [50, [Validators.required, Validators.min(1)]],
    maxDiscountAmount: [null as number | null],
    minimumAmount: [0, [Validators.min(0)]],
    usageLimit: [500, [Validators.min(1)]],
    usagePerUser: [1, [Validators.required, Validators.min(1)]],
    validUntil: [''],
    applicablePlanId: [null as number | null],
    description: [''],
    active: [true]
  });

  get activeCouponCount(): number {
    return this.coupons.filter((c) => this.isCouponActive(c)).length;
  }

  get totalRedemptionsCount(): number {
    return this.coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0);
  }

  get maxActiveDiscountText(): string {
    const active = this.coupons.filter((c) => this.isCouponActive(c));
    if (active.length === 0) return '—';
    const pct = Math.max(0, ...active.filter((c) => c.discountType === 'PERCENTAGE').map((c) => Number(c.discountValue) || 0));
    if (pct > 0) return `${pct}% OFF`;
    const fix = Math.max(0, ...active.filter((c) => c.discountType !== 'PERCENTAGE').map((c) => Number(c.discountValue) || 0));
    return fix > 0 ? `₹${fix} OFF` : '—';
  }

  ngOnInit(): void {
    this.loadCoupons();
    this.loadPlans();
  }

  loadPlans(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/plans`).subscribe({
      next: (res) => {
        this.plans = res?.data || res || [];
      },
      error: () => {}
    });
  }

  loadCoupons(): void {
    this.couponApi.getCoupons(0, 100, '').subscribe({
      next: (res) => {
        this.coupons = res?.data?.content || [];
        this.applyFilters();
      },
      error: () => this.notification.error('Failed to load coupons.')
    });
  }

  isCouponActive(c: Coupon): boolean {
    return c.isActive !== undefined ? Boolean(c.isActive) : Boolean(c.active);
  }

  getMinAmount(c: Coupon): number {
    return Number(c.minOrderAmount ?? c.minimumAmount ?? 0);
  }

  getPlanName(planId?: number | null): string {
    if (!planId) return 'All Plans';
    const p = this.plans.find((x) => Number(x.id) === Number(planId));
    return p ? p.name : `Plan #${planId}`;
  }

  getUsagePercent(c: Coupon): number {
    if (!c.usageLimit || c.usageLimit <= 0) return 0;
    return Math.min(100, Math.round(((c.usedCount || 0) / c.usageLimit) * 100));
  }

  getRemaining(c: Coupon): number {
    if (!c.usageLimit || c.usageLimit <= 0) return 0;
    return Math.max(0, c.usageLimit - (c.usedCount || 0));
  }

  setFilter(f: string): void {
    this.selectedFilter = f;
    this.applyFilters();
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredCoupons = this.coupons.filter((c) => {
      if (this.selectedFilter === 'ACTIVE' && !this.isCouponActive(c)) return false;
      if (this.selectedFilter === 'PERCENTAGE' && c.discountType !== 'PERCENTAGE') return false;
      if (this.selectedFilter === 'FIXED' && c.discountType !== 'FIXED') return false;
      if (q && !`${c.code} ${c.description || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  openCreateForm(): void {
    this.editingCouponId = null;
    this.couponForm.reset({
      code: '',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      maxDiscountAmount: null,
      minimumAmount: 0,
      usageLimit: 500,
      usagePerUser: 1,
      validUntil: '',
      applicablePlanId: null,
      description: '',
      active: true
    });
    this.showForm = true;
  }

  openPreset(code: string, type: string, val: number, minAmt: number, limit: number, perUser: number): void {
    this.editingCouponId = null;
    this.couponForm.reset({
      code,
      discountType: type,
      discountValue: val,
      maxDiscountAmount: null,
      minimumAmount: minAmt,
      usageLimit: limit,
      usagePerUser: perUser,
      validUntil: '',
      applicablePlanId: null,
      description: '',
      active: true
    });
    this.showForm = true;
  }

  openEditForm(c: Coupon): void {
    this.editingCouponId = c.id ?? null;
    this.couponForm.patchValue({
      code: c.code,
      discountType: c.discountType || 'PERCENTAGE',
      discountValue: Number(c.discountValue) || 10,
      maxDiscountAmount: c.maxDiscountAmount ?? c.maximumDiscount ?? null,
      minimumAmount: this.getMinAmount(c),
      usageLimit: c.usageLimit ?? 500,
      usagePerUser: c.usagePerUser ?? 1,
      validUntil: this.toDatetimeLocal(c.validUntil),
      applicablePlanId: c.applicablePlanId ?? null,
      description: c.description || '',
      active: this.isCouponActive(c)
    });
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.editingCouponId = null;
  }

  generateRandomCode(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = 'MAXX';
    for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
    this.couponForm.patchValue({ code: out });
  }

  onSaveCoupon(): void {
    if (this.couponForm.invalid || this.saving) return;
    this.saving = true;
    const v = this.couponForm.value;
    const payload: any = {
      code: (v.code || '').trim().toUpperCase(),
      description: (v.description || '').trim(),
      discountType: v.discountType || 'PERCENTAGE',
      discountValue: Number(v.discountValue) || 10,
      maxDiscountAmount: v.maxDiscountAmount ? Number(v.maxDiscountAmount) : null,
      minOrderAmount: Number(v.minimumAmount) || 0,
      minimumAmount: Number(v.minimumAmount) || 0,
      usageLimit: v.usageLimit ? Number(v.usageLimit) : null,
      usagePerUser: Number(v.usagePerUser) || 1,
      applicablePlanId: v.applicablePlanId || null,
      validUntil: v.validUntil ? new Date(v.validUntil).toISOString() : null,
      isActive: Boolean(v.active),
      active: Boolean(v.active)
    };

    const req$ = this.editingCouponId
      ? this.couponApi.updateCoupon(this.editingCouponId, payload)
      : this.couponApi.createCoupon(payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.notification.success(this.editingCouponId ? `Coupon ${payload.code} updated!` : `Coupon ${payload.code} published!`);
        this.loadCoupons();
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err?.error?.message || 'Failed to save coupon.');
      }
    });
  }

  onToggleStatus(c: Coupon): void {
    if (!c.id) return;
    this.couponApi.toggleStatus(c.id).subscribe({
      next: () => {
        this.notification.success(`Coupon ${c.code} status updated.`);
        this.loadCoupons();
      },
      error: () => this.notification.error('Failed to update coupon status.')
    });
  }

  async onDeleteCoupon(c: Coupon): Promise<void> {
    if (!c.id) return;
    const ok = await this.notification.confirm(
      'Deactivate Coupon?',
      `Deactivate coupon "${c.code}" so it can no longer be redeemed?`,
      'Yes, Deactivate'
    );
    if (!ok) return;

    this.couponApi.deleteCoupon(c.id).subscribe({
      next: () => {
        this.notification.success(`Coupon ${c.code} deactivated.`);
        this.loadCoupons();
      },
      error: () => this.notification.error('Failed to deactivate coupon.')
    });
  }

  copyCode(code: string): void {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        this.notification.info(`Copied code: ${code}`);
      });
    }
  }

  private toDatetimeLocal(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
