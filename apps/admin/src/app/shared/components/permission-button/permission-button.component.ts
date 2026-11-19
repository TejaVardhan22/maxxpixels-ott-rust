import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-permission-button',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule],
  template: `
    <button
      *ngIf="isVisible"
      mat-raised-button
      [color]="color"
      [disabled]="disabled || loading"
      (click)="onClick($event)">
      <mat-icon *ngIf="icon && !loading">{{ icon }}</mat-icon>
      <span *ngIf="loading" class="spinner-border"></span>
      <ng-content></ng-content>
    </button>
  `
})
export class PermissionButtonComponent {
  private readonly authStore = inject(AuthStore);

  @Input() permission = '';
  @Input() role = '';
  @Input() color: 'primary' | 'accent' | 'warn' = 'primary';
  @Input() icon = '';
  @Input() disabled = false;
  @Input() loading = false;

  @Output() buttonClick = new EventEmitter<Event>();

  get isVisible(): boolean {
    if (this.role && !this.authStore.hasRole(this.role)) return false;
    if (this.permission && !this.authStore.hasPermission(this.permission)) return false;
    return true;
  }

  onClick(event: Event): void {
    if (!this.disabled) {
      this.buttonClick.emit(event);
    }
  }
}
