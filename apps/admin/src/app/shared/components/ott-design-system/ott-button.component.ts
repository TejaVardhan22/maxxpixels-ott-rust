import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ott-button',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled"
      [class]="'ott-btn ott-btn-' + variant + (fullWidth ? ' full-width' : '')"
      (click)="onClick.emit($event)">
      <mat-icon *ngIf="icon" class="btn-icon">{{ icon }}</mat-icon>
      <span class="btn-label"><ng-content></ng-content></span>
    </button>
  `,
  styles: [`
    .ott-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 22px;
      border-radius: 8px;
      font-family: var(--font-main, sans-serif);
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
      outline: none;
      user-select: none;
      white-space: nowrap;
      min-height: 44px;

      &.full-width {
        width: 100%;
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      .btn-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .ott-btn-primary {
      background: var(--color-accent, #E50914);
      color: #FFFFFF;
      box-shadow: 0 4px 14px rgba(229, 9, 20, 0.35);

      &:hover {
        background: var(--color-accent-hover, #F40612);
        box-shadow: 0 6px 20px rgba(229, 9, 20, 0.5);
        transform: translateY(-1px);
      }
      &:active {
        transform: translateY(0);
      }
    }

    .ott-btn-secondary {
      background: rgba(255, 255, 255, 0.15);
      color: #FFFFFF;
      backdrop-filter: blur(12px);

      &:hover {
        background: rgba(255, 255, 255, 0.28);
        transform: translateY(-1px);
      }
    }

    .ott-btn-ghost {
      background: transparent;
      color: var(--text-secondary, #AAB0BC);
      border-color: rgba(255, 255, 255, 0.15);

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #FFFFFF;
        border-color: rgba(255, 255, 255, 0.3);
      }
    }

    .ott-btn-danger {
      background: var(--color-error, #EF4444);
      color: #FFFFFF;

      &:hover {
        background: #DC2626;
      }
    }

    .ott-btn-icon {
      padding: 10px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.5);
      color: #FFFFFF;
      border: 1px solid rgba(255, 255, 255, 0.2);

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: scale(1.08);
      }
    }
  `]
})
export class OttButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon' = 'primary';
  @Input() icon?: string;
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Input() fullWidth = false;
  @Output() onClick = new EventEmitter<MouseEvent>();
}
