import { Injectable, signal, computed } from '@angular/core';

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: {
    id: string;
    email?: string;
    phone?: string;
    name: string;
    roles: string[];
    permissions?: string[];
  } | null;
  deviceId: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthStore {
  private readonly defaultAdminUser = {
    id: '1',
    name: 'Super Admin',
    email: 'admin@maxxpixels.com',
    roles: ['ADMIN', 'SUPER_ADMIN', 'PRODUCER', 'USER'],
    permissions: ['ALL', 'USER_VIEW', 'USER_EDIT', 'CONTENT_VIEW', 'CONTENT_CREATE', 'CONTENT_EDIT', 'CONTENT_DELETE', 'SUBSCRIPTION_VIEW', 'PAYMENT_VIEW', 'ANALYTICS_VIEW']
  };

  private static normalizeUser(user: any): any {
    if (!user) return user;
    let roles: string[] = user.roles || [];
    if (Array.isArray(roles)) {
      const normalizedRoles = new Set<string>();
      roles.forEach((r: string) => {
        if (!r) return;
        normalizedRoles.add(r);
        if (r.startsWith('ROLE_')) {
          normalizedRoles.add(r.replace(/^ROLE_/, ''));
        } else {
          normalizedRoles.add(`ROLE_${r}`);
        }
      });
      roles = Array.from(normalizedRoles);
    }
    let permissions: string[] = user.permissions || [];
    const isAdminOrSuper = roles.some(r => ['ADMIN', 'ROLE_ADMIN', 'SUPER_ADMIN', 'ROLE_SUPER_ADMIN'].includes(r));
    if (isAdminOrSuper && (!permissions.length || !permissions.includes('ALL'))) {
      permissions = ['ALL', 'USER_VIEW', 'USER_EDIT', 'CONTENT_VIEW', 'CONTENT_CREATE', 'CONTENT_EDIT', 'CONTENT_DELETE', 'CONTENT_UPDATE', 'PRODUCER_VIEW', 'SUBSCRIPTION_VIEW', 'PAYMENT_VIEW', 'ANALYTICS_VIEW'];
    }
    const name = user.name || user.fullName || user.full_name || user.email || 'Admin';
    return {
      ...user,
      name,
      roles,
      permissions
    };
  }

  private readonly initialToken = localStorage.getItem('ott_access_token');
  private readonly initialUser = (() => {
    try {
      const raw = localStorage.getItem('ott_user');
      return raw ? AuthStore.normalizeUser(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  })();

  private readonly state = signal<AuthState>({
    accessToken: this.initialUser && this.initialToken ? this.initialToken : null,
    refreshToken: localStorage.getItem('ott_refresh_token'),
    user: this.initialUser && this.initialToken ? this.initialUser : null,
    deviceId: localStorage.getItem('ott_device_id') || this.generateDeviceId()
  });

  // Signal Selectors
  readonly accessToken = computed(() => this.state().accessToken);
  readonly refreshToken = computed(() => this.state().refreshToken);
  readonly currentUser = computed(() => this.state().user);
  readonly permissions = computed(() => this.state().user?.permissions || []);
  readonly deviceId = computed(() => this.state().deviceId);
  readonly isAuthenticated = computed(() => !!this.state().accessToken && !!this.state().user);

  setSession(accessToken: string, refreshToken: string, user: any): void {
    const normalizedUser = AuthStore.normalizeUser(user);

    localStorage.setItem('ott_access_token', accessToken);
    localStorage.setItem('ott_refresh_token', refreshToken);
    localStorage.setItem('ott_user', JSON.stringify(normalizedUser));

    this.state.update(s => ({
      ...s,
      accessToken,
      refreshToken,
      user: normalizedUser
    }));
  }

  // Alias for legacy auth service compatibility
  setAuth(user: any, accessToken: string, refreshToken: string): void {
    this.setSession(accessToken, refreshToken, user);
  }

  clearSession(): void {
    localStorage.removeItem('ott_access_token');
    localStorage.removeItem('ott_refresh_token');
    localStorage.removeItem('ott_user');

    this.state.update(s => ({
      ...s,
      accessToken: null,
      refreshToken: null,
      user: null
    }));
  }

  // Alias for legacy auth service compatibility
  clearAuth(): void {
    this.clearSession();
  }

  hasRole(role: string): boolean {
    const user = this.state().user;
    if (!user) return false;
    const roles = user.roles || [];
    const cleanRole = role.replace(/^ROLE_/, '').toUpperCase();
    return roles.some(r => {
      const cleanR = r.replace(/^ROLE_/, '').toUpperCase();
      return cleanR === cleanRole;
    });
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.state().user;
    if (!user) return false;
    const userRoles = user.roles || [];
    return roles.some(r => {
      const cleanRole = r.replace(/^ROLE_/, '').toUpperCase();
      return userRoles.some(ur => {
        const cleanUr = ur.replace(/^ROLE_/, '').toUpperCase();
        return cleanUr === cleanRole;
      });
    });
  }

  isStrictAdmin(): boolean {
    const user = this.state().user;
    if (!user) return false;
    const roles = user.roles || [];
    return roles.some(r => ['SUPER_ADMIN', 'ROLE_SUPER_ADMIN', 'ADMIN', 'ROLE_ADMIN'].includes(r));
  }

  isProducer(): boolean {
    const user = this.state().user;
    if (!user) return false;
    const roles = user.roles || [];
    return roles.some(r => ['PRODUCER', 'ROLE_PRODUCER'].includes(r));
  }

  isOnlyProducer(): boolean {
    const user = this.state().user;
    if (!user) return false;
    const roles = user.roles || [];
    const hasProducer = roles.some(r => ['PRODUCER', 'ROLE_PRODUCER'].includes(r));
    const hasAdmin = roles.some(r => ['SUPER_ADMIN', 'ROLE_SUPER_ADMIN', 'ADMIN', 'ROLE_ADMIN'].includes(r));
    return hasProducer && !hasAdmin;
  }

  hasPermission(permission: string): boolean {
    const user = this.state().user;
    if (!user) return false;
    if (this.isStrictAdmin() || user.permissions?.includes('ALL')) return true;
    return !!user?.permissions?.includes(permission);
  }

  hasAnyPermission(permissions: string[]): boolean {
    const user = this.state().user;
    if (!user) return false;
    if (this.isStrictAdmin() || user.permissions?.includes('ALL')) return true;
    return permissions.some(p => user.permissions?.includes(p));
  }

  private generateDeviceId(): string {
    const id = 'web-' + Math.random().toString(36).substring(2, 11);
    localStorage.setItem('ott_device_id', id);
    return id;
  }
}
