import type { ShiftTemplate } from '@prisma/client';
import type { TenantClient } from '../../db/tenant.js';
import { ApiError } from '../../middleware/error.js';
import { auditWriter } from '../../audit/audit-writer.js';
import type { z } from 'zod';
import type { ShiftTemplateSchema } from '@tempora/shared';

type CreateShiftTemplate = z.infer<typeof ShiftTemplateSchema>;

// ---------------------------------------------------------------------------
// ShiftTemplate service — satisfies FR-SHIFT-1
// Admin only writes; auto-sets crossesMidnight when endTime < startTime.
// ---------------------------------------------------------------------------

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export async function createTemplate(
  dto: CreateShiftTemplate,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<ShiftTemplate> {
  // Auto-detect crossesMidnight: endTime < startTime → overnight shift.
  const crossesMidnight = toMinutes(dto.endTime) < toMinutes(dto.startTime);

  const template = await db.shiftTemplate.create({
    data: {
      organizationId,
      name: dto.name,
      shiftType: dto.shiftType,
      startTime: dto.startTime,
      endTime: dto.endTime,
      crossesMidnight,
      breakMinutes: dto.breakMinutes ?? 0,
      categoryRequirements: dto.categoryRequirements ?? {},
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'ShiftTemplate',
    entityId: template.id,
    after: { name: template.name, shiftType: template.shiftType, startTime: template.startTime, endTime: template.endTime },
  });

  return template;
}

export async function listTemplates(db: TenantClient): Promise<ShiftTemplate[]> {
  return db.shiftTemplate.findMany({
    orderBy: [{ shiftType: 'asc' }, { name: 'asc' }],
  });
}

export async function updateTemplate(
  id: string,
  dto: Partial<CreateShiftTemplate>,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<ShiftTemplate> {
  const existing = await db.shiftTemplate.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', `ShiftTemplate ${id} not found`);

  const startTime = dto.startTime ?? existing.startTime;
  const endTime = dto.endTime ?? existing.endTime;
  const crossesMidnight = toMinutes(endTime) < toMinutes(startTime);

  const updated = await db.shiftTemplate.update({
    where: { id },
    data: {
      name: dto.name ?? undefined,
      shiftType: dto.shiftType ?? undefined,
      startTime: dto.startTime ?? undefined,
      endTime: dto.endTime ?? undefined,
      crossesMidnight,
      breakMinutes: dto.breakMinutes ?? undefined,
      categoryRequirements: dto.categoryRequirements ?? undefined,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'UPDATE',
    entityType: 'ShiftTemplate',
    entityId: id,
    before: { name: existing.name, startTime: existing.startTime, endTime: existing.endTime },
    after: { name: updated.name, startTime: updated.startTime, endTime: updated.endTime },
  });

  return updated;
}

export async function deleteTemplate(
  id: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<void> {
  const existing = await db.shiftTemplate.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', `ShiftTemplate ${id} not found`);

  // Check for assignments referencing this template.
  const assignmentCount = await db.shiftAssignment.count({
    where: { shiftTemplateId: id },
  });
  if (assignmentCount > 0) {
    throw new ApiError(409, 'TEMPLATE_IN_USE', `ShiftTemplate ${id} has active assignments and cannot be deleted`);
  }

  await db.shiftTemplate.delete({ where: { id } });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'DELETE',
    entityType: 'ShiftTemplate',
    entityId: id,
    before: { name: existing.name },
  });
}
