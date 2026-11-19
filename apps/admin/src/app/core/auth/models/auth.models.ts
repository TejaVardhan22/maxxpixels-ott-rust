export interface AuthUser {
  id: number | string;
  name: string;
  fullName?: string;
  email: string;
  roles: string[];
  permissions?: string[];
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
  fullName?: string;
  user: AuthUser;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  deviceId?: string;
  platform?: string;
}

export interface NavigationItem {
  label: string;
  icon: string;
  route?: string;
  queryParams?: { [key: string]: any };
  permissions?: string[];
  roles?: string[];
  children?: NavigationItem[];
}
