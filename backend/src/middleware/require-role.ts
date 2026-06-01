import type { RequestHandler } from 'express';
import type { Role } from '@tempora/shared';
import { ApiError } from './error.js';

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
    if (!roles.includes(req.user.role as Role)) {
      return next(
        new ApiError(
          403,
          'FORBIDDEN',
          `Required role: ${roles.join(' | ')}. Got: ${req.user.role}`,
        ),
      );
    }
    next();
  };
}
