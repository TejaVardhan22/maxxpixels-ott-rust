import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataTableComponent, TableColumn } from '../../shared/components/data-table/data-table.component';
import { PermissionButtonComponent } from '../../shared/components/permission-button/permission-button.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { environment } from '../../../environments/environment';

export interface LiveChannel {
  id: number;
  name: string;
  category: string;
  streamUrl: string;
  drmProtected: boolean;
  status: string;
}

@Component({
  selector: 'app-live-list-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, DataTableComponent, PermissionButtonComponent, StatusBadgeComponent],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <h1>Live TV & Live Sports Events</h1>
          <p>Manage Live Channels, HLS/DASH Ingest Streams, DRM Protection & Event Schedules</p>
        </div>
        <app-permission-button permission="CONTENT_CREATE" color="primary" icon="add">
          Add Live Channel
        </app-permission-button>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="liveChannels"
        [totalElements]="totalElements"
        [loading]="loading">
      </app-data-table>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; }
    .header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
    p { color: #a0a0b0; margin: 0; }
  `]
})
export class LiveListPage implements OnInit {
  private readonly http = inject(HttpClient);

  liveChannels: LiveChannel[] = [];
  totalElements = 0;
  loading = false;

  columns: TableColumn<LiveChannel>[] = [
    { key: 'id', header: 'ID', sortable: true },
    { key: 'name', header: 'Channel / Event Name', sortable: true },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'drmProtected', header: 'DRM Status', sortable: true },
    { key: 'status', header: 'Status', sortable: true }
  ];

  ngOnInit(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/live-channels`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.liveChannels = res.data;
          this.totalElements = this.liveChannels.length;
        }
      },
      error: () => { this.loading = false; }
    });
  }
}
