import type { RuleSet } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';

// ---------------------------------------------------------------------------
// RuleSet CRUD service — satisfies FR-RULES-2, FR-RULES-4
//
// Per-organization convenio configuration consumed by the Rules Engine.
// Statutory defaults (fallback when no RuleSet found):
//   minRestHours: 12, maxDailyHours: 9, maxAnnualOvertime: 80, weeklyRestDays: 1.5
// ---------------------------------------------------------------------------

export interface CreateRuleSetDto {
  name: string;
  isDefault?: boolean;
  minRestHours?: number;
  maxDailyHours?: number;
  maxAnnualOvertime?: number;
  weeklyRestDays?: number;
  params?: Record<string, unknown>;
}

export interface UpdateRuleSetDto {
  name?: string;
  isDefault?: boolean;
  minRestHours?: number;
  maxDailyHours?: number;
  maxAnnualOvertime?: number;
  weeklyRestDays?: number;
  params?: Record<string, unknown>;
}

/**
 * Creates a new RuleSet for the organization.
 * ADMIN only (enforced at controller/router level).
 * Validates name is unique within the org.
 */
export async function createRuleSet(
  dto: CreateRuleSetDto,
  orgId: string,
  actorId: string,
  db: TenantClient,
): Promise<RuleSet> {
  // Validate unique name within org.
  const existing = await db.ruleSet.findFirst({
    where: { organizationId: orgId, name: dto.name },
  });
  if (existing) {
    throw new ApiError(409, 'RULESET_NAME_CONFLICT', `A RuleSet named "${dto.name}" already exists for this organization`);
  }

  const ruleSet = await db.ruleSet.create({
    data: {
      organizationId: orgId,
      name: dto.name,
      isDefault: dto.isDefault ?? false,
      minRestHours: dto.minRestHours ?? 12,
      maxDailyHours: dto.maxDailyHours ?? 9,
      maxAnnualOvertime: dto.maxAnnualOvertime ?? 80,
      weeklyRestDays: dto.weeklyRestDays ?? 1.5,
      params: (dto.params ?? {}) as object,
    },
  });

  await auditWriter.write(db, actorId, orgId, {
    action: 'CREATE',
    entityType: 'RuleSet',
    entityId: ruleSet.id,
    after: {
      name: ruleSet.name,
      isDefault: ruleSet.isDefault,
      minRestHours: Number(ruleSet.minRestHours),
      maxDailyHours: Number(ruleSet.maxDailyHours),
      maxAnnualOvertime: Number(ruleSet.maxAnnualOvertime),
      weeklyRestDays: Number(ruleSet.weeklyRestDays),
    },
  });

  return ruleSet;
}

/**
 * Partially updates an existing RuleSet.
 * ADMIN only (enforced at controller/router level).
 * Returns 404 if the RuleSet does not exist.
 */
export async function updateRuleSet(
  id: string,
  dto: UpdateRuleSetDto,
  orgId: string,
  actorId: string,
  db: TenantClient,
): Promise<RuleSet> {
  const existing = await db.ruleSet.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', `RuleSet ${id} not found`);
  }

  // If name is changing, validate uniqueness.
  if (dto.name && dto.name !== existing.name) {
    const nameConflict = await db.ruleSet.findFirst({
      where: { organizationId: orgId, name: dto.name },
    });
    if (nameConflict) {
      throw new ApiError(409, 'RULESET_NAME_CONFLICT', `A RuleSet named "${dto.name}" already exists for this organization`);
    }
  }

  const before = {
    name: existing.name,
    isDefault: existing.isDefault,
    minRestHours: Number(existing.minRestHours),
    maxDailyHours: Number(existing.maxDailyHours),
    maxAnnualOvertime: Number(existing.maxAnnualOvertime),
    weeklyRestDays: Number(existing.weeklyRestDays),
  };

  const updated = await db.ruleSet.update({
    where: { id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      ...(dto.minRestHours !== undefined ? { minRestHours: dto.minRestHours } : {}),
      ...(dto.maxDailyHours !== undefined ? { maxDailyHours: dto.maxDailyHours } : {}),
      ...(dto.maxAnnualOvertime !== undefined ? { maxAnnualOvertime: dto.maxAnnualOvertime } : {}),
      ...(dto.weeklyRestDays !== undefined ? { weeklyRestDays: dto.weeklyRestDays } : {}),
      ...(dto.params !== undefined ? { params: dto.params as object } : {}),
    },
  });

  await auditWriter.write(db, actorId, orgId, {
    action: 'UPDATE',
    entityType: 'RuleSet',
    entityId: id,
    before,
    after: {
      name: updated.name,
      isDefault: updated.isDefault,
      minRestHours: Number(updated.minRestHours),
      maxDailyHours: Number(updated.maxDailyHours),
      maxAnnualOvertime: Number(updated.maxAnnualOvertime),
      weeklyRestDays: Number(updated.weeklyRestDays),
    },
  });

  return updated;
}

/**
 * Lists all RuleSets for the organization.
 * The default ruleset is marked with isDefault=true.
 *
 * Default fallback (when no RuleSet exists): callers should use statutory defaults:
 *   minRestHours: 12, maxDailyHours: 9, maxAnnualOvertime: 80, weeklyRestDays: 1.5
 */
export async function listRuleSets(orgId: string, db: TenantClient): Promise<RuleSet[]> {
  return db.ruleSet.findMany({
    where: { organizationId: orgId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
}
