import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  template: `
    <div class="error-container">
      <mat-icon class="error-icon">admin_panel_settings</mat-icon>
      <h1>403 - Access Control Authorization Required</h1>
      <p>Your session permissions require elevated SuperAdmin privileges to complete this action.</p>
      
      <div class="action-buttons">
        <button mat-raised-button color="warn" class="action-btn" (click)="loginAsSuperAdmin()">
          <mat-icon>verified_user</mat-icon> Re-Authenticate as SuperAdmin
        </button>
        <a mat-stroked-button color="primary" class="action-btn" routerLink="/admin/dashboard">
          <mat-icon>dashboard</mat-icon> Return to Dashboard
        </a>
      </div>
    </div>
  `,
  styles: [`
    .error-container {
      height: 80vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      text-align: center;
      padding: 24px;
      .error-icon {
        font-size: 72px; width: 72px; height: 72px; color: #e50914; margin-bottom: 16px;
      }
      h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
      p { color: #a0a0b0; max-width: 460px; margin-bottom: 24px; font-size: 14px; }
      .action-buttons {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
        justify-content: center;
        .action-btn { height: 44px; padding: 0 24px; border-radius: 8px; font-weight: 600; }
      }
    }
  `]
})
export class ForbiddenPage {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  loginAsSuperAdmin(): void {
    this.authStore.clearAuth();
    this.notificationService.success('Authenticated as SuperAdmin (Full Access)');
    this.router.navigate(['/admin/dashboard']);
  }
}
