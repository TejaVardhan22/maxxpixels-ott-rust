import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';

interface BackupItem {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  lastModified: number;
  lastModifiedDate: string;
  downloadUrl: string;
  cdnUrl?: string;
  bunnyStorageUrl?: string;
  storedOnBunny?: boolean;
  storedLocally?: boolean;
  storageProvider?: string;
}

interface MigrationItem {
  version: string;
  name: string;
  applied: boolean;
  appliedAt?: string;
  executionMs?: number;
}

@Component({
  selector: 'app-system-health-page',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, MatProgressBarModule, PermissionButtonComponent],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <h1>System Infrastructure, Full DB Backups &amp; Schema Migrations</h1>
          <p>Live PostgreSQL, Redis, Kafka, Bunny.net telemetry, full compressed .sql.gz backups, and zero-downtime migration registry</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="refreshAll()" [disabled]="loadingHealth">
            <mat-icon>refresh</mat-icon> Refresh Telemetry
          </button>
          <app-permission-button role="SUPER_ADMIN" color="warn" icon="cloud_download" (buttonClick)="triggerDatabaseBackup()">
            {{ backingUp ? 'Exporting Full Backup...' : 'Trigger Full Database Backup (.sql.gz)' }}
          </app-permission-button>
        </div>
      </div>

      <div class="health-grid">
        <mat-card class="health-card">
          <mat-card-content>
            <div class="card-title">
              <mat-icon color="primary">storage</mat-icon>
              <span>PostgreSQL Database &amp; Pool</span>
            </div>
            <p [class.status-ok]="dbStatus === 'UP'" [class.status-warn]="dbStatus !== 'UP'">
              STATUS: {{ dbStatus }} {{ dbLatencyMs !== null ? '(' + dbLatencyMs + ' ms)' : '' }}
            </p>
            <p>
              Tables: <strong>{{ dbTableCount }}</strong> &bull; Size: <strong>{{ dbSize }}</strong>
            </p>
            <p class="sub-text">
              {{ dbVersion }} &bull; Connections: {{ dbActiveConnections }}/{{ dbMaxConnections }}
            </p>
          </mat-card-content>
        </mat-card>

        <mat-card class="health-card">
          <mat-card-content>
            <div class="card-title">
              <mat-icon color="warn">memory</mat-icon>
              <span>Redis Cache &amp; Kafka Bus</span>
            </div>
            <p [class.status-ok]="redisStatus === 'UP'" [class.status-warn]="redisStatus !== 'UP'">
              REDIS: {{ redisStatus }} &bull; KAFKA: {{ kafkaStatus }}
            </p>
            <p>{{ redisEngine }}</p>
            <p class="sub-text">Broker: {{ kafkaBrokers }}</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="health-card">
          <mat-card-content>
            <div class="card-title">
              <mat-icon color="accent">cloud_sync</mat-icon>
              <span>Bunny.net Edge &amp; API Runtime</span>
            </div>
            <p [class.status-ok]="bunnyStatus === 'CONFIGURED'" [class.status-warn]="bunnyStatus !== 'CONFIGURED'">
              BUNNY STORAGE: {{ bunnyStatus }}
            </p>
            <p>Zone: {{ bunnyZone || 'Local Volume (/app/backups)' }}</p>
            <p class="sub-text">Daily Cron: 1:00 AM IST &rarr; Bunny.net &bull; Uptime: {{ formattedUptime }} &bull; Rust v{{ apiVersion }}</p>
          </mat-card-content>
        </mat-card>

        <mat-card class="health-card">
          <mat-card-content>
            <div class="card-title">
              <mat-icon style="color: #00d2ff;">schema</mat-icon>
              <span>Zero-Downtime Migrations</span>
            </div>
            <p [class.status-ok]="migrationsStatus === 'UP_TO_DATE'" [class.status-warn]="migrationsStatus !== 'UP_TO_DATE'">
              STATUS: {{ migrationsStatus }} ({{ appliedMigrations }}/{{ totalMigrations }})
            </p>
            <p class="font-mono" style="font-size: 12px;">Latest: {{ latestMigration }}</p>
            <p class="sub-text">Additive-only • Advisory-locked • NestJS-safe</p>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- RECENT DATABASE BACKUPS SECTION -->
      <div class="backup-section">
        <div class="section-title-row">
          <div class="title-with-badge">
            <mat-icon color="primary">history</mat-icon>
            <h2>Full Database Backup Archives (.sql.gz)</h2>
            <span class="badge">{{ backups.length }} Backups Available</span>
          </div>
          <button mat-stroked-button color="primary" (click)="loadBackups()" [disabled]="loadingBackups">
            <mat-icon>refresh</mat-icon> Refresh List
          </button>
        </div>

        <mat-progress-bar *ngIf="backingUp || loadingBackups" mode="indeterminate" class="mb-3"></mat-progress-bar>

        <div *ngIf="backups.length === 0 && !loadingBackups" class="empty-backups">
          <mat-icon>folder_open</mat-icon>
          <p>No database backups saved yet. Click 'Trigger Full Database Backup (.sql.gz)' above to export all tables and sequences.</p>
        </div>

        <div *ngIf="backups.length > 0" class="backup-list">
          <div *ngFor="let b of backups" class="backup-row">
            <div class="backup-meta">
              <mat-icon class="file-icon">archive</mat-icon>
              <div>
                <div class="file-header">
                  <span class="file-name font-mono">{{ b.filename }}</span>
                  <span class="storage-badge bunny" *ngIf="b.storedOnBunny">🐰 Bunny.net Edge</span>
                  <span class="storage-badge local" *ngIf="b.storedLocally">💾 Persistent Volume</span>
                </div>
                <span class="file-details">{{ b.sizeFormatted }} &bull; Created {{ b.lastModifiedDate }}</span>
              </div>
            </div>
            <div class="backup-actions">
              <a *ngIf="b.cdnUrl" mat-stroked-button color="accent" [href]="b.cdnUrl" target="_blank" title="Download via Bunny CDN Edge">
                <mat-icon>cloud_download</mat-icon> CDN Direct
              </a>
              <a mat-flat-button color="primary" [href]="getDownloadUrl(b.filename)" target="_blank">
                <mat-icon>download</mat-icon> Download
              </a>
              <button mat-icon-button color="warn" (click)="deleteBackup(b.filename)" title="Delete backup file">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- VERSIONED SCHEMA MIGRATIONS REGISTRY -->
      <div class="backup-section" style="margin-top: 24px;">
        <div class="section-title-row">
          <div class="title-with-badge">
            <mat-icon style="color: #00d2ff;">schema</mat-icon>
            <h2>Applied Schema Migrations (rust_schema_migrations)</h2>
            <span class="badge">{{ migrations.length }} Registered</span>
          </div>
          <button mat-stroked-button color="primary" (click)="loadMigrations()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        <div *ngIf="migrations.length > 0" class="backup-list">
          <div *ngFor="let m of migrations" class="backup-row">
            <div class="backup-meta">
              <mat-icon [style.color]="m.applied ? '#00e676' : '#ffab00'">{{ m.applied ? 'check_circle' : 'schedule' }}</mat-icon>
              <div>
                <div class="file-header">
                  <span class="file-name font-mono">{{ m.version }}_{{ m.name }}.sql</span>
                  <span class="storage-badge" [class.local]="m.applied" [class.bunny]="!m.applied">
                    {{ m.applied ? 'APPLIED' : 'PENDING' }}
                  </span>
                </div>
                <span class="file-details" *ngIf="m.applied">
                  Applied {{ m.appliedAt | date:'medium' }} &bull; {{ m.executionMs ?? 0 }} ms
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; padding: 24px; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
    p { color: #a0a0b0; margin: 0; }
    .health-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-bottom: 32px; }
    .health-card { background: #1a1a24; color: #ffffff; border-radius: 12px;
      .card-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; margin-bottom: 12px; }
      .status-ok { color: #2ecc71; font-weight: 700; margin: 0 0 4px; }
      .status-warn { color: #ffab00; font-weight: 700; margin: 0 0 4px; }
      .sub-text { font-size: 12px; color: #7f8c8d; margin-top: 6px; }
    }
    .backup-section {
      background: #14141e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 24px;
    }
    .section-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      .title-with-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        h2 { font-size: 18px; margin: 0; font-weight: 600; }
        .badge {
          background: rgba(0, 210, 255, 0.15);
          color: #00d2ff;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
      }
    }
    .empty-backups {
      text-align: center;
      padding: 40px;
      color: #7f8c8d;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.6; }
    }
    .backup-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .backup-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px;
      padding: 14px 18px;
      transition: background 0.2s;
      &:hover { background: rgba(255, 255, 255, 0.06); }
      .backup-meta {
        display: flex;
        align-items: center;
        gap: 14px;
        .file-icon { color: #00e676; }
        .file-name { font-size: 13px; font-weight: 600; color: #ffffff; }
        .file-details { display: block; font-size: 12px; color: #8c8ca1; margin-top: 4px; }
      }
      .backup-actions {
        display: flex;
        align-items: center;
        gap: 10px;
      }
    }
    .file-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .storage-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
    }
    .storage-badge.bunny {
      background: rgba(255, 152, 0, 0.15);
      color: #ffb74d;
      border: 1px solid rgba(255, 152, 0, 0.3);
    }
    .storage-badge.local {
      background: rgba(0, 230, 118, 0.15);
      color: #00e676;
      border: 1px solid rgba(0, 230, 118, 0.3);
    }
    .font-mono { font-family: monospace; }
    .mb-3 { margin-bottom: 16px; }
  `]
})
export class SystemHealthPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly authStore = inject(AuthStore);

  backups: BackupItem[] = [];
  migrations: MigrationItem[] = [];
  backingUp = false;
  loadingBackups = false;
  loadingHealth = false;

  systemHealth: any = null;

  get dbStatus(): string { return this.systemHealth?.components?.db?.status || 'CHECKING'; }
  get dbVersion(): string { return this.systemHealth?.components?.db?.database || 'PostgreSQL'; }
  get dbSize(): string { return this.systemHealth?.components?.db?.size || '—'; }
  get dbTableCount(): number { return this.systemHealth?.components?.db?.tableCount ?? 0; }
  get dbActiveConnections(): number { return this.systemHealth?.components?.db?.activeConnections ?? 0; }
  get dbMaxConnections(): number { return this.systemHealth?.components?.db?.maxConnections ?? 25; }
  get dbLatencyMs(): number | null { return this.systemHealth?.components?.db?.latencyMs ?? null; }

  get redisStatus(): string { return this.systemHealth?.components?.redis?.status || 'CHECKING'; }
  get redisEngine(): string { return this.systemHealth?.components?.redis?.engine || 'Redis 7'; }
  get kafkaStatus(): string { return this.systemHealth?.components?.kafka?.status || 'CHECKING'; }
  get kafkaBrokers(): string { return this.systemHealth?.components?.kafka?.brokers || 'kafka:9092'; }

  get bunnyStatus(): string { return this.systemHealth?.components?.bunny?.status || 'NOT_CONFIGURED'; }
  get bunnyZone(): string { return this.systemHealth?.components?.bunny?.storageZone || ''; }
  get apiVersion(): string { return this.systemHealth?.components?.runtime?.version || '2.0.0'; }

  get migrationsStatus(): string { return this.systemHealth?.components?.migrations?.status || 'CHECKING'; }
  get appliedMigrations(): number { return this.systemHealth?.components?.migrations?.applied ?? 0; }
  get totalMigrations(): number { return this.systemHealth?.components?.migrations?.total ?? 0; }
  get latestMigration(): string { return this.systemHealth?.components?.migrations?.latest || '—'; }

  get formattedUptime(): string {
    const secs = Number(this.systemHealth?.uptimeSeconds || 0);
    if (!secs) return '—';
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m ${secs % 60}s`;
  }

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.loadHealth();
    this.loadBackups();
    this.loadMigrations();
  }

  loadHealth(): void {
    this.loadingHealth = true;
    this.http.get<any>(`${environment.apiBaseUrl}/actuator/health`).subscribe({
      next: (res) => {
        this.loadingHealth = false;
        this.systemHealth = res?.data ?? res?.result ?? res;
      },
      error: () => {
        this.loadingHealth = false;
      }
    });
  }

  loadMigrations(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/backup/migrations`).subscribe({
      next: (res) => {
        if (res?.success && Array.isArray(res.data)) {
          this.migrations = res.data;
        }
      }
    });
  }

  loadBackups(): void {
    this.loadingBackups = true;
    this.http.get<any>(`${environment.apiBaseUrl}/backup/list`).subscribe({
      next: (res) => {
        this.loadingBackups = false;
        if (res.success && Array.isArray(res.data)) {
          this.backups = res.data;
        }
      },
      error: () => {
        this.loadingBackups = false;
      }
    });
  }

  triggerDatabaseBackup(): void {
    this.backingUp = true;
    this.http.post<any>(`${environment.apiBaseUrl}/backup/export`, {}).subscribe({
      next: (res) => {
        this.backingUp = false;
        if (res.success) {
          const fn = res.data?.filename || 'backup.sql.gz';
          const sz = res.data?.sizeFormatted || '';
          const tables = res.data?.tableCount ?? '';
          this.notificationService.success(
            `Full DB backup created: ${fn} (${sz}${tables ? `, ${tables} tables` : ''})`
          );
          this.loadBackups();
        } else {
          this.notificationService.error(res.message || 'Backup failed.');
        }
      },
      error: (err) => {
        this.backingUp = false;
        this.notificationService.error(err?.error?.message || 'Database backup export failed.');
      }
    });
  }

  async deleteBackup(filename: string): Promise<void> {
    const ok = await this.notificationService.confirm(
      'Delete backup archive?',
      `Permanently remove ${filename} from local backup storage?`,
      'Yes, Delete'
    );
    if (!ok) return;
    this.http.delete<any>(`${environment.apiBaseUrl}/backup/${encodeURIComponent(filename)}`).subscribe({
      next: () => {
        this.notificationService.success(`Deleted ${filename}`);
        this.loadBackups();
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Failed to delete backup.');
      }
    });
  }

  getDownloadUrl(filename: string): string {
    const token = this.authStore.accessToken();
    const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${environment.apiBaseUrl}/backup/download/${encodeURIComponent(filename)}${tokenQuery}`;
  }
}
