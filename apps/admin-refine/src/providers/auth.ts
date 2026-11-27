import type { AuthProvider } from "@refinedev/core";
import { API_BASE, TOKEN_KEY, USER_KEY } from "./api";

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          success: false,
          error: { message: body?.message || "Invalid email or password", name: "LoginError" },
        };
      }

      const payload = body?.data ?? body?.result ?? body;
      const token = payload?.accessToken || payload?.token || payload?.access_token;
      const user = payload?.user || { email, fullName: email, roles: ["ROLE_ADMIN"] };

      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        return { success: true, redirectTo: "/dashboard" };
      }

      return {
        success: false,
        error: { message: "No token received from server", name: "LoginError" },
      };
    } catch (error: any) {
      return {
        success: false,
        error: { message: error?.message ?? "Login failed", name: "LoginError" },
      };
    }
  },

  logout: async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return { authenticated: true };
    return {
      authenticated: false,
      error: { message: "Not authenticated", name: "NotAuthenticated" },
      logout: true,
      redirectTo: "/login",
    };
  },

  getPermissions: async () => {
    try {
      const user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");
      return user?.roles ?? ["ROLE_ADMIN"];
    } catch {
      return ["ROLE_ADMIN"];
    }
  },

  getIdentity: async () => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const u = JSON.parse(raw);
      return { ...u, name: u.fullName || u.name || u.email || "Admin" };
    } catch {
      return null;
    }
  },

  onError: async (error: any) => {
    if (error?.status === 401 || error?.status === 403) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return { error, logout: true, redirectTo: "/login" };
    }
    return { error };
  },
};
