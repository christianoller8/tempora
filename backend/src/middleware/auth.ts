import type { RequestHandler } from 'express';
import { verifyAccessToken } from '../modules/iam/jwt.js';
import { ApiError } from './error.js';

/**
 * Authentication middleware.
 *
 * Token resolution order:
 *  1. `Authorization: Bearer <token>` header  — used by regular API calls.
 *  2. `access_token` httpOnly cookie            — used by SSE connections.
 *     `EventSource` cannot set custom headers, so the frontend configures
 *     `withCredentials: true` and the browser sends the cookie automatically.
 *
 * On success: populates `req.user` from the verified JWT claims.
 * On failure: calls `next(ApiError(401))`.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization');
  const rawToken: string | undefined = header?.startsWith('Bearer ')
    ? header.slice(7)
    : (req.cookies as Record<string, string | undefined>)['access_token'];

  if (!rawToken) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing bearer token'));
  }

  try {
    const claims = verifyAccessToken(rawToken);
    req.user = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role as 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
      employeeId: claims.emp,
      jti: claims.jti,
    };
    next();
  } catch {
    next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired access token'));
  }
};
