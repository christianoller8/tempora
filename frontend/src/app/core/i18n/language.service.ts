import { computed, inject, Injectable, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type AppLanguage = 'es' | 'en';
const STORAGE_KEY = 'tempora-lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly current = signal<AppLanguage>('es');

  readonly dateLocale = computed(() => this.current() === 'es' ? 'es-ES' : 'en-US');

  init(): void {
    const stored = localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    const lang: AppLanguage = stored === 'en' ? 'en' : 'es';
    this.translate.use(lang);
    this.current.set(lang);
  }

  toggle(): void {
    const next: AppLanguage = this.current() === 'es' ? 'en' : 'es';
    this.translate.use(next);
    this.current.set(next);
    localStorage.setItem(STORAGE_KEY, next);
  }
}
