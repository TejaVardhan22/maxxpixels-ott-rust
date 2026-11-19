import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DataTableComponent, TableColumn } from '../../shared/components/data-table/data-table.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { NotificationService } from '../../shared/services/notification.service';
import { environment } from '../../../environments/environment';

export interface UserDevice {
  id: number;
  userId: number;
  deviceType: string;
  deviceName: string;
  ipAddress: string;
  lastActiveAt: string;
  active: boolean;
}

@Component({
  selector: 'app-device-list-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, DataTableComponent, StatusBadgeComponent],
  template: `
    <div class="page-container">
      <div class="header-row">
        <div>
          <h1>Active Devices & Session Revocation</h1>
          <p>Monitor registered Smart TVs, Mobile Apps, Web Browsers & enforce concurrent screen limits</p>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [data]="devices"
        [totalElements]="devices.length"
        [loading]="loading">
      </app-data-table>
    </div>
  `,
  styles: [`
    .page-container { color: #ffffff; }
    .header-row { margin-bottom: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
    p { color: #a0a0b0; margin: 0; }
  `]
})
export class DeviceListPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);

  devices: UserDevice[] = [];
  loading = false;

  columns: TableColumn<UserDevice>[] = [
    { key: 'id', header: 'Device ID', sortable: true },
    { key: 'userId', header: 'User ID', sortable: true },
    { key: 'deviceType', header: 'Device Type', sortable: true },
    { key: 'deviceName', header: 'Device Model / Browser', sortable: true },
    { key: 'ipAddress', header: 'IP Address', sortable: true },
    { key: 'lastActiveAt', header: 'Last Active', sortable: true }
  ];

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.loading = true;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/devices`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.data) {
          this.devices = res.data;
        }
      },
      error: () => { this.loading = false; }
    });
  }

  revokeDevice(id: number): void {
    this.http.delete<any>(`${environment.apiBaseUrl}/devices/${id}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success('Device session revoked & logged out remotely!');
          this.loadDevices();
        }
      }
    });
  }
}
