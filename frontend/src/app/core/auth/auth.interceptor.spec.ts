import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { of } from 'rxjs';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthStore } from './auth.store';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../http/api.tokens';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authStore: AuthStore;
  let authService: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        AuthStore,
        AuthService,
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authStore = TestBed.inject(AuthStore);
    authService = TestBed.inject(AuthService);

    // Prevent onInit refresh from interfering
    vi.spyOn(authService, 'refresh').mockReturnValue(
      of({ accessToken: 'initial-token' }),
    );
  });

  it('attaches Authorization header when token is present', () => {
    // Manually set the token on the store via a mocked login
    vi.spyOn(authService, 'login').mockReturnValue(
      of({
        accessToken: 'test-bearer-token',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'user@test.com',
          role: 'ADMIN' as const,
          organizationId: '00000000-0000-0000-0000-000000000002',
          employeeId: null,
        },
      }),
    );

    authStore.login({ email: 'user@test.com', password: 'password123' }).subscribe();

    http.get('/some-endpoint').subscribe();

    const req = httpMock.expectOne('/some-endpoint');
    expect(req.request.headers.get('Authorization')).toBe(
      'Bearer test-bearer-token',
    );
    req.flush({});
  });

  it('on 401 response calls auth.refresh() and retries with new token', () => {
    // Set initial token
    vi.spyOn(authService, 'login').mockReturnValue(
      of({
        accessToken: 'old-token',
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'user@test.com',
          role: 'ADMIN' as const,
          organizationId: '00000000-0000-0000-0000-000000000002',
          employeeId: null,
        },
      }),
    );

    authStore.login({ email: 'user@test.com', password: 'password123' }).subscribe();

    // Override refresh to return new token
    vi.spyOn(authStore, 'refresh').mockReturnValue(of('new-token'));

    let responseData: unknown;
    http.get('/protected-endpoint').subscribe((data) => {
      responseData = data;
    });

    // First attempt — respond with 401
    const firstReq = httpMock.expectOne('/protected-endpoint');
    expect(firstReq.request.headers.get('Authorization')).toBe('Bearer old-token');
    firstReq.flush({ code: 'UNAUTHENTICATED', message: 'Token expired' }, { status: 401, statusText: 'Unauthorized' });

    // Retry — interceptor should retry with new token
    const retryReq = httpMock.expectOne('/protected-endpoint');
    expect(retryReq.request.headers.get('Authorization')).toBe('Bearer new-token');
    retryReq.flush({ result: 'ok' });

    expect(responseData).toEqual({ result: 'ok' });
  });
});
