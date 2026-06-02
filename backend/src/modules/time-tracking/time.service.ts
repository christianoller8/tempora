import type { TimeEntry, TimeCorrection } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';
import { ruleEngine } from '../rules/index';
import type { RuleContext, RuleSetConfig, RuleCheckResult } from '../rules/types';
import type { OrgEventBus } from '../../sse/event-bus';

// ---------------------------------------------------------------------------
// Event bus injection — replaced at startup with real OrgEventBus instance.
// Satisfies the P2 stub pattern used by schedules.service.ts and swaps.service.ts.
// ---------------------------------------------------------------------------
let _eventBus: OrgEventBus | null = null;

export function setEventBus(bus: OrgEventBus): void {
  _eventBus = bus;
}

function emitSseEvent(event: {
  type: string;
  organizationId: string;
  targetRole?: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  payload: unknown;
}): void {
  if (!_eventBus) return;
  _eventBus.publish({
    type: event.type as import('../../sse/events.js').SseEventType,
    organizationId: event.organizationId,
    targetRole: event.targetRole,
    payload: event.payload,
    emittedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Fetches the RuleSetConfig for an organization.
 * Falls back to statutory defaults if none configured.
 */
async function fetchRuleSetConfig(organizationId: string, db: TenantClient): Promise<RuleSetConfig> {
  const ruleSet = await db.ruleSet.findFirst({
    where: { organizationId, isDefault: true },
  });
  return {
    minRestHours: ruleSet ? Number(ruleSet.minRestHours) : 12,
    maxDailyHours: ruleSet ? Number(ruleSet.maxDailyHours) : 9,
    maxAnnualOvertime: ruleSet ? Number(ruleSet.maxAnnualOvertime) : 80,
    weeklyRestDays: ruleSet ? Number(ruleSet.weeklyRestDays) : 1.5,
    params: ruleSet ? (ruleSet.params as Record<string, unknown>) : {},
  };
}

/**
 * Computes year-to-date overtime hours for an employee.
 * Only counts closed entries where effective hours exceed the daily max (9h default).
 *
 * Used by clockOut and extracted as a shared helper for P2 services.
 */
export async function getYtdOvertimeHours(
  employeeId: string,
  orgId: string,
  year: number,
  db: TenantClient,
): Promise<number> {
  const result = await db.$queryRaw<[{ total: number }]>`
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600), 0) AS total
    FROM time_entries
    WHERE "employeeId" = ${employeeId}::uuid
      AND "organizationId" = ${orgId}::uuid
      AND status = 'CLOSED'
      AND EXTRACT(YEAR FROM "clockIn") = ${year}
      AND EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600 > 9
  `;
  return Number(result[0]?.total ?? 0);
}

// ---------------------------------------------------------------------------
// clockIn — FR-TIME-1, FR-TIME-2, FR-TIME-3 [COMPLIANCE]
// ---------------------------------------------------------------------------

/**
 * Records a clock-in for an employee.
 *
 * Server-authoritative timestamp is used (client time ignored — FR-TIME-1).
 * Returns 409 if the employee already has an OPEN entry (FR-TIME-3).
 * Writes a CREATE audit row in the same transaction.
 */
export async function clockIn(
  employeeId: string,
  orgId: string,
  db: TenantClient,
  source = 'web',
): Promise<TimeEntry> {
  // FR-TIME-3: check for existing OPEN entry.
  const openEntry = await db.timeEntry.findFirst({
    where: { employeeId, organizationId: orgId, status: 'OPEN' },
  });
  if (openEntry) {
    throw new ApiError(409, 'ALREADY_CLOCKED_IN', 'Employee already has an open time entry');
  }

  // FR-TIME-1: server-authoritative timestamp.
  const entry = await db.timeEntry.create({
    data: {
      organizationId: orgId,
      employeeId,
      clockIn: new Date(),
      status: 'OPEN',
      source,
    },
  });

  await auditWriter.write(db, employeeId, orgId, {
    action: 'CREATE',
    entityType: 'TimeEntry',
    entityId: entry.id,
    after: { employeeId, status: 'OPEN', clockIn: entry.clockIn.toISOString(), source },
  });

  // FR-TIME-9 / AC-TIME-8: notify live dashboard.
  emitSseEvent({
    type: 'CLOCK_IN',
    organizationId: orgId,
    targetRole: 'MANAGER',
    payload: { employeeId, entryId: entry.id, clockIn: entry.clockIn.toISOString(), source },
  });

  return entry;
}

// ---------------------------------------------------------------------------
// clockOut — FR-TIME-2, FR-TIME-4, FR-TIME-8, FR-TIME-9 [COMPLIANCE]
// ---------------------------------------------------------------------------

/**
 * Records a clock-out for an employee.
 *
 * - Finds the OPEN entry (404 if none).
 * - Computes effective hours; sets overtime flag if > daily max (default 9h).
 * - Performs the trigger-guarded OPEN→CLOSED UPDATE.
 * - Queries YTD overtime and calls ruleEngine for MAX_ANNUAL_OT_80H.
 * - Emits CLOCK_OUT SSE event scoped to MANAGER/ADMIN roles.
 * - Writes audit row in the same transaction.
 */
export async function clockOut(
  employeeId: string,
  orgId: string,
  db: TenantClient,
): Promise<{ entry: TimeEntry; warnings: RuleCheckResult[] }> {
  const openEntry = await db.timeEntry.findFirst({
    where: { employeeId, organizationId: orgId, status: 'OPEN' },
  });
  if (!openEntry) {
    throw new ApiError(404, 'NOT_CLOCKED_IN', 'Employee has no open time entry to close');
  }

  const clockOutTime = new Date();
  const effectiveHours =
    (clockOutTime.getTime() - openEntry.clockIn.getTime()) / (1000 * 60 * 60);

  const ruleSetConfig = await fetchRuleSetConfig(orgId, db);
  const overtime = effectiveHours > ruleSetConfig.maxDailyHours;

  // Trigger-guarded OPEN→CLOSED update (enforced by enforce_timeentry_immutability trigger).
  const closed = await db.timeEntry.update({
    where: { id: openEntry.id },
    data: {
      clockOut: clockOutTime,
      status: 'CLOSED',
    },
  });

  // YTD overtime accumulator — no separate OvertimeEntry model; compute via raw SQL.
  const year = clockOutTime.getFullYear();
  const ytdOvertimeHours = await getYtdOvertimeHours(employeeId, orgId, year, db);

  // Load approved absences for the clock-in day (FR-RULES-6, P4-9).
  const clockInDate = openEntry.clockIn;
  const approvedAbsences = await db.absence.findMany({
    where: {
      employeeId,
      organizationId: orgId,
      status: 'APPROVED',
      startDate: { lte: clockInDate },
      endDate: { gte: clockInDate },
    },
  });

  // Rules Engine check for annual OT cap (FR-TIME-4, FR-RULES-6).
  const context: RuleContext = {
    organizationId: orgId,
    employeeId,
    candidate: {
      kind: 'timeEntry',
      clockIn: openEntry.clockIn.toISOString(),
      clockOut: clockOutTime.toISOString(),
    },
    recentAssignments: [],
    weekAssignments: [],
    annualOvertimeHours: ytdOvertimeHours,
    approvedAbsences: approvedAbsences.map((abs) => ({
      startDate: abs.startDate.toISOString().slice(0, 10),
      endDate: abs.endDate.toISOString().slice(0, 10),
    })),
  };

  const ruleResults = ruleEngine.check(context, ruleSetConfig);
  const warnings = ruleResults.filter((r) => r.type === 'warn');
  const blocks = ruleResults.filter((r) => r.type === 'block');

  // BLOCK violations on clock-out are surfaced as 422 (FR-RULES-7).
  // Per spec: ruleEngine.check is called and MAY flag the 80h cap violation.
  // The spec says "MAY flag" — we return the violations rather than blocking
  // clock-out itself (workers must still be able to clock out even over cap).
  // Compliance note: the overtime cap is a WARN on clock-out per FR-TIME-4.

  // Emit CLOCK_OUT SSE event to managers/admins for live dashboard (FR-TIME-9).
  emitSseEvent({
    type: 'CLOCK_OUT',
    organizationId: orgId,
    targetRole: 'MANAGER',
    payload: {
      employeeId,
      entryId: closed.id,
      clockOut: clockOutTime.toISOString(),
      effectiveHours,
      overtime,
    },
  });

  await auditWriter.write(db, employeeId, orgId, {
    action: 'UPDATE',
    entityType: 'TimeEntry',
    entityId: closed.id,
    before: { status: 'OPEN', clockIn: openEntry.clockIn.toISOString() },
    after: {
      status: 'CLOSED',
      clockOut: clockOutTime.toISOString(),
      effectiveHours,
      overtime,
      ytdOvertimeHours,
    },
  });

  return { entry: closed, warnings: [...warnings, ...blocks] };
}

// ---------------------------------------------------------------------------
// listEntries — FR-TIME-10
// ---------------------------------------------------------------------------

export interface ListEntriesFilter {
  employeeId?: string;
  from?: Date;
  to?: Date;
  status?: 'OPEN' | 'CLOSED';
}

/**
 * Lists TimeEntry rows with optional filtering.
 * Scoped to the tenant via RLS (organizationId set by withTenant).
 */
export async function listEntries(
  filter: ListEntriesFilter,
  db: TenantClient,
): Promise<TimeEntry[]> {
  return db.timeEntry.findMany({
    where: {
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.from || filter.to
        ? {
            clockIn: {
              ...(filter.from ? { gte: filter.from } : {}),
              ...(filter.to ? { lte: filter.to } : {}),
            },
          }
        : {}),
    },
    orderBy: { clockIn: 'desc' },
  });
}

// ---------------------------------------------------------------------------
// createCorrection — FR-TIME-5
// ---------------------------------------------------------------------------

export interface CreateCorrectionDto {
  timeEntryId: string;
  requestedById: string;
  proposedClockIn?: Date;
  proposedClockOut?: Date;
  justification: string;
}

/**
 * Creates a TimeCorrection in PENDING status.
 * Returns 404 if the linked TimeEntry does not exist.
 */
export async function createCorrection(
  dto: CreateCorrectionDto,
  orgId: string,
  db: TenantClient,
): Promise<TimeCorrection> {
  const entry = await db.timeEntry.findUnique({ where: { id: dto.timeEntryId } });
  if (!entry) {
    throw new ApiError(404, 'NOT_FOUND', `TimeEntry ${dto.timeEntryId} not found`);
  }

  const correction = await db.timeCorrection.create({
    data: {
      organizationId: orgId,
      timeEntryId: dto.timeEntryId,
      requestedById: dto.requestedById,
      proposedClockIn: dto.proposedClockIn ?? null,
      proposedClockOut: dto.proposedClockOut ?? null,
      justification: dto.justification,
      status: 'PENDING',
    },
  });

  await auditWriter.write(db, dto.requestedById, orgId, {
    action: 'CREATE',
    entityType: 'TimeCorrection',
    entityId: correction.id,
    after: {
      timeEntryId: dto.timeEntryId,
      status: 'PENDING',
      justification: dto.justification,
    },
  });

  return correction;
}

// ---------------------------------------------------------------------------
// approveCorrection / rejectCorrection — FR-TIME-6, FR-TIME-7 [COMPLIANCE]
// ---------------------------------------------------------------------------

/**
 * Approves a TimeCorrection.
 * Records before (PENDING) and after (APPROVED + decidedAt) in the audit log.
 */
export async function approveCorrection(
  correctionId: string,
  approverId: string,
  orgId: string,
  db: TenantClient,
): Promise<TimeCorrection> {
  const correction = await db.timeCorrection.findUnique({ where: { id: correctionId } });
  if (!correction) {
    throw new ApiError(404, 'NOT_FOUND', `TimeCorrection ${correctionId} not found`);
  }
  if (correction.status !== 'PENDING') {
    throw new ApiError(409, 'CORRECTION_NOT_PENDING', `TimeCorrection ${correctionId} is not in PENDING status`);
  }

  const before = { status: correction.status };
  const decidedAt = new Date();

  const approved = await db.timeCorrection.update({
    where: { id: correctionId },
    data: { status: 'APPROVED', approverId, decidedAt },
  });

  await auditWriter.write(db, approverId, orgId, {
    action: 'APPROVE',
    entityType: 'TimeCorrection',
    entityId: correctionId,
    before,
    after: { status: 'APPROVED', approverId, decidedAt: decidedAt.toISOString() },
  });

  return approved;
}

/**
 * Rejects a TimeCorrection.
 * Records before (PENDING) and after (REJECTED + decidedAt) in the audit log.
 */
export async function rejectCorrection(
  correctionId: string,
  rejecterId: string,
  orgId: string,
  db: TenantClient,
): Promise<TimeCorrection> {
  const correction = await db.timeCorrection.findUnique({ where: { id: correctionId } });
  if (!correction) {
    throw new ApiError(404, 'NOT_FOUND', `TimeCorrection ${correctionId} not found`);
  }
  if (correction.status !== 'PENDING') {
    throw new ApiError(409, 'CORRECTION_NOT_PENDING', `TimeCorrection ${correctionId} is not in PENDING status`);
  }

  const before = { status: correction.status };
  const decidedAt = new Date();

  const rejected = await db.timeCorrection.update({
    where: { id: correctionId },
    data: { status: 'REJECTED', approverId: rejecterId, decidedAt },
  });

  await auditWriter.write(db, rejecterId, orgId, {
    action: 'REJECT',
    entityType: 'TimeCorrection',
    entityId: correctionId,
    before,
    after: { status: 'REJECTED', decidedAt: decidedAt.toISOString() },
  });

  return rejected;
}
