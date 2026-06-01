import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { authenticate } from './auth';
import { ApiError } from './error';

// Mock jwt module to avoid loading env.ts at test time.
vi.mock('../modules/iam/jwt.js', () => ({
  verifyAccessToken: vi.fn(),
}));

// Import the mock AFTER vi.mock so Vitest's hoisting gives us the mocked version.
import { verifyAccessToken } from '../modules/iam/jwt.js';

const mockVerify = vi.mocked(verifyAccessToken);

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    header: vi.fn().mockReturnValue(undefined),
    cookies: {},
    ...overrides,
  } as unknown as Request;
}

const res = {} as Response;

describe('authenticate', () => {
  beforeEach(() => {
    mockVerify.mockReset();
  });

  it('calls next(ApiError 401) when no Authorization header and no cookie', () => {
    const next = vi.fn();
    authenticate(makeReq(), res, next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('calls next(ApiError 401) when the token is invalid', () => {
    mockVerify.mockImplementation(() => { throw new Error('invalid signature'); });
    const next = vi.fn();
    const req = makeReq({
      header: vi.fn().mockReturnValue('Bearer bad-token'),
    });
    authenticate(req, res, next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.code).toBe('INVALID_TOKEN');
  });

  it('populates req.user and calls next() with no args on a valid Bearer token', () => {
    const claims = {
      sub: 'user-1',
      org: 'org-1',
      role: 'ADMIN',
      emp: 'emp-1',
      jti: 'jti-1',
    };
    mockVerify.mockReturnValue(claims);
    const next = vi.fn();
    const req = makeReq({
      header: vi.fn().mockReturnValue('Bearer valid-token'),
    });
    authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect((req as Request & { user: unknown }).user).toMatchObject({
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role,
    });
  });

  it('reads the token from the access_token cookie when no Authorization header', () => {
    const claims = { sub: 'u1', org: 'o1', role: 'EMPLOYEE', jti: 'jti-2' };
    mockVerify.mockReturnValue(claims);
    const next = vi.fn();
    const req = makeReq({
      header: vi.fn().mockReturnValue(undefined),
      cookies: { access_token: 'cookie-token' },
    });
    authenticate(req, res, next);
    expect(mockVerify).toHaveBeenCalledWith('cookie-token');
    expect(next).toHaveBeenCalledWith();
  });
});
