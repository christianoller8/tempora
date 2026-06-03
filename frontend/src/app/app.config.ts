import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withEnabledBlockingInitialNavigation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
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
    providePrimeNG({
      theme: {
        preset: Aura,
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
