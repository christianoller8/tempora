import type { Request, RequestHandler } from 'express';
import { withTenant } from '../db/tenant';
import { requestContext } from '../db-context';
import type { AuthUser } from '../types/auth';

type RequestWithUser = Request & { user: AuthUser };

/**
 * Opens a tenant-scoped Prisma transaction for the duration of the request.
 *
 * The transaction client is stored in `AsyncLocalStorage` so controllers and
 * services can retrieve it via `getDb()` without explicit prop-drilling.
 *
 * The transaction stays open until the response is finished (`res.finish` /
 * `res.close`), which keeps RLS (`app.current_org`) active for every query in
 * the handler chain. Long-lived streaming endpoints should opt out and call
 * `withTenant` per query batch directly.
 *
 * Must be used AFTER `authenticate` (which populates `req.user`).
 */
export const tenantContext: RequestHandler = (req, res, next) => {
  const user = (req as RequestWithUser).user;
  withTenant(user.organizationId, (db) =>
    new Promise<void>((resolve, reject) => {
      requestContext.run({ db, user }, () => {
        res.on('finish', resolve);
        res.on('close', resolve);
        next((err?: unknown) => (err ? reject(err) : undefined));
      });
    }),
  ).catch(next);
};
