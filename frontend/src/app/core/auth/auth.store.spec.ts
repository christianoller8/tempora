import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../http/api.tokens';

describe('AuthStore', () => {
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        AuthStore,
        AuthService,
      ],
    });

    authService = TestBed.inject(AuthService);

    // Prevent the onInit refresh from failing the test suite
    vi.spyOn(authService, 'refresh').mockReturnValue(
      throwError(() => new Error('not authenticated')),
    );
  });

  it('isAuthenticated() is false initially', () => {
    const store = TestBed.inject(AuthStore);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated() becomes true after login() succeeds', async () => {
    const store = TestBed.inject(AuthStore);

    vi.spyOn(authService, 'login').mockReturnValue(
      of({
        accessToken: 'test-token-abc',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@test.com',
          role: 'ADMIN' as const,
          organizationId: '00000000-0000-0000-0000-000000000002',
          employeeId: null,
        },
      }),
    );

    await new Promise<void>((resolve) => {
      store.login({ email: 'admin@test.com', password: 'password123' }).subscribe({
        complete: resolve,
      });
    });

    expect(store.isAuthenticated()).toBe(true);
    expect(store.accessToken()).toBe('test-token-abc');
  });

  it('logoutLocal() resets isAuthenticated to false', async () => {
    const store = TestBed.inject(AuthStore);

    vi.spyOn(authService, 'login').mockReturnValue(
      of({
        accessToken: 'test-token-abc',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@test.com',
          role: 'ADMIN' as const,
          organizationId: '00000000-0000-0000-0000-000000000002',
          employeeId: null,
        },
      }),
    );

    await new Promise<void>((resolve) => {
      store.login({ email: 'admin@test.com', password: 'password123' }).subscribe({
        complete: resolve,
      });
    });

    expect(store.isAuthenticated()).toBe(true);

    store.logoutLocal();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
  });
});
