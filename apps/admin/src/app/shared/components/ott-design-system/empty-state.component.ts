import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from './ott-button.component';

@Component({
  selector: 'ott-empty-state',
  standalone: true,
  imports: [CommonModule, MatIconModule, OttButtonComponent],
  template: `
    <div class="empty-state-wrapper">
      <div class="icon-ring">
        <mat-icon class="state-icon">{{ icon }}</mat-icon>
      </div>
      <h3 class="state-title">{{ title }}</h3>
      <p class="state-description">{{ description }}</p>
      <ott-button *ngIf="actionLabel" variant="primary" (onClick)="onAction.emit()">
        {{ actionLabel }}
      </ott-button>
    </div>
  `,
  styles: [`
    .empty-state-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 24px;
      text-align: center;
      max-width: 480px;
      margin: 0 auto;

      .icon-ring {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;

        .state-icon {
          font-size: 40px;
          width: 40px;
          height: 40px;
          color: var(--text-muted, #747B89);
        }
      }

      .state-title {
        font-size: 22px;
        font-weight: 700;
        margin: 0 0 8px 0;
        color: var(--text-primary, #FFFFFF);
      }

      .state-description {
        font-size: 14px;
        color: var(--text-secondary, #AAB0BC);
        line-height: 1.5;
        margin: 0 0 24px 0;
      }
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'search_off';
  @Input() title = 'Nothing found';
  @Input() description = 'We couldn\'t find any content matching your request.';
  @Input() actionLabel?: string;
  @Output() onAction = new EventEmitter<void>();
}
