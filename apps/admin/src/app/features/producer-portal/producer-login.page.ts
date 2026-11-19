import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/auth/auth.service';
import { AuthStore } from '../../core/auth/auth.store';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-producer-login-page',
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
    <div class="producer-login-wrapper">
      <div class="ambient-glow glow-blue"></div>
      <div class="ambient-glow glow-purple"></div>

      <mat-card class="login-card">
        <mat-progress-bar mode="indeterminate" *ngIf="loading" class="top-progress"></mat-progress-bar>

        <div class="card-header">
          <div class="brand">
            <div class="icon-ring">
              <img [src]="brandLogoUrl" alt="Producer Studio Logo" class="brand-logo-img">
            </div>
            <div class="brand-text">
              <h1 class="brand-title">PRODUCER STUDIO</h1>
              <span class="brand-badge">STUDIO PORTAL LOGIN</span>
            </div>
          </div>
          <p class="subtitle">Sign in to your producer studio dashboard</p>
        </div>

        <mat-card-content class="card-content">
          <!-- LOGIN FORM ONLY -->
          <form [formGroup]="loginForm" (ngSubmit)="onLoginSubmit()">
            <mat-form-field appearance="outline" class="full-width custom-field">
              <mat-label>Studio Email</mat-label>
              <input
                matInput
                formControlName="email"
                type="email"
                placeholder="producer@yourstudio.com"
                required
              />
              <mat-icon matSuffix>alternate_email</mat-icon>
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">Email is required</mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">Enter a valid studio email</mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width custom-field">
              <mat-label>Passcode</mat-label>
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
              <span *ngIf="!loading">Authenticate Studio Portal</span>
              <span *ngIf="loading">Authenticating Studio...</span>
              <mat-icon class="btn-arrow">arrow_forward</mat-icon>
            </button>
          </form>
        </mat-card-content>

        <div class="card-footer">
          <mat-icon class="lock-icon">lock</mat-icon>
          <span>Encrypted Studio Session &bull; MaxxPixels Media Distribution</span>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .producer-login-wrapper {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #0b0b10;
      position: relative;
      overflow: hidden;
      padding: 24px;
    }
    .ambient-glow {
      position: absolute;
      width: 450px;
      height: 450px;
      border-radius: 50%;
      filter: blur(140px);
      opacity: 0.25;
      pointer-events: none;
    }
    .glow-blue {
      background: #3498db;
      top: -100px;
      left: -100px;
    }
    .glow-purple {
      background: #9b59b6;
      bottom: -100px;
      right: -100px;
    }
    .login-card {
      width: 100%;
      max-width: 480px;
      background: rgba(22, 22, 30, 0.88) !important;
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 20px !important;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      color: #ffffff;
    }
    .top-progress {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
    }
    .card-header {
      padding: 28px 32px 12px;
      text-align: center;
    }
    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .icon-ring {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(155, 89, 182, 0.2));
      border: 1px solid rgba(52, 152, 219, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .brand-logo-img {
      width: 38px;
      height: 38px;
      object-fit: contain;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 1px;
      margin: 0;
      color: #ffffff;
    }
    .brand-badge {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #3498db;
      background: rgba(52, 152, 219, 0.15);
      padding: 4px 10px;
      border-radius: 12px;
    }
    .subtitle {
      font-size: 13px;
      color: #a0a0b5;
      margin: 6px 0 0;
    }

    .card-content {
      padding: 18px 32px 28px;
    }
    .full-width {
      width: 100%;
    }
    .custom-field {
      margin-bottom: 12px;
    }
    .submit-btn {
      height: 48px;
      background: linear-gradient(135deg, #3498db, #2980b9) !important;
      color: #ffffff !important;
      border-radius: 12px !important;
      font-weight: 700 !important;
      font-size: 15px !important;
      margin-top: 8px;
    }
    .card-footer {
      padding: 16px 32px 20px;
      text-align: center;
      font-size: 12px;
      color: #6e6e82;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      .lock-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
      }
    }
  `]
})
export class ProducerLoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  hidePassword = true;
  brandLogoUrl = 'assets/logo.png';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  ngOnInit(): void {
    if (this.authStore.isAuthenticated()) {
      this.router.navigate(['/producer/dashboard']);
      return;
    }
  }

  onLoginSubmit(): void {
    if (this.loginForm.invalid) return;
    this.loading = true;
    const email = (this.loginForm.get('email')?.value || '').trim();
    const password = (this.loginForm.get('password')?.value || '').trim();

    this.authService.login({ identifier: email, password: password }).subscribe({
      next: (res: any) => {
        this.loading = false;
        const isOk = res?.success || !!res?.accessToken || !!res?.data?.accessToken || !!res?.token;
        if (isOk) {
          this.notificationService.success('Producer Studio Authenticated!');
          this.router.navigate(['/producer/dashboard']);
        } else {
          this.notificationService.error(res?.message || 'Producer login failed');
        }
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.error(err?.error?.message || 'Invalid producer studio credentials');
      }
    });
  }
}
