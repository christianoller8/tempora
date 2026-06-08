import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEn from '@angular/common/locales/en';
import { catchError, firstValueFrom, of } from 'rxjs';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { definePreset } from '@primeuix/themes';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { LanguageService } from './core/i18n/language.service';

registerLocaleData(localeEs);
registerLocaleData(localeEn);

const TemporaTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
      800: '#166534',
      900: '#14532d',
      950: '#052e16',
    },
    focusRing: {
      width: '2px',
      style: 'solid',
      color: '{primary.color}',
      offset: '2px',
      shadow: 'none',
    },
    formField: {
      focusRing: {
        width: '2px',
        style: 'solid',
        color: '{primary.color}',
        offset: '0',
        shadow: 'none',
      },
    },
  },
});
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { API_BASE_URL } from './core/http/api.tokens';
import { AuthStore } from './core/auth/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding(), withEnabledBlockingInitialNavigation()),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
    provideTranslateService({ defaultLanguage: 'es' }),
    ...provideTranslateHttpLoader({ prefix: '/assets/i18n/', suffix: '.json' }),
    provideAppInitializer(() => inject(LanguageService).init()),
    providePrimeNG({
      theme: {
        preset: TemporaTheme,
        options: {
          // .app-dark on <html> activates dark palette globally.
          darkModeSelector: '.app-dark',
          cssLayer: false,
        },
      },
    }),
    // Re-hydrate session from httpOnly cookie on bootstrap.
    provideAppInitializer(async () => {
      try {
        const auth = inject(AuthStore) as unknown as AuthStore;
        const token = await firstValueFrom(auth.refresh().pipe(catchError(() => of(null))));
        // If we got a valid token, load user details so role-based UI works immediately.
        if (token) {
          await firstValueFrom(auth.loadMe().pipe(catchError(() => of(null))));
        }
      } catch {
        // Swallow — user is treated as unauthenticated.
      }
    }),
  ],
};
