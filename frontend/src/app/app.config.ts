import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { catchError, firstValueFrom, of } from 'rxjs';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { API_BASE_URL } from './core/http/api.tokens';
import { AuthStore } from './core/auth/auth.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
    // Re-hydrate session from httpOnly cookie on bootstrap. Errors are swallowed —
    // the user is simply treated as unauthenticated if the refresh fails.
    provideAppInitializer(() => {
      const auth = inject(AuthStore) as unknown as AuthStore;
      return firstValueFrom(auth.refresh().pipe(catchError(() => of(null))));
    }),
  ],
};
