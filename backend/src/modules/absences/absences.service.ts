import type { Absence, AbsenceStatus, AbsenceType } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';
import { encryptCause, decryptCause } from './crypto';
import { env } from '../../config/env';

// ---------------------------------------------------------------------------
// Absence service — satisfies FR-ABS-1..7, AC-ABS-1..6 [GDPR] [COMPLIANCE]
// ---------------------------------------------------------------------------

export interface CreateAbsenceDto {
  employeeId: string;
  type: AbsenceType;
  startDate: string; // ISO date: "2026-06-15"
  endDate: string;   // ISO date: "2026-06-20"
  cause?: string;    // Only for IT type — GDPR special-category
}

export interface AbsenceWithCause extends Omit<Absence, 'causeEncrypted'> {
  cause?: string;
}

// ---------------------------------------------------------------------------
// createAbsence — FR-ABS-1, FR-ABS-2, FR-ABS-3 [GDPR]
// ---------------------------------------------------------------------------

/**
 * Creates an absence request.
 *
 * - 422 if dates overlap with an existing PENDING/APPROVED absence for the same employee.
 * - 422 if type=VACACIONES and remaining vacation balance is 0.
 * - Encrypts cause when type=IT and cause is provided.
 * - IT absences created by MANAGER or ADMIN go straight to APPROVED (FR-ABS-3).
 * - Writes CREATE audit row in-transaction.
 */
export async function createAbsence(
  dto: CreateAbsenceDto,
  actorId: string,
  actorRole: 'ADMIN' | 'MANAGER' | 'EMPLOYEE',
  orgId: string,
  db: TenantClient,
): Promise<{ absence: AbsenceWithCause }> {
  const startDate = new Date(dto.startDate);
  const endDate = new Date(dto.endDate);

  if (endDate < startDate) {
    throw new ApiError(422, 'INVALID_DATE_RANGE', 'endDate must be on or after startDate');
  }

  // Check for date overlap with existing PENDING or APPROVED absences.
  const overlapping = await db.absence.findFirst({
    where: {
      employeeId: dto.employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
  });

  if (overlapping) {
    throw new ApiError(
      422,
      'ABSENCE_OVERLAP',
      `Employee already has an absence from ${overlapping.startDate.toISOString().slice(0, 10)} to ${overlapping.endDate.toISOString().slice(0, 10)} that overlaps with the requested period`,
    );
  }

  // Validate vacation balance for VACACIONES type.
  if (dto.type === 'VACACIONES') {
    const balance = await computeBalance(dto.employeeId, startDate.getFullYear(), orgId, db);
    if (balance.remaining <= 0) {
      throw new ApiError(
        422,
        'INSUFFICIENT_VACATION_BALANCE',
        `Employee has no remaining vacation days for year ${startDate.getFullYear()}`,
      );
    }
  }

  // Determine initial status.
  // IT absences created by MANAGER or ADMIN are auto-APPROVED (FR-ABS-3, AC-ABS-3).
  let initialStatus: AbsenceStatus = 'PENDING';
  if (dto.type === 'IT' && (actorRole === 'MANAGER' || actorRole === 'ADMIN')) {
    initialStatus = 'APPROVED';
  }

  // Encrypt IT cause if provided (GDPR Art. 9 — special-category field).
  let causeEncrypted: Buffer | null = null;
  if (dto.type === 'IT' && dto.cause) {
    causeEncrypted = encryptCause(dto.cause, env.FIELD_ENCRYPTION_KEY);
  }

  const absence = await db.absence.create({
    data: {
      organizationId: orgId,
      employeeId: dto.employeeId,
      type: dto.type,
      startDate,
      endDate,
      status: initialStatus,
      // Buffer is compatible at runtime; cast bridges the TS 6 ArrayBuffer strict check.
      causeEncrypted: causeEncrypted as unknown as Uint8Array<ArrayBuffer> | null,
      approverId: initialStatus === 'APPROVED' ? actorId : null,
      decidedAt: initialStatus === 'APPROVED' ? new Date() : null,
    },
  });

  await auditWriter.write(db, actorId, orgId, {
    action: 'CREATE',
    entityType: 'Absence',
    entityId: absence.id,
    after: {
      employeeId: dto.employeeId,
      type: dto.type,
      startDate: dto.startDate,
      endDate: dto.endDate,
      status: initialStatus,
      hasCause: causeEncrypted !== null,
    },
  });

  const { causeEncrypted: _raw, ...rest } = absence;
  return { absence: rest };
}

// ---------------------------------------------------------------------------
// approveAbsence — FR-ABS-2, FR-ABS-5 [COMPLIANCE]
// ---------------------------------------------------------------------------

/**
 * Approves a PENDING absence.
 *
 * - Transitions status: PENDING → APPROVED.
 * - Writes APPROVE audit row.
 */
export async function approveAbsence(
  id: string,
  approverId: string,
  orgId: string,
  db: TenantClient,
): Promise<AbsenceWithCause> {
  const existing = await db.absence.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', `Absence ${id} not found`);
  }
  if (existing.status !== 'PENDING') {
    throw new ApiError(409, 'ABSENCE_NOT_PENDING', `Absence ${id} is not in PENDING status`);
  }

  const before = { status: existing.status };
  const decidedAt = new Date();

  const approved = await db.absence.update({
    where: { id },
    data: { status: 'APPROVED', approverId, decidedAt },
  });

  await auditWriter.write(db, approverId, orgId, {
    action: 'APPROVE',
    entityType: 'Absence',
    entityId: id,
    before,
    after: { status: 'APPROVED', approverId, decidedAt: decidedAt.toISOString() },
  });

  const { causeEncrypted: _raw, ...rest } = approved;
  return rest;
}

