import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';

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

  // Prisma known errors — convert to meaningful HTTP codes.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    console.error('[errorHandler] Prisma', err.code, err.message, err.meta);
    if (err.code === 'P2002') {
      // Unique constraint violation
      res.status(409).json({ code: 'CONFLICT', message: 'Resource already exists (unique constraint)' });
      return;
    }
    if (err.code === 'P2003') {
      // Foreign key constraint failure
      res.status(422).json({ code: 'FK_VIOLATION', message: 'Referenced resource not found', meta: err.meta });
      return;
    }
    if (err.code === 'P2025') {
      // Record not found (e.g. update on missing row)
      res.status(404).json({ code: 'NOT_FOUND', message: 'Record not found' });
      return;
    }
    // Other Prisma errors — log with full meta and return 400
    res.status(400).json({ code: `PRISMA_${err.code}`, message: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error('[errorHandler] PrismaValidation', err.message);
    res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Database validation error', detail: err.message });
    return;
  }

  // Unknown error — log it, send generic envelope.
  console.error('[errorHandler]', err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
};
