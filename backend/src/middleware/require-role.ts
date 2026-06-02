import type { Request, RequestHandler } from 'express';
import type { Role } from '@tempora/shared';
import { ApiError } from './error';
import type { AuthUser } from '../types/auth';

type RequestWithUser = Request & { user: AuthUser };

/**
 * RBAC guard middleware factory.
 *
 * Checks that `req.user.role` is one of the allowed `roles`.
 * Returns a 403 ApiError when the role is not included.
 *
 * Must be used AFTER `authenticate` (which populates `req.user`).
 *
 * @param roles - Array of allowed Role values.
 */
export function requireRole(roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    const { role } = (req as RequestWithUser).user;
    if (!roles.includes(role as Role)) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          `Required role: ${roles.join(' | ')}. Got: ${role}`,
        ),
      );
    }
    next();
  };
}
