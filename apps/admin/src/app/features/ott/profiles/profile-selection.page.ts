import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { ProfileStore, UserProfile } from '../../../core/profiles/profile.store';

@Component({
  selector: 'app-ott-profile-selection-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="profiles-container">
      <div class="profiles-header">
        <h1 class="title">Who's Watching MaxxPixels?</h1>
        <p class="subtitle">Select your personal profile to load your customized Continue Watching and Recommendations.</p>
      </div>

      <!-- PROFILES GRID -->
      <div class="profiles-grid">
        <div
          *ngFor="let p of profileStore.allProfiles()"
          class="profile-card"
          [class.active]="p.id === profileStore.activeProfile()?.id"
          (click)="selectProfile(p)">
          <div class="avatar-ring">
            <img [src]="p.avatarUrl" [alt]="p.name" class="avatar-img" />
            <div *ngIf="p.isKids" class="kids-badge">KIDS</div>
            <div *ngIf="p.hasPin" class="pin-badge" title="PIN Protected"><mat-icon>lock</mat-icon></div>
          </div>
          <span class="profile-name">{{ p.name }}</span>
        </div>

        <!-- ADD PROFILE BUTTON -->
        <div class="profile-card add-card" (click)="showAddModal = true">
          <div class="avatar-ring add-ring">
            <mat-icon>add</mat-icon>
          </div>
          <span class="profile-name">Add Profile</span>
        </div>
      </div>

      <!-- PARENTAL PIN DIALOG MODAL -->
      <div *ngIf="showPinModal" class="modal-backdrop">
        <div class="modal-card pin-modal">
          <button class="close-btn" (click)="showPinModal = false"><mat-icon>close</mat-icon></button>
          <h2>Enter Parental PIN</h2>
          <p>This profile is protected with a 4-digit security PIN.</p>

          <div class="pin-inputs">
            <input type="password" maxlength="1" [(ngModel)]="pin1" (input)="onPinInput(1)" id="p1" autofocus />
            <input type="password" maxlength="1" [(ngModel)]="pin2" (input)="onPinInput(2)" id="p2" />
            <input type="password" maxlength="1" [(ngModel)]="pin3" (input)="onPinInput(3)" id="p3" />
            <input type="password" maxlength="1" [(ngModel)]="pin4" (input)="onPinInput(4)" id="p4" />
          </div>

          <div *ngIf="pinError" class="pin-error">Incorrect PIN. Please try again.</div>

          <button class="submit-btn" (click)="verifyPin()">Unlock Profile</button>
        </div>
      </div>

      <!-- ADD PROFILE MODAL WITH AVATAR PICKER -->
      <div *ngIf="showAddModal" class="modal-backdrop">
        <div class="modal-card add-modal">
          <button class="close-btn" (click)="showAddModal = false"><mat-icon>close</mat-icon></button>
          <h2>Create New Profile</h2>

          <div class="avatar-picker-section">
            <label>Choose Avatar:</label>
            <div class="picker-grid">
              <img
                *ngFor="let av of avatarOptions"
                [src]="av"
                class="picker-avatar"
                [class.selected]="selectedAvatar === av"
                (click)="selectedAvatar = av" />
            </div>
          </div>

          <div class="input-field">
            <label>Profile Name:</label>
            <input type="text" [(ngModel)]="newProfileName" placeholder="e.g. Rahul, Kids Zone" class="name-input" />
          </div>

          <div class="toggle-row">
            <label>Kids Profile (Safe catalog for under 12)</label>
            <input type="checkbox" [(ngModel)]="isNewKids" class="toggle-checkbox" />
          </div>

          <button class="submit-btn" (click)="createProfile()">Create Profile</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profiles-container {
      padding: 100px 4vw 60px 4vw; min-height: 100vh; background: #06070A; color: #FFF; display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .profiles-header {
      text-align: center; margin-bottom: 48px;
      .title { font-size: clamp(32px, 4vw, 44px); font-weight: 900; margin: 0 0 10px 0; }
      .subtitle { font-size: 16px; color: #AAB0BC; max-width: 540px; }
    }

    .profiles-grid {
      display: flex; gap: 32px; flex-wrap: wrap; justify-content: center; margin-bottom: 40px;
    }

    .profile-card {
      display: flex; flex-direction: column; align-items: center; gap: 14px; cursor: pointer;
      .avatar-ring {
        position: relative; width: 130px; height: 130px; border-radius: 50%; border: 3px solid rgba(255,255,255,0.15); overflow: hidden; transition: all 250ms cubic-bezier(0.2, 0, 0, 1);
        .avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .kids-badge { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); background: #3B82F6; color: #FFF; font-size: 10px; font-weight: 900; padding: 2px 8px; border-radius: 10px; }
        .pin-badge { position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: #F59E0B; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; mat-icon { font-size: 14px; width: 14px; height: 14px; } }
      }
      &.active .avatar-ring { border-color: #E50914; box-shadow: 0 0 25px rgba(229,9,20,0.6); }
      &:hover .avatar-ring { border-color: #E50914; transform: scale(1.08); }
      .profile-name { font-size: 16px; font-weight: 800; color: #AAB0BC; }
      &:hover .profile-name { color: #FFF; }

      &.add-card {
        .add-ring { border-style: dashed; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; mat-icon { font-size: 44px; width: 44px; height: 44px; color: #747B89; } }
        &:hover .add-ring { border-color: #FFF; mat-icon { color: #FFF; } }
      }
    }

    /* MODAL BACKDROP & DIALOGS */
    .modal-backdrop {
      position: fixed; inset: 0; z-index: 6000; background: rgba(0,0,0,0.85); backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; padding: 20px;
    }

    .modal-card {
      position: relative; width: 100%; max-width: 440px; background: #171A21; border-radius: 20px; border: 1px solid rgba(255,255,255,0.15); padding: 32px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);
      .close-btn { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: #AAB0BC; cursor: pointer; &:hover { color: #FFF; } }
      h2 { font-size: 22px; font-weight: 800; margin: 0 0 8px 0; }
      p { font-size: 14px; color: #AAB0BC; margin: 0 0 24px 0; }
    }

    .pin-inputs {
      display: flex; gap: 12px; justify-content: center; margin-bottom: 24px;
      input { width: 50px; height: 60px; border-radius: 12px; background: #06070A; border: 1px solid rgba(255,255,255,0.2); color: #FFF; font-size: 24px; text-align: center; outline: none; &:focus { border-color: #E50914; box-shadow: 0 0 16px rgba(229,9,20,0.4); } }
    }
    .pin-error { color: #EF4444; font-size: 13px; font-weight: 700; text-align: center; margin-bottom: 16px; }

    .avatar-picker-section {
      margin-bottom: 20px;
      label { display: block; font-size: 13px; font-weight: 700; color: #AAB0BC; margin-bottom: 10px; }
      .picker-grid { display: flex; gap: 12px; overflow-x: auto;
        .picker-avatar { width: 60px; height: 60px; border-radius: 50%; object-fit: cover; border: 2px solid transparent; cursor: pointer; opacity: 0.7; transition: all 150ms ease; &.selected { border-color: #E50914; opacity: 1; transform: scale(1.1); } }
      }
    }

    .input-field {
      margin-bottom: 20px;
      label { display: block; font-size: 13px; font-weight: 700; color: #AAB0BC; margin-bottom: 6px; }
      .name-input { width: 100%; height: 48px; border-radius: 10px; background: #06070A; border: 1px solid rgba(255,255,255,0.15); color: #FFF; padding: 0 14px; font-size: 15px; outline: none; &:focus { border-color: #E50914; } }
    }

    .toggle-row {
      display: flex; align-items: center; justify-content: space-between; font-size: 13px; color: #AAB0BC; margin-bottom: 24px;
      .toggle-checkbox { width: 20px; height: 20px; accent-color: #E50914; }
    }

    .submit-btn {
      width: 100%; height: 50px; border-radius: 12px; background: #E50914; color: #FFF; border: none; font-size: 16px; font-weight: 800; cursor: pointer; transition: background 150ms ease;
      &:hover { background: #FF1E27; }
    }
  `]
})
export class ProfileSelectionPage {
  readonly profileStore = inject(ProfileStore);

  showPinModal = false;
  showAddModal = false;

  pendingProfile: UserProfile | null = null;
  pin1 = ''; pin2 = ''; pin3 = ''; pin4 = '';
  pinError = false;

  newProfileName = '';
  isNewKids = false;
  selectedAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80';

  avatarOptions = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&q=80'
  ];

  constructor(private router: Router) {}

  selectProfile(p: UserProfile): void {
    if (p.hasPin) {
      this.pendingProfile = p;
      this.showPinModal = true;
      this.pin1 = ''; this.pin2 = ''; this.pin3 = ''; this.pin4 = '';
      this.pinError = false;
    } else {
      this.profileStore.setActiveProfile(p);
      if (p.isKids) {
        this.router.navigate(['/kids']);
      } else {
        this.router.navigate(['/home']);
      }
    }
  }

  onPinInput(idx: number): void {
    if (idx === 1 && this.pin1) document.getElementById('p2')?.focus();
    if (idx === 2 && this.pin2) document.getElementById('p3')?.focus();
    if (idx === 3 && this.pin3) document.getElementById('p4')?.focus();
  }

  verifyPin(): void {
    const fullPin = `${this.pin1}${this.pin2}${this.pin3}${this.pin4}`;
    if (fullPin === '1234' || fullPin === '0000') {
      if (this.pendingProfile) {
        this.profileStore.setActiveProfile(this.pendingProfile);
        this.showPinModal = false;
        this.router.navigate(['/home']);
      }
    } else {
      this.pinError = true;
    }
  }

  createProfile(): void {
    if (!this.newProfileName.trim()) return;
    const newP: UserProfile = {
      id: 'p_' + Math.random().toString(36).substring(2, 7),
      name: this.newProfileName.trim(),
      avatarUrl: this.selectedAvatar,
      isKids: this.isNewKids,
      maturityRating: this.isNewKids ? 'U' : 'ALL',
      hasPin: false
    };
    this.profileStore.addProfile(newP);
    this.showAddModal = false;
    this.newProfileName = '';
  }
}
