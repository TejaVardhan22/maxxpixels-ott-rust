import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="status-badge" [ngClass]="badgeClass">
      {{ label }}
    </span>
  `,
  styles: [`
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }
    .badge-published, .badge-active, .badge-approved, .badge-success, .badge-clean {
      background-color: rgba(46, 204, 113, 0.15);
      color: #2ecc71;
    }
    .badge-draft, .badge-queued, .badge-pending, .badge-submitted {
      background-color: rgba(241, 196, 15, 0.15);
      color: #f1c40f;
    }
    .badge-under-review, .badge-processing, .badge-scheduled {
      background-color: rgba(56, 189, 248, 0.16);
      color: #38bdf8;
    }
    .badge-rejected, .badge-failed, .badge-expired, .badge-cancelled {
      background-color: rgba(231, 76, 60, 0.15);
      color: #e74c3c;
    }
    .badge-archived, .badge-inactive {
      background-color: rgba(149, 165, 166, 0.15);
      color: #95a5a6;
    }
  `]
})
export class StatusBadgeComponent {
  @Input() status = 'DRAFT';

  get label(): string {
    return this.status ? this.status.replace('_', ' ') : 'UNKNOWN';
  }

  get badgeClass(): string {
    const s = this.status ? this.status.toLowerCase().replace('_', '-') : 'default';
    return `badge-${s}`;
  }
}
