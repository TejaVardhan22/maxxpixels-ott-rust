import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface ProducerDashboardAnalytics {
  producerId: number;
  totalSubmissions: number;
  totalAdImpressions: number;
  totalAdRevenueEarned: number;
  totalSubscriptionEarnings: number;
  totalTvodEarnings: number;
  grandTotalEarnings: number;
}

@Component({
  selector: 'app-producer-dashboard',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <div class="dashboard-container">
      <div class="header-section">
        <h1>Producer Content & Revenue Dashboard</h1>
        <p>Monitor your content performance, SSAI ad impressions, and earnings</p>
      </div>

      <div class="metrics-grid">
        <mat-card class="metric-card primary">
          <mat-card-content>
            <div class="metric-header">
              <mat-icon>movie</mat-icon>
              <span>Total Submissions</span>
            </div>
            <h2>{{ analytics?.totalSubmissions || 0 }}</h2>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card accent">
          <mat-card-content>
            <div class="metric-header">
              <mat-icon>analytics</mat-icon>
              <span>SSAI Ad Impressions</span>
            </div>
            <h2>{{ (analytics?.totalAdImpressions || 0) | number }}</h2>
          </mat-card-content>
        </mat-card>

        <mat-card class="metric-card success">
          <mat-card-content>
            <div class="metric-header">
              <mat-icon>monetization_on</mat-icon>
              <span>Total Revenue Share</span>
            </div>
            <h2>₹{{ (analytics?.grandTotalEarnings || 0) | number:'1.2-2' }}</h2>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { color: #ffffff; }
    .header-section { margin-bottom: 24px; h1 { font-size: 24px; font-weight: 700; } p { color: #a0a0b0; } }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
    .metric-card {
      background-color: #1a1a24; color: #ffffff; border-radius: 12px;
      .metric-header { display: flex; align-items: center; color: #a0a0b0; margin-bottom: 12px; mat-icon { margin-right: 8px; } }
      h2 { font-size: 28px; font-weight: 700; margin: 0; }
      &.primary mat-icon { color: #3498db; }
      &.accent mat-icon { color: #9b59b6; }
      &.success mat-icon { color: #2ecc71; }
    }
  `]
})
export class ProducerDashboardPage implements OnInit {
  private readonly http = inject(HttpClient);
  analytics: ProducerDashboardAnalytics | null = null;

  ngOnInit(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/producer/analytics/dashboard`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.analytics = res.data;
        }
      }
    });
  }
}
