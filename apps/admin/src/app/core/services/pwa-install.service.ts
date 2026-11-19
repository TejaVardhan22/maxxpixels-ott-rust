import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaInstallService {
  private deferredPrompt: any = null;
  private readonly canInstallSignal = signal<boolean>(false);

  readonly canInstall = computed(() => this.canInstallSignal());

  constructor() {
    this.initPwaListeners();
  }

  private initPwaListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstallSignal.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstallSignal.set(false);
      console.log('[PWA] MaxxPixels App was successfully installed!');
    });
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.canInstallSignal.set(false);
      this.deferredPrompt = null;
      return true;
    }
    return false;
  }
}
