import { Injectable, signal, computed, effect } from '@angular/core';

/**
 * Manages the app theme (dark / light) using Angular Signals.
 * Persists preference in localStorage; falls back to system preference;
 * writes data-theme attribute on <html> so tokens.css picks up the palette.
 */

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'tempora-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.resolveInitial());

  readonly isDark = computed(() => this.theme() === 'dark');

  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    effect(() => {
      document.documentElement.setAttribute('data-theme', this.theme());
    });

    this.media.addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        this.theme.set(e.matches ? 'dark' : 'light');
      }
    });
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }

  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  useSystem(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.theme.set(this.media.matches ? 'dark' : 'light');
  }

  private resolveInitial(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return 'dark';
  }
}
