import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { DeviceApiService, UserDeviceItem } from '../../../core/services/api-services';

@Component({
  selector: 'app-ott-account-devices-page',
  standalone: true,
  imports: [CommonModule, MatIconModule, OttButtonComponent],
  template: `
    <div class="account-page-container">
      <div class="account-header">
        <h1 class="page-title">Manage Registered Devices</h1>
        <p class="page-sub">View and revoke active device sessions connected to your MaxxPixels account.</p>
      </div>

      <div class="devices-list">
        <div *ngIf="devices.length === 0" style="text-align: center; color: #747B89; padding: 48px 16px; background: #171A21; border-radius: 14px; border: 1px dashed rgba(255,255,255,0.1);">
          <mat-icon style="font-size: 40px; width: 40px; height: 40px; margin-bottom: 12px; color: #747B89;">phonelink_off</mat-icon>
          <p style="margin: 0; font-size: 15px; font-weight: 600;">No active registered devices found</p>
        </div>

        <div *ngFor="let device of devices" class="device-card" [class.current]="device.isCurrent">
          <div class="device-icon-box">
            <mat-icon>{{ getDeviceIcon(device.deviceType) }}</mat-icon>
          </div>

          <div class="device-info">
            <div class="device-name-row">
              <span class="device-name">{{ device.deviceName }}</span>
              <span *ngIf="device.isCurrent" class="current-badge">THIS DEVICE</span>
            </div>
            <span class="device-meta">Last Active: {{ device.lastActive }}</span>
          </div>

          <div class="device-action">
            <ott-button *ngIf="!device.isCurrent" variant="ghost" icon="phonelink_off" (onClick)="revokeDevice(device.deviceId)">
              Logout
            </ott-button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .account-page-container {
      padding: 100px 4vw 60px 4vw; min-height: 100vh; max-width: 1000px; margin: 0 auto; color: #FFF;
    }
    .account-header { margin-bottom: 32px; .page-title { font-size: 32px; font-weight: 900; margin: 0 0 8px 0; } .page-sub { color: #AAB0BC; font-size: 15px; } }
    .devices-list { display: flex; flex-direction: column; gap: 16px; }
    .device-card {
      display: flex; align-items: center; gap: 20px; padding: 20px 24px; border-radius: 14px; background: #171A21; border: 1px solid rgba(255,255,255,0.08); transition: border-color 200ms ease;
      &.current { border-color: rgba(229,9,20,0.4); background: rgba(229,9,20,0.05); }
      .device-icon-box {
        width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; flex: 0 0 52px;
        mat-icon { font-size: 28px; width: 28px; height: 28px; color: #E50914; }
      }
      .device-info {
        flex: 1;
        .device-name-row { display: flex; align-items: center; gap: 10px; .device-name { font-size: 16px; font-weight: 800; color: #FFF; } .current-badge { background: #E50914; color: #FFF; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 4px; } }
        .device-meta { font-size: 13px; color: #747B89; margin-top: 4px; display: block; }
      }
    }
  `]
})
export class AccountDevicesPage implements OnInit {
  private readonly deviceApi = inject(DeviceApiService);

  devices: UserDeviceItem[] = [];

  ngOnInit(): void {
    this.loadDevices();
  }

  loadDevices(): void {
    this.deviceApi.getActiveDevices().subscribe({
      next: (res) => {
        if (res?.success && res.data) {
          this.devices = res.data;
        } else {
          this.devices = [];
        }
      },
      error: () => {
        this.devices = [];
      }
    });
  }

  getDeviceIcon(type: string): string {
    switch (type.toUpperCase()) {
      case 'WEB': return 'laptop';
      case 'TV': return 'tv';
      case 'MOBILE': return 'smartphone';
      default: return 'devices';
    }
  }

  revokeDevice(id: string): void {
    this.deviceApi.revokeDevice(id).subscribe({
      next: () => {
        this.devices = this.devices.filter(d => d.deviceId !== id);
      },
      error: () => {
        this.devices = this.devices.filter(d => d.deviceId !== id);
      }
    });
  }
}
