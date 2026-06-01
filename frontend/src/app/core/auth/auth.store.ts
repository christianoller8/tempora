import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
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

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),
  withComputed((store) => ({
    isAuthenticated: computed(() => store.accessToken() !== null),
    role: computed(() => store.user()?.role ?? null),
  })),
  withMethods((store, authService = inject(AuthService)) => {
    // Single shared observable for the in-flight refresh — deduplicates concurrent 401s.
    let refreshInFlight$: Observable<string> | null = null;

    return {
      login(dto: LoginRequest): Observable<void> {
        patchState(store, { loading: true, error: null });
        return authService.login(dto).pipe(
          tap({
            next: (res: LoginResponse) => {
              patchState(store, {
                accessToken: res.accessToken,
                user: res.user,
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
  withHooks({
    onInit(store) {
      // Re-hydrate session from httpOnly cookie on bootstrap.
      store.refresh().subscribe({ error: () => { /* no-op: not authenticated */ } });
    },
  }),
);
