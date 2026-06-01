import type { ErrorRequestHandler } from 'express';

/**
 * Typed API error. Carries HTTP status, a machine-readable code, a human
 * message, and optional structured details (e.g. Zod validation issues).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
    // Maintain proper prototype chain in transpiled CommonJS.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Express 5 catch-all error handler.
 * Registered LAST in the middleware chain (4-argument signature).
 *
 * - Known `ApiError` instances → their own status + code.
 * - Everything else            → 500 INTERNAL_ERROR (no detail leak in prod).
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    const body: Record<string, unknown> = { code: err.code, message: err.message };
    if (err.details !== undefined) body['details'] = err.details;
    res.status(err.status).json(body);
    return;
  }

  // Unknown error — log it, send generic envelope.
  console.error('[errorHandler]', err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
};
