import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule } from '@angular/router';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface ProducerOnboardingProfile {
  id: number;
  producerUserId?: number;
  studioName: string;
  studioRegistrationNumber: string;
  contactEmail: string;
  contactPhone: string;
  bankAccountPayoutId: string;
  taxId: string;
  defaultRevenueSharePercentage: number;
  onboardingStatus: string;
  status?: string;
  signedAgreementUrl?: string;
  agreementStatus?: string;
  /** Known only immediately after create/reset; plaintext is never stored server-side. */
  loginPassword?: string | null;
  showPassword?: boolean;
}

@Component({
  selector: 'app-producer-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>business</mat-icon> PRODUCER DIRECTORY &amp; STUDIO MANAGEMENT</span>
          <h1>Content Producer Studios &amp; Account Provisioning</h1>
          <p>Manage production studios, configure payout bank settlements, and provision studio partner portal accounts</p>
        </div>
        <div class="header-actions">
          <a mat-raised-button color="primary" class="add-btn" routerLink="/admin/producers/onboard">
            <mat-icon>person_add</mat-icon> Onboard New Producer Studio
          </a>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>business</mat-icon></div>
          <div>
            <span class="kpi-label">Active Producer Studios</span>
            <div class="kpi-val">{{ activeCount }} Studios Active</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>key</mat-icon></div>
          <div>
            <span class="kpi-label">Active Studio Accounts</span>
            <div class="kpi-val">{{ activeCount }} ROLE_PRODUCER Users</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>visibility_off</mat-icon></div>
          <div>
            <span class="kpi-label">Deactivated &amp; Hidden</span>
            <div class="kpi-val">{{ deactivatedCount }} Hidden Studios</div>
          </div>
        </div>
      </div>

      <!-- 3. SEARCH & VISIBILITY FILTER BAR -->
      <div class="filter-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="filterProducers()" placeholder="Search active studio name, email, tax ID, payout bank...">
        </div>

        <div class="filter-toggle-container">
          <label class="toggle-pill" [class.active]="showDeactivated">
            <input type="checkbox" [(ngModel)]="showDeactivated" (change)="filterProducers()">
            <mat-icon>{{ showDeactivated ? 'visibility' : 'visibility_off' }}</mat-icon>
            <span>Show Deactivated / Hidden Studios ({{ deactivatedCount }})</span>
          </label>
        </div>
      </div>

      <!-- 4. ONBOARDED PRODUCERS DIRECTORY TABLE -->
      <div class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Onboarded Producer Studios &amp; Login Accounts</h3>
            <p>{{ showDeactivated ? 'Displaying all studios including hidden/deactivated accounts' : 'Displaying active verified studios (deactivated accounts are hidden)' }}</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
          <thead>
            <tr>
              <th>Studio &amp; Registration</th>
              <th>Login Account Email</th>
              <th>Provisioned Password</th>
              <th>Payout Bank ID</th>
              <th>Tax ID</th>
              <th>Rev Share</th>
              <th>Status</th>
              <th style="text-align: right;">Producer Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of filteredProducers" [class.row-deactivated]="isDeactivated(item)">
              <td>
                <div class="studio-cell">
                  <span class="studio-name">{{ item.studioName }}</span>
                  <span class="studio-reg">{{ item.studioRegistrationNumber }}</span>
                </div>
              </td>
              <td>
                <span class="email-text">{{ item.contactEmail }}</span>
              </td>
              <td>
                <div class="password-cell">
                  <span class="password-text" [class.password-unknown]="!item.loginPassword">
                    {{ item.loginPassword ? (item.showPassword ? item.loginPassword : '••••••••••••') : 'Unknown — use Reset Password' }}
                  </span>
                  <button *ngIf="item.loginPassword" mat-icon-button class="eye-btn" (click)="item.showPassword = !item.showPassword">
                    <mat-icon>{{ item.showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                  </button>
                </div>
              </td>
              <td>
                <span class="bank-id font-mono">{{ item.bankAccountPayoutId }}</span>
              </td>
              <td>
                <span class="tax-text font-mono">{{ item.taxId }}</span>
              </td>
              <td>
                <span class="share-badge">{{ item.defaultRevenueSharePercentage || 60 }}% Share</span>
              </td>
              <td>
                <app-status-badge [status]="item.status || item.onboardingStatus"></app-status-badge>
              </td>
              <td style="text-align: right;">
                <div class="action-buttons">
                  <button
                    *ngIf="!isDeactivated(item)"
                    mat-stroked-button
                    color="warn"
                    (click)="removeProducer(item)"
                    matTooltip="Deactivate and Hide this producer from active list"
                  >
                    <mat-icon>visibility_off</mat-icon> Remove / Hide
                  </button>
                  <button
                    *ngIf="isDeactivated(item)"
                    mat-stroked-button
                    color="accent"
                    (click)="toggleProducerStatus(item)"
                    matTooltip="Restore and Activate this producer"
                  >
                    <mat-icon>check_circle</mat-icon> Restore / Activate
                  </button>
                  <a
                    mat-stroked-button
                    color="primary"
                    [routerLink]="['/admin/producer-reviews']"
                    [queryParams]="{ producerId: item.id }"
                    matTooltip="Inspect and Verify Producer KYC, Documents & Bank Settlement Details"
                  >
                    <mat-icon>verified_user</mat-icon> Verify KYC
                  </a>
                  <button mat-stroked-button color="primary" (click)="resetPassword(item)" matTooltip="Reset Login Password">
                    <mat-icon>key</mat-icon> Reset Pass
                  </button>
                  <button mat-stroked-button color="accent" (click)="viewProducerPortal(item)" matTooltip="View Producer Shows &amp; Media Assets">
                    <mat-icon>movie</mat-icon> View Shows
                  </button>
                </div>
              </td>
            </tr>
            <tr *ngIf="filteredProducers.length === 0">
              <td colspan="8" class="empty-state-cell">
                <div class="empty-box">
                  <mat-icon>business</mat-icon>
                  <p>No active producer studios found.<span *ngIf="deactivatedCount > 0 && !showDeactivated"> ({{ deactivatedCount }} deactivated studio(s) are hidden. Check "Show Deactivated" to view them).</span></p>
                </div>
              </td>
            </tr>
          </tbody>
          </table>
        </div>
      </div>

      <!-- 5. ONBOARD PRODUCER MODAL -->
      <div class="modal-backdrop" *ngIf="showModal" (click)="closeModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon-box"><mat-icon>person_add</mat-icon></div>
            <div>
              <h2>Onboard New Producer Studio</h2>
              <p>Provisions a ROLE_PRODUCER user account and generates login credentials</p>
            </div>
            <button mat-icon-button (click)="closeModal()" class="close-btn"><mat-icon>close</mat-icon></button>
          </div>

          <form [formGroup]="onboardForm" (ngSubmit)="onSaveProducer()" class="modal-form">
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Studio / Company Name</mat-label>
                  <input matInput formControlName="studioName" placeholder="e.g. Apex Digital Pictures" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Studio Registration Number</mat-label>
                  <input matInput formControlName="studioRegistrationNumber" placeholder="e.g. REG-STUDIO-3310" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Producer Contact Email (Login ID)</mat-label>
                  <input matInput type="email" formControlName="contactEmail" placeholder="apex.studios@maxxpixels.tv" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Contact Phone Number</mat-label>
                  <input matInput formControlName="contactPhone" placeholder="+1 (555) 321-7654" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bank Account / Payout ID</mat-label>
                  <input matInput formControlName="bankAccountPayoutId" placeholder="e.g. BANK-PAYOUT-4412091" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Tax ID / EIN Number</mat-label>
                  <input matInput formControlName="taxId" placeholder="e.g. TAX-US-44102941" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>PAN Number (e.g. ABCDE1234F)</mat-label>
                  <input matInput formControlName="panNumber" placeholder="e.g. ABCDE1234F">
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Aadhar Number (12 Digits)</mat-label>
                  <input matInput formControlName="aadharNumber" placeholder="e.g. 123456789012">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Bank Account Number</mat-label>
                  <input matInput formControlName="bankAccountNumber" placeholder="e.g. 98765432101">
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>IFSC Code (e.g. SBIN0001234)</mat-label>
                  <input matInput formControlName="ifscCode" placeholder="e.g. SBIN0001234">
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Temporary Login Password</mat-label>
                  <input matInput formControlName="loginPassword" placeholder="ApexMedia#2026" required>
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Revenue Share (%)</mat-label>
                  <input matInput type="number" formControlName="defaultRevenueSharePercentage" placeholder="60.0">
                </mat-form-field>
              </div>
            </div>

            <div class="modal-actions">
              <button type="button" mat-stroked-button (click)="closeModal()">Cancel</button>
              <button type="submit" mat-raised-button class="submit-btn" [disabled]="onboardForm.invalid">
                <mat-icon>verified</mat-icon> Onboard Producer & Provision Login Account
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
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;

      .category-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(26, 76, 216, 0.15);
        color: #00d2ff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 6px;
        margin-bottom: 6px;
        letter-spacing: 0.5px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; }
      }
      h1 { font-size: 26px; font-weight: 800; margin: 0 0 4px; color: #ffffff; }
      p { color: #a0a0b0; margin: 0; font-size: 13px; }

      .add-btn {
        height: 44px;
        border-radius: 10px;
        font-weight: 800;
        font-size: 13px;
        background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 4px 16px rgba(26, 76, 216, 0.35);
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
      background: rgba(22, 22, 34, 0.8);
      border: 1px solid #28283c;
      border-radius: 14px;
      padding: 18px;
      display: flex;
      align-items: center;
      gap: 14px;

      .kpi-icon {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: #1c1c2b;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .kpi-label { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 2px; }
      .kpi-val { font-size: 18px; font-weight: 700; color: #ffffff; }

      &.green .kpi-icon { color: #00e676; background: rgba(0, 230, 118, 0.12); }
      &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
    }

    /* FILTER BAR */
    .filter-bar {
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;

      .search-box {
        position: relative;
        width: 100%;
        max-width: 440px;
        .search-icon { position: absolute; left: 12px; top: 10px; color: #a0a0b0; font-size: 18px; width: 18px; height: 18px; }
        input {
          width: 100%;
          background: #161624;
          border: 1px solid #28283c;
          border-radius: 10px;
          color: #ffffff;
          padding: 10px 14px 10px 38px;
          font-size: 13px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
      }

      .filter-toggle-container {
        display: flex;
        align-items: center;

        .toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid #28283c;
          background: #161624;
          color: #a0a0b0;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;

          input {
            display: none;
          }

          mat-icon {
            font-size: 18px;
            width: 18px;
            height: 18px;
          }

          &:hover {
            border-color: #40405c;
            color: #ffffff;
          }

          &.active {
            border-color: #00d2ff;
            background: rgba(0, 210, 255, 0.12);
            color: #00d2ff;
          }
        }
      }
    }

    .row-deactivated {
      opacity: 0.6;
      background: rgba(255, 23, 68, 0.03);
    }

    .empty-state-cell {
      padding: 48px 16px !important;
      text-align: center;
      .empty-box {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #a0a0b0;
        mat-icon { font-size: 40px; width: 40px; height: 40px; color: #505068; }
        p { margin: 0; font-size: 14px; }
      }
    }

    /* TABLE CARD */
    .table-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      .table-title-row {
        margin-bottom: 20px;
        h3 { margin: 0 0 2px; font-size: 18px; font-weight: 800; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }

      .custom-table {
        width: 100%;
        min-width: 1050px;
        border-collapse: collapse;
        text-align: left;

        th {
          background: #101018;
          color: #a0a0b0;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 14px 16px;
          border-bottom: 1px solid #28283c;
          white-space: nowrap;
        }

        td {
          padding: 14px 16px;
          border-bottom: 1px solid #202030;
          font-size: 13px;
          white-space: nowrap;
        }
      }
    }

    .studio-cell {
      display: flex;
      flex-direction: column;
      gap: 3px;
      .studio-name { font-weight: 700; color: #ffffff; font-size: 14px; }
      .studio-reg { font-size: 11px; color: #00d2ff; font-family: monospace; }
    }

    .email-text { font-weight: 600; color: #ffffff; }

    .password-cell {
      display: flex;
      align-items: center;
      gap: 4px;
      .password-text { font-family: monospace; font-size: 12px; color: #ffab00; }
      .password-text.password-unknown { color: #a0a0b0; font-style: italic; font-family: inherit; }
      .eye-btn { width: 24px; height: 24px; line-height: 24px; mat-icon { font-size: 16px; width: 16px; height: 16px; color: #a0a0b0; } }
    }

    .bank-id, .tax-text { font-family: monospace; font-size: 12px; color: #00d2ff; }
    .share-badge { font-weight: 800; color: #00e676; }
    .action-buttons { display: flex; gap: 8px; justify-content: flex-end; }

    /* MODAL STYLES */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }

    .modal-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      width: 100%;
      max-width: 620px;
      padding: 24px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);

      .modal-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        position: relative;
        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(26,76,216,0.2), rgba(199,37,163,0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00d2ff;
        }
        h2 { margin: 0 0 2px; font-size: 20px; font-weight: 800; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
        .close-btn { position: absolute; right: 0; top: 0; color: #a0a0b0; }
      }

      .modal-form {
        .full-width { width: 100%; margin-bottom: 14px; display: block; }
        .form-row { display: flex; gap: 14px; flex-wrap: wrap; }
        .half-width { flex: 1; min-width: 240px; }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 16px;
          .submit-btn {
            background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
            color: #ffffff !important;
            font-weight: 800;
            padding: 0 20px;
            height: 44px;
            border-radius: 10px;
          }
        }
      }
    }
  `]
})
export class ProducerListPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  producers: ProducerOnboardingProfile[] = [];
  filteredProducers: ProducerOnboardingProfile[] = [];
  searchQuery = '';
  showDeactivated = false;
  showModal = false;
  loading = false;

  onboardForm = this.fb.group({
    studioName: ['', [Validators.required]],
    studioRegistrationNumber: ['', [Validators.required]],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required]],
    bankAccountPayoutId: ['', [Validators.required]],
    taxId: ['', [Validators.required]],
    panNumber: [''],
    aadharNumber: [''],
    bankAccountNumber: [''],
    ifscCode: [''],
    loginPassword: ['Producer@2026', [Validators.required]],
    defaultRevenueSharePercentage: [60.0]
  });

  isDeactivated(item: ProducerOnboardingProfile): boolean {
    const s = (item.status || item.onboardingStatus || '').toUpperCase();
    return s === 'DEACTIVATED' || s === 'SUSPENDED' || s === 'INACTIVE';
  }

  get activeCount(): number {
    return this.producers.filter(p => !this.isDeactivated(p)).length;
  }

  get deactivatedCount(): number {
    return this.producers.filter(p => this.isDeactivated(p)).length;
  }

  ngOnInit(): void {
    this.loadProducers();
  }

  loadProducers(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/producers?includeInactive=true`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.producers = res.data;
        } else {
          this.producers = [];
        }
        this.filterProducers();
      },
      error: () => {
        this.loading = false;
        this.producers = [];
        this.filterProducers();
      }
    });
  }

  filterProducers(): void {
    let list = this.producers;
    if (!this.showDeactivated) {
      list = list.filter(p => !this.isDeactivated(p));
    }

    if (!this.searchQuery || !this.searchQuery.trim()) {
      this.filteredProducers = list;
      return;
    }
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredProducers = list.filter(p =>
      (p.studioName || '').toLowerCase().includes(q) ||
      (p.contactEmail || '').toLowerCase().includes(q) ||
      (p.taxId || '').toLowerCase().includes(q) ||
      (p.bankAccountPayoutId || '').toLowerCase().includes(q)
    );
  }

  openOnboardModal(): void {
    this.onboardForm.reset({
      studioName: '',
      studioRegistrationNumber: 'REG-STUDIO-' + Math.floor(1000 + Math.random() * 9000),
      contactEmail: '',
      contactPhone: '',
      bankAccountPayoutId: 'BANK-PAYOUT-' + Math.floor(1000000 + Math.random() * 9000000),
      taxId: 'TAX-US-' + Math.floor(10000000 + Math.random() * 90000000),
      panNumber: 'ABCDE1234F',
      aadharNumber: '123456789012',
      bankAccountNumber: '98765432101',
      ifscCode: 'SBIN0001234',
      loginPassword: 'Producer@2026',
      defaultRevenueSharePercentage: 60.0
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  onSaveProducer(): void {
    if (this.onboardForm.invalid) return;

    const dto = this.onboardForm.value as any;
    dto.companyName = dto.studioName;
    dto.company_name = dto.studioName;
    dto.email = dto.contactEmail;
    dto.phoneNumber = dto.contactPhone;
    dto.phone_number = dto.contactPhone;
    dto.fullName = dto.studioName;
    dto.name = dto.studioName;

    this.http.post<any>(`${environment.apiBaseUrl}/admin/producers/onboard`, dto).subscribe({
      next: (res) => {
        if (res.success) {
          const newProducer: ProducerOnboardingProfile = {
            id: res.data?.id || Date.now(),
            ...dto,
            onboardingStatus: 'VERIFIED',
            showPassword: false
          };
          this.producers.unshift(newProducer);
          this.filterProducers();
          this.closeModal();
          this.notificationService.success(`Producer "${dto.studioName}" onboarded! Login email: ${dto.contactEmail}, Password: ${dto.loginPassword}`);
        } else {
          this.notificationService.error(res.message || 'Failed to onboard producer');
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Error onboarding producer');
      }
    });
  }

  resetPassword(item: ProducerOnboardingProfile): void {
    const newPass = 'ProducerReset#' + Math.floor(100 + Math.random() * 900);
    this.http.post<any>(`${environment.apiBaseUrl}/admin/producers/${item.id}/reset-password`, {
      newPassword: newPass
    }).subscribe({
      next: (res) => {
        const isOk = res?.success || res?.statusCode === 200 || typeof res === 'string';
        if (isOk) {
          item.loginPassword = newPass;
          item.showPassword = true;
          this.notificationService.success(`Producer password for "${item.studioName}" reset to: ${newPass}`);
        } else {
          this.notificationService.error(res?.message || 'Failed to reset password');
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Error resetting password');
      }
    });
  }

  viewProducerPortal(item: ProducerOnboardingProfile): void {
    this.notificationService.info(`Viewing "${item.studioName}" dashboard & analytics...`);
    this.router.navigate(['/producer/dashboard'], { queryParams: { producerId: item.id } });
  }

  async removeProducer(item: ProducerOnboardingProfile): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Remove Producer?',
      `Are you sure you want to remove and hide producer "${item.studioName}"?`,
      'Yes, Remove'
    );
    if (!ok) {
      return;
    }

    this.http.delete<any>(`${environment.apiBaseUrl}/admin/producers/${item.id}`).subscribe({
      next: (res) => {
        if (res.success) {
          item.status = 'DEACTIVATED';
          item.onboardingStatus = 'DEACTIVATED';
          this.filterProducers();
          this.notificationService.success(`Producer "${item.studioName}" has been deactivated and hidden from the active list.`);
        } else {
          this.notificationService.error(res.message || 'Failed to remove producer');
        }
      },
      error: () => {
        // Fallback to toggle-status
        this.toggleProducerStatus(item);
      }
    });
  }

  toggleProducerStatus(item: ProducerOnboardingProfile): void {
    const isInactive = this.isDeactivated(item);
    const targetStatus = isInactive ? 'ACTIVE' : 'DEACTIVATED';

    this.http.post<any>(`${environment.apiBaseUrl}/admin/producers/${item.id}/toggle-status`, { status: targetStatus }).subscribe({
      next: (res) => {
        if (res.success) {
          const updatedStatus = res.data?.status || targetStatus;
          item.status = updatedStatus;
          item.onboardingStatus = updatedStatus;
          this.filterProducers();
          if (updatedStatus === 'DEACTIVATED') {
            this.notificationService.success(`Producer "${item.studioName}" deactivated and hidden from active list.`);
          } else {
            this.notificationService.success(`Producer "${item.studioName}" restored to active status.`);
          }
        } else {
          this.notificationService.error(res.message || 'Failed to update producer status');
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Error updating producer status');
      }
    });
  }
}
