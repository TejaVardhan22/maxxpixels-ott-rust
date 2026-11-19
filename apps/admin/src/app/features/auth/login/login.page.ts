import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="login-wrapper">
      <!-- Background Ambient Glow Orbs -->
      <div class="ambient-glow glow-red"></div>
      <div class="ambient-glow glow-gold"></div>

      <mat-card class="login-card">
        <!-- Progress Bar -->
        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="top-progress"></mat-progress-bar>

        <!-- Brand Header -->
        <div class="card-header">
          <div class="brand">
            <div class="icon-ring">
              <img [src]="brandLogoUrl" [alt]="brandTitle + ' Logo'" class="brand-logo-img">
            </div>
            <div class="brand-text">
              <h1 class="brand-title">{{ brandTitle }}</h1>
              <span class="brand-badge">ADMIN CONSOLE</span>
            </div>
          </div>
          <p class="subtitle">Secure Role-Based Operations & Content Management System</p>
        </div>

        <mat-card-content class="card-content">
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width custom-field">
              <mat-label>Administrator Email</mat-label>
              <input
                matInput
                formControlName="email"
                type="email"
                placeholder="admin@yourdomain.com"
                required
              />
              <mat-icon matSuffix>alternate_email</mat-icon>
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">Email is required</mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">Enter a valid email address</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width custom-field">
              <mat-label>Security Passcode</mat-label>
              <input
                matInput
                formControlName="password"
                [type]="hidePassword ? 'password' : 'text'"
                required
              />
              <button mat-icon-button matSuffix type="button" (click)="hidePassword = !hidePassword">
                <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              <mat-error *ngIf="loginForm.get('password')?.hasError('required')">Password is required</mat-error>
            </mat-form-field>

            <button
              mat-raised-button
              class="full-width submit-btn"
              type="submit"
              [disabled]="loginForm.invalid || loading"
            >
              <span *ngIf="!loading">Authenticate Admin Console</span>
              <span *ngIf="loading">Verifying Credentials...</span>
              <mat-icon class="btn-arrow">arrow_forward</mat-icon>
            </button>
          </form>
        </mat-card-content>

        <div class="card-footer">
          <mat-icon class="lock-icon">lock</mat-icon>
          <span>256-bit Encrypted Session &bull; Authorized Master Admin Access Only</span>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      position: relative;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #090a10;
      padding: 20px;
      box-sizing: border-box;
      overflow: hidden;
      font-family: 'Roboto', sans-serif;
    }

    .ambient-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(120px);
      pointer-events: none;
      opacity: 0.25;
    }
    .glow-red {
      top: -100px;
      right: -100px;
      width: 450px;
      height: 450px;
      background: #e50914;
    }
    .glow-gold {
      bottom: -120px;
      left: -120px;
      width: 500px;
      height: 500px;
      background: #eab308;
    }

    .login-card {
      position: relative;
      width: 100%;
      max-width: 460px;
      padding: 36px 28px;
      background: rgba(18, 20, 29, 0.92) !important;
      color: #ffffff;
      border-radius: 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(16px);
      overflow: hidden;
    }

    .top-progress {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }

    .card-header {
      margin-bottom: 20px;
      text-align: center;
    }

    .brand {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      margin-bottom: 10px;

      .icon-ring {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: rgba(229, 9, 20, 0.12);
        border: 1px solid rgba(229, 9, 20, 0.4);
      }

      .brand-logo-img {
        width: 36px;
        height: 36px;
        object-fit: contain;
      }

      .brand-text {
        text-align: left;
      }

      .brand-title {
        font-size: 24px;
        font-weight: 900;
        margin: 0;
        color: #ffffff;
        letter-spacing: 1.5px;
      }

      .brand-badge {
        font-size: 10px;
        font-weight: 800;
        color: #eab308;
        letter-spacing: 1px;
      }
    }

    .subtitle {
      color: #94a3b8;
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      font-weight: 500;
    }

    .card-content {
      padding: 0 !important;
    }

    .custom-field {
      width: 100%;
      margin-bottom: 16px;
      ::ng-deep .mdc-text-field--outlined {
        --mdc-outlined-text-field-container-shape: 12px;
        --mdc-outlined-text-field-outline-color: #2d3248;
        --mdc-outlined-text-field-focus-outline-color: #e50914;
        --mdc-outlined-text-field-label-text-color: #94a3b8;
        --mdc-outlined-text-field-focus-label-text-color: #e50914;
        --mdc-outlined-text-field-input-text-color: #ffffff;
      }
      mat-icon {
        color: #64748b;
      }
    }

    .submit-btn {
      width: 100%;
      height: 50px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #e50914 0%, #b80710 100%) !important;
      color: #ffffff !important;
      border-radius: 12px !important;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 8px 24px rgba(229, 9, 20, 0.4) !important;
      transition: transform 0.15s ease;
      &:hover {
        transform: translateY(-1px);
      }
      .btn-arrow {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .card-footer {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 24px;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      .lock-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #eab308;
      }
    }
  `]
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  loading = false;
  hidePassword = true;
  brandLogoUrl = 'assets/logo.png';
  brandTitle = 'MAXXPIXELS';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      const user = this.authStore.currentUser();
      const roles = user?.roles || [];
      const isAdmin = roles.some(r => ['ADMIN', 'SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'].includes(r));
      const isProducer = roles.some(r => ['PRODUCER', 'ROLE_PRODUCER'].includes(r));

      if (isProducer && !isAdmin) {
        this.router.navigate(['/producer/dashboard']);
      } else {
        this.router.navigate(['/admin/dashboard']);
      }
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    const { email, password } = this.loginForm.value;

    this.authService.login({ identifier: email!, password: password! }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success) {
          const userName = res.data?.user?.name || res.data?.user?.fullName || res.data?.fullName || 'Administrator';
          this.notificationService.success(`Welcome back, ${userName}! Access Granted.`);
          this.authService.redirectAfterLogin();
        } else {
          this.notificationService.error(res.message || 'Authentication failed');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Invalid administrator credentials');
      }
    });
  }
}

