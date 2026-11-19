import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { UserApiService, UserAccount } from '../../core/services/user-api.service';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

interface SupportNote {
  id: number;
  text: string;
  author: string;
  createdAt: string;
}

@Component({
  selector: 'app-user-list-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    StatusBadgeComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER (Matches /admin/producers UI) -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>people</mat-icon> REGISTERED USERS &amp; SUBSCRIBER MANAGEMENT</span>
          <h1>Users</h1>
          <p>Manage registered MaxxPixels viewers, inspect active subscriptions &amp; devices, and control account access</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button class="add-btn" (click)="openCreateModal()">
            <mat-icon>person_add</mat-icon> Add New User
          </button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green" [class.selected]="selectedPlan === 'ALL'" (click)="setPlanFilter('ALL')">
          <div class="kpi-icon"><mat-icon>people</mat-icon></div>
          <div>
            <span class="kpi-label">Active Registered Users</span>
            <div class="kpi-val">{{ activeCount }} Users Active</div>
          </div>
        </div>

        <div class="kpi-card blue" [class.selected]="selectedPlan === 'PAID'" (click)="setPlanFilter('PAID')">
          <div class="kpi-icon"><mat-icon>workspace_premium</mat-icon></div>
          <div>
            <span class="kpi-label">Paid Subscribers (SVOD)</span>
            <div class="kpi-val">{{ paidCount }} Paid Subscribers</div>
          </div>
        </div>

        <div class="kpi-card gold" [class.selected]="showSuspended" (click)="toggleShowSuspended()">
          <div class="kpi-icon"><mat-icon>visibility_off</mat-icon></div>
          <div>
            <span class="kpi-label">Suspended &amp; Hidden</span>
            <div class="kpi-val">{{ suspendedCount }} Hidden Users</div>
          </div>
        </div>
      </div>

      <!-- 3. SEARCH & VISIBILITY FILTER BAR -->
      <div class="filter-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (input)="applyFilters()" placeholder="Search user name, mobile number, email...">
        </div>

        <div class="filter-right">
          <div class="plan-pills">
            <button type="button" class="plan-pill" [class.active]="selectedPlan === 'ALL'" (click)="setPlanFilter('ALL')">All</button>
            <button type="button" class="plan-pill" [class.active]="selectedPlan === 'PAID'" (click)="setPlanFilter('PAID')">Paid</button>
            <button type="button" class="plan-pill" [class.active]="selectedPlan === 'FREE'" (click)="setPlanFilter('FREE')">Free</button>
          </div>

          <label class="toggle-pill" [class.active]="showSuspended">
            <input type="checkbox" [(ngModel)]="showSuspended" (change)="applyFilters()">
            <mat-icon>{{ showSuspended ? 'visibility' : 'visibility_off' }}</mat-icon>
            <span>Show Suspended / Hidden Users ({{ suspendedCount }})</span>
          </label>
        </div>
      </div>

      <!-- 4. REGISTERED USERS DIRECTORY TABLE -->
      <div class="table-card">
        <div class="table-title-row">
          <div>
            <h3>Registered OTT Users &amp; Subscriptions</h3>
            <p>{{ showSuspended ? 'Displaying all registered users including suspended accounts' : 'Displaying active registered users (suspended accounts are hidden)' }}</p>
          </div>
        </div>

        <div class="table-responsive">
          <table class="custom-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Mobile Number</th>
                <th>Email (Optional)</th>
                <th>Subscription Plan</th>
                <th>Devices &amp; Joined</th>
                <th>Status</th>
                <th style="text-align: right;">User Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let user of filteredUsers" class="clickable-row" [class.row-deactivated]="isSuspended(user)" (click)="openDetailModal(user)">
                <td>
                  <div class="user-cell">
                    <div class="avatar-badge" [style.background]="getAvatarColor(user.fullName)">
                      {{ getInitials(user.fullName) }}
                    </div>
                    <div>
                      <span class="user-name">{{ user.fullName || 'OTT Viewer' }}</span>
                      <span class="user-id">ID #{{ user.id }}</span>
                    </div>
                  </div>
                </td>

                <td>
                  <div class="mobile-cell">
                    <span class="mobile-text">{{ user.phoneNumber || '—' }}</span>
                    <span class="verified-chip" *ngIf="user.phoneVerified">
                      <mat-icon>verified</mat-icon> Verified
                    </span>
                  </div>
                </td>

                <td>
                  <span class="email-text" [class.muted]="!user.email">{{ user.email || 'Not provided' }}</span>
                </td>

                <td>
                  <div class="plan-cell">
                    <span class="plan-badge" [class.paid]="isPaid(user)" [class.free]="!isPaid(user)">
                      <mat-icon *ngIf="isPaid(user)">workspace_premium</mat-icon>
                      {{ user.subscriptionTier || 'Free' }}
                    </span>
                    <span class="plan-sub" *ngIf="isPaid(user) && user.subscriptionExpiryDate">
                      Ends {{ user.subscriptionExpiryDate | date:'MMM d, y' }}
                    </span>
                    <span class="plan-sub" *ngIf="(user.rentalsCount || 0) > 0">
                      {{ user.rentalsCount }} TVOD Rental(s)
                    </span>
                  </div>
                </td>

                <td>
                  <div class="meta-cell">
                    <span class="device-pill"><mat-icon>devices</mat-icon> {{ user.activeDevicesCount ?? 0 }} active</span>
                    <span class="joined-text" *ngIf="user.createdAt">{{ user.createdAt | date:'MMM d, y' }}</span>
                  </div>
                </td>

                <td>
                  <app-status-badge [status]="user.status"></app-status-badge>
                </td>

                <td style="text-align: right;" (click)="$event.stopPropagation()">
                  <div class="action-buttons">
                    <button mat-icon-button class="btn-view" (click)="openDetailModal(user)" matTooltip="View Full Details & Manage">
                      <mat-icon>visibility</mat-icon>
                    </button>
                    <button mat-icon-button class="btn-edit" (click)="openEditModal(user)" matTooltip="Edit User Details">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      [class.btn-warn]="!isSuspended(user)"
                      [class.btn-ok]="isSuspended(user)"
                      (click)="onToggleStatus(user)"
                      [matTooltip]="isSuspended(user) ? 'Activate User' : 'Suspend User'">
                      <mat-icon>{{ isSuspended(user) ? 'check_circle' : 'block' }}</mat-icon>
                    </button>
                    <button mat-icon-button class="btn-del" (click)="onDeleteUser(user)" matTooltip="Remove User">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </td>
              </tr>

              <tr *ngIf="!loading && filteredUsers.length === 0">
                <td colspan="7" class="empty-state">
                  <mat-icon>person_search</mat-icon>
                  <p>No registered users found matching the current filter.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 5. FULL USER DETAILS & MANAGEMENT MODAL -->
      <div *ngIf="showDetailModal && selectedUser" class="modal-backdrop" (click)="closeDetailModal()">
        <div class="modal-card detail-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="detail-hero">
              <div class="avatar-badge large" [style.background]="getAvatarColor(selectedUser.fullName)">
                {{ getInitials(selectedUser.fullName) }}
              </div>
              <div>
                <h2>{{ selectedUser.fullName || 'OTT Viewer' }}</h2>
                <div class="detail-sub">
                  <span>User #{{ selectedUser.id }}</span>
                  <span>•</span>
                  <app-status-badge [status]="selectedUser.status"></app-status-badge>
                </div>
              </div>
            </div>
            <button mat-icon-button (click)="closeDetailModal()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="modal-body">
            <div class="detail-section">
              <div class="section-top">
                <h3><mat-icon>badge</mat-icon> Account Profile</h3>
                <button type="button" class="btn-inline" (click)="openEditFromDetail()">
                  <mat-icon>edit</mat-icon> Edit Details
                </button>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">First Name</span>
                  <span class="info-val">{{ selectedUser.firstName || getFirstName(selectedUser.fullName) || '—' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Last Name</span>
                  <span class="info-val">{{ selectedUser.lastName || getLastName(selectedUser.fullName) || '—' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Mobile Number</span>
                  <span class="info-val">
                    {{ selectedUser.phoneNumber || '—' }}
                    <span class="mini-verified" *ngIf="selectedUser.phoneVerified">OTP Verified</span>
                  </span>
                </div>
                <div class="info-item">
                  <span class="info-label">Email (Optional)</span>
                  <span class="info-val">{{ selectedUser.email || 'Not provided' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Joined On</span>
                  <span class="info-val">{{ selectedUser.createdAt ? (selectedUser.createdAt | date:'medium') : '—' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Last Active</span>
                  <span class="info-val">{{ selectedUser.lastLoginAt ? (selectedUser.lastLoginAt | date:'medium') : 'Never' }}</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <div class="section-top">
                <h3><mat-icon>workspace_premium</mat-icon> Subscription &amp; Rentals</h3>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">Current Plan</span>
                  <span class="info-val">{{ selectedUser.subscriptionTier || 'Free (AVOD)' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Plan Status</span>
                  <span class="info-val">{{ selectedUser.subscriptionStatus || 'None' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">Valid Until</span>
                  <span class="info-val">{{ selectedUser.subscriptionExpiryDate ? (selectedUser.subscriptionExpiryDate | date:'MMM d, y') : '—' }}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">TVOD Rentals</span>
                  <span class="info-val">{{ selectedUser.rentalsCount ?? 0 }} title(s)</span>
                </div>
              </div>
            </div>

            <div class="detail-section">
              <div class="section-top">
                <h3><mat-icon>devices</mat-icon> Active Devices ({{ selectedUser.activeDevicesCount ?? 0 }})</h3>
                <button
                  type="button"
                  class="btn-inline danger"
                  *ngIf="(selectedUser.activeDevicesCount ?? 0) > 0"
                  (click)="onRevokeDevices(selectedUser)">
                  <mat-icon>phonelink_erase</mat-icon> Revoke All Sessions
                </button>
              </div>
              <div class="device-list" *ngIf="selectedUser.devices && selectedUser.devices.length > 0; else noDevices">
                <div class="device-item" *ngFor="let d of selectedUser.devices">
                  <mat-icon>devices_other</mat-icon>
                  <div>
                    <div class="dev-name">{{ d.deviceName || d.deviceId }}</div>
                    <div class="dev-meta">{{ d.platform || 'WEB' }} • Last active {{ d.lastSeen || 'Recently' }}</div>
                  </div>
                </div>
              </div>
              <ng-template #noDevices>
                <p class="muted-note">No active device sessions.</p>
              </ng-template>
            </div>

            <div class="detail-section" style="margin-top:16px;">
              <div class="section-top">
                <h3><mat-icon>receipt_long</mat-icon> Customer 360: Payments & Transactions</h3>
                <button type="button" class="btn-inline" (click)="loadUserPayments(selectedUser!)" [disabled]="loadingUserPayments">
                  <mat-icon>refresh</mat-icon> {{ loadingUserPayments ? 'Loading...' : 'Refresh' }}
                </button>
              </div>
              <div style="font-size:12px;color:#8e8ea0;margin-bottom:8px;">
                Recent transactions matched by {{ selectedUser.email || selectedUser.phoneNumber || ('ID ' + selectedUser.id) }} (support/debug view)
              </div>
              <div *ngIf="loadingUserPayments" style="font-size:12px;color:#a0a0b0;">Loading payment history...</div>
              <div *ngIf="!loadingUserPayments && selectedUserPayments.length === 0" style="font-size:12px;color:#8e8ea0;background:#101018;border:1px solid #202030;border-radius:8px;padding:10px;">
                No matching payment transactions found for this user in recent records.
              </div>
              <div *ngIf="!loadingUserPayments && selectedUserPayments.length > 0" style="overflow:auto;background:#101018;border:1px solid #202030;border-radius:8px;">
                <table style="width:100%;border-collapse:collapse;font-size:12px;">
                  <thead>
                    <tr>
                      <th style="text-align:left;padding:8px;color:#a0a0b0;border-bottom:1px solid #202030;">Ref</th>
                      <th style="text-align:left;padding:8px;color:#a0a0b0;border-bottom:1px solid #202030;">Type</th>
                      <th style="text-align:left;padding:8px;color:#a0a0b0;border-bottom:1px solid #202030;">Amount</th>
                      <th style="text-align:left;padding:8px;color:#a0a0b0;border-bottom:1px solid #202030;">Status</th>
                      <th style="text-align:left;padding:8px;color:#a0a0b0;border-bottom:1px solid #202030;">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let p of selectedUserPayments">
                      <td style="padding:8px;border-bottom:1px solid #1b1b28;color:#00d2ff;font-family:monospace;">{{ p.transactionId || p.transaction_id || p.providerPaymentId || p.id }}</td>
                      <td style="padding:8px;border-bottom:1px solid #1b1b28;">{{ p.orderType || p.order_type || (p.contentId ? 'TVOD' : 'SUBSCRIPTION') }}</td>
                      <td style="padding:8px;border-bottom:1px solid #1b1b28;font-weight:700;color:#00e676;">₹{{ (p.amount || 0) | number:'1.0-2' }} {{ p.currency || 'INR' }}</td>
                      <td style="padding:8px;border-bottom:1px solid #1b1b28;">
                        <span [style.color]="(p.status||'').toUpperCase()==='SUCCESS' || (p.status||'').toUpperCase()==='ACTIVE' ? '#00e676' : ((p.status||'').toUpperCase()==='FAILED' ? '#ff8a80' : '#ffab00')">{{ p.status || '-' }}</span>
                        <div *ngIf="p.failureReason || p.failure_reason || p.errorDescription || p.error_description" style="font-size:11px;color:#ff8a80;margin-top:2px;">{{ p.failureReason || p.failure_reason || p.errorDescription || p.error_description }}</div>
                      </td>
                      <td style="padding:8px;border-bottom:1px solid #1b1b28;color:#cfd3dc;">{{ (p.createdAt || p.created_at || p.purchasedAt || p.purchased_at) | date:'medium' }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="detail-section" style="margin-top:16px;">
              <div class="section-top">
                <h3><mat-icon>support_agent</mat-icon> Support Notes & Action Log (Local)</h3>
              </div>
              <div style="font-size:12px;color:#8e8ea0;margin-bottom:8px;">
                Add internal support notes for this user (stored locally in this browser for now; additive, non-disruptive).
              </div>
              <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;">
                <textarea [(ngModel)]="newSupportNote" [ngModelOptions]="{standalone: true}" rows="2" placeholder="Add support note (e.g. called user, refund requested, entitlement issue, device reset advised)..."
                  style="flex:1;background:#101018;border:1px solid #28283c;border-radius:8px;color:#fff;padding:10px;font-size:12px;resize:vertical;"></textarea>
                <button type="button" class="btn-inline" (click)="addSupportNote()" [disabled]="!(newSupportNote && newSupportNote.trim())">
                  <mat-icon>note_add</mat-icon> Add
                </button>
              </div>
              <div *ngIf="supportNotes.length === 0" style="font-size:12px;color:#8e8ea0;background:#101018;border:1px solid #202030;border-radius:8px;padding:10px;">
                No support notes yet for this user.
              </div>
              <div *ngIf="supportNotes.length > 0" style="display:flex;flex-direction:column;gap:8px;">
                <div *ngFor="let n of supportNotes" style="background:#101018;border:1px solid #202030;border-radius:8px;padding:10px;">
                  <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:4px;">
                    <div style="font-size:11px;color:#8e8ea0;">{{ n.author }} • {{ n.createdAt | date:'medium' }}</div>
                    <button type="button" (click)="removeSupportNote(n.id)" style="background:transparent;border:none;color:#ff8a80;cursor:pointer;font-size:11px;">Remove</button>
                  </div>
                  <div style="font-size:13px;color:#fff;white-space:pre-wrap;">{{ n.text }}</div>
                </div>
              </div>
            </div>

            <div class="detail-section" style="margin-top:16px;">
              <div class="section-top">
                <h3><mat-icon>badge</mat-icon> Support / Entitlement Quick Actions</h3>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <button type="button" class="btn-inline" (click)="copySupportValue(selectedUser.id)"><mat-icon>content_copy</mat-icon> Copy User ID</button>
                <button type="button" class="btn-inline" (click)="copySupportValue(selectedUser.email)" [disabled]="!selectedUser.email"><mat-icon>content_copy</mat-icon> Copy Email</button>
                <button type="button" class="btn-inline" (click)="copySupportValue(selectedUser.phoneNumber)" [disabled]="!selectedUser.phoneNumber"><mat-icon>content_copy</mat-icon> Copy Phone</button>
                <button type="button" class="btn-inline" (click)="openEditFromDetail()"><mat-icon>edit</mat-icon> Edit Account</button>
                <button type="button" class="btn-inline" (click)="onRevokeDevices(selectedUser)"><mat-icon>devices</mat-icon> Revoke Devices</button>
                <button type="button" class="btn-inline" (click)="onResetPassword(selectedUser)"><mat-icon>lock_reset</mat-icon> Reset Password</button>
                <button type="button" class="btn-inline" (click)="onToggleStatus(selectedUser)"><mat-icon>{{ isSuspended(selectedUser) ? 'check_circle' : 'block' }}</mat-icon> {{ isSuspended(selectedUser) ? 'Activate' : 'Suspend' }}</button>
              </div>
              <div style="margin-top:10px;font-size:12px;color:#8e8ea0;line-height:1.5;">
                Entitlement snapshot: Plan <strong style="color:#fff;">{{ selectedUser.subscriptionTier || 'Free' }}</strong> • Status <strong style="color:#fff;">{{ selectedUser.subscriptionStatus || selectedUser.status || '—' }}</strong> • Expires <strong style="color:#fff;">{{ selectedUser.subscriptionExpiryDate ? (selectedUser.subscriptionExpiryDate | date:'mediumDate') : '—' }}</strong> • Devices <strong style="color:#fff;">{{ selectedUser.activeDevicesCount ?? 0 }}</strong> • TVOD rentals <strong style="color:#fff;">{{ selectedUser.rentalsCount ?? 0 }}</strong>
              </div>
            </div>
          </div>

          <div class="modal-footer detail-footer">
            <button
              type="button"
              mat-stroked-button
              [class.btn-suspend]="!isSuspended(selectedUser)"
              [class.btn-activate]="isSuspended(selectedUser)"
              (click)="onToggleStatus(selectedUser)">
              <mat-icon>{{ isSuspended(selectedUser) ? 'check_circle' : 'block' }}</mat-icon>
              {{ isSuspended(selectedUser) ? 'Activate User' : 'Suspend User' }}
            </button>
            <button type="button" mat-stroked-button class="btn-delete-footer" (click)="onDeleteUser(selectedUser)">
              <mat-icon>delete</mat-icon> Remove User
            </button>
          </div>
        </div>
      </div>

      <!-- 6. ADD / EDIT USER MODAL -->
      <div *ngIf="showFormModal" class="modal-backdrop" (click)="closeFormModal()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ isEdit ? 'Edit User Details' : 'Add New User' }}</h2>
            <button mat-icon-button (click)="closeFormModal()"><mat-icon>close</mat-icon></button>
          </div>

          <form [formGroup]="userForm" (ngSubmit)="onSaveUser()" class="modal-body">
            <div class="form-row-2">
              <mat-form-field appearance="outline">
                <mat-label>First Name *</mat-label>
                <input matInput formControlName="firstName" placeholder="e.g. Rahul" required>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Last Name *</mat-label>
                <input matInput formControlName="lastName" placeholder="e.g. Sharma" required>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Mobile Number *</mat-label>
              <input matInput formControlName="phoneNumber" placeholder="+919876543210" required>
              <mat-icon matSuffix>smartphone</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email Address (Optional)</mat-label>
              <input matInput type="email" formControlName="email" placeholder="name@example.com">
              <mat-icon matSuffix>mail_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="isEdit">
              <mat-label>Account Status</mat-label>
              <mat-select formControlName="status">
                <mat-option value="ACTIVE">Active</mat-option>
                <mat-option value="SUSPENDED">Suspended</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="modal-footer">
              <button type="button" mat-stroked-button (click)="closeFormModal()">Cancel</button>
              <button type="submit" mat-raised-button class="add-btn" [disabled]="userForm.invalid || saving">
                <mat-icon>save</mat-icon> {{ saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Create User') }}
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
        background: linear-gradient(135deg, #e50914 0%, #f43f5e 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 4px 16px rgba(229, 9, 20, 0.35);
      }
    }

    /* KPI CARDS (Exact /admin/producers style) */
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
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover { border-color: #3a3a54; }
      &.selected { border-color: #e50914; box-shadow: 0 0 0 1px rgba(229, 9, 20, 0.3); }

      .kpi-icon {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: #1c1c2b;
        display: flex;
        align-items: center;
        justify-content: center;
        mat-icon { font-size: 24px; width: 24px; height: 24px; }
      }

      .kpi-label { font-size: 12px; color: #a0a0b0; display: block; margin-bottom: 2px; }
      .kpi-val { font-size: 18px; font-weight: 700; color: #ffffff; }

      &.green .kpi-icon { color: #00e676; background: rgba(0, 230, 118, 0.12); }
      &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
    }

    /* FILTER BAR (Exact /admin/producers style) */
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
          box-sizing: border-box;
          background: #161624;
          border: 1px solid #28283c;
          border-radius: 10px;
          color: #ffffff;
          padding: 10px 14px 10px 38px;
          font-size: 13px;
          outline: none;
          &:focus { border-color: #e50914; }
        }
      }

      .filter-right {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .plan-pills {
        display: inline-flex;
        gap: 6px;
      }

      .plan-pill {
        background: #161624;
        border: 1px solid #28283c;
        color: #a0a0b0;
        border-radius: 999px;
        padding: 7px 14px;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        &:hover { color: #ffffff; }
        &.active { background: #e50914; border-color: #e50914; color: #ffffff; }
      }

      .toggle-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #161624;
        border: 1px solid #28283c;
        border-radius: 10px;
        padding: 8px 14px;
        font-size: 12px;
        font-weight: 600;
        color: #a0a0b0;
        cursor: pointer;
        user-select: none;
        input { display: none; }
        mat-icon { font-size: 17px; width: 17px; height: 17px; }
        &.active {
          border-color: #ffab00;
          color: #ffab00;
          background: rgba(255, 171, 0, 0.1);
        }
      }
    }

    /* TABLE CARD (Exact /admin/producers style) */
    .table-card {
      background: rgba(22, 22, 34, 0.85);
      border: 1px solid #28283c;
      border-radius: 16px;
      overflow: hidden;

      .table-title-row {
        padding: 18px 22px;
        border-bottom: 1px solid #28283c;
        h3 { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #ffffff; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }
    }

    .table-responsive { overflow-x: auto; }
    .custom-table {
      width: 100%;
      border-collapse: collapse;
      th {
        text-align: left;
        padding: 14px 18px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #8b8fa3;
        border-bottom: 1px solid #28283c;
      }
      td {
        padding: 14px 18px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        vertical-align: middle;
      }
      .clickable-row {
        cursor: pointer;
        transition: background 0.15s;
        &:hover { background: rgba(255, 255, 255, 0.03); }
      }
      .row-deactivated { opacity: 0.65; }
    }

    .user-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-badge {
      width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; color: #ffffff; flex-shrink: 0;
      &.large { width: 52px; height: 52px; font-size: 18px; }
    }
    .user-name { display: block; font-size: 14px; font-weight: 700; color: #ffffff; }
    .user-id { display: block; font-size: 11px; color: #8b8fa3; margin-top: 2px; }

    .mobile-cell { display: flex; flex-direction: column; gap: 3px; }
    .mobile-text { font-size: 13px; font-weight: 600; color: #e2e8f0; }
    .verified-chip {
      display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #00e676; font-weight: 600;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    .email-text { font-size: 13px; color: #cbd5e1; &.muted { color: #64748b; font-style: italic; } }

    .plan-cell { display: flex; flex-direction: column; gap: 3px; align-items: flex-start; }
    .plan-badge {
      display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 8px;
      font-size: 11px; font-weight: 700;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.paid { background: rgba(255, 171, 0, 0.16); color: #ffab00; }
      &.free { background: rgba(148, 163, 184, 0.14); color: #cbd5e1; }
    }
    .plan-sub { font-size: 11px; color: #8b8fa3; }

    .meta-cell { display: flex; flex-direction: column; gap: 3px; }
    .device-pill {
      display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: #00d2ff; font-weight: 600;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .joined-text { font-size: 11px; color: #8b8fa3; }

    .action-buttons {
      display: inline-flex; align-items: center; gap: 2px;
      .btn-view { color: #00d2ff; }
      .btn-edit { color: #a78bfa; }
      .btn-warn { color: #ffab00; }
      .btn-ok { color: #00e676; }
      .btn-del { color: #ff5252; }
    }

    .empty-state {
      text-align: center; padding: 48px 20px; color: #8b8fa3;
      mat-icon { font-size: 38px; width: 38px; height: 38px; margin-bottom: 8px; }
      p { margin: 0; font-size: 14px; }
    }

    /* MODALS */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;
    }
    .modal-card {
      background: #161624; border: 1px solid #28283c; border-radius: 16px; width: 100%; max-width: 520px;
      max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
      &.detail-card { max-width: 680px; }
    }
    .modal-header {
      display: flex; justify-content: space-between; align-items: center; padding: 18px 22px;
      border-bottom: 1px solid #28283c;
      h2 { margin: 0; font-size: 18px; font-weight: 800; color: #ffffff; }
    }
    .detail-hero {
      display: flex; align-items: center; gap: 14px;
      .detail-sub { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #a0a0b0; margin-top: 4px; }
    }
    .modal-body { padding: 20px 22px; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; border-top: 1px solid #28283c;
      &.detail-footer { justify-content: space-between; }
    }

    .detail-section {
      background: #10101b; border: 1px solid #242438; border-radius: 12px; padding: 16px; margin-bottom: 14px;
      .section-top {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;
        h3 {
          margin: 0; font-size: 13px; font-weight: 800; color: #e2e8f0; display: inline-flex; align-items: center; gap: 6px;
          mat-icon { font-size: 17px; width: 17px; height: 17px; color: #00d2ff; }
        }
      }
    }
    .btn-inline {
      display: inline-flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, 0.06);
      border: 1px solid #2e2e46; color: #e2e8f0; border-radius: 8px; padding: 5px 10px; font-size: 11px; font-weight: 700; cursor: pointer;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &:hover { background: rgba(255, 255, 255, 0.12); }
      &.danger { color: #fca5a5; border-color: rgba(239, 68, 68, 0.35); background: rgba(239, 68, 68, 0.1); }
    }
    .info-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .info-item {
      .info-label { display: block; font-size: 11px; color: #8b8fa3; font-weight: 600; }
      .info-val { display: block; font-size: 13px; color: #f1f5f9; font-weight: 600; margin-top: 2px; }
      .mini-verified {
        margin-left: 6px; padding: 2px 6px; border-radius: 6px; font-size: 10px;
        background: rgba(0, 230, 118, 0.14); color: #00e676;
      }
    }
    .device-list { display: flex; flex-direction: column; gap: 8px; }
    .device-item {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; background: #181828;
      mat-icon { color: #00d2ff; }
      .dev-name { font-size: 13px; font-weight: 700; color: #ffffff; }
      .dev-meta { font-size: 11px; color: #a0a0b0; }
    }
    .muted-note { margin: 0; font-size: 12px; color: #8b8fa3; }

    .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .full-width { width: 100%; }
    .btn-suspend { color: #ffab00 !important; border-color: rgba(255, 171, 0, 0.4) !important; }
    .btn-activate { color: #00e676 !important; border-color: rgba(0, 230, 118, 0.4) !important; }
    .btn-delete-footer { color: #ff5252 !important; border-color: rgba(255, 82, 82, 0.4) !important; }
  `]
})
export class UserListPage implements OnInit {
  private readonly userApi = inject(UserApiService);
  private readonly notification = inject(NotificationService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  users: UserAccount[] = [];
  filteredUsers: UserAccount[] = [];
  loading = false;
  saving = false;

  selectedPlan = 'ALL';
  showSuspended = false;
  searchQuery = '';

  showDetailModal = false;
  selectedUser: UserAccount | null = null;
  selectedUserPayments: any[] = [];
  loadingUserPayments = false;
  supportNotes: SupportNote[] = [];
  newSupportNote = '';

  showFormModal = false;
  isEdit = false;
  editingUserId: number | string | null = null;

  userForm = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required]],
    phoneNumber: ['', [Validators.required]],
    email: [''],
    status: ['ACTIVE']
  });

  get activeCount(): number {
    return this.users.filter(u => !this.isSuspended(u)).length;
  }

  get paidCount(): number {
    return this.users.filter(u => this.isPaid(u)).length;
  }

  get suspendedCount(): number {
    return this.users.filter(u => this.isSuspended(u)).length;
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.userApi.getUsers(0, 100, '', 'USER').subscribe({
      next: (res) => {
        this.loading = false;
        const rows = res?.data?.content || [];
        this.users = rows.filter(u => {
          const roles = (u.roles || []).map(r => r.toUpperCase());
          return !roles.some(r => r.includes('ADMIN') || r.includes('PRODUCER') || r.includes('STAFF'));
        });
        this.applyFilters();
        if (this.selectedUser?.id) {
          this.selectedUser = this.users.find(u => u.id === this.selectedUser?.id) || null;
        }
      },
      error: () => {
        this.loading = false;
        this.notification.error('Failed to load registered users.');
      }
    });
  }

  isSuspended(user: UserAccount): boolean {
    const st = (user.status || '').toUpperCase();
    return st === 'SUSPENDED' || st === 'BLOCKED' || st === 'INACTIVE';
  }

  isPaid(user: UserAccount): boolean {
    const tier = (user.subscriptionTier || '').trim().toLowerCase();
    return Boolean(tier && tier !== 'free' && tier !== 'free tier' && user.subscriptionStatus === 'ACTIVE');
  }

  setPlanFilter(plan: string): void {
    this.selectedPlan = plan;
    this.applyFilters();
  }

  toggleShowSuspended(): void {
    this.showSuspended = !this.showSuspended;
    this.applyFilters();
  }

  applyFilters(): void {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredUsers = this.users.filter(u => {
      if (!this.showSuspended && this.isSuspended(u)) return false;
      if (this.selectedPlan === 'PAID' && !this.isPaid(u)) return false;
      if (this.selectedPlan === 'FREE' && this.isPaid(u)) return false;
      if (q) {
        const hay = `${u.fullName || ''} ${u.phoneNumber || ''} ${u.email || ''} ${u.id || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  openDetailModal(user: UserAccount): void {
    this.selectedUser = user;
    this.showDetailModal = true;
    this.selectedUserPayments = [];
    this.newSupportNote = '';
    this.loadSupportNotes(user);
    this.loadUserPayments(user);
    if (user.id) {
      this.userApi.getUserById(user.id).subscribe({
        next: (res) => {
          if (res?.data) {
            this.selectedUser = res.data;
            this.loadSupportNotes(res.data);
          }
        },
        error: () => {}
      });
    }
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedUser = null;
    this.selectedUserPayments = [];
    this.supportNotes = [];
    this.newSupportNote = '';
  }

  private supportNotesKey(user: UserAccount | null): string | null {
    if (!user?.id && !user?.uuid) return null;
    return `maxx_user_support_notes_${user.id ?? user.uuid}`;
  }

  loadSupportNotes(user: UserAccount): void {
    this.supportNotes = [];
    const key = this.supportNotesKey(user);
    if (!key || typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.supportNotes = parsed;
      }
    } catch {}
  }

  saveSupportNotes(): void {
    const key = this.supportNotesKey(this.selectedUser);
    if (!key || typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(this.supportNotes.slice(-100)));
    } catch {}
  }

  addSupportNote(): void {
    const text = (this.newSupportNote || '').trim();
    if (!text || !this.selectedUser) return;
    this.supportNotes.unshift({
      id: Date.now(),
      text,
      author: 'Admin Support',
      createdAt: new Date().toISOString(),
    });
    this.newSupportNote = '';
    this.saveSupportNotes();
  }

  removeSupportNote(noteId: number): void {
    this.supportNotes = this.supportNotes.filter(n => n.id !== noteId);
    this.saveSupportNotes();
  }

  loadUserPayments(user: UserAccount): void {
    const search = encodeURIComponent((user.email || user.phoneNumber || String(user.id || '')).trim());
    if (!search) {
      this.selectedUserPayments = [];
      return;
    }
    this.loadingUserPayments = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/payments?page=0&size=10&search=${search}`).subscribe({
      next: (res) => {
        this.loadingUserPayments = false;
        const data = res?.data || {};
        const rows = data.content || data.items || (Array.isArray(data) ? data : []);
        this.selectedUserPayments = Array.isArray(rows) ? rows : [];
      },
      error: () => {
        this.loadingUserPayments = false;
        this.selectedUserPayments = [];
      }
    });
  }

  copySupportValue(value?: string | number | null): void {
    const text = String(value ?? '').trim();
    if (!text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => this.notification.success('Copied to clipboard')).catch(() => {});
    }
  }

  openCreateModal(): void {
    this.isEdit = false;
    this.editingUserId = null;
    this.userForm.reset({ firstName: '', lastName: '', phoneNumber: '+91', email: '', status: 'ACTIVE' });
    this.showFormModal = true;
  }

  openEditModal(user: UserAccount): void {
    this.isEdit = true;
    this.editingUserId = user.id ?? null;
    this.userForm.patchValue({
      firstName: user.firstName || this.getFirstName(user.fullName),
      lastName: user.lastName || this.getLastName(user.fullName),
      phoneNumber: user.phoneNumber || '',
      email: user.email || '',
      status: user.status || 'ACTIVE'
    });
    this.showFormModal = true;
  }

  openEditFromDetail(): void {
    if (!this.selectedUser) return;
    const u = this.selectedUser;
    this.showDetailModal = false;
    this.openEditModal(u);
  }

  closeFormModal(): void {
    this.showFormModal = false;
  }

  onSaveUser(): void {
    if (this.userForm.invalid) return;
    this.saving = true;
    const v = this.userForm.value;
    const payload: Partial<UserAccount> = {
      firstName: (v.firstName || '').trim(),
      lastName: (v.lastName || '').trim(),
      fullName: `${(v.firstName || '').trim()} ${(v.lastName || '').trim()}`.trim(),
      phoneNumber: (v.phoneNumber || '').trim(),
      email: (v.email || '').trim(),
      status: v.status || 'ACTIVE'
    };

    const req$ = this.isEdit && this.editingUserId
      ? this.userApi.updateUser(this.editingUserId, payload)
      : this.userApi.createUser(payload);

    req$.subscribe({
      next: () => {
        this.saving = false;
        this.showFormModal = false;
        this.notification.success(this.isEdit ? 'User details updated!' : 'New user added!');
        this.loadUsers();
      },
      error: (err) => {
        this.saving = false;
        this.notification.error(err?.error?.message || 'Failed to save user.');
      }
    });
  }

  async onToggleStatus(user: UserAccount): Promise<void> {
    if (!user.id) return;
    const action = this.isSuspended(user) ? 'Activate' : 'Suspend';
    const ok = await this.notification.confirm(
      `${action} User?`,
      `${action} ${user.fullName || user.phoneNumber}?`,
      `Yes, ${action}`
    );
    if (!ok) return;

    this.userApi.toggleStatus(user.id).subscribe({
      next: () => {
        this.notification.success(`User ${action.toLowerCase()}d successfully.`);
        this.loadUsers();
      },
      error: () => this.notification.error(`Failed to ${action.toLowerCase()} user.`)
    });
  }

  async onRevokeDevices(user: UserAccount): Promise<void> {
    if (!user.id) return;
    const ok = await this.notification.confirm(
      'Revoke All Devices?',
      `Sign out ${user.fullName || user.phoneNumber} from all active devices?`,
      'Yes, Revoke All'
    );
    if (!ok) return;

    this.userApi.revokeDevices(user.id).subscribe({
      next: () => {
        this.notification.success('All active device sessions revoked.');
        this.loadUsers();
        this.loadUserPayments(user);
      },
      error: () => this.notification.error('Failed to revoke devices.')
    });
  }

  async onResetPassword(user: UserAccount): Promise<void> {
    if (!user.id) return;
    const ok = await this.notification.confirm(
      'Reset Password?',
      `Set a temporary password for ${user.fullName || user.phoneNumber || ('User #' + user.id)}? The user should change it after login.`,
      'Continue'
    );
    if (!ok) return;

    const tempPassword = (typeof window !== 'undefined')
      ? (window.prompt('Enter temporary password (leave blank to let backend generate/default behavior if supported):', '') || '').trim()
      : '';

    this.userApi.resetPassword(user.id, tempPassword || undefined).subscribe({
      next: (res) => {
        const msg = res?.data || 'Password reset request completed.';
        this.notification.success(typeof msg === 'string' ? msg : 'Password reset completed.');
        if (tempPassword) {
          this.addSupportNoteDirect(`Temporary password reset performed by admin support. (Password set manually; share securely with user.)`);
        } else {
          this.addSupportNoteDirect('Password reset initiated by admin support.');
        }
      },
      error: (err) => this.notification.error(err?.error?.message || 'Failed to reset password.')
    });
  }

  private addSupportNoteDirect(text: string): void {
    if (!this.selectedUser) return;
    this.supportNotes.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      text,
      author: 'Admin Support',
      createdAt: new Date().toISOString(),
    });
    this.saveSupportNotes();
  }

  async onDeleteUser(user: UserAccount): Promise<void> {
    if (!user.id) return;
    const ok = await this.notification.confirm(
      'Remove User Account?',
      `Deactivate ${user.fullName || user.phoneNumber}? Their sessions will be revoked and the account will be soft-deleted.`,
      'Yes, Remove'
    );
    if (!ok) return;

    this.userApi.deleteUser(user.id).subscribe({
      next: () => {
        this.notification.success('User account removed.');
        this.closeDetailModal();
        this.loadUsers();
      },
      error: () => this.notification.error('Failed to remove user.')
    });
  }

  getFirstName(fullName?: string): string {
    return (fullName || '').trim().split(/\s+/)[0] || '';
  }

  getLastName(fullName?: string): string {
    return (fullName || '').trim().split(/\s+/).slice(1).join(' ');
  }

  getInitials(name?: string): string {
    const parts = (name || 'U').trim().split(/\s+/);
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || 'U';
  }

  getAvatarColor(name?: string): string {
    const palette = ['#e50914', '#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777'];
    let hash = 0;
    const s = name || 'U';
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }
}
