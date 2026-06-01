import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantClient } from './db/tenant';
import type { AuthUser } from './types/auth';

interface RequestContext {
  db: TenantClient;
  user: AuthUser;
}

/**
 * AsyncLocalStorage that carries the tenant-scoped Prisma client and the
 * authenticated user throughout the full request chain without explicit
 * prop-drilling.
 *
 * Populated by the `tenantContext` middleware; read by `getDb()` / `getUser()`.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the tenant-scoped Prisma transaction client for the current request.
 * Throws if called outside of the `tenantContext` middleware (e.g., public routes,
 * background jobs).
 */
export function getDb(): TenantClient {
  const ctx = requestContext.getStore();
  if (!ctx) {
    throw new Error('No tenant context — query attempted outside withTenant');
  }
  return ctx.db;
}

/**
 * Returns the authenticated user for the current request.
 * Throws if called outside of the `authenticate` + `tenantContext` middleware chain.
 */
export function getUser(): AuthUser {
  const ctx = requestContext.getStore();
  if (!ctx) {
    throw new Error('No auth context — getUser() called outside tenant context');
  }
  return ctx.user;
}
