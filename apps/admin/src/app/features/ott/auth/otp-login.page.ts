import { Component, ElementRef, QueryList, ViewChildren, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OttButtonComponent } from '../../../shared/components/ott-design-system/ott-button.component';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthApiService } from '../../../core/auth/auth-api.service';

@Component({
  selector: 'app-ott-otp-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, OttButtonComponent],
  template: `
    <div class="login-wrapper">
      <div class="bg-poster"></div>
      <div class="bg-overlay"></div>

      <div class="login-card" [class.shake]="hasError">
        <div class="brand-header">
          <span class="logo-mark">MAXX<span class="logo-accent">PIXELS</span></span>
          <p class="sub-tag">Stream Movies, Web Series & Live Sports in 4K</p>
        </div>

        <!-- STEP 1: MOBILE NUMBER ENTRY -->
        <div *ngIf="step === 'phone'" class="step-container">
          <h2 class="card-title">Sign In / Register</h2>
          <p class="card-desc">Enter your 10-digit mobile number to receive a verification OTP</p>

          <div class="phone-input-box">
            <span class="country-code">+91</span>
            <input
              type="tel"
              maxlength="10"
              placeholder="Enter mobile number"
              [(ngModel)]="phoneNumber"
              (ngModelChange)="onPhoneChange($event)"
              class="phone-input"
              autofocus />
          </div>

          <ott-button
            variant="primary"
            [fullWidth]="true"
            [disabled]="phoneNumber.length < 10 || isLoading"
            (onClick)="sendOtp()">
            {{ isLoading ? 'Sending Code...' : 'Get OTP Code' }}
          </ott-button>
        </div>

        <!-- STEP 2: OTP DIGITS VERIFICATION -->
        <div *ngIf="step === 'otp'" class="step-container">
          <button class="back-link" (click)="step = 'phone'"><mat-icon>arrow_back</mat-icon> Change Mobile Number</button>

          <h2 class="card-title">Enter 6-Digit OTP</h2>
          <p class="card-desc">Code sent to <strong class="phone-highlight">+91 {{ phoneNumber }}</strong></p>

          <div class="otp-boxes-row">
            <input
              *ngFor="let digit of otpDigits; let i = index"
              #otpInput
              type="text"
              inputmode="numeric"
              maxlength="1"
              class="otp-box"
              [class.filled]="digit.length > 0"
              [value]="otpDigits[i]"
              (input)="onOtpInput(i, $event)"
              (keydown)="onOtpKeyDown(i, $event)"
              (paste)="onOtpPaste($event)" />
          </div>

          <div *ngIf="hasError" class="error-msg">
            <mat-icon>error_outline</mat-icon> {{ errorMessage || 'Invalid OTP code. Please enter the 6-digit code sent to your mobile.' }}
          </div>

          <ott-button
            variant="primary"
            [fullWidth]="true"
            [disabled]="!isOtpComplete || isLoading"
            (onClick)="verifyOtp()">
            {{ isLoading ? 'Verifying...' : 'Verify & Sign In' }}
          </ott-button>

          <div class="resend-row">
            <div class="timer-line">
              <span *ngIf="resendTimer > 0" class="timer-text">Resend code in 00:{{ resendTimer < 10 ? '0' + resendTimer : resendTimer }}</span>
              <button *ngIf="resendTimer === 0" class="resend-btn" (click)="resendOtp()">Resend Code</button>
            </div>
          </div>
        </div>

        <!-- STEP 3: SUCCESS ANIMATION -->
        <div *ngIf="step === 'success'" class="step-container success-box">
          <div class="check-circle"><mat-icon>check</mat-icon></div>
          <h2>Authentication Successful!</h2>
          <p>Redirecting to profile selection...</p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .login-wrapper {
      position: relative; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #06070A; color: #FFF; overflow: hidden;
      .bg-poster { position: absolute; inset: 0; background-image: url('https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1600&q=80'); background-size: cover; background-position: center; filter: blur(6px) brightness(0.35); transform: scale(1.05); }
      .bg-overlay { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(6,7,10,0.6) 0%, rgba(6,7,10,0.95) 100%); }
    }

    .login-card {
      position: relative; z-index: 10; width: 100%; max-width: 440px; background: rgba(23, 26, 33, 0.92); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 20px; padding: 40px 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.8);
      &.shake { animation: shakeError 400ms cubic-bezier(0.2, 0, 0, 1); }
    }

    .brand-header {
      text-align: center; margin-bottom: 28px;
      .logo-mark { font-size: 26px; font-weight: 900; letter-spacing: 1px; .logo-accent { color: #E50914; margin-left: 2px; } }
      .sub-tag { font-size: 13px; color: #747B89; margin: 4px 0 0 0; }
    }

    .step-container {
      .card-title { font-size: 22px; font-weight: 800; margin: 0 0 6px 0; }
      .card-desc { font-size: 13px; color: #AAB0BC; margin: 0 0 24px 0; line-height: 1.5; .phone-highlight { color: #FFF; } }
      .back-link { background: transparent; border: none; color: #747B89; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; margin-bottom: 16px; &:hover { color: #FFF; } mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    }

    .phone-input-box {
      display: flex; align-items: center; background: #12151C; border: 1px solid rgba(255,255,255,0.18); border-radius: 12px; overflow: hidden; margin-bottom: 20px; transition: border-color 200ms ease;
      &:focus-within { border-color: #E50914; box-shadow: 0 0 16px rgba(229, 9, 20, 0.3); }
      .country-code { padding: 0 16px; font-size: 16px; font-weight: 700; color: #AAB0BC; border-right: 1px solid rgba(255,255,255,0.1); }
      .phone-input { width: 100%; height: 52px; background: transparent; border: none; color: #FFF; font-size: 16px; font-weight: 700; padding: 0 16px; outline: none; letter-spacing: 1px; }
    }

    .demo-login-box {
      display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 18px; padding: 10px; border-radius: 10px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F59E0B; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 150ms ease;
      &:hover { background: rgba(245, 158, 11, 0.2); transform: scale(1.02); }
      .demo-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .otp-boxes-row {
      display: flex; gap: 8px; justify-content: space-between; margin-bottom: 24px;
      .otp-box {
        width: 48px; height: 56px; border-radius: 12px; background: #12151C; border: 1px solid rgba(255,255,255,0.2); color: #FFF; font-size: 22px; font-weight: 800; text-align: center; outline: none; transition: all 200ms ease;
        &:focus { border-color: #E50914; box-shadow: 0 0 16px rgba(229, 9, 20, 0.5); background: rgba(229, 9, 20, 0.1); }
        &.filled { border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.06); }
      }
    }

    .error-msg {
      display: flex; align-items: center; gap: 6px; color: #EF4444; font-size: 13px; font-weight: 600; margin-bottom: 16px; mat-icon { font-size: 18px; width: 18px; height: 18px; }
    }

    .resend-row {
      display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 20px; font-size: 13px;
      .demo-otp-btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #FFF; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; &:hover { background: rgba(255,255,255,0.2); } }
      .timer-line { color: #747B89; font-weight: 600; }
      .resend-btn { background: transparent; border: none; color: #E50914; font-weight: 700; cursor: pointer; &:hover { text-decoration: underline; } }
    }

    .success-box {
      text-align: center; padding: 20px 0;
      .check-circle { width: 72px; height: 72px; border-radius: 50%; background: rgba(34, 197, 94, 0.15); border: 2px solid #22C55E; color: #22C55E; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; mat-icon { font-size: 40px; width: 40px; height: 40px; } }
    }

    @keyframes shakeError {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }
  `]
})
export class OtpLoginPage {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  step: 'phone' | 'otp' | 'success' = 'phone';
  phoneNumber = '';
  otpDigits: string[] = ['', '', '', '', '', ''];
  isLoading = false;
  hasError = false;
  errorMessage = '';
  resendTimer = 30;
  timerInterval: any;

