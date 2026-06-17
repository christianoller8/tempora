import type { ShiftAssignment } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';
import { ruleEngine } from '../rules/index';
import type { RuleContext, RuleSetConfig, RuleCheckResult } from '../rules/types';
import { getYtdOvertimeHours } from '../time-tracking/time.service';
import type { z } from 'zod';
import type { ShiftAssignmentSchema } from '@tempora/shared';

type CreateAssignmentDto = z.infer<typeof ShiftAssignmentSchema>;

// ---------------------------------------------------------------------------
// ShiftAssignment service — satisfies FR-SHIFT-5, FR-RULES-5 [COMPLIANCE]
// Validates DRAFT status, fetches RuleSetConfig, assembles RuleContext,
// calls ruleEngine.check, rejects with 422 on BLOCK, persists, audits.
// ---------------------------------------------------------------------------

export async function createAssignment(
  dto: CreateAssignmentDto,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<{ assignment: ShiftAssignment; warnings: RuleCheckResult[] }> {
  // Validate schedule is in DRAFT status.
  const schedule = await db.shiftSchedule.findUnique({ where: { id: dto.scheduleId } });
  if (!schedule) {
    throw new ApiError(404, 'NOT_FOUND', `ShiftSchedule ${dto.scheduleId} not found`);
  }
  if (schedule.status !== 'DRAFT') {
    throw new ApiError(
      409,
      'SCHEDULE_NOT_DRAFT',
      `ShiftSchedule ${dto.scheduleId} is not in DRAFT status — assignments cannot be changed after publish (AC-SHIFT-3)`,
    );
  }

  // Fetch the shift template to get timing information.
  const template = await db.shiftTemplate.findUnique({ where: { id: dto.shiftTemplateId } });
  if (!template) {
    throw new ApiError(404, 'NOT_FOUND', `ShiftTemplate ${dto.shiftTemplateId} not found`);
  }

  // Fetch org's active RuleSet.
  const ruleSetRow = await db.ruleSet.findFirst({
    where: { organizationId, isDefault: true },
  });
  const ruleSetConfig: RuleSetConfig = {
    minRestHours: ruleSetRow ? Number(ruleSetRow.minRestHours) : 12,
    maxDailyHours: ruleSetRow ? Number(ruleSetRow.maxDailyHours) : 9,
    maxAnnualOvertime: ruleSetRow ? Number(ruleSetRow.maxAnnualOvertime) : 80,
    weeklyRestDays: ruleSetRow ? Number(ruleSetRow.weeklyRestDays) : 1.5,
    params: ruleSetRow ? (ruleSetRow.params as Record<string, unknown>) : {},
  };

  // Fetch recent assignments for this employee (used by minRest rule).
  const recentAssignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: dto.employeeId,
      date: { lt: new Date(dto.date) },
    },
    include: { shiftTemplate: true },
    orderBy: { date: 'desc' },
    take: 10,
  });

  // Fetch 7-day window assignments for the weekly rest rule.
  const candidateDate = new Date(dto.date);
  const windowStart = new Date(candidateDate);
  windowStart.setDate(windowStart.getDate() - 6);

  const weekWindowAssignments = await db.shiftAssignment.findMany({
    where: {
      employeeId: dto.employeeId,
      date: { gte: windowStart, lt: candidateDate },
    },
    orderBy: { date: 'asc' },
  });

  // Fetch annual overtime accumulator via time_entries (no overtime_entries table yet).
  const annualOt = await getYtdOvertimeHours(
    dto.employeeId, organizationId, candidateDate.getFullYear(), db,
  ).catch(() => 0);

  // Load approved absences for the employee in the relevant period (FR-RULES-6, P4-9).
  const approvedAbsences = await db.absence.findMany({
    where: {
      employeeId: dto.employeeId,
      organizationId,
      status: 'APPROVED',
      startDate: { lte: candidateDate },
      endDate: { gte: windowStart },
    },
  });

  // Assemble RuleContext.
  const context: RuleContext = {
    organizationId,
    employeeId: dto.employeeId,
    candidate: {
      kind: 'assignment',
      date: dto.date,
      startsAt: template.startTime,
      endsAt: template.endTime,
    },
    recentAssignments: recentAssignments
      .filter((ra) => ra.shiftTemplate != null)
      .map((ra) => ({
        date: (ra.date as Date).toISOString().slice(0, 10),
        startsAt: ra.shiftTemplate.startTime,
        endsAt: ra.shiftTemplate.endTime,
      })),
    weekAssignments: weekWindowAssignments.map((wa) => ({
      date: (wa.date as Date).toISOString().slice(0, 10),
      restDay: false, // assignments are work days; rest days are absent from the list
    })),
    annualOvertimeHours: annualOt,
    approvedAbsences: approvedAbsences.map((abs) => ({
      startDate: abs.startDate.toISOString().slice(0, 10),
      endDate: abs.endDate.toISOString().slice(0, 10),
    })),
  };

  // Run Rules Engine — pure, no I/O.
  const results = ruleEngine.check(context, ruleSetConfig);
  const blockViolations = results.filter((r) => r.type === 'block');

  if (blockViolations.length > 0) {
    throw new ApiError(
      422,
      'RULE_VIOLATION',
      `Assignment blocked by ${blockViolations.length} rule violation(s)`,
      blockViolations,
    );
  }

  // Upsert assignment — replace if one already exists for this employee+date in this schedule.
  // Use gte/lt range to avoid timestamp-vs-date equality issues with @db.Date.
  const dayStart = new Date(dto.date + 'T00:00:00.000Z');
  const dayEnd   = new Date(dto.date + 'T23:59:59.999Z');
  const existing = await db.shiftAssignment.findFirst({
    where: {
      scheduleId: dto.scheduleId,
      employeeId: dto.employeeId,
      date: { gte: dayStart, lte: dayEnd },
    },
  });

  let assignment: ShiftAssignment;
  if (existing) {
    assignment = await db.shiftAssignment.update({
      where: { id: existing.id },
      data: { shiftTemplateId: dto.shiftTemplateId },
    });
  } else {
    assignment = await db.shiftAssignment.create({
      data: {
        organizationId,
        scheduleId: dto.scheduleId,
        employeeId: dto.employeeId,
        shiftTemplateId: dto.shiftTemplateId,
        departmentId: dto.departmentId ?? null,
        date: new Date(dto.date),
      },
    });
  }

  // Write audit row.
  await auditWriter.write(db, actorId, organizationId, {
    action: 'CREATE',
    entityType: 'ShiftAssignment',
    entityId: assignment.id,
    after: {
      employeeId: assignment.employeeId,
      shiftTemplateId: assignment.shiftTemplateId,
      date: dto.date,
      scheduleId: assignment.scheduleId,
    },
  });

  const warnings = results.filter((r) => r.type === 'warn');
  return { assignment, warnings };
}

