import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';
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
      50:  '#EEE8FF',
      100: '#DCCFFF',
      200: '#BAA4FF',
      300: '#9573FF',
      400: '#7244EE',
      500: '#401BBB',
      600: '#3616A8',
      700: '#2B1290',
      800: '#210E78',
      900: '#170A60',
      950: '#0D0640',
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
          darkModeSelector: '[data-theme="dark"]',
          cssLayer: false,
        },
      },
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
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
