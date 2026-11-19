import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ott-section-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="section-header">
      <div class="title-group">
        <h2 class="section-title">{{ title }}</h2>
        <span *ngIf="subtitle" class="section-subtitle">{{ subtitle }}</span>
      </div>

      <button *ngIf="showViewAll" type="button" class="view-all-btn" (click)="onViewAll.emit()">
        <span>View All</span>
        <mat-icon>chevron_right</mat-icon>
      </button>
    </div>
  `,
  styles: [`
    .section-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      margin-bottom: 14px;
      padding: 0 4px;

      .title-group {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }

      .section-title {
        font-size: clamp(18px, 2.2vw, 22px);
        font-weight: 800;
        letter-spacing: -0.3px;
        margin: 0;
        color: #FFFFFF;
      }

      .section-subtitle {
        font-size: 13px;
        color: #747B89;
        font-weight: 500;
      }

      .view-all-btn {
        background: transparent;
        border: none;
        color: #AAB0BC;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        transition: color 150ms ease, transform 150ms ease;

        &:hover {
          color: #E50914;
          transform: translateX(2px);
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }
      }
    }
  `]
})
export class SectionHeaderComponent {
  @Input() title = 'Trending Now';
  @Input() subtitle?: string;
  @Input() showViewAll = true;
  @Output() onViewAll = new EventEmitter<void>();
}
