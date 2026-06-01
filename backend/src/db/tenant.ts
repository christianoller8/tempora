import { Prisma } from '@prisma/client';
import { prisma } from './prisma';

/**
 * A transactional Prisma client scoped to one organization for the duration of
 * the transaction. All queries made through this client are subject to RLS
 * policies that check `app.current_org`.
 */
export type TenantClient = Prisma.TransactionClient;

/**
 * Wraps `fn` in a Prisma interactive transaction that sets the PostgreSQL
 * session variable `app.current_org` to `organizationId` before any query runs.
 *
 * Using `set_config(..., true)` makes the setting transaction-local — it is
 * automatically cleared when the transaction commits or rolls back, preventing
 * the value from leaking across pooled connections.
 *
 * RLS policies on tenant tables use:
 *   USING (organization_id = current_setting('app.current_org', true)::uuid)
 *
 * When `app.current_org` is not set, `current_setting(..., true)` returns NULL,
 * and all comparisons with NULL are false — so every row is excluded (fail-closed).
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // set_config(key, value, is_local=true) — scoped to THIS transaction only.
    await tx.$executeRaw`SELECT set_config('app.current_org', ${organizationId}::text, true)`;
    return fn(tx);
  });
}
