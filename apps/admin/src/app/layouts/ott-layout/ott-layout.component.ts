import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ProfileStore } from '../../core/profiles/profile.store';
import { PwaInstallService } from '../../core/services/pwa-install.service';

@Component({
  selector: 'app-ott-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, MatMenuModule],
  template: `
    <div class="ott-shell">
      <!-- Desktop Header Navbar -->
      <header class="ott-header" [class.scrolled]="isScrolled">
        <div class="header-container">
          <div class="header-left">
            <a routerLink="/" class="brand-logo">
              <span class="logo-mark">MAXX</span>
              <span class="logo-accent">PIXELS</span>
            </a>

            <nav class="desktop-nav">
              <a routerLink="/home" routerLinkActive="active">Home</a>
              <a routerLink="/movies" routerLinkActive="active">Movies</a>
              <a routerLink="/series" routerLinkActive="active">Series</a>
              <a routerLink="/live" routerLinkActive="active">Live TV</a>
              <a routerLink="/sports" routerLinkActive="active">Sports</a>
              <a routerLink="/kids" routerLinkActive="active">Kids</a>
              <a routerLink="/my-list" routerLinkActive="active">My List</a>
            </nav>
          </div>

          <div class="header-right">
            <!-- PWA Install Button (Displays when browser supports PWA install) -->
            <button *ngIf="pwaService.canInstall()" class="pwa-install-btn" (click)="installPwa()" title="Install MaxxPixels Desktop/Mobile App">
              <mat-icon>get_app</mat-icon>
              <span>Install App</span>
            </button>

            <!-- Search Icon / Link -->
            <a routerLink="/search" class="icon-nav-btn search-btn" title="Search movies, shows, genres">
              <mat-icon>search</mat-icon>
              <span class="search-label">Search</span>
            </a>

            <!-- Subscription VIP Pill Badge -->
            <a routerLink="/plans" class="plan-badge-link" title="Manage Subscription">
              <span class="vip-pill"><mat-icon class="vip-icon">stars</mat-icon> PREMIUM 4K</span>
            </a>

            <!-- Notifications Menu -->
            <button class="icon-nav-btn notif-btn" [matMenuTriggerFor]="notifMenu" title="Notifications">
              <mat-icon>notifications_none</mat-icon>
              <span *ngIf="notifications.length > 0" class="notif-badge">{{ notifications.length }}</span>
            </button>
            <mat-menu #notifMenu="matMenu" class="notif-dropdown">
              <div class="notif-header">
                <span>Notifications</span>
                <span *ngIf="notifications.length > 0" class="mark-read" (click)="notifications = []">Mark all as read</span>
              </div>
              <div *ngIf="notifications.length === 0" style="padding: 20px 16px; color: #747B89; font-size: 13px; text-align: center;">
                No new notifications
              </div>
              <div *ngFor="let notif of notifications" class="notif-item" [class.unread]="notif.unread">
                <div class="notif-icon-box"><mat-icon>{{ notif.icon || 'notifications' }}</mat-icon></div>
                <div class="notif-text">
                  <span class="notif-title">{{ notif.title }}</span>
                  <span class="notif-time">{{ notif.time }}</span>
                </div>
              </div>
            </mat-menu>

            <!-- Profile Avatar / Switcher -->
            <button class="profile-avatar-btn" [matMenuTriggerFor]="profileMenu">
              <div class="avatar-box">
                <img [src]="profileStore.activeProfile()?.avatarUrl" [alt]="profileStore.activeProfile()?.name" class="avatar-img">
                <span class="status-dot"></span>
              </div>
              <span class="profile-badge-name">{{ profileStore.activeProfile()?.name }}</span>
              <mat-icon class="arrow-down">keyboard_arrow_down</mat-icon>
            </button>
            <mat-menu #profileMenu="matMenu" class="profile-dropdown">
              <div class="profile-header">
                <span class="profile-name">{{ profileStore.activeProfile()?.name }}</span>
                <span class="profile-plan">Premium 4K Account</span>
              </div>
              <div class="profiles-sub-list">
                <div *ngFor="let p of profileStore.allProfiles()" class="sub-profile-item" (click)="profileStore.setActiveProfile(p)">
                  <img [src]="p.avatarUrl" [alt]="p.name" class="mini-avatar" />
                  <span>{{ p.name }}</span>
                  <mat-icon *ngIf="p.id === profileStore.activeProfile()?.id" class="check-icon">check</mat-icon>
                </div>
              </div>
              <a mat-menu-item routerLink="/profiles">
                <mat-icon>people</mat-icon>
                <span>Manage Profiles</span>
              </a>
              <a mat-menu-item routerLink="/account/devices">
                <mat-icon>devices</mat-icon>
                <span>Registered Devices</span>
              </a>
              <a mat-menu-item routerLink="/plans">
                <mat-icon>card_membership</mat-icon>
                <span>Manage Subscription</span>
              </a>
              <a mat-menu-item routerLink="/admin/dashboard">
                <mat-icon>admin_panel_settings</mat-icon>
                <span>Admin Console</span>
              </a>
              <a mat-menu-item routerLink="/login-otp">
                <mat-icon>logout</mat-icon>
                <span>Sign Out</span>
              </a>
            </mat-menu>
          </div>
        </div>
      </header>

      <!-- Main Content Outlet -->
      <main class="ott-main">
        <router-outlet></router-outlet>
      </main>

      <!-- Mobile Bottom Navigation -->
      <nav class="mobile-bottom-nav">
        <a routerLink="/home" routerLinkActive="active" class="bottom-nav-item">
          <mat-icon>home</mat-icon>
          <span>Home</span>
        </a>
        <a routerLink="/search" routerLinkActive="active" class="bottom-nav-item">
          <mat-icon>search</mat-icon>
          <span>Search</span>
        </a>
        <a routerLink="/live" routerLinkActive="active" class="bottom-nav-item">
          <mat-icon>live_tv</mat-icon>
          <span>Live</span>
        </a>
        <a routerLink="/my-list" routerLinkActive="active" class="bottom-nav-item">
          <mat-icon>bookmark_border</mat-icon>
          <span>My List</span>
        </a>
        <a routerLink="/profiles" routerLinkActive="active" class="bottom-nav-item">
          <mat-icon>person_outline</mat-icon>
          <span>Profile</span>
        </a>
      </nav>
    </div>
  `,
  styles: [`
    .ott-shell {
      min-height: 100vh;
      background-color: var(--bg-main, #06070A);
      color: #FFFFFF;
      position: relative;
    }

    /* Desktop Header */
    .ott-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      height: 72px;
      background: linear-gradient(180deg, rgba(6, 7, 10, 0.95) 0%, rgba(6, 7, 10, 0.5) 70%, rgba(6, 7, 10, 0) 100%);
      transition: background 300ms cubic-bezier(0.2, 0, 0, 1), backdrop-filter 300ms cubic-bezier(0.2, 0, 0, 1), border-color 300ms ease;

      &.scrolled {
        background: rgba(5, 7, 10, 0.88);
        backdrop-filter: blur(20px);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
      }
    }

    .header-container {
      max-width: 1600px;
      height: 100%;
      margin: 0 auto;
      padding: 0 36px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 36px;
    }

    .brand-logo {
      text-decoration: none;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      transition: transform 150ms ease;

      &:hover { transform: scale(1.03); }

      .logo-mark { color: #FFFFFF; }
      .logo-accent { color: #E50914; margin-left: 2px; }
    }

    .desktop-nav {
      display: flex;
      align-items: center;
      gap: 8px;

      a {
        text-decoration: none;
        color: var(--text-secondary, #AAB0BC);
        font-size: 14px;
        font-weight: 600;
        padding: 6px 14px;
        border-radius: 20px;
        transition: all 200ms cubic-bezier(0.2, 0, 0, 1);
        border: 1px solid transparent;

        &:hover {
          color: #FFFFFF;
          background: rgba(255, 255, 255, 0.08);
        }

        &.active {
          color: #FFFFFF;
          font-weight: 800;
          background: rgba(229, 9, 20, 0.18);
          border-color: rgba(229, 9, 20, 0.4);
          box-shadow: 0 0 14px rgba(229, 9, 20, 0.2);
        }
      }
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .pwa-install-btn {
      background: linear-gradient(135deg, #22C55E 0%, #16A34A 100%);
      color: #FFF;
      border: none;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.4);
      transition: transform 150ms ease;

      &:hover { transform: scale(1.05); }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }

    .icon-nav-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #AAB0BC;
      height: 38px;
      border-radius: 20px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 12px;
      cursor: pointer;
      position: relative;
      text-decoration: none;
      transition: all 150ms ease;

      &:hover {
        color: #FFFFFF;
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.3);
      }

      .search-label {
        font-size: 13px;
        font-weight: 600;
      }

      .notif-badge {
        background: #E50914;
        color: #FFF;
        font-size: 10px;
        font-weight: 900;
        padding: 1px 6px;
        border-radius: 10px;
        line-height: 1.2;
      }
    }

    .vip-pill {
      background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
      color: #000;
      font-size: 11px;
      font-weight: 900;
      padding: 5px 12px;
      border-radius: 20px;
      letter-spacing: 0.5px;
      box-shadow: 0 0 14px rgba(245, 158, 11, 0.4);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: transform 150ms ease;

      &:hover { transform: scale(1.05); }

      .vip-icon { font-size: 14px; width: 14px; height: 14px; }
    }

    .profile-avatar-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 20px;
      padding: 3px 10px 3px 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 150ms ease;

      &:hover {
        border-color: #E50914;
        background: rgba(255, 255, 255, 0.15);
      }

      .avatar-box {
        position: relative;
        .avatar-img {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .status-dot {
          position: absolute;
          bottom: 0; right: 0;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #22C55E;
          border: 1px solid #000;
        }
      }

      .profile-badge-name {
        font-size: 13px;
        font-weight: 700;
        color: #FFFFFF;
      }

      .arrow-down { font-size: 18px; width: 18px; height: 18px; color: #747B89; }
    }

    .sub-profile-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;

      &:hover { background: rgba(255, 255, 255, 0.1); }

      .mini-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
      .check-icon { font-size: 16px; width: 16px; height: 16px; color: #E50914; margin-left: auto; }
    }

    .ott-main {
      min-height: 100vh;
      padding-bottom: 60px;
    }

    /* Mobile Bottom Navbar */
    .mobile-bottom-nav {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      height: 64px;
      background: rgba(12, 14, 19, 0.95);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      justify-content: space-around;
      align-items: center;
    }

    .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: #747B89;
      text-decoration: none;
      font-size: 11px;
      font-weight: 600;
      min-width: 50px;
      height: 48px;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      &.active {
        color: #E50914;
      }
    }

    @media (max-width: 900px) {
      .desktop-nav { display: none; }
      .header-container { padding: 0 16px; }
      .mobile-bottom-nav { display: flex; }
      .ott-main { padding-bottom: 74px; }
    }
  `]
})
export class OttLayoutComponent implements OnInit {
  readonly profileStore = inject(ProfileStore);
  readonly pwaService = inject(PwaInstallService);
  isScrolled = false;
  notifications: any[] = [];

  @HostListener('window:scroll', [])
  onWindowScroll(): void {
    this.isScrolled = window.scrollY > 40;
  }

  ngOnInit(): void {
    this.onWindowScroll();
  }

  installPwa(): void {
    this.pwaService.promptInstall();
  }
}
