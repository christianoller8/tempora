import type { RotationPattern } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';
import type { z } from 'zod';
import type { RotationPatternSchema } from '@tempora/shared';

type CreateRotationPattern = z.infer<typeof RotationPatternSchema>;

// ---------------------------------------------------------------------------
// RotationPattern service — satisfies FR-SHIFT-2
// Validates cycle array length equals cycleLength.
// ---------------------------------------------------------------------------

function validateCycle(cycleLength: number, cycle: CreateRotationPattern['cycle']): void {
  if (cycle.length !== cycleLength) {
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      `cycle array length (${cycle.length}) must equal cycleLength (${cycleLength})`,
    );
  }
}

export async function createPattern(
  dto: CreateRotationPattern,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<RotationPattern> {
  validateCycle(dto.cycleLength, dto.cycle);

  const pattern = await db.rotationPattern.create({
    data: {
      organizationId,
      name: dto.name,
      cycleLength: dto.cycleLength,
      cycle: dto.cycle,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'RotationPattern',
    entityId: pattern.id,
    after: { name: pattern.name, cycleLength: pattern.cycleLength },
  });

  return pattern;
}

export async function listPatterns(db: TenantClient): Promise<RotationPattern[]> {
  return db.rotationPattern.findMany({
    orderBy: [{ name: 'asc' }],
  });
}

export async function updatePattern(
  id: string,
  dto: Partial<CreateRotationPattern>,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<RotationPattern> {
  const existing = await db.rotationPattern.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', `RotationPattern ${id} not found`);

  // If both cycleLength and cycle are provided, validate them together.
  const newCycleLength = dto.cycleLength ?? existing.cycleLength;
  const newCycle = (dto.cycle as CreateRotationPattern['cycle'] | undefined) ?? (existing.cycle as CreateRotationPattern['cycle']);
  validateCycle(newCycleLength, newCycle);

  const updated = await db.rotationPattern.update({
    where: { id },
    data: {
      name: dto.name ?? undefined,
      cycleLength: dto.cycleLength ?? undefined,
      cycle: dto.cycle ?? undefined,
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'UPDATE',
    entityType: 'RotationPattern',
    entityId: id,
    before: { name: existing.name, cycleLength: existing.cycleLength },
    after: { name: updated.name, cycleLength: updated.cycleLength },
  });

  return updated;
}

export async function deletePattern(
  id: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<void> {
  const existing = await db.rotationPattern.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', `RotationPattern ${id} not found`);

  await db.rotationPattern.delete({ where: { id } });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'DELETE',
    entityType: 'RotationPattern',
    entityId: id,
    before: { name: existing.name },
  });
}
