import { Injectable, NgZone, computed, inject, signal } from '@angular/core';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly ngZone = inject(NgZone);

  private readonly _deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  private readonly _isOffline = signal(!navigator.onLine);
  private readonly _isInstalled = signal(
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true,
  );

  readonly canInstall = computed(() => this._deferredPrompt() !== null && !this._isInstalled());
  readonly isOffline = this._isOffline.asReadonly();
  readonly isInstalled = this._isInstalled.asReadonly();

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.ngZone.run(() => this._deferredPrompt.set(e as BeforeInstallPromptEvent));
    });

    window.addEventListener('appinstalled', () => {
      this.ngZone.run(() => {
        this._isInstalled.set(true);
        this._deferredPrompt.set(null);
      });
    });

    window.addEventListener('online', () => this.ngZone.run(() => this._isOffline.set(false)));
    window.addEventListener('offline', () => this.ngZone.run(() => this._isOffline.set(true)));
  }

  dismissInstall(): void {
    this._deferredPrompt.set(null);
  }

  async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const prompt = this._deferredPrompt();
    if (!prompt) return 'unavailable';
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    this.ngZone.run(() => this._deferredPrompt.set(null));
    return outcome;
  }
}