// ---------------------------------------------------------------------------
// rejectAbsence — FR-ABS-2 [COMPLIANCE]
// ---------------------------------------------------------------------------

/**
 * Rejects a PENDING absence.
 *
 * - Transitions status: PENDING → REJECTED.
 * - Writes REJECT audit row.
 */
export async function rejectAbsence(
  id: string,
  rejecterId: string,
  orgId: string,
  db: TenantClient,
): Promise<AbsenceWithCause> {
  const existing = await db.absence.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError(404, 'NOT_FOUND', `Absence ${id} not found`);
  }
  if (existing.status !== 'PENDING') {
    throw new ApiError(409, 'ABSENCE_NOT_PENDING', `Absence ${id} is not in PENDING status`);
  }

  const before = { status: existing.status };
  const decidedAt = new Date();

  const rejected = await db.absence.update({
    where: { id },
    data: { status: 'REJECTED', approverId: rejecterId, decidedAt },
  });

  await auditWriter.write(db, rejecterId, orgId, {
    action: 'REJECT',
    entityType: 'Absence',
    entityId: id,
    before,
    after: { status: 'REJECTED', decidedAt: decidedAt.toISOString() },
  });

  const { causeEncrypted: _raw, ...rest } = rejected;
  return rest;
}

// ---------------------------------------------------------------------------
// getAbsence — FR-ABS-6, AC-ABS-4, AC-AUDIT-3 [GDPR] [COMPLIANCE]
// ---------------------------------------------------------------------------

/**
 * Retrieves a single absence by id.
 *
 * GDPR INVARIANT: If causeEncrypted is present, the AuditLog READ row is written
 * BEFORE decryption occurs and BEFORE the function returns. Both operations run
 * inside the same tenant transaction. If the audit write fails, the data is NOT
 * returned (the tx rolls back).
 *
 * The raw causeEncrypted bytes are NEVER included in the returned object.
 */
export async function getAbsence(
  id: string,
  orgId: string,
  actorId: string,
  db: TenantClient,
): Promise<AbsenceWithCause> {
  const absence = await db.absence.findUnique({ where: { id } });
  if (!absence) {
    throw new ApiError(404, 'NOT_FOUND', `Absence ${id} not found`);
  }

  let cause: string | undefined;

  if (absence.causeEncrypted) {
    // GDPR: write READ audit FIRST — before any decryption (AC-AUDIT-3, AC-ABS-4).
    // If this write throws, the entire tx rolls back and data is not returned.
    await auditWriter.write(db, actorId, orgId, {
      action: 'READ',
      entityType: 'Absence',
      entityId: id,
    });

    // Only decrypt AFTER audit is committed (within same tx).
    cause = decryptCause(absence.causeEncrypted as Buffer, env.FIELD_ENCRYPTION_KEY);
  }

  const { causeEncrypted: _raw, ...rest } = absence;
  return { ...rest, ...(cause !== undefined ? { cause } : {}) };
}

// ---------------------------------------------------------------------------
// listAbsences — FR-ABS-6
// ---------------------------------------------------------------------------

export interface ListAbsencesFilter {
  employeeId?: string;
  status?: AbsenceStatus;
  type?: AbsenceType;
}

/**
 * Lists absences with optional filtering.
 *
 * GDPR: causeEncrypted is NEVER decrypted or returned in list results.
 * Only getAbsence (single-record) triggers the GDPR audit + decrypt.
 */
export async function listAbsences(
  filter: ListAbsencesFilter,
  db: TenantClient,
): Promise<AbsenceWithCause[]> {
  const rows = await db.absence.findMany({
    where: {
      ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.type ? { type: filter.type } : {}),
    },
    orderBy: { startDate: 'desc' },
  });

  // Strip causeEncrypted — never exposed in list results (GDPR minimization).
  return rows.map(({ causeEncrypted: _raw, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// getBalance — FR-ABS-5, FR-ABS-7
// ---------------------------------------------------------------------------

export interface AbsenceBalance {
  entitled: number;
  used: number;
  remaining: number;
}

/**
 * Computes vacation balance for an employee for a given year.
 *
 * - Entitled: statutory 22 working days per year.
 * - Used: sum of approved VACACIONES absence days for the employee+year.
 * - Remaining: entitled - used (floor at 0).
 */
export async function getBalance(
  employeeId: string,
  year: number,
  orgId: string,
  db: TenantClient,
): Promise<AbsenceBalance> {
  return computeBalance(employeeId, year, orgId, db);
}

// ---------------------------------------------------------------------------
// Internal helper — shared by createAbsence validation and getBalance.
// ---------------------------------------------------------------------------

async function computeBalance(
  employeeId: string,
  year: number,
  orgId: string,
  db: TenantClient,
): Promise<AbsenceBalance> {
  const ENTITLED_DAYS = 22; // statutory vacation days per year (Art. 38 ET)

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  const approvedVacaciones = await db.absence.findMany({
    where: {
      employeeId,
      organizationId: orgId,
      type: 'VACACIONES',
      status: 'APPROVED',
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
    },
  });

  let used = 0;
  for (const abs of approvedVacaciones) {
    // Clamp to the year boundaries in case the absence spans years.
    const clampedStart = abs.startDate < yearStart ? yearStart : abs.startDate;
    const clampedEnd = abs.endDate > yearEnd ? yearEnd : abs.endDate;
    const days = Math.round(
      (clampedEnd.getTime() - clampedStart.getTime()) / (1000 * 60 * 60 * 24),
    ) + 1;
    used += days;
  }

  const remaining = Math.max(0, ENTITLED_DAYS - used);
  return { entitled: ENTITLED_DAYS, used, remaining };
}
