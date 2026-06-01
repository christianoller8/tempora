import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/**
 * Wraps an async Express route handler so that any rejected promise is forwarded
 * to `next(err)`. Required for Express 4 compatibility; Express 5 forwards async
 * rejections automatically, but keeping this wrapper makes intent explicit and
 * maintains pre-5 parity.
 */
export function asyncHandler(fn: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
