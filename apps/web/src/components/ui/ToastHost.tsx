'use client';

export interface ToastPayload {
  title?: string;
  message: string;
  variant?: 'success' | 'info' | 'error';
  actionLabel?: string;
  actionHref?: string;
  durationMs?: number;
}

export function showToast(_payload: ToastPayload) {
  // Toaster disabled per user request
}

export function ToastHost() {
  return null;
}
