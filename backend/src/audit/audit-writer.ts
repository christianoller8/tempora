import type { Request } from 'express';
import type { AuditAction } from '@prisma/client';
import type { TenantClient } from '../db/tenant';

export interface AuditEvent {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * INSERT-only audit log writer.
 *
 * Every write MUST happen within the caller's tenant transaction so the audit
 * row commits or rolls back atomically with the business mutation.
 *
 * The DB role (`tempora_app`) has INSERT-only on `audit_logs` — any attempt to
 * UPDATE or DELETE is rejected at the database level.
 *
 * @param db            - Tenant-scoped Prisma transaction client.
 * @param actorId       - userId of the user performing the action.
 * @param organizationId - The organization this audit log belongs to.
 * @param event         - Audit event details.
 * @param req           - Optional Express request for IP/user-agent capture.
 */
export class AuditWriter {
  async write(
    db: TenantClient,
    actorId: string,
    organizationId: string,
    event: AuditEvent,
    req?: Request,
  ): Promise<void> {
    await db.auditLog.create({
      data: {
        organizationId,
        actorUserId: actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        before: (event.before ?? null) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        after: (event.after ?? null) as any,
        ip: req?.ip ?? null,
        userAgent: req?.header('user-agent') ?? null,
      },
    });
  }
}

export const auditWriter = new AuditWriter();
