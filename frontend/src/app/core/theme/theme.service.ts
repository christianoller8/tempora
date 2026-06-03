import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'tempora-theme';
const DARK_CLASS  = 'app-dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  /** True = dark mode, false = light mode. */
  readonly isDark = signal(this.resolveInitial());

  constructor() {
    // Apply on construction (in case the inline script wasn't enough).
    this.apply(this.isDark());
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this.apply(next);
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle(DARK_CLASS, dark);
  }

  private resolveInitial(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light') return false;
    if (stored === 'dark')  return true;
    // Default: dark.
    return true;
  }
}
