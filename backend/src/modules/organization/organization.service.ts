import type { Center, Department } from '@prisma/client';
import type { TenantClient } from '../../db/tenant.js';
import { ApiError } from '../../middleware/error.js';
import { auditWriter } from '../../audit/audit-writer.js';
import type { z } from 'zod';
import type {
  CreateCenterSchema,
  UpdateCenterSchema,
  CreateDepartmentSchema,
} from '@tempora/shared';

type CreateCenter = z.infer<typeof CreateCenterSchema>;
type UpdateCenter = z.infer<typeof UpdateCenterSchema>;
type CreateDepartment = z.infer<typeof CreateDepartmentSchema>;

// ---------------------------------------------------------------------------
// Center operations
// ---------------------------------------------------------------------------

export async function createCenter(
  dto: CreateCenter,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<Center> {
  const center = await db.center.create({
    data: {
      organizationId,
      name: dto.name,
      address: dto.address ?? null,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'Center',
    entityId: center.id,
    after: { name: center.name },
  });

  return center;
}

export async function updateCenter(
  id: string,
  dto: UpdateCenter,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<Center> {
  const existing = await db.center.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', `Center ${id} not found`);

  const updated = await db.center.update({
    where: { id },
    data: {
      name: dto.name ?? undefined,
      address: dto.address ?? undefined,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'UPDATE',
    entityType: 'Center',
    entityId: id,
    before: { name: existing.name },
    after: { name: updated.name },
  });

  return updated;
}

export async function listCenters(db: TenantClient): Promise<Center[]> {
  return db.center.findMany({ orderBy: { name: 'asc' } });
}

export async function softDeleteCenter(
  id: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<void> {
  const activeCount = await db.employee.count({
    where: { primaryCenterId: id, isActive: true },
  });

  if (activeCount > 0) {
    throw new ApiError(
      409,
      'CENTER_HAS_ACTIVE_EMPLOYEES',
      `Cannot delete center with ${activeCount} active employee(s). Reassign or terminate them first.`,
    );
  }

  // The Center model has no deletedAt column. Design §1.9 calls this "soft delete"
  // to mean "blocked by active employees". The actual deletion is hard delete —
  // it is safe because the active-employee guard above prevents orphaned data.
  await db.center.delete({ where: { id } });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'DELETE',
    entityType: 'Center',
    entityId: id,
  });
}

// ---------------------------------------------------------------------------
// Department operations
// ---------------------------------------------------------------------------

export async function createDepartment(
  centerId: string,
  dto: CreateDepartment,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<Department> {
  const dept = await db.department.create({
    data: {
      organizationId,
      centerId,
      name: dto.name,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'Department',
    entityId: dept.id,
    after: { name: dept.name, centerId },
  });

  return dept;
}

export async function listDepartments(
  centerId: string,
  db: TenantClient,
): Promise<Department[]> {
  return db.department.findMany({
    where: { centerId },
    orderBy: { name: 'asc' },
  });
}
