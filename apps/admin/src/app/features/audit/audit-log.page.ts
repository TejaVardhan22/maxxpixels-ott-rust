import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataTableComponent, TableColumn } from '../../shared/components/data-table/data-table.component';
import { environment } from '../../../environments/environment';

export interface AuditLogEntry {
  id: number | string;
  userEmail: string;
  userRole: string;
  action: string;
  entityName: string;
  entityId: string;
  ipAddress: string;
  details: string;
  timestamp: string;
}

@Component({
  selector: 'app-audit-log-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, DataTableComponent],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <span class="category-tag"><mat-icon>policy</mat-icon> SECURITY, COMPLIANCE & GOVERNANCE</span>
          <h1>Audit Logs & Governance Trail</h1>
          <p>Immutable operational trail for admin actions, configuration changes, security events, and system operations (as recorded by backend)</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="loadAuditLogs()" [disabled]="loading">
            <mat-icon>refresh</mat-icon> {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
          <button mat-raised-button color="accent" (click)="exportCsv()" [disabled]="!filteredAuditLogs.length">
            <mat-icon>download</mat-icon> Export CSV
          </button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Total Records (Loaded)</span>
          <div class="kpi-val">{{ auditLogs.length }}</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Matching Current Filters</span>
          <div class="kpi-val">{{ filteredAuditLogs.length }}</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Distinct Actions</span>
          <div class="kpi-val">{{ distinctActionCount }}</div>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Distinct Operators</span>
          <div class="kpi-val">{{ distinctOperatorCount }}</div>
        </div>
      </div>

      <div class="filter-bar">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" [(ngModel)]="searchQuery" (ngModelChange)="applyFilters()" placeholder="Search action, operator, entity, details, IP, ID...">
        </div>
        <select [(ngModel)]="selectedAction" (ngModelChange)="applyFilters()" class="select-filter">
          <option value="ALL">All Actions</option>
          <option *ngFor="let a of actionOptions" [value]="a">{{ a }}</option>
        </select>
        <select [(ngModel)]="selectedRole" (ngModelChange)="applyFilters()" class="select-filter">
          <option value="ALL">All Roles</option>
          <option *ngFor="let r of roleOptions" [value]="r">{{ r }}</option>
        </select>
        <button class="clear-btn" type="button" (click)="clearFilters()" [disabled]="!hasActiveFilters">Clear Filters</button>
      </div>

      <div class="table-card">
        <div class="table-title-row">
          <h3>Governance Event Stream</h3>
          <p>Client-side filtering/export over loaded records. Use refresh to fetch latest backend audit entries.</p>
        </div>
        <app-data-table
          [columns]="columns"
          [data]="filteredAuditLogs"
          [totalElements]="filteredAuditLogs.length"
          [loading]="loading">
        </app-data-table>

        <div *ngIf="!loading && !filteredAuditLogs.length" class="empty-state">
          <mat-icon>fact_check</mat-icon>
          <p>No audit records match the current filters.</p>
        </div>
      </div>

      <div class="details-panel" *ngIf="recentDetails.length">
        <h3><mat-icon>notes</mat-icon> Recent Event Details (Context)</h3>
        <div class="detail-item" *ngFor="let log of recentDetails">
          <div class="detail-head">
            <span class="action">{{ log.action }}</span>
            <span class="meta">{{ log.userEmail || 'system' }} • {{ log.timestamp | date:'medium' }}</span>
          </div>
          <div class="detail-body">{{ log.details || (log.entityName + ' ' + log.entityId) || 'No details provided' }}</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 4px; }
    .header-row { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
    .category-tag { display:inline-flex; align-items:center; gap:6px; background:rgba(0,210,255,0.12); color:#00d2ff; font-size:11px; font-weight:700; padding:4px 10px; border-radius:6px; margin-bottom:6px; }
    .category-tag mat-icon { font-size:14px; width:14px; height:14px; }
    h1 { font-size:26px; font-weight:800; margin:0 0 4px; color:#fff; }
    p { color:#a0a0b0; margin:0; font-size:13px; }
    .header-actions { display:flex; gap:10px; flex-wrap:wrap; }

    .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:16px; }
    .kpi-card { background:#161622; border:1px solid #28283a; border-radius:10px; padding:14px; }
    .kpi-label { font-size:11px; color:#a0a0b0; display:block; margin-bottom:4px; }
    .kpi-val { font-size:22px; font-weight:800; color:#fff; }

    .filter-bar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; background:#161622; border:1px solid #28283a; border-radius:10px; padding:12px; margin-bottom:16px; }
    .search-box { position:relative; flex:1; min-width:260px; }
    .search-icon { position:absolute; left:10px; top:9px; color:#8e8ea0; font-size:18px; width:18px; height:18px; }
    .search-box input { width:100%; box-sizing:border-box; background:#101018; border:1px solid #28283a; border-radius:8px; color:#fff; padding:9px 12px 9px 34px; font-size:13px; outline:none; }
    .search-box input:focus { border-color:#00d2ff; }
    .select-filter { background:#101018; border:1px solid #28283a; color:#fff; border-radius:8px; padding:9px 10px; font-size:13px; min-width:160px; }
    .clear-btn { background:transparent; border:1px solid #383850; color:#d0d4de; border-radius:8px; padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer; }
    .clear-btn:disabled { opacity:.5; cursor:not-allowed; }

    .table-card { background:#161622; border:1px solid #28283a; border-radius:12px; overflow:hidden; }
    .table-title-row { padding:14px 16px; border-bottom:1px solid #28283a; }
    .table-title-row h3 { margin:0 0 4px; font-size:15px; font-weight:800; }
    .empty-state { text-align:center; padding:24px; color:#8e8ea0; }
    .empty-state mat-icon { font-size:30px; width:30px; height:30px; margin-bottom:6px; }

    .details-panel { margin-top:16px; background:#161622; border:1px solid #28283a; border-radius:12px; padding:14px 16px; }
    .details-panel h3 { margin:0 0 10px; font-size:14px; font-weight:800; display:flex; align-items:center; gap:6px; }
    .details-panel h3 mat-icon { font-size:18px; width:18px; height:18px; color:#00d2ff; }
    .detail-item { background:#101018; border:1px solid #232332; border-radius:8px; padding:10px 12px; margin-bottom:8px; }
    .detail-head { display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; margin-bottom:4px; }
    .action { color:#00d2ff; font-weight:700; font-size:12px; }
    .meta { color:#8e8ea0; font-size:11px; }
    .detail-body { color:#d5dae6; font-size:12px; line-height:1.5; white-space:pre-wrap; word-break:break-word; }
  `]
})
export class AuditLogPage implements OnInit {
  private readonly http = inject(HttpClient);

  auditLogs: AuditLogEntry[] = [];
  filteredAuditLogs: AuditLogEntry[] = [];
  loading = false;
  searchQuery = '';
  selectedAction = 'ALL';
  selectedRole = 'ALL';

  columns: TableColumn<AuditLogEntry>[] = [
    { key: 'id', header: 'ID', sortable: true },
    { key: 'timestamp', header: 'Timestamp', sortable: true },
    { key: 'userEmail', header: 'Operator', sortable: true },
    { key: 'userRole', header: 'Role', sortable: true },
    { key: 'action', header: 'Action', sortable: true },
    { key: 'entityName', header: 'Entity', sortable: true },
    { key: 'entityId', header: 'Entity ID', sortable: true },
    { key: 'ipAddress', header: 'IP / Source', sortable: true },
    { key: 'details', header: 'Details', sortable: false }
  ];

  get actionOptions(): string[] {
    return Array.from(new Set(this.auditLogs.map(l => l.action).filter(Boolean))).sort();
  }

  get roleOptions(): string[] {
    return Array.from(new Set(this.auditLogs.map(l => l.userRole).filter(Boolean))).sort();
  }

  get distinctActionCount(): number { return this.actionOptions.length; }
  get distinctOperatorCount(): number { return new Set(this.auditLogs.map(l => l.userEmail).filter(Boolean)).size; }
  get hasActiveFilters(): boolean { return !!this.searchQuery.trim() || this.selectedAction !== 'ALL' || this.selectedRole !== 'ALL'; }
  get recentDetails(): AuditLogEntry[] {
    return this.filteredAuditLogs.filter(l => (l.details || '').trim()).slice(0, 8);
  }

  ngOnInit(): void {
    this.loadAuditLogs();
  }

  loadAuditLogs(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/audit-logs`).subscribe({
      next: (res) => {
        this.loading = false;
        const raw = res?.data ?? res ?? [];
        const list = Array.isArray(raw) ? raw : (raw.content || raw.items || raw.logs || []);
        this.auditLogs = (Array.isArray(list) ? list : []).map((r: any, idx: number) => this.normalizeAudit(r, idx));
        this.auditLogs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        this.applyFilters();
      },
      error: () => {
        this.loading = false;
        this.auditLogs = [];
        this.filteredAuditLogs = [];
      }
    });
  }

  private normalizeAudit(r: any, idx: number): AuditLogEntry {
    const timestamp = r?.timestamp || r?.createdAt || r?.created_at || r?.time || r?.updatedAt || new Date().toISOString();
    return {
      id: r?.id ?? r?.auditId ?? idx + 1,
      userEmail: r?.userEmail || r?.user_email || r?.actor || r?.email || r?.performedBy || 'system',
      userRole: r?.userRole || r?.user_role || r?.role || 'N/A',
      action: r?.action || r?.event || r?.type || 'UNKNOWN',
      entityName: r?.entityName || r?.entity_name || r?.resource || r?.module || '-',
      entityId: String(r?.entityId ?? r?.entity_id ?? r?.targetId ?? r?.target_id ?? r?.id ?? ''),
      ipAddress: r?.ipAddress || r?.ip_address || r?.ip || r?.source || '-',
      details: typeof r?.details === 'string' ? r.details : (r?.details ? JSON.stringify(r.details) : (r?.message || r?.description || '')),
      timestamp
    };
  }

  applyFilters(): void {
    const q = (this.searchQuery || '').toLowerCase().trim();
    this.filteredAuditLogs = this.auditLogs.filter(l => {
      if (this.selectedAction !== 'ALL' && l.action !== this.selectedAction) return false;
      if (this.selectedRole !== 'ALL' && l.userRole !== this.selectedRole) return false;
      if (!q) return true;
      const hay = [l.id, l.timestamp, l.userEmail, l.userRole, l.action, l.entityName, l.entityId, l.ipAddress, l.details]
        .map(v => String(v ?? '').toLowerCase()).join(' ');
      return hay.includes(q);
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedAction = 'ALL';
    this.selectedRole = 'ALL';
    this.applyFilters();
  }

  exportCsv(): void {
    const rows = this.filteredAuditLogs.map(l => [
      l.id, l.timestamp, l.userEmail, l.userRole, l.action, l.entityName, l.entityId, l.ipAddress, l.details
    ]);
    const header = ['ID', 'Timestamp', 'Operator', 'Role', 'Action', 'Entity', 'Entity ID', 'IP/Source', 'Details'];
    const csv = [header, ...rows].map(r => r.map(c => this.escapeCsv(String(c ?? ''))).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `audit-logs-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private escapeCsv(value: string): string {
    if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
  }
}
