import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { ApiError } from './error';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Middleware factory that validates the selected part of an incoming request
 * against a Zod schema. On failure it calls `next(ApiError(422))` with the
 * Zod issues attached as `details`.
 *
 * @param schema - The Zod schema to validate against.
 * @param target - Which part of the request to validate (default: 'body').
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      return next(
        new ApiError(422, 'VALIDATION_ERROR', 'Validation failed', result.error.issues),
      );
    }
    // Replace the target with the parsed + coerced value.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[target] = result.data;
    next();
  };
}
