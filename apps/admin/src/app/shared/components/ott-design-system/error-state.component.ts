import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from './ott-button.component';

@Component({
  selector: 'ott-error-state',
  standalone: true,
  imports: [CommonModule, MatIconModule, OttButtonComponent],
  template: `
    <div class="error-state-card">
      <div class="error-icon-box">
        <mat-icon>error_outline</mat-icon>
      </div>
      <div class="error-content">
        <h4>{{ title }}</h4>
        <p>{{ message }}</p>
        <span *ngIf="errorCode" class="error-code">Error Code: {{ errorCode }}</span>
      </div>
      <ott-button variant="secondary" icon="refresh" (onClick)="onRetry.emit()">
        Retry
      </ott-button>
    </div>
  `,
  styles: [`
    .error-state-card {
      display: flex;
      align-items: center;
      gap: 18px;
      padding: 24px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      backdrop-filter: blur(12px);
      max-width: 600px;
      margin: 20px auto;

      .error-icon-box {
        width: 48px;
        height: 48px;
        border-radius: 10px;
        background: rgba(239, 68, 68, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 48px;

        mat-icon {
          color: #EF4444;
          font-size: 26px;
        }
      }

      .error-content {
        flex: 1;

        h4 {
          margin: 0 0 4px 0;
          font-size: 16px;
          font-weight: 700;
          color: #FFFFFF;
        }

        p {
          margin: 0;
          font-size: 13px;
          color: #AAB0BC;
          line-height: 1.4;
        }

        .error-code {
          display: inline-block;
          margin-top: 4px;
          font-size: 11px;
          color: #747B89;
          font-family: monospace;
        }
      }
    }
  `]
})
export class ErrorStateComponent {
  @Input() title = 'Something went wrong';
  @Input() message = 'We couldn\'t load this content. Please check your connection.';
  @Input() errorCode?: string;
  @Output() onRetry = new EventEmitter<void>();
}