  private readonly authApi = inject(AuthApiService);

  constructor(private router: Router, private authStore: AuthStore) {}

  onPhoneChange(val: string): void {
    if (val.length === 10) {
      this.sendOtp();
    }
  }

  sendOtp(): void {
    if (this.phoneNumber.length < 10) return;
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    const fullPhone = '+91' + this.phoneNumber;
    this.authApi.sendOtp({ identifier: fullPhone, channel: 'SMS' }).subscribe({
      next: () => {
        this.isLoading = false;
        this.step = 'otp';
        this.startResendTimer();
        setTimeout(() => {
          const inputs = this.otpInputs?.toArray();
          inputs?.[0]?.nativeElement.focus();
        }, 100);
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage = err?.error?.message || 'Failed to send OTP. Please check your number and try again.';
      }
    });
  }

  onOtpInput(index: number, event: Event): void {
    const inputEl = event.target as HTMLInputElement;
    const rawVal = inputEl.value.replace(/\D/g, '');

    // Extract only single numeric digit
    const digit = rawVal.length > 0 ? rawVal.slice(-1) : '';
    this.otpDigits[index] = digit;
    inputEl.value = digit;
    this.hasError = false;

    if (digit && index < 5) {
      setTimeout(() => {
        const inputs = this.otpInputs.toArray();
        inputs[index + 1]?.nativeElement.focus();
      }, 10);
    }

    if (this.isOtpComplete) {
      this.verifyOtp();
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      if (!this.otpDigits[index] && index > 0) {
        event.preventDefault();
        this.otpDigits[index - 1] = '';
        const inputs = this.otpInputs.toArray();
        const prevInput = inputs[index - 1]?.nativeElement;
        if (prevInput) {
          prevInput.value = '';
          prevInput.focus();
        }
      }
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const data = (event.clipboardData?.getData('text') || '').replace(/\D/g, '').trim();
    if (data.length >= 6) {
      const digits = data.substring(0, 6).split('');
      this.otpDigits = digits;
      const inputs = this.otpInputs.toArray();
      inputs.forEach((inp, idx) => {
        if (inp?.nativeElement) inp.nativeElement.value = digits[idx] || '';
      });
      this.verifyOtp();
    }
  }

  get isOtpComplete(): boolean {
    return this.otpDigits.every(d => d.length === 1);
  }

  verifyOtp(): void {
    if (!this.isOtpComplete) return;
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';

    const code = this.otpDigits.join('');
    const fullPhone = '+91' + this.phoneNumber;

    this.authApi.verifyOtp({ identifier: fullPhone, otp: code }).subscribe({
      next: (res) => {
        this.isLoading = false;
        const authData = res?.data;
        if (authData) {
          const user = authData.user || {
            id: (authData as any).userId || (authData as any).id || '1',
            name: (authData as any).fullName || (authData as any).full_name || 'User',
            phone: fullPhone,
            roles: ['USER']
          };
          this.authStore.setSession(
            authData.accessToken || (authData as any).auth_token || '',
            authData.refreshToken || (authData as any).refresh_token || '',
            user
          );
          this.step = 'success';
          setTimeout(() => {
            this.router.navigate(['/profiles']);
          }, 1000);
        } else {
          this.hasError = true;
          this.errorMessage = 'Verification failed. Please try again.';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage = err?.error?.message || 'Invalid OTP code. Please enter the correct code.';
      }
    });
  }

  startResendTimer(): void {
    this.resendTimer = 30;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.resendTimer--;
      if (this.resendTimer <= 0) clearInterval(this.timerInterval);
    }, 1000);
  }

  resendOtp(): void {
    this.otpDigits = ['', '', '', '', '', ''];
    const inputs = this.otpInputs.toArray();
    inputs.forEach(inp => {
      if (inp?.nativeElement) inp.nativeElement.value = '';
    });
    this.sendOtp();
  }
}
