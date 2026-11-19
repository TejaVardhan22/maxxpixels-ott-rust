import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { BadgeComponent } from '../../../shared/components/ott-design-system/badge.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-ott-plans-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, OttButtonComponent, BadgeComponent],
  template: `
    <div class="plans-container">
      <div class="plans-header">
        <h1 class="heading">Choose the plan that's right for you</h1>
        <p class="subheading">Watch anywhere. Cancel anytime.</p>

        <!-- BILLING PERIOD TOGGLE -->
        <div class="billing-toggle">
          <button class="toggle-btn" [class.active]="billingCycle === 'monthly'" (click)="billingCycle = 'monthly'">Monthly Billing</button>
          <button class="toggle-btn" [class.active]="billingCycle === 'yearly'" (click)="billingCycle = 'yearly'">
            Yearly Billing
            <span class="save-badge">SAVE 25%</span>
          </button>
        </div>
      </div>

      <!-- COUPON CODE SECTION -->
      <div class="coupon-box-wrapper">
        <div class="coupon-input-group">
          <mat-icon class="tag-icon">local_offer</mat-icon>
          <input
            type="text"
            placeholder="Enter Promo Code (e.g. SAVE20)"
            [(ngModel)]="couponCode"
            class="coupon-input" />
          <button class="apply-coupon-btn" (click)="applyCoupon()">Apply Code</button>
        </div>
        <div *ngIf="appliedDiscount > 0" class="coupon-success">
          <mat-icon>check_circle</mat-icon> Promo code '{{ appliedCouponName }}' applied! You get {{ appliedDiscount }}% OFF!
        </div>
      </div>

      <!-- PLANS GRID -->
      <div *ngIf="plans.length === 0 && !loading" style="text-align: center; color: #747B89; padding: 48px 16px; background: #171A21; border-radius: 16px; margin-bottom: 40px; border: 1px dashed rgba(255,255,255,0.1);">
        <mat-icon style="font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; color: #747B89;">card_membership</mat-icon>
        <p style="margin: 0; font-size: 16px; font-weight: 600;">No active subscription plans available at the moment.</p>
      </div>

      <div class="plans-grid" *ngIf="plans.length > 0">
        <div *ngFor="let plan of plans" class="plan-card" [class.popular]="plan.isPopular" [class.selected]="selectedPlanId === plan.id" (click)="selectedPlanId = plan.id">
          <div *ngIf="plan.isPopular" class="popular-badge">MOST POPULAR</div>

          <h3 class="plan-name">{{ plan.name }}</h3>
          <div class="plan-price">
            <span class="currency">₹</span>
            <span class="amount">{{ getPrice(plan) }}</span>
            <span class="period">/{{ billingCycle === 'monthly' ? 'month' : 'year' }}</span>
          </div>

          <div *ngIf="appliedDiscount > 0" class="discount-badge">
            Original: ₹{{ getOriginalPrice(plan) }} (Saved ₹{{ getOriginalPrice(plan) - getPrice(plan) }})
          </div>

          <div class="plan-features-list">
            <div class="feature-item"><mat-icon>check</mat-icon> {{ plan.quality }} Video Quality</div>
            <div class="feature-item"><mat-icon>check</mat-icon> {{ plan.resolution }} Resolution</div>
            <div class="feature-item"><mat-icon>check</mat-icon> {{ plan.screens }} Concurrent Screen{{ plan.screens > 1 ? 's' : '' }}</div>
            <div class="feature-item"><mat-icon>check</mat-icon> {{ plan.devices }}</div>
            <div class="feature-item"><mat-icon>{{ plan.ads ? 'close' : 'check' }}</mat-icon> {{ plan.ads ? 'Contains Ads' : 'Ad-free Experience' }}</div>
          </div>

          <ott-button [variant]="plan.isPopular ? 'primary' : 'secondary'" [fullWidth]="true" (onClick)="selectAndSubscribe(plan)">
            Subscribe Now
          </ott-button>
        </div>
      </div>

      <!-- COMPARISON TABLE -->
      <div class="comparison-section" *ngIf="plans.length > 0">
        <h2>Detailed Plan Comparison</h2>
        <div class="table-wrapper">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Features</th>
                <th *ngFor="let plan of plans">{{ plan.name }} (₹{{ plan.monthlyPrice }})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="feature-name">Monthly Price</td>
                <td *ngFor="let plan of plans">₹{{ plan.monthlyPrice }}</td>
              </tr>
              <tr>
                <td class="feature-name">Video Quality</td>
                <td *ngFor="let plan of plans">{{ plan.resolution }}</td>
              </tr>
              <tr>
                <td class="feature-name">Concurrent Screens</td>
                <td *ngFor="let plan of plans">{{ plan.screens }} Screen{{ plan.screens > 1 ? 's' : '' }}</td>
              </tr>
              <tr>
                <td class="feature-name">Supported Devices</td>
                <td *ngFor="let plan of plans">{{ plan.devices }}</td>
              </tr>
              <tr>
                <td class="feature-name">Ad-Free Streaming</td>
                <td *ngFor="let plan of plans">{{ plan.ads ? '❌ Contains Ads' : '✅ 100% Ad-Free' }}</td>
              </tr>
              <tr>
                <td class="feature-name">Offline Downloads</td>
                <td *ngFor="let plan of plans">{{ plan.downloadsEnabled ? '✅ Enabled' : '❌ Not Included' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .plans-container {
      padding: 100px 4vw 80px 4vw; min-height: 100vh; background: #06070A; color: #FFF; max-width: 1400px; margin: 0 auto;
    }
    .plans-header {
      text-align: center; margin-bottom: 32px;
      .heading { font-size: clamp(28px, 4vw, 42px); font-weight: 900; margin: 0 0 10px 0; }
      .subheading { font-size: 16px; color: #AAB0BC; margin-bottom: 24px; }
      .billing-toggle {
        display: inline-flex; background: #171A21; padding: 4px; border-radius: 30px; border: 1px solid rgba(255,255,255,0.12);
        .toggle-btn {
          padding: 10px 24px; border-radius: 26px; background: transparent; border: none; color: #AAB0BC; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 150ms ease;
          &.active { background: #E50914; color: #FFF; }
          .save-badge { background: #F59E0B; color: #000; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 10px; }
        }
      }
    }

    .coupon-box-wrapper {
      max-width: 500px; margin: 0 auto 40px auto;
      .coupon-input-group {
        position: relative; display: flex; align-items: center; background: #12151C; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 4px;
        .tag-icon { margin-left: 12px; color: #F59E0B; }
        .coupon-input { flex: 1; background: transparent; border: none; color: #FFF; padding: 12px 14px; font-size: 14px; font-weight: 700; outline: none; text-transform: uppercase; }
        .apply-coupon-btn { background: #E50914; color: #FFF; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; }
      }
      .coupon-success { display: flex; align-items: center; gap: 6px; color: #22C55E; font-size: 13px; font-weight: 700; margin-top: 10px; text-align: center; justify-content: center; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    }

    .plans-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px; margin-bottom: 64px;
    }

    .plan-card {
      position: relative; background: #171A21; border-radius: 16px; border: 2px solid rgba(255,255,255,0.1); padding: 32px 24px; display: flex; flex-direction: column; cursor: pointer; transition: all 250ms ease;
      &.selected { border-color: #E50914; background: #1D222E; }
      &.popular { border-color: #F59E0B; background: linear-gradient(180deg, rgba(245, 158, 11, 0.08) 0%, #171A21 100%); }
      &:hover { transform: translateY(-6px); box-shadow: 0 16px 40px rgba(0,0,0,0.6); }

      .popular-badge {
        position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #000; font-size: 11px; font-weight: 900; padding: 4px 16px; border-radius: 20px; letter-spacing: 0.5px;
      }

      .plan-name { font-size: 22px; font-weight: 800; margin: 0 0 16px 0; }
      .plan-price { font-size: 40px; font-weight: 900; color: #FFF; margin-bottom: 12px; .currency { font-size: 24px; } .period { font-size: 14px; color: #747B89; font-weight: 600; } }

      .discount-badge { font-size: 12px; color: #22C55E; font-weight: 700; margin-bottom: 16px; }

      .plan-features-list {
        display: flex; flex-direction: column; gap: 12px; margin-bottom: 32px; flex: 1;
        .feature-item { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #D1D5DB; mat-icon { font-size: 18px; width: 18px; height: 18px; color: #22C55E; } }
      }
    }

    .comparison-section {
      h2 { font-size: 24px; font-weight: 800; margin-bottom: 24px; text-align: center; }
      .table-wrapper { overflow-x: auto; background: #12151C; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); padding: 12px; }
      .comparison-table {
        width: 100%; border-collapse: collapse; text-align: left;
        th, td { padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 14px; }
        th { font-size: 15px; font-weight: 800; color: #FFF; }
        .feature-name { font-weight: 700; color: #AAB0BC; }
      }
    }
  `]
})
export class PlansPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  selectedPlanId: any = null;
  billingCycle: 'monthly' | 'yearly' = 'monthly';
  couponCode = '';
  appliedCouponName = '';
  appliedDiscount = 0;
  loading = false;

  plans: any[] = [];

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/plans`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res?.success && res.data) {
          this.plans = res.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            monthlyPrice: p.price != null ? p.price : 0,
            yearlyPrice: p.price != null ? Math.round(p.price * 9.5) : 0,
            price: p.price != null ? p.price : 0,
            quality: p.maxResolution?.includes('4K') ? 'Best' : (p.maxResolution?.includes('1080') ? 'Great' : 'Good'),
            resolution: p.maxResolution || '1080p Full HD',
            screens: p.maxConcurrentStreams || 1,
            devices: `${p.maxDevices || 1} Device(s)`,
            ads: p.adsEnabled,
            downloadsEnabled: p.downloadsEnabled,
            billingPeriod: p.billingPeriod,
            isPopular: p.name?.toLowerCase().includes('premium') || false
          }));
          if (this.plans.length > 0) {
            this.selectedPlanId = this.plans[0].id;
          }
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

  applyCoupon(): void {
    const code = this.couponCode.trim().toUpperCase();
    if (code === 'SAVE20' || code === 'WELCOME50') {
      this.appliedCouponName = code;
      this.appliedDiscount = code === 'WELCOME50' ? 50 : 20;
    }
  }

  getOriginalPrice(plan: any): number {
    return this.billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  }

  getPrice(plan: any): number {
    const orig = this.getOriginalPrice(plan);
    if (this.appliedDiscount > 0) {
      return Math.round(orig * (1 - this.appliedDiscount / 100));
    }
    return orig;
  }

  selectAndSubscribe(plan: any): void {
    this.router.navigate(['/home']);
  }
}