export async function deleteAssignment(
  id: string,
  organizationId: string,
  actorId: string,
  db: TenantClient,
): Promise<void> {
  const assignment = await db.shiftAssignment.findUnique({ where: { id } });
  if (!assignment) throw new ApiError(404, 'NOT_FOUND', `ShiftAssignment ${id} not found`);

  const schedule = await db.shiftSchedule.findUnique({ where: { id: assignment.scheduleId } });
  if (!schedule) throw new ApiError(404, 'NOT_FOUND', `ShiftSchedule not found`);
  if (schedule.status !== 'DRAFT') {
    throw new ApiError(409, 'SCHEDULE_NOT_DRAFT', 'Cannot remove assignments from a published schedule');
  }

  await db.shiftAssignment.delete({ where: { id } });

  await auditWriter.write(db, actorId, organizationId, {
    action: 'DELETE',
    entityType: 'ShiftAssignment',
    entityId: id,
    before: {
      employeeId: assignment.employeeId,
      shiftTemplateId: assignment.shiftTemplateId,
      date: (assignment.date as Date).toISOString().slice(0, 10),
      scheduleId: assignment.scheduleId,
    },
  });
}

export async function listAssignments(
  filter: { scheduleId?: string; employeeId?: string },
  db: TenantClient,
): Promise<ShiftAssignment[]> {
  return db.shiftAssignment.findMany({
    where: {
      ...(filter.scheduleId ? { scheduleId: filter.scheduleId } : {}),
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
    },
    orderBy: [{ date: 'asc' }],
  });
}
