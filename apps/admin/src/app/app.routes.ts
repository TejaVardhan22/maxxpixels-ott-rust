import { Routes } from '@angular/router';
import { adminGuard, producerGuard, publicOnlyGuard } from './core/auth/auth.guard';
import { permissionGuard } from './core/auth/permission.guard';

export const routes: Routes = [
  // PUBLIC AUTH & ERROR ROUTES
  {
    path: 'login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./features/auth/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'producer/login',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./features/producer-portal/producer-login.page').then(m => m.ProducerLoginPage)
  },
  {
    path: 'producer/register',
    canActivate: [publicOnlyGuard],
    loadComponent: () => import('./features/producer-portal/producer-login.page').then(m => m.ProducerLoginPage)
  },
  {
    path: 'producer/signup',
    redirectTo: 'producer/register',
    pathMatch: 'full'
  },
  {
    path: '403',
    loadComponent: () => import('./features/error/forbidden.page').then(m => m.ForbiddenPage)
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./features/error/forbidden.page').then(m => m.ForbiddenPage)
  },

  // DEFAULT REDIRECT TO ADMIN DASHBOARD
  {
    path: '',
    redirectTo: 'admin',
    pathMatch: 'full'
  },
  {
    path: 'legal-pages',
    redirectTo: 'admin/legal-pages',
    pathMatch: 'full'
  },

  // STRICT ADMIN PORTAL ROUTES (Requires ADMIN or SUPER_ADMIN role)
  {
    path: 'admin',
    canActivate: [adminGuard],
    canActivateChild: [adminGuard],
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/admin-dashboard.page').then(m => m.AdminDashboardPage)
      },
      {
        path: 'analytics',
        loadComponent: () => import('./features/analytics/analytics-dashboard.page').then(m => m.AnalyticsDashboardPage)
      },
      {
        path: 'movies',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_VIEW'] },
        loadComponent: () => import('./features/movies/movie-list.page').then(m => m.MovieListPage)
      },
      {
        path: 'movies/new',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_CREATE'] },
        loadComponent: () => import('./features/movies/movie-form.page').then(m => m.MovieFormPage)
      },
      {
        path: 'movies/edit/:id',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/movies/movie-form.page').then(m => m.MovieFormPage)
      },
      {
        path: 'movies/:id/edit',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/movies/movie-form.page').then(m => m.MovieFormPage)
      },
      {
        path: 'series',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_VIEW'] },
        loadComponent: () => import('./features/series/series-list.page').then(m => m.SeriesListPage)
      },
      {
        path: 'series/new',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_CREATE'] },
        loadComponent: () => import('./features/series/series-form.page').then(m => m.SeriesFormPage)
      },
      {
        path: 'series/:id/edit',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/series/series-form.page').then(m => m.SeriesFormPage)
      },
      {
        path: 'series/edit/:id',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/series/series-form.page').then(m => m.SeriesFormPage)
      },
      {
        path: 'live',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_VIEW'] },
        loadComponent: () => import('./features/live/live-list.page').then(m => m.LiveListPage)
      },
      {
        path: 'users',
        canActivate: [permissionGuard],
        data: { permissions: ['USER_VIEW'] },
        loadComponent: () => import('./features/users/user-list.page').then(m => m.UserListPage)
      },
      {
        path: 'plans',
        canActivate: [permissionGuard],
        data: { permissions: ['SUBSCRIPTION_VIEW'] },
        loadComponent: () => import('./features/subscriptions/subscription-list.page').then(m => m.SubscriptionListPage)
      },
      {
        path: 'payments',
        canActivate: [permissionGuard],
        data: { permissions: ['PAYMENT_VIEW'] },
        loadComponent: () => import('./features/payments/payment-list.page').then(m => m.PaymentListPage)
      },
      {
        path: 'ads',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_VIEW'] },
        loadComponent: () => import('./features/ads/ad-monetization.page').then(m => m.AdMonetizationPage)
      },
      {
        path: 'ads/ssai',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_VIEW'] },
        loadComponent: () => import('./features/ads/ad-campaign-list.page').then(m => m.AdCampaignListPage)
      },
      {
        path: 'drm',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/drm/drm-protection.page').then(m => m.DrmProtectionPage)
      },
      {
        path: 'analytics',
        canActivate: [permissionGuard],
        data: { permissions: ['ANALYTICS_VIEW'] },
        loadComponent: () => import('./features/analytics/analytics-dashboard.page').then(m => m.AnalyticsDashboardPage)
      },
      {
        path: 'notifications',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_CREATE'] },
        loadComponent: () => import('./features/notifications/notification-list.page').then(m => m.NotificationListPage)
      },
      {
        path: 'producers',
        canActivate: [permissionGuard],
        data: { permissions: ['PRODUCER_VIEW'] },
        loadComponent: () => import('./features/producers/producer-list.page').then(m => m.ProducerListPage)
      },
      {
        path: 'producers/onboard',
        canActivate: [permissionGuard],
        data: { permissions: ['PRODUCER_VIEW'] },
        loadComponent: () => import('./features/producers/producer-onboarding.page').then(m => m.ProducerOnboardingPage)
      },
      {
        path: 'producers/onboarding',
        redirectTo: 'producers/onboard',
        pathMatch: 'full'
      },
      {
        path: 'producer-onboarding',
        redirectTo: 'producers/onboard',
        pathMatch: 'full'
      },
      {
        path: 'producer-reviews',
        canActivate: [permissionGuard],
        data: { permissions: ['PRODUCER_VIEW'] },
        loadComponent: () => import('./features/producers/producer-reviews.page').then(m => m.ProducerReviewsPage)
      },
      {
        path: 'cms',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/cms/cms-list.page').then(m => m.CmsListPage)
      },
      {
        path: 'intro-video',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/home-content/intro-video.page').then(m => m.IntroVideoPage)
      },
      {
        path: 'banners',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/home-content/hero-banners.page').then(m => m.HeroBannersPage)
      },
      {
        path: 'portal-banners',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_UPDATE'] },
        loadComponent: () => import('./features/home-content/portal-banners.page').then(m => m.PortalBannersPage)
      },
      {
        path: 'categories',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_VIEW'] },
        loadComponent: () => import('./features/categories/category-list.page').then(m => m.CategoryListPage)
      },
      {
        path: 'content',
        canActivate: [permissionGuard],
        data: { permissions: ['CONTENT_CREATE'] },
        loadComponent: () => import('./features/content/content-hub.page').then(m => m.ContentHubPage)
      },
      {
        path: 'basic-details',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/master-data/master-data.page').then(m => m.MasterDataPage)
      },
      {
        path: 'master-data',
        redirectTo: 'basic-details',
        pathMatch: 'full'
      },
      {
        path: 'legal-pages',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/legal/legal-pages.page').then(m => m.LegalPagesPage)
      },
      {
        path: 'coupons',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'MARKETING'] },
        loadComponent: () => import('./features/coupons/coupon-list.page').then(m => m.CouponListPage)
      },
      {
        path: 'marketing-agents',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING'] },
        loadComponent: () => import('./features/marketing/marketing-agents.page').then(m => m.MarketingAgentsPage)
      },
      {
        path: 'security',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/security/roles-permissions.page').then(m => m.RolesPermissionsPage)
      },
      {
        path: 'audit',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/audit/audit-log.page').then(m => m.AuditLogPage)
      },
      {
        path: 'devices',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/devices/device-list.page').then(m => m.DeviceListPage)
      },
      {
        path: 'system-health',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/system/system-health.page').then(m => m.SystemHealthPage)
      },
      {
        path: 'settings',
        canActivate: [permissionGuard],
        data: { roles: ['SUPER_ADMIN', 'ADMIN'] },
        loadComponent: () => import('./features/settings/system-settings.page').then(m => m.SystemSettingsPage)
      }
    ]
  },

  // STRICT PRODUCER PORTAL ROUTES (Requires PRODUCER or ADMIN role)
  {
    path: 'producer',
    canActivate: [producerGuard],
    canActivateChild: [producerGuard],
    loadComponent: () => import('./layouts/producer-layout/producer-layout.component').then(m => m.ProducerLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/producer-portal/producer-content-dashboard.page').then(m => m.ProducerContentDashboardPage)
      },
      {
        path: 'submit',
        loadComponent: () => import('./features/producer-portal/content-submission.page').then(m => m.ContentSubmissionPage)
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./features/producer-portal/content-submission.page').then(m => m.ContentSubmissionPage)
      },
      {
        path: 'submissions',
        loadComponent: () => import('./features/producer-portal/content-submission.page').then(m => m.ContentSubmissionPage)
      },
      {
        path: 'portal',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'ad-analytics',
        loadComponent: () => import('./features/producer-portal/ad-analytics.page').then(m => m.AdAnalyticsPage)
      }
    ]
  },

  // PUBLIC PRODUCER CONTENT SUBMISSION (no auth required)
  {
    path: 'producer/submit-content',
    loadComponent: () => import('./features/producer-portal/public-submission/public-submission.page').then(m => m.PublicSubmissionPage)
  },
  {
    path: 'submit-content',
    redirectTo: 'producer/submit-content',
    pathMatch: 'full'
  },

  // OTT CONSUMER STREAMING PORTAL ROUTES
  {
    path: 'ott',
    loadComponent: () => import('./layouts/ott-layout/ott-layout.component').then(m => m.OttLayoutComponent),
    children: [
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        loadComponent: () => import('./features/ott/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'movies',
        loadComponent: () => import('./features/ott/movies/movies.page').then(m => m.MoviesPage)
      },
      {
        path: 'movie/:id',
        loadComponent: () => import('./features/ott/details/movie-detail.page').then(m => m.MovieDetailPage)
      },
      {
        path: 'series',
        loadComponent: () => import('./features/ott/series/series.page').then(m => m.SeriesPage)
      },
      {
        path: 'series/:id',
        loadComponent: () => import('./features/ott/details/series-detail.page').then(m => m.SeriesDetailPage)
      },
      {
        path: 'live',
        loadComponent: () => import('./features/ott/live/live.page').then(m => m.LivePage)
      },
      {
        path: 'kids',
        loadComponent: () => import('./features/ott/kids/kids.page').then(m => m.KidsPage)
      },
      {
        path: 'search',
        loadComponent: () => import('./features/ott/search/search.page').then(m => m.SearchPage)
      },
      {
        path: 'my-list',
        loadComponent: () => import('./features/ott/my-list/my-list.page').then(m => m.MyListPage)
      },
      {
        path: 'plans',
        loadComponent: () => import('./features/ott/plans/plans.page').then(m => m.PlansPage)
      },
      {
        path: 'profiles',
        loadComponent: () => import('./features/ott/profiles/profile-selection.page').then(m => m.ProfileSelectionPage)
      },
      {
        path: 'watch/:id',
        loadComponent: () => import('./features/ott/player/player.page').then(m => m.PlayerPage)
      },
      {
        path: 'login-otp',
        loadComponent: () => import('./features/ott/auth/otp-login.page').then(m => m.OtpLoginPage)
      },
      {
        path: 'account/devices',
        loadComponent: () => import('./features/ott/account/account-devices.page').then(m => m.AccountDevicesPage)
      }
    ]
  },

  // OTT TOP-LEVEL CONVENIENCE ROUTES (e.g. /home, /watch/:id, /movie/:id)
  {
    path: '',
    loadComponent: () => import('./layouts/ott-layout/ott-layout.component').then(m => m.OttLayoutComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/ott/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'watch/:id',
        loadComponent: () => import('./features/ott/player/player.page').then(m => m.PlayerPage)
      },
      {
        path: 'movie/:id',
        loadComponent: () => import('./features/ott/details/movie-detail.page').then(m => m.MovieDetailPage)
      },
      {
        path: 'kids',
        loadComponent: () => import('./features/ott/kids/kids.page').then(m => m.KidsPage)
      },
      {
        path: 'search',
        loadComponent: () => import('./features/ott/search/search.page').then(m => m.SearchPage)
      },
      {
        path: 'my-list',
        loadComponent: () => import('./features/ott/my-list/my-list.page').then(m => m.MyListPage)
      },
      {
        path: 'profiles',
        loadComponent: () => import('./features/ott/profiles/profile-selection.page').then(m => m.ProfileSelectionPage)
      },
      {
        path: 'login-otp',
        loadComponent: () => import('./features/ott/auth/otp-login.page').then(m => m.OtpLoginPage)
      }
    ]
  },

  // FALLBACK UNKNOWN ROUTES
  {
    path: '**',
    redirectTo: 'admin'
  }
];
