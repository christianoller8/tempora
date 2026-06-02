import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { Observable, map, shareReplay, tap } from 'rxjs';
import type { LoginRequest, LoginResponse, MeResponse } from '@tempora/shared';
import { AuthService } from './auth.service';

type AuthState = {
  accessToken: string | null;
  user: MeResponse | null;
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  accessToken: null,
  user: null,
  loading: false,
  error: null,
};

// withHooks omitted — TypeScript 5.9 cannot infer the store type when withHooks is present.
// Auth re-hydration is triggered via provideAppInitializer in app.config.ts instead.
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),
  withComputed((store) => ({
    isAuthenticated: computed(() => store.accessToken() !== null),
    role: computed(() => store.user()?.role ?? null),
  })),
  withMethods((store) => {
    const authService = inject(AuthService);
    let refreshInFlight$: Observable<string> | null = null;

    return {
      login(dto: LoginRequest): Observable<void> {
        patchState(store, { loading: true, error: null });
        return authService.login(dto).pipe(
          tap({
            next: (res: LoginResponse) => {
              patchState(store, {
                accessToken: res.accessToken,
                // LoginResponse.user is a subset of MeResponse; supply defaults for
                // the missing fields so the stored user is always a complete MeResponse.
                user: { ...res.user, isActive: true, lastLoginAt: null },
                loading: false,
                error: null,
              });
            },
            error: (err: unknown) => {
              const message =
                err !== null &&
                typeof err === 'object' &&
                'error' in err &&
                err.error !== null &&
                typeof err.error === 'object' &&
                'message' in err.error
                  ? String((err.error as Record<string, unknown>)['message'])
                  : 'Login failed';
              patchState(store, { loading: false, error: message });
            },
          }),
          map(() => undefined as void),
        );
      },

      refresh(): Observable<string> {
        if (refreshInFlight$) return refreshInFlight$;

        refreshInFlight$ = authService.refresh().pipe(
          tap({
            next: (res) => {
              patchState(store, { accessToken: res.accessToken, error: null });
            },
            error: () => {
              refreshInFlight$ = null;
            },
            complete: () => {
              refreshInFlight$ = null;
            },
          }),
          map((res) => res.accessToken),
          shareReplay(1),
        );

        return refreshInFlight$;
      },

      logoutLocal(): void {
        patchState(store, initialState);
      },

      logout(): Observable<void> {
        return authService.logout().pipe(
          tap({
            next: () => patchState(store, initialState),
            error: () => patchState(store, initialState),
          }),
          map(() => undefined as void),
        );
      },
    };
  }),
);

// TypeScript 5.9 workaround: signalStore() return type is not inferrable.
// Export an explicit interface; consumers cast via `inject(AuthStore) as unknown as AuthStore`.
export type AuthStore = {
  accessToken(): string | null;
  user(): MeResponse | null;
  loading(): boolean;
  error(): string | null;
  isAuthenticated(): boolean;
  role(): string | null;
  login(dto: LoginRequest): Observable<void>;
  refresh(): Observable<string>;
  logoutLocal(): void;
  logout(): Observable<void>;
};
