import type { Request, Response, NextFunction } from 'express';
import { login, refresh, logout } from './iam.service.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../middleware/error.js';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
} as const;

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  res.cookie('refresh_token', tokens.refreshToken, {
    ...COOKIE_OPTS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  res.cookie('access_token', tokens.accessToken, {
    ...COOKIE_OPTS,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie('refresh_token', COOKIE_OPTS);
  res.clearCookie('access_token', COOKIE_OPTS);
}

/**
 * POST /auth/login
 * Body: { email, password }
 */
export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const tokens = await login(email, password);
    setAuthCookies(res, tokens);
    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/refresh
 * Reads refresh_token from httpOnly cookie.
 */
export async function refreshHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const token: string | undefined = (req.cookies as Record<string, string | undefined>)[
      'refresh_token'
    ];
    if (!token) {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing refresh token'));
    }
    const tokens = await refresh(token);
    setAuthCookies(res, tokens);
    res.json({ accessToken: tokens.accessToken });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 * Requires authenticate middleware (populates req.user).
 */
export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await logout(req.user.jti, req.user.userId, req.user.organizationId);
    clearAuthCookies(res);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/**
 * GET /auth/me
 * Returns the authenticated user's claims from req.user.
 * No DB query — information is already in the verified JWT.
 */
export function meHandler(req: Request, res: Response) {
  res.json(req.user);
}
