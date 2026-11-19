import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface PermissionMatrixRow {
  permissionCode: string;
  category: string; // CONTENT, USER, FINANCIAL, SYSTEM
  description: string;
  superAdmin: boolean;
  admin: boolean;
  contentManager: boolean;
  producer: boolean;
  finance: boolean;
  analyst: boolean;
}

export interface RoleDto {
  id: number;
  code: string;
  name: string;
  description: string;
  userCount: number;
  systemRole: boolean;
}

export interface SecuritySettings {
  jwtExpirationHours: number;
  refreshTokenExpirationDays: number;
  enforceMfaAdmin: boolean;
  enforceMfaProducer: boolean;
  maxFailedLoginAttempts: number;
  allowedIpCidrBlocks: string;
}

@Component({
  selector: 'app-roles-permissions-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatCheckboxModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
    PermissionButtonComponent
  ],
  template: `
    <div class="page-container">
      <!-- 1. EXECUTIVE HEADER -->
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>security</mat-icon> SYSTEM SECURITY & ACCESS CONTROL</span>
          <h1>RBAC Role Permission Matrix & Security Policies</h1>
          <p>Super Admin control over system roles, granular module permissions, JWT authentication, and MFA enforcement</p>
        </div>
        <div class="header-actions" *ngIf="activeTab === 'MATRIX'">
          <app-permission-button role="SUPER_ADMIN" color="primary" icon="save" (buttonClick)="savePermissions()">
            {{ isSavingMatrix ? 'Saving Matrix...' : 'Save Permission Matrix' }}
          </app-permission-button>
        </div>
        <div class="header-actions" *ngIf="activeTab === 'ROLES'">
          <button mat-raised-button color="primary" class="save-settings-btn" (click)="openNewRoleForm()">
            <mat-icon>add_moderator</mat-icon> Create Custom Role
          </button>
        </div>
        <div class="header-actions" *ngIf="activeTab === 'SETTINGS'">
          <button mat-raised-button color="accent" class="save-settings-btn" (click)="saveSecuritySettings()" [disabled]="isSavingSettings">
            <mat-icon>verified_user</mat-icon> {{ isSavingSettings ? 'Saving...' : 'Save Security Policies' }}
          </button>
        </div>
        <div class="header-actions" *ngIf="activeTab === 'AUDIT'">
          <button mat-raised-button color="primary" class="save-settings-btn" (click)="loadAuditLogs()">
            <mat-icon>refresh</mat-icon> Refresh Audit Log
          </button>
        </div>
      </div>

      <!-- 2. EXECUTIVE KPI SUMMARY CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card green">
          <div class="kpi-icon"><mat-icon>shield</mat-icon></div>
          <div>
            <span class="kpi-label">Active RBAC Roles</span>
            <div class="kpi-val">{{ roles.length }} Roles</div>
          </div>
        </div>

        <div class="kpi-card blue">
          <div class="kpi-icon"><mat-icon>key</mat-icon></div>
          <div>
            <span class="kpi-label">Active Permissions</span>
            <div class="kpi-val">{{ matrix.length }} Module Keys</div>
          </div>
        </div>

        <div class="kpi-card gold">
          <div class="kpi-icon"><mat-icon>people</mat-icon></div>
          <div>
            <span class="kpi-label">Assigned Accounts</span>
            <div class="kpi-val">{{ totalAssignedUsers | number }} Accounts</div>
          </div>
        </div>

        <div class="kpi-card purple">
          <div class="kpi-icon"><mat-icon>lock</mat-icon></div>
          <div>
            <span class="kpi-label">Security Protocol</span>
            <div class="kpi-val font-mono">JWT {{ securityForm.value.jwtExpirationHours || 24 }}h • {{ securityForm.value.enforceMfaAdmin ? 'MFA ON' : 'MFA OFF' }}</div>
          </div>
        </div>
      </div>

      <!-- 3. TAB NAVIGATION -->
      <div class="sec-tabs">
        <button class="tab-btn" [class.active]="activeTab === 'MATRIX'" (click)="activeTab = 'MATRIX'">
          <mat-icon>grid_on</mat-icon> Role Permission Matrix
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'ROLES'" (click)="activeTab = 'ROLES'">
          <mat-icon>badge</mat-icon> System Roles Directory
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'SETTINGS'" (click)="activeTab = 'SETTINGS'">
          <mat-icon>tune</mat-icon> Security & MFA Policies
        </button>
        <button class="tab-btn" [class.active]="activeTab === 'AUDIT'" (click)="activeTab = 'AUDIT'; loadAuditLogs()">
          <mat-icon>history</mat-icon> Security Audit Trail
        </button>
      </div>

      <!-- TAB 1: PERMISSION MATRIX -->
      <div *ngIf="activeTab === 'MATRIX'" class="tab-content">
        <!-- FILTER BAR -->
        <div class="filter-bar">
          <div class="filter-group">
            <span class="filter-label">Module Category:</span>
            <button class="filter-pill" [class.active]="selectedCategory === 'ALL'" (click)="setCategoryFilter('ALL')">All Modules</button>
            <button class="filter-pill" [class.active]="selectedCategory === 'CONTENT'" (click)="setCategoryFilter('CONTENT')">🎬 Content</button>
            <button class="filter-pill" [class.active]="selectedCategory === 'USER'" (click)="setCategoryFilter('USER')">👥 Users & Producers</button>
            <button class="filter-pill" [class.active]="selectedCategory === 'FINANCIAL'" (click)="setCategoryFilter('FINANCIAL')">💰 Financial & Payouts</button>
            <button class="filter-pill" [class.active]="selectedCategory === 'SYSTEM'" (click)="setCategoryFilter('SYSTEM')">⚙️ System Security</button>
          </div>

          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" [(ngModel)]="searchQuery" (input)="filterMatrix()" placeholder="Search permission code or description...">
          </div>
        </div>

        <div class="table-card">
          <div class="table-responsive">
            <table class="custom-table">
            <thead>
              <tr>
                <th style="width: 30%;">Permission Code & Scope</th>
                <th style="text-align: center;">Super Admin</th>
                <th style="text-align: center;">Admin</th>
                <th style="text-align: center;">Content Mgr</th>
                <th style="text-align: center;">Producer</th>
                <th style="text-align: center;">Finance</th>
                <th style="text-align: center;">Analyst</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of filteredMatrix">
                <td>
                  <div class="perm-cell">
                    <div class="code-row">
                      <code class="perm-code">{{ row.permissionCode }}</code>
                      <span class="cat-badge" [ngClass]="row.category.toLowerCase()">{{ row.category }}</span>
                    </div>
                    <span class="perm-desc">{{ row.description }}</span>
                  </div>
                </td>
                <td style="text-align: center;">
                  <mat-checkbox [(ngModel)]="row.superAdmin" [disabled]="true" color="primary"></mat-checkbox>
                </td>
                <td style="text-align: center;">
                  <mat-checkbox [(ngModel)]="row.admin" color="primary"></mat-checkbox>
                </td>
                <td style="text-align: center;">
                  <mat-checkbox [(ngModel)]="row.contentManager" color="primary"></mat-checkbox>
                </td>
                <td style="text-align: center;">
                  <mat-checkbox [(ngModel)]="row.producer" color="primary"></mat-checkbox>
                </td>
                <td style="text-align: center;">
                  <mat-checkbox [(ngModel)]="row.finance" color="primary"></mat-checkbox>
                </td>
                <td style="text-align: center;">
                  <mat-checkbox [(ngModel)]="row.analyst" color="primary"></mat-checkbox>
                </td>
              </tr>
            </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB 2: SYSTEM ROLES DIRECTORY -->
      <div *ngIf="activeTab === 'ROLES'" class="tab-content">
        <!-- INLINE CREATE / EDIT ROLE CARD -->
        <div *ngIf="showRoleForm" class="form-card" style="margin-bottom: 20px;">
          <div class="card-header" style="margin-bottom: 16px;">
            <div class="header-icon-box"><mat-icon>{{ editingRoleId ? 'edit' : 'add_moderator' }}</mat-icon></div>
            <div>
              <h3>{{ editingRoleId ? 'Edit RBAC Role' : 'Create Custom RBAC Role' }}</h3>
              <p>Define a scoped platform role (auto-prefixed with ROLE_)</p>
            </div>
          </div>
          <div class="security-form">
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Role Code (e.g. ROLE_MODERATOR)</mat-label>
                  <input matInput [(ngModel)]="roleFormCode" [disabled]="editingRoleIsSystem" placeholder="ROLE_MODERATOR">
                </mat-form-field>
              </div>
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Role Description</mat-label>
                  <input matInput [(ngModel)]="roleFormDescription" placeholder="Describe permissions and scope">
                </mat-form-field>
              </div>
            </div>
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
              <button mat-button type="button" (click)="cancelRoleForm()">Cancel</button>
              <button mat-raised-button color="primary" type="button" (click)="saveRoleForm()" [disabled]="isSavingRole || !roleFormCode.trim()">
                <mat-icon>save</mat-icon> {{ isSavingRole ? 'Saving...' : (editingRoleId ? 'Update Role' : 'Create Role') }}
              </button>
            </div>
          </div>
        </div>

        <div class="roles-grid">
          <div class="role-card" *ngFor="let role of roles">
            <div>
              <div class="role-header">
                <div class="role-icon-box"><mat-icon>shield</mat-icon></div>
                <div style="flex: 1; min-width: 0;">
                  <h3>{{ role.name }}</h3>
                  <code class="role-code">{{ role.code }}</code>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button mat-icon-button matTooltip="Edit role" (click)="openEditRoleForm(role)">
                    <mat-icon style="font-size: 18px; color: #00d2ff;">edit</mat-icon>
                  </button>
                  <button *ngIf="!role.systemRole" mat-icon-button matTooltip="Delete custom role" (click)="deleteRole(role)">
                    <mat-icon style="font-size: 18px; color: #ef4444;">delete</mat-icon>
                  </button>
                </div>
              </div>
              <p class="role-desc">{{ role.description }}</p>
            </div>
            <div class="role-footer">
              <span class="user-count-badge"><mat-icon>person</mat-icon> {{ role.userCount }} Users Assigned</span>
              <span class="system-badge" *ngIf="role.systemRole">System Protected</span>
              <span class="system-badge" *ngIf="!role.systemRole" style="color: #00d2ff; background: rgba(0,210,255,0.12);">Custom Role</span>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB 3: SECURITY & MFA POLICIES -->
      <div *ngIf="activeTab === 'SETTINGS'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box blue"><mat-icon>tune</mat-icon></div>
            <div>
              <h3>System Authentication & MFA Enforcement Rules</h3>
              <p>Configure JWT token lifetimes, failed login lockouts, and administrative IP CIDR whitelisting</p>
            </div>
          </div>

          <form [formGroup]="securityForm" (ngSubmit)="saveSecuritySettings()" class="security-form">
            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>JWT Access Token Expiration (Hours)</mat-label>
                  <input matInput type="number" formControlName="jwtExpirationHours" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Refresh Token Expiration (Days)</mat-label>
                  <input matInput type="number" formControlName="refreshTokenExpirationDays" required>
                </mat-form-field>
              </div>
            </div>

            <div class="form-row">
              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Max Failed Login Attempts Before Lockout</mat-label>
                  <input matInput type="number" formControlName="maxFailedLoginAttempts" required>
                </mat-form-field>
              </div>

              <div class="half-width">
                <mat-form-field appearance="outline" class="full-width custom-field">
                  <mat-label>Allowed Admin IP CIDR Blocks</mat-label>
                  <input matInput formControlName="allowedIpCidrBlocks" placeholder="10.0.0.0/8, 192.168.1.0/24" required>
                </mat-form-field>
              </div>
            </div>

            <div class="toggles-card">
              <h4>MFA & Two-Factor Enforcement Rules</h4>
              <div class="toggle-row">
                <div>
                  <span class="t-title">Enforce MFA for Administrators & Staff</span>
                  <span class="t-desc">Require OTP authenticator app for ROLE_ADMIN and ROLE_SUPER_ADMIN</span>
                </div>
                <mat-slide-toggle formControlName="enforceMfaAdmin" color="primary"></mat-slide-toggle>
              </div>

              <div class="toggle-row">
                <div>
                  <span class="t-title">Enforce MFA for Content Producers</span>
                  <span class="t-desc">Require OTP authenticator verification on studio payout access</span>
                </div>
                <mat-slide-toggle formControlName="enforceMfaProducer" color="primary"></mat-slide-toggle>
              </div>
            </div>

            <button mat-raised-button class="full-width submit-btn blue-btn" type="submit" [disabled]="securityForm.invalid || isSavingSettings">
              <mat-icon>verified_user</mat-icon> {{ isSavingSettings ? 'Saving Policies...' : 'Save & Apply Security Policy Rules' }}
            </button>
          </form>
        </div>
      </div>

      <!-- TAB 4: SECURITY AUDIT TRAIL -->
      <div *ngIf="activeTab === 'AUDIT'" class="tab-content">
        <div class="form-card">
          <div class="card-header">
            <div class="header-icon-box"><mat-icon>history</mat-icon></div>
            <div>
              <h3>Security, RBAC & Configuration Audit Trail</h3>
              <p>Live record of role mutations, permission matrix saves, security policy updates, and settings changes</p>
            </div>
          </div>

          <div *ngIf="isLoadingAudit" style="text-align: center; padding: 30px; color: #a0a0b0;">
            Loading security audit events...
          </div>

          <div *ngIf="!isLoadingAudit && auditLogs.length === 0" style="text-align: center; padding: 36px; color: #a0a0b0;">
            <mat-icon style="font-size: 36px; width: 36px; height: 36px;">verified_user</mat-icon>
            <p>No security audit events recorded yet. Role, matrix, and policy changes will appear here automatically.</p>
          </div>

          <div *ngIf="!isLoadingAudit && auditLogs.length > 0" style="display: flex; flex-direction: column; gap: 12px;">
            <div *ngFor="let log of auditLogs" style="background: #101018; border: 1px solid #28283a; border-radius: 10px; padding: 14px 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                <span style="font-weight: 800; color: #00d2ff; font-size: 13px;">{{ log.action }}</span>
                <span style="font-size: 12px; color: #a0a0b0;">by <strong style="color: #fff;">{{ log.userEmail }}</strong> • {{ log.createdAt | date:'medium' }}</span>
              </div>
              <div style="font-family: monospace; font-size: 12px; color: #94a3b8;">{{ log.details || log.target }}</div>
            </div>
          </div>
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

      .save-settings-btn {
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
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);

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
      .font-mono { font-family: monospace; font-size: 14px; color: #00d2ff; }

      &.green .kpi-icon { color: #00e676; background: rgba(0, 230, 118, 0.12); }
      &.blue .kpi-icon { color: #00d2ff; background: rgba(0, 210, 255, 0.12); }
      &.gold .kpi-icon { color: #ffab00; background: rgba(255, 171, 0, 0.12); }
      &.purple .kpi-icon { color: #ab47bc; background: rgba(171, 71, 188, 0.12); }
    }

    /* TABS */
    .sec-tabs {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      .tab-btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: #161624;
        border: 1px solid #28283c;
        color: #a0a0b0;
        padding: 10px 18px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;

        &:hover, &.active {
          background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%);
          border-color: transparent;
          color: #ffffff;
          box-shadow: 0 4px 16px rgba(26, 76, 216, 0.35);
        }
        mat-icon { font-size: 18px; width: 18px; height: 18px; }
      }
    }

    /* FILTER BAR */
    .filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 24px;
      flex-wrap: wrap;

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        .filter-label { font-size: 12px; font-weight: 700; color: #a0a0b0; }
        .filter-pill {
          background: #101018;
          border: 1px solid #28283a;
          color: #ffffff;
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          &:hover, &.active {
            background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%);
            border-color: transparent;
            color: #ffffff;
          }
        }
      }

      .search-box {
        position: relative;
        width: 320px;
        .search-icon { position: absolute; left: 10px; top: 8px; color: #a0a0b0; font-size: 18px; width: 18px; height: 18px; }
        input {
          width: 100%;
          background: #101018;
          border: 1px solid #28283a;
          border-radius: 8px;
          color: #ffffff;
          padding: 8px 12px 8px 34px;
          font-size: 13px;
          &:focus { outline: none; border-color: #00d2ff; }
        }
      }
    }

    /* TABLE CARD */
    .table-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      .custom-table {
        width: 100%;
        min-width: 950px;
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

    .perm-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      .code-row {
        display: flex;
        align-items: center;
        gap: 8px;
        .perm-code { font-family: monospace; font-size: 13px; color: #00d2ff; font-weight: 700; }
        .cat-badge {
          font-size: 9px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          background: rgba(26, 76, 216, 0.15);
          color: #00d2ff;
          &.financial { background: rgba(0, 230, 118, 0.15); color: #00e676; }
          &.system { background: rgba(171, 71, 188, 0.15); color: #ab47bc; }
        }
      }
      .perm-desc { font-size: 11px; color: #a0a0b0; }
    }

    /* ROLES GRID */
    .roles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
    }

    .role-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 14px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      .role-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        .role-icon-box {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(26, 76, 216, 0.15);
          color: #00d2ff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        h3 { margin: 0 0 2px; font-size: 16px; font-weight: 800; }
        .role-code { font-family: monospace; font-size: 11px; color: #ffab00; }
      }

      .role-desc { font-size: 12px; color: #a0a0b0; margin: 0 0 16px; line-height: 1.5; }

      .role-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid #202030;
        padding-top: 12px;

        .user-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: #00d2ff;
          mat-icon { font-size: 14px; width: 14px; height: 14px; }
        }

        .system-badge {
          font-size: 10px;
          font-weight: 800;
          color: #00e676;
          background: rgba(0, 230, 118, 0.12);
          padding: 2px 8px;
          border-radius: 4px;
        }
      }
    }

    /* FORM CARD */
    .form-card {
      background: #161624;
      border: 1px solid #28283c;
      border-radius: 16px;
      padding: 28px;
      color: #ffffff;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);

      .card-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 24px;
        .header-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(26,76,216,0.2), rgba(199,37,163,0.2));
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00d2ff;
          &.blue { color: #00e676; }
        }
        h3 { margin: 0 0 2px; font-size: 18px; font-weight: 800; color: #ffffff; }
        p { margin: 0; font-size: 12px; color: #a0a0b0; }
      }
    }

    .security-form {
      .full-width { width: 100%; margin-bottom: 16px; display: block; }
      .form-row { display: flex; gap: 16px; flex-wrap: wrap; }
      .half-width { flex: 1; min-width: 240px; }

      .toggles-card {
        background: #101018;
        border: 1px solid #28283a;
        border-radius: 12px;
        padding: 18px;
        margin: 16px 0 24px;
        h4 { margin: 0 0 14px; font-size: 14px; font-weight: 800; color: #ffffff; }
        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #1c1c2b;
          &:last-child { border-bottom: none; }
          .t-title { font-weight: 700; font-size: 13px; display: block; }
          .t-desc { font-size: 11px; color: #a0a0b0; display: block; }
        }
      }

      .submit-btn {
        height: 50px;
        border-radius: 12px;
        font-weight: 800;
        font-size: 15px;
        background: linear-gradient(135deg, #1a4cd8 0%, #c725a3 100%) !important;
        color: #ffffff !important;
        box-shadow: 0 4px 16px rgba(26, 76, 216, 0.4);
      }
    }
  `]
})
export class RolesPermissionsPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  private readonly notificationService = inject(NotificationService);

  activeTab = 'MATRIX';
  selectedCategory = 'ALL';
  searchQuery = '';
  isSavingMatrix = false;
  isSavingSettings = false;
  isSavingRole = false;
  isLoadingAudit = false;

  showRoleForm = false;
  editingRoleId: number | null = null;
  editingRoleIsSystem = false;
  roleFormCode = '';
  roleFormDescription = '';
  auditLogs: Array<{ id: number; action: string; userEmail: string; details: string; target?: string; createdAt: string }> = [];

  get totalAssignedUsers(): number {
    return this.roles.reduce((sum, r) => sum + (Number(r.userCount) || 0), 0);
  }

  roles: RoleDto[] = [
    { id: 1, code: 'ROLE_SUPER_ADMIN', name: 'Super Administrator', description: 'Full unrestricted root access to all OTT modules and security policies', userCount: 2, systemRole: true },
    { id: 2, code: 'ROLE_ADMIN', name: 'Platform Administrator', description: 'Manages movies, web series, producer approvals, and system users', userCount: 5, systemRole: true },
    { id: 3, code: 'ROLE_CONTENT_MANAGER', name: 'Content Operations Manager', description: 'Manages catalog titles, FFmpeg transcode queues, and Home CMS rails', userCount: 8, systemRole: true },
    { id: 4, code: 'ROLE_PRODUCER', name: 'Studio Content Producer', description: 'Producer portal access to view studio performance, payout details, and analytics', userCount: 14, systemRole: true },
    { id: 5, code: 'ROLE_FINANCE', name: 'Finance & Billing Specialist', description: 'Manages subscription pricing, payment refunds, and revenue share payouts', userCount: 4, systemRole: true },
    { id: 6, code: 'ROLE_ANALYST', name: 'Business Intelligence Analyst', description: 'View-only access to streaming analytics, SSAI ad metrics, and user growth', userCount: 6, systemRole: true }
  ];

  matrix: PermissionMatrixRow[] = [
    { permissionCode: 'CONTENT_VIEW', category: 'CONTENT', description: 'View movie, series, and live streaming catalog', superAdmin: true, admin: true, contentManager: true, producer: true, finance: false, analyst: true },
    { permissionCode: 'CONTENT_CREATE', category: 'CONTENT', description: 'Upload master video files and submit metadata', superAdmin: true, admin: true, contentManager: true, producer: true, finance: false, analyst: false },
    { permissionCode: 'CONTENT_UPDATE', category: 'CONTENT', description: 'Edit title metadata, genres, cast, and posters', superAdmin: true, admin: true, contentManager: true, producer: false, finance: false, analyst: false },
    { permissionCode: 'CONTENT_APPROVE', category: 'CONTENT', description: 'Approve or reject producer submissions & initiate transcode', superAdmin: true, admin: true, contentManager: true, producer: false, finance: false, analyst: false },
    { permissionCode: 'CONTENT_DELETE', category: 'CONTENT', description: 'Completely delete content entries and media assets', superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: false },

    { permissionCode: 'USER_VIEW', category: 'USER', description: 'View user directory and profile metadata', superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: true },
    { permissionCode: 'USER_MANAGE', category: 'USER', description: 'Ban/unban users, edit roles, and reset passwords', superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: false },
    { permissionCode: 'PRODUCER_ONBOARD', category: 'USER', description: 'Onboard producer studio and provision login account', superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: false },

    { permissionCode: 'PAYMENT_VIEW', category: 'FINANCIAL', description: 'View subscription transactions and revenue logs', superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: true },
    { permissionCode: 'PAYMENT_REFUND', category: 'FINANCIAL', description: 'Issue refunds for failed transactions', superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: false },
    { permissionCode: 'PRODUCER_PAYOUT', category: 'FINANCIAL', description: 'Process 70% revenue share bank payouts', superAdmin: true, admin: true, contentManager: false, producer: false, finance: true, analyst: false },

    { permissionCode: 'SYSTEM_SECURITY', category: 'SYSTEM', description: 'Modify security settings, CIDR rules, and MFA policies', superAdmin: true, admin: false, contentManager: false, producer: false, finance: false, analyst: false },
    { permissionCode: 'SYSTEM_AUDIT_LOGS', category: 'SYSTEM', description: 'Inspect immutable security audit logs', superAdmin: true, admin: true, contentManager: false, producer: false, finance: false, analyst: true }
  ];

  filteredMatrix: PermissionMatrixRow[] = [];

  securityForm = this.fb.group({
    jwtExpirationHours: [24, [Validators.required]],
    refreshTokenExpirationDays: [30, [Validators.required]],
    enforceMfaAdmin: [true],
    enforceMfaProducer: [true],
    maxFailedLoginAttempts: [5, [Validators.required]],
    allowedIpCidrBlocks: ['10.0.0.0/8, 192.168.1.0/24', [Validators.required]]
  });

  ngOnInit(): void {
    this.filteredMatrix = [...this.matrix];
    this.loadSecurityData();
  }

  loadSecurityData(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/security/roles`).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.roles = res.data;
        }
      },
      error: (err) => {
        const msg = err?.error?.message || 'Failed to load RBAC roles';
        this.notificationService.error(msg);
      }
    });

    this.http.get<any>(`${environment.apiBaseUrl}/admin/security/matrix`).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          this.matrix = res.data;
          this.filterMatrix();
        }
      }
    });

    this.http.get<any>(`${environment.apiBaseUrl}/admin/security/settings`).subscribe({
      next: (res) => {
        if (res.success && res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
          this.securityForm.patchValue(res.data);
          this.securityForm.markAsPristine();
        }
      }
    });
  }

  loadAuditLogs(): void {
    this.isLoadingAudit = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/security/audit-logs`).subscribe({
      next: (res) => {
        this.isLoadingAudit = false;
        this.auditLogs = Array.isArray(res?.data) ? res.data : [];
      },
      error: () => {
        this.isLoadingAudit = false;
        this.notificationService.error('Failed to load security audit logs.');
      }
    });
  }

  openNewRoleForm(): void {
    this.editingRoleId = null;
    this.editingRoleIsSystem = false;
    this.roleFormCode = '';
    this.roleFormDescription = '';
    this.showRoleForm = true;
  }

  openEditRoleForm(role: RoleDto): void {
    this.editingRoleId = role.id;
    this.editingRoleIsSystem = !!role.systemRole;
    this.roleFormCode = role.code;
    this.roleFormDescription = role.description || '';
    this.showRoleForm = true;
  }

  cancelRoleForm(): void {
    this.showRoleForm = false;
    this.editingRoleId = null;
  }

  saveRoleForm(): void {
    const code = this.roleFormCode.trim();
    if (!code) return;
    this.isSavingRole = true;
    const payload = { code, name: code, description: this.roleFormDescription.trim() };

    const req$ = this.editingRoleId
      ? this.http.put<any>(`${environment.apiBaseUrl}/admin/security/roles/${this.editingRoleId}`, payload)
      : this.http.post<any>(`${environment.apiBaseUrl}/admin/security/roles`, payload);

    req$.subscribe({
      next: () => {
        this.isSavingRole = false;
        this.showRoleForm = false;
        this.notificationService.success(this.editingRoleId ? 'RBAC role updated!' : 'Custom RBAC role created!');
        this.loadSecurityData();
      },
      error: (err) => {
        this.isSavingRole = false;
        this.notificationService.error(err?.error?.message || 'Failed to save role.');
      }
    });
  }

  async deleteRole(role: RoleDto): Promise<void> {
    const ok = await this.notificationService.confirm(
      `Delete role ${role.code}?`,
      'This custom role will be soft-deleted and hidden from the directory.',
      'Yes, Delete'
    );
    if (!ok) return;
    this.http.delete<any>(`${environment.apiBaseUrl}/admin/security/roles/${role.id}`).subscribe({
      next: () => {
        this.notificationService.success(`Role ${role.code} archived.`);
        this.loadSecurityData();
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Unable to delete role.');
      }
    });
  }

  setCategoryFilter(cat: string): void {
    this.selectedCategory = cat;
    this.filterMatrix();
  }

  filterMatrix(): void {
    let result = [...this.matrix];
    if (this.selectedCategory !== 'ALL') {
      result = result.filter(r => r.category === this.selectedCategory);
    }
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      result = result.filter(r => r.permissionCode.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    }
    this.filteredMatrix = result;
  }

  savePermissions(): void {
    this.isSavingMatrix = true;
    this.http.put<any>(`${environment.apiBaseUrl}/admin/security/matrix`, this.matrix).subscribe({
      next: () => {
        this.isSavingMatrix = false;
        this.notificationService.success('Role Permission Matrix saved to security registry!');
      },
      error: (err) => {
        this.isSavingMatrix = false;
        this.notificationService.error(err?.error?.message || 'Failed to save Permission Matrix.');
      }
    });
  }

  saveSecuritySettings(): void {
    if (this.securityForm.invalid) {
      this.securityForm.markAllAsTouched();
      this.notificationService.error('Please fill in all required security policy fields.');
      return;
    }
    this.isSavingSettings = true;
    const dto = this.securityForm.value;
    this.http.put<any>(`${environment.apiBaseUrl}/admin/security/settings`, dto).subscribe({
      next: () => {
        this.isSavingSettings = false;
        this.securityForm.markAsPristine();
        this.notificationService.success('System Security & MFA Policies saved and logged!');
      },
      error: (err) => {
        this.isSavingSettings = false;
        this.notificationService.error(err?.error?.message || 'Failed to save Security Policies.');
      }
    });
  }
}
