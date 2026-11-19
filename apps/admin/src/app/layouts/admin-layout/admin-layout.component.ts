import { Component, OnInit, OnDestroy, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subscription } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AuthService } from '../../core/auth/auth.service';
import { NavigationItem } from '../../core/auth/models/auth.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-layout',
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
    <mat-sidenav-container class="admin-container" autosize>
      <mat-sidenav 
        #drawer 
        [mode]="isMobile ? 'over' : 'side'" 
        [opened]="!isMobile" 
        class="admin-sidenav"
        [fixedInViewport]="isMobile"
        [fixedTopGap]="0"
        [fixedBottomGap]="0">
        
        <div class="brand">
          <img *ngIf="brandLogoUrl; else fallbackBrandIcon" class="brand-logo" [src]="brandLogoUrl" [alt]="brandName + ' logo'">
          <ng-template #fallbackBrandIcon><mat-icon class="brand-icon">play_circle_filled</mat-icon></ng-template>
          <div class="brand-text">
            <h2>{{ brandName }}</h2>
            <span class="brand-sub">Console Admin</span>
          </div>
          <button *ngIf="isMobile" mat-icon-button class="close-drawer-btn" (click)="drawer.close()" aria-label="Close menu">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-nav-list class="nav-list">
          <ng-container *ngFor="let item of navItems">
            <ng-container *ngIf="isItemVisible(item)">
              <!-- Expandable Dropdown Menu Item -->
              <ng-container *ngIf="item.children?.length; else singleNavItem">
                <a mat-list-item class="nav-parent-item" (click)="toggleMenu(item.label)">
                  <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                  <span matListItemTitle class="nav-item-title">{{ item.label }}</span>
                  <mat-icon matListItemMeta class="dropdown-chevron">
                    {{ expandedMenus[item.label] ? 'expand_less' : 'expand_more' }}
                  </mat-icon>
                </a>
                <div class="nav-submenu" *ngIf="expandedMenus[item.label]">
                  <a mat-list-item class="nav-sub-item" *ngFor="let child of item.children" [routerLink]="child.route" [queryParams]="child.queryParams" routerLinkActive="active-link" [routerLinkActiveOptions]="{ exact: true }" (click)="onNavItemClick(drawer)">
                    <mat-icon matListItemIcon>{{ child.icon }}</mat-icon>
                    <span matListItemTitle class="nav-item-title">{{ child.label }}</span>
                  </a>
                </div>
              </ng-container>

              <!-- Regular Link Item -->
              <ng-template #singleNavItem>
                <a mat-list-item [routerLink]="item.route" [queryParams]="item.queryParams" routerLinkActive="active-link" [routerLinkActiveOptions]="{ exact: false }" (click)="onNavItemClick(drawer)">
                  <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
                  <span matListItemTitle class="nav-item-title">{{ item.label }}</span>
                </a>
              </ng-template>
            </ng-container>
          </ng-container>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="admin-content">
        <mat-toolbar color="primary" class="admin-toolbar">
          <button mat-icon-button class="menu-toggle-btn" (click)="drawer.toggle()" aria-label="Toggle navigation menu">
            <mat-icon>menu</mat-icon>
          </button>

          <div class="mobile-brand-title" *ngIf="isMobile">
            <span>{{ brandName }}</span>
          </div>

          <span class="spacer"></span>

          <div class="user-profile" *ngIf="authStore.currentUser() as user">
            <div class="user-meta" *ngIf="!isMobile">
              <span class="user-name">{{ user.name }}</span>
              <span class="user-role-tag">{{ user.roles[0] || 'ADMIN' }}</span>
            </div>
            <button mat-icon-button [matMenuTriggerFor]="menu" class="avatar-btn" [matTooltip]="user.name">
              <mat-icon>account_circle</mat-icon>
            </button>
            <mat-menu #menu="matMenu" class="user-dropdown-menu">
              <div class="dropdown-header">
                <span class="dropdown-user-name">{{ user.name }}</span>
                <span class="dropdown-user-role">{{ user.roles.join(', ') }}</span>
              </div>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="logout()">
                <mat-icon color="warn">logout</mat-icon>
                <span>Logout</span>
              </button>
            </mat-menu>
          </div>
        </mat-toolbar>

        <main class="page-body">
          <router-outlet></router-outlet>
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .admin-container {
      height: 100vh;
      background-color: #121216;
      color: #ffffff;
    }
    .admin-sidenav {
      width: min(280px, 85vw);
      background-color: #1a1a24;
      border-right: 1px solid #2a2a38;
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.4);
    }
    .nav-parent-item { cursor: pointer; }
    .dropdown-chevron { color: #94a3b8; font-size: 20px; }
    .nav-submenu {
      padding-left: 20px;
      margin: 2px 10px 6px 18px;
      border-left: 2px solid rgba(229, 9, 20, 0.45);
    }
    .nav-sub-item {
      height: 40px !important;
      border-radius: 8px;
      margin-bottom: 2px;
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

      .brand-text {
        flex: 1;
        overflow: hidden;
        h2 {
          margin: 0;
          color: #ffffff;
          font-size: 16px;
          font-weight: 800;
          line-height: 1.15;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .brand-sub {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #e50914;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      }

      .brand-icon {
        font-size: 32px;
        width: 38px;
        height: 38px;
        flex: 0 0 38px;
        color: #e50914;
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
          background-color: rgba(229, 9, 20, 0.15);
          color: #e50914;
          font-weight: 700;
        }
      }
    }
    .admin-toolbar {
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
    .mobile-brand-title {
      font-size: 16px;
      font-weight: 800;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 8px;

      .user-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        .user-name {
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.2;
        }
        .user-role-tag {
          font-size: 10px;
          color: #e50914;
          font-weight: 700;
          letter-spacing: 0.4px;
        }
      }

      .avatar-btn {
        color: #ffffff;
      }
    }
    .dropdown-header {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      .dropdown-user-name {
        font-weight: 700;
        font-size: 14px;
        color: #ffffff;
      }
      .dropdown-user-role {
        font-size: 11px;
        color: #8b95aa;
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
export class AdminLayoutComponent implements OnInit, OnDestroy {
  @ViewChild('drawer') drawer?: MatSidenav;

  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly breakpointObserver = inject(BreakpointObserver);

  isMobile = false;
  private breakpointSub?: Subscription;

  brandName = 'MaxxPixels';
  brandLogoUrl = 'assets/logo.png';
  expandedMenus: Record<string, boolean> = { Content: false };

  toggleMenu(label: string): void {
    this.expandedMenus[label] = !this.expandedMenus[label];
  }

  readonly navItems: (NavigationItem & { children?: NavigationItem[] })[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/admin/dashboard' },
    { label: 'Analytics & BI', icon: 'bar_chart', route: '/admin/analytics' },
    {
      label: 'Content',
      icon: 'add_box',
      route: '/admin/content',
      permissions: ['CONTENT_CREATE'],
      children: [
        { label: 'Single (Movies, Songs...)', icon: 'movie', route: '/admin/movies/new', permissions: ['CONTENT_CREATE'] },
        { label: 'Series & Episodes', icon: 'tv', route: '/admin/series/new', permissions: ['CONTENT_CREATE'] }
      ]
    },
    { label: 'Basic Details', icon: 'dataset', route: '/admin/basic-details', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'All Catalog', icon: 'apps', route: '/admin/movies', queryParams: { type: 'ALL' }, permissions: ['CONTENT_VIEW'] },
    { label: 'Movies', icon: 'movie', route: '/admin/movies', queryParams: { type: 'MOVIE' }, permissions: ['CONTENT_VIEW'] },
    { label: 'Music & Songs', icon: 'album', route: '/admin/movies', queryParams: { type: 'ALBUM' }, permissions: ['CONTENT_VIEW'] },
    { label: 'Microdramas', icon: 'video_collection', route: '/admin/movies', queryParams: { type: 'MICRODRAMA' }, permissions: ['CONTENT_VIEW'] },
    { label: 'Short Films', icon: 'slideshow', route: '/admin/movies', queryParams: { type: 'SHORT_FILM' }, permissions: ['CONTENT_VIEW'] },
    { label: 'Podcasts', icon: 'podcasts', route: '/admin/movies', queryParams: { type: 'PODCAST' }, permissions: ['CONTENT_VIEW'] },
    { label: 'Series', icon: 'tv', route: '/admin/series', permissions: ['CONTENT_VIEW'] },
    { label: 'Live TV & Sports', icon: 'live_tv', route: '/admin/live', permissions: ['CONTENT_VIEW'] },
    { label: 'Producers Directory', icon: 'business', route: '/admin/producers', permissions: ['PRODUCER_VIEW'] },
    { label: 'Producer Onboarding', icon: 'person_add', route: '/admin/producers/onboard', permissions: ['PRODUCER_VIEW'] },
    { label: 'Producer Reviews', icon: 'fact_check', route: '/admin/producer-reviews', permissions: ['PRODUCER_VIEW'] },
    { label: 'Home CMS', icon: 'view_quilt', route: '/admin/cms', permissions: ['CONTENT_UPDATE'] },
    { label: 'Intro Video', icon: 'play_circle_filled', route: '/admin/intro-video', permissions: ['CONTENT_UPDATE'] },
    { label: 'Portal Banners', icon: 'view_carousel', route: '/admin/portal-banners', permissions: ['CONTENT_UPDATE'] },
    { label: 'Legal Pages', icon: 'gavel', route: '/admin/legal-pages', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'Users', icon: 'people', route: '/admin/users', permissions: ['USER_VIEW'] },
    { label: 'Subscription Plans', icon: 'loyalty', route: '/admin/plans', permissions: ['SUBSCRIPTION_VIEW'] },
    { label: 'Payment Transactions', icon: 'payments', route: '/admin/payments', permissions: ['PAYMENT_VIEW'] },
    { label: 'Coupons & Offers', icon: 'card_giftcard', route: '/admin/coupons', roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MARKETING'] },
    { label: 'Marketing Agents', icon: 'campaign', route: '/admin/marketing-agents', roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING'] },
    { label: 'Ad Monetization & IMA', icon: 'monetization_on', route: '/admin/ads' },
    { label: 'SSAI Video Campaigns', icon: 'slideshow', route: '/admin/ads/ssai' },
    { label: 'Multi-DRM Security', icon: 'lock', route: '/admin/drm', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'Notifications', icon: 'campaign', route: '/admin/notifications', permissions: ['CONTENT_CREATE'] },
    { label: 'Security Audit Logs', icon: 'history', route: '/admin/audit', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'System Health', icon: 'health_and_safety', route: '/admin/system-health', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'Roles & Security', icon: 'security', route: '/admin/security', roles: ['SUPER_ADMIN', 'ADMIN'] },
    { label: 'System Settings', icon: 'settings', route: '/admin/settings', roles: ['SUPER_ADMIN', 'ADMIN'] }
  ];

  isItemVisible(item: NavigationItem): boolean {
    if (item.roles && !this.authStore.hasAnyRole(item.roles)) return false;
    if (item.permissions && !this.authStore.hasAnyPermission(item.permissions)) return false;
    return true;
  }

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
    this.authService.logout('/login');
  }
}

