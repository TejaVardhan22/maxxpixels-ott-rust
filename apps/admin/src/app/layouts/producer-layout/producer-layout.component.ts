import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthService } from '../../core/auth/auth.service';
import { NavigationItem } from '../../core/auth/models/auth.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-producer-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule
  ],
  template: `
    <mat-sidenav-container class="producer-container" autosize>
      <mat-sidenav 
        #drawer 
        [mode]="isMobile ? 'over' : 'side'" 
        [opened]="!isMobile" 
        class="producer-sidenav"
        [fixedInViewport]="isMobile"
        [fixedTopGap]="0"
        [fixedBottomGap]="0">
        
        <div class="brand">
          <img *ngIf="brandLogoUrl; else fallbackBrandIcon" class="brand-logo" [src]="brandLogoUrl" [alt]="brandName + ' Producer Logo'">
          <ng-template #fallbackBrandIcon><mat-icon class="brand-icon">movie_creation</mat-icon></ng-template>
          <div class="brand-text">
            <h2>{{ brandName }}</h2>
            <span class="brand-sub">Producer Studio</span>
          </div>
          <button *ngIf="isMobile" mat-icon-button class="close-drawer-btn" (click)="drawer.close()" aria-label="Close menu">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-nav-list class="nav-list">
          <ng-container *ngFor="let item of navItems">
            <a mat-list-item [routerLink]="item.route" routerLinkActive="active-link" (click)="onNavItemClick(drawer)">
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle class="nav-item-title">{{ item.label }}</span>
            </a>
          </ng-container>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="producer-content">
        <mat-toolbar color="primary" class="producer-toolbar">
          <button mat-icon-button class="menu-toggle-btn" (click)="drawer.toggle()" aria-label="Toggle navigation menu">
            <mat-icon>menu</mat-icon>
          </button>

          <span class="toolbar-title" *ngIf="!isMobile">Producer Studio Portal</span>
          <span class="toolbar-title mobile-title" *ngIf="isMobile">{{ brandName }} Studio</span>
          <span class="spacer"></span>

          <!-- Authenticated User Profile & Logout -->
          <div class="user-profile" *ngIf="authStore.currentUser() as user; else loginButton">
            <div class="user-info" *ngIf="!isMobile">
              <span class="user-name">{{ user.name || 'Studio Partner' }}</span>
              <span class="role-badge">PRODUCER</span>
            </div>
            <button mat-icon-button [matMenuTriggerFor]="menu" class="avatar-btn" [matTooltip]="user.name || 'Producer'">
              <mat-icon>account_circle</mat-icon>
            </button>
            <mat-menu #menu="matMenu" class="custom-menu">
              <div mat-menu-item disabled class="menu-header">
                <strong>{{ user.email || 'producer@maxxpixels.tv' }}</strong>
              </div>
              <a mat-menu-item routerLink="/producer/dashboard">
                <mat-icon>dashboard</mat-icon>
                <span>Studio Dashboard</span>
              </a>
              <button mat-menu-item (click)="logout()">
                <mat-icon color="warn">logout</mat-icon>
                <span>Logout Studio</span>
              </button>
            </mat-menu>
          </div>

          <!-- Unauthenticated State -->
          <ng-template #loginButton>
            <button mat-raised-button color="accent" routerLink="/producer/login" class="login-btn">
              <mat-icon>login</mat-icon>
              <span *ngIf="!isMobile">Producer Login</span>
            </button>
          </ng-template>
        </mat-toolbar>

        <main class="page-body">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .producer-container {
      height: 100vh;
      background-color: #121216;
      color: #ffffff;
    }
    .producer-sidenav {
      width: min(280px, 85vw);
      background-color: #1a1a24;
      border-right: 1px solid #2a2a38;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
    }
    .brand {
      min-height: 64px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #2a2a38;
      .brand-logo {
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        object-fit: contain;
      }
      .brand-icon {
        font-size: 32px;
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        color: #3498db;
      }
      .brand-text {
        flex: 1;
        overflow: hidden;
        h2 {
          font-size: 16px;
          font-weight: 800;
          margin: 0;
          color: #ffffff;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brand-sub {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #3498db;
          letter-spacing: 0.5px;
        }
      }
      .close-drawer-btn {
        color: #a0a0b0;
      }
    }
    .nav-list {
      padding: 8px 4px;
      a {
        color: #a0a0b0;
        margin: 2px 6px;
        border-radius: 8px;
        transition: all 0.2s ease;
        .nav-item-title {
          font-size: 13.5px;
          font-weight: 600;
          white-space: nowrap;
        }
        &:hover {
          background-color: rgba(255, 255, 255, 0.05);
          color: #ffffff;
        }
        &.active-link {
          background-color: rgba(52, 152, 219, 0.15);
          color: #3498db;
          font-weight: 700;
        }
      }
    }
    .producer-toolbar {
      background-color: #1a1a24 !important;
      border-bottom: 1px solid #2a2a38;
      height: 60px;
      padding: 0 16px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .menu-toggle-btn {
      color: #ffffff;
    }
    .toolbar-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      &.mobile-title {
        font-size: 15px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    .spacer {
      flex: 1 1 auto;
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 8px;
      .user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .user-name {
        font-size: 13px;
        font-weight: 600;
        line-height: 1.2;
      }
      .role-badge {
        font-size: 10px;
        background: rgba(52, 152, 219, 0.2);
        color: #3498db;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: 700;
        letter-spacing: 0.4px;
      }
    }
    .page-body {
      padding: clamp(12px, 2.5vw, 24px);
      background-color: #121216;
      min-height: calc(100vh - 60px);
      box-sizing: border-box;
      overflow-x: hidden;
    }

    @media (min-width: 960px) {
      .menu-toggle-btn {
        display: none;
      }
    }
  `]
})
export class ProducerLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer?: MatSidenav;

  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly breakpointObserver = inject(BreakpointObserver);

  isMobile = false;
  private breakpointSub?: Subscription;

  brandName = 'MaxxPixels';
  brandLogoUrl = 'assets/logo.png';

  get isAdmin(): boolean {
    return this.authStore.isStrictAdmin() && !this.authStore.isOnlyProducer();
  }

  // Producer portal shows ONLY the content dashboard — all other screens are
  // hidden. (Routes for submit/ad-analytics remain valid but are not navigable.)
  readonly navItems: NavigationItem[] = [
    { label: 'Producer Dashboard', icon: 'dashboard', route: '/producer/dashboard' },
  ];

  ngOnInit(): void {
    this.breakpointSub = this.breakpointObserver
      .observe(['(max-width: 959.98px)'])
      .subscribe((state) => {
        this.isMobile = state.matches;
      });

    this.http.get<any>(`${environment.apiBaseUrl}/settings`).subscribe({
      next: (response) => {
        const settings = response?.data ?? {};
        this.brandName = settings.app_short_name || settings.platform_name || this.brandName;
        this.brandLogoUrl = settings.dark_logo_url || settings.logo_url || 'assets/logo.png';
      }
    });
  }

  ngOnDestroy(): void {
    this.breakpointSub?.unsubscribe();
  }

  onNavItemClick(drawer: MatSidenav): void {
    if (this.isMobile) {
      drawer.close();
    }
  }

  logout(): void {
    this.authService.logout('/producer/login');
  }
}

