import type { ShiftSchedule } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';
import { ruleEngine } from '../rules/index';
import type { RuleContext, RuleSetConfig, RuleCheckResult } from '../rules/types';
import { getYtdOvertimeHours } from '../time-tracking/time.service';
import type { z } from 'zod';
import type { CreateScheduleSchema } from '@tempora/shared';

type CreateSchedule = z.infer<typeof CreateScheduleSchema>;

// ---------------------------------------------------------------------------
// ShiftSchedule (cuadrante) service — satisfies FR-SHIFT-3, FR-SHIFT-4,
// FR-SHIFT-5, FR-SHIFT-6, FR-SHIFT-7
// ---------------------------------------------------------------------------

// Stub event bus — the real SSE hub is wired in P3.
// Importing lazily to avoid circular deps if SSE hub isn't implemented yet.
let _eventBusPublish: ((orgId: string, event: Record<string, unknown>) => void) | null = null;

export function setEventBus(fn: (orgId: string, event: Record<string, unknown>) => void): void {
  _eventBusPublish = fn;
}

function publishEvent(orgId: string, event: Record<string, unknown>): void {
  if (_eventBusPublish) {
    _eventBusPublish(orgId, event);
  }
  // No-op if not wired — SSE hub is P3.
}

// ---------------------------------------------------------------------------
// createSchedule — creates in DRAFT status; manager scoped to own center.
// ---------------------------------------------------------------------------
export async function createSchedule(
  dto: CreateSchedule,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<ShiftSchedule> {
  // Check for existing schedule in same slot.
  const existing = await db.shiftSchedule.findFirst({
    where: {
      organizationId,
      centerId: dto.centerId,
      departmentId: dto.departmentId ?? null,
      year: dto.year,
      month: dto.month,
    },
  });
  if (existing) {
    throw new ApiError(
      409,
      'SCHEDULE_EXISTS',
      `A schedule already exists for center ${dto.centerId} ${dto.year}-${dto.month}`,
    );
  }

  const schedule = await db.shiftSchedule.create({
    data: {
      organizationId,
      centerId: dto.centerId,
      departmentId: dto.departmentId ?? null,
      year: dto.year,
      month: dto.month,
      status: 'DRAFT',
    },
  });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'ShiftSchedule',
    entityId: schedule.id,
    after: { centerId: schedule.centerId, year: schedule.year, month: schedule.month, status: 'DRAFT' },
  });

  return schedule;
}

export async function getSchedule(id: string, db: TenantClient): Promise<ShiftSchedule> {
  const schedule = await db.shiftSchedule.findUnique({ where: { id } });
  if (!schedule) throw new ApiError(404, 'NOT_FOUND', `ShiftSchedule ${id} not found`);
  return schedule;
}

export async function listSchedules(
  filter: { centerId?: string; year?: number; month?: number },
  db: TenantClient,
): Promise<ShiftSchedule[]> {
  return db.shiftSchedule.findMany({
    where: {
      ...(filter.centerId ? { centerId: filter.centerId } : {}),
      ...(filter.year !== undefined ? { year: filter.year } : {}),
      ...(filter.month !== undefined ? { month: filter.month } : {}),
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });
}

// ---------------------------------------------------------------------------
// publishSchedule — runs Rules Engine on all assignments, blocks on BLOCK
// violations, transitions to PUBLISHED (immutable), emits SSE event, audits.
// Satisfies: FR-SHIFT-4, FR-SHIFT-5, FR-SHIFT-7 [COMPLIANCE]
// ---------------------------------------------------------------------------
export async function publishSchedule(
  scheduleId: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<{ schedule: ShiftSchedule; warnings: RuleCheckResult[] }> {
  const schedule = await db.shiftSchedule.findUnique({
    where: { id: scheduleId },
    include: { assignments: { include: { shiftTemplate: true } } },
  });
  if (!schedule) throw new ApiError(404, 'NOT_FOUND', `ShiftSchedule ${scheduleId} not found`);
  if (schedule.status !== 'DRAFT') {
    throw new ApiError(409, 'ALREADY_PUBLISHED', `ShiftSchedule ${scheduleId} is not in DRAFT status`);
  }

  // Fetch the org's default RuleSet.
  const ruleSet = await db.ruleSet.findFirst({
    where: { organizationId, isDefault: true },
  });

  const ruleSetConfig: RuleSetConfig = {
    minRestHours: ruleSet ? Number(ruleSet.minRestHours) : 12,
    maxDailyHours: ruleSet ? Number(ruleSet.maxDailyHours) : 9,
    maxAnnualOvertime: ruleSet ? Number(ruleSet.maxAnnualOvertime) : 80,
    weeklyRestDays: ruleSet ? Number(ruleSet.weeklyRestDays) : 1.5,
    params: ruleSet ? (ruleSet.params as Record<string, unknown>) : {},
  };

  const allViolations: RuleCheckResult[] = [];
  const blockViolations: RuleCheckResult[] = [];

  // Run Rules Engine on each assignment in the schedule.
  for (const assignment of schedule.assignments) {
    // Fetch recent assignments for this employee (last 3 days for rest check).
    const recentAssignments = await db.shiftAssignment.findMany({
      where: {
        employeeId: assignment.employeeId,
        date: {
          lt: assignment.date,
        },
      },
      include: { shiftTemplate: true },
      orderBy: { date: 'desc' },
      take: 10,
    });

    // Fetch real YTD overtime using the shared helper from time.service (P3 fix for STUB).
    const annualOt = await getYtdOvertimeHours(
      assignment.employeeId,
      organizationId,
      schedule.year,
      db,
    ).catch(() => 0);

    const context: RuleContext = {
      organizationId,
      employeeId: assignment.employeeId,
      candidate: {
        kind: 'assignment',
        date: assignment.date.toISOString().slice(0, 10),
        startsAt: assignment.shiftTemplate.startTime,
        endsAt: assignment.shiftTemplate.endTime,
      },
      recentAssignments: recentAssignments.map((ra) => ({
        date: ra.date.toISOString().slice(0, 10),
        startsAt: ra.shiftTemplate.startTime,
        endsAt: ra.shiftTemplate.endTime,
      })),
      weekAssignments: [],
      annualOvertimeHours: annualOt,
    };

    const results = ruleEngine.check(context, ruleSetConfig);
    allViolations.push(...results);
    blockViolations.push(...results.filter((r) => r.type === 'block'));
  }

  if (blockViolations.length > 0) {
    throw new ApiError(
      422,
      'RULE_VIOLATION',
      `Schedule cannot be published due to ${blockViolations.length} BLOCK violation(s)`,
      blockViolations,
    );
  }

  // Transition to PUBLISHED — immutable from this point (AC-SHIFT-3).
  const published = await db.shiftSchedule.update({
    where: { id: scheduleId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: actorId,
    },
  });

  // Emit SHIFT_PUBLISHED SSE event (no-op until P3 SSE hub is wired).
  publishEvent(organizationId, {
    type: 'SHIFT_PUBLISHED',
    organizationId,
    payload: { scheduleId, centerId: schedule.centerId, year: schedule.year, month: schedule.month },
    emittedAt: new Date().toISOString(),
  });

  // Write PUBLISH audit row.
  await auditWriter.write(db, actorId, organizationId, {
    action: 'PUBLISH',
    entityType: 'ShiftSchedule',
    entityId: scheduleId,
    before: { status: 'DRAFT' },
    after: { status: 'PUBLISHED', publishedAt: published.publishedAt?.toISOString() },
  });

  const warnings = allViolations.filter((r) => r.type === 'warn');
  return { schedule: published, warnings };
}
