import type { TimesheetSignature } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';
import { auditWriter } from '../../audit/audit-writer';

// ---------------------------------------------------------------------------
// Timesheet Signature service
// Satisfies FR-TSS-001..014, AC-TSS-001..014
// APPEND-ONLY: no UPDATE or DELETE paths exist in this service.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// assertMonthNotConfirmed — exported guard consumed by time-tracking (ADR-2)
// Throws 409 MONTH_LOCKED if the employee has confirmed the given month.
// Month is derived from the UTC year/month of the supplied date.
// ---------------------------------------------------------------------------

export async function assertMonthNotConfirmed(
  employeeId: string,
  date: Date,
  orgId: string,
  db: TenantClient,
): Promise<void> {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;

  const sig = await db.timesheetSignature.findUnique({
    where: {
      organizationId_employeeId_year_month: {
        organizationId: orgId,
        employeeId,
        year,
        month,
      },
    },
  });

  if (sig) {
    throw new ApiError(
      409,
      'MONTH_LOCKED',
      `Month ${year}-${month} is confirmed and locked for this employee`,
    );
  }
}

// ---------------------------------------------------------------------------
// assertNoOpenEntry — internal guard (ADR-5)
// Throws 422 OPEN_ENTRIES_EXIST if any OPEN TimeEntry exists in the month.
// ---------------------------------------------------------------------------

export async function assertNoOpenEntry(
  employeeId: string,
  year: number,
  month: number,
  db: TenantClient,
): Promise<void> {
  // Build UTC boundaries for the month
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  const openEntry = await db.timeEntry.findFirst({
    where: {
      employeeId,
      status: 'OPEN',
      clockIn: {
        gte: from,
        lt: to,
      },
    },
  });

  if (openEntry) {
    throw new ApiError(
      422,
      'OPEN_ENTRIES_EXIST',
      `Employee has an open (unclosed) time entry in ${year}-${month}. Please clock out before confirming.`,
    );
  }
}

// ---------------------------------------------------------------------------
// confirmMonth — FR-TSS-004, FR-TSS-005, FR-TSS-009; AC-TSS-002, AC-TSS-003
//
// Flow:
//  1. assertNoOpenEntry (ADR-5 — rejects with 422 if OPEN)
//  2. findUnique on unique key — if found, return existing (idempotent, ADR-4)
//  3. db.$transaction → create signature + write AuditLog atomically (FR-TSS-009)
//  4. On P2002 race: re-read and return existing row with created=false
// ---------------------------------------------------------------------------

export async function confirmMonth(
  employeeId: string,
  year: number,
  month: number,
  actorId: string,
  orgId: string,
  db: TenantClient,
): Promise<{ signature: TimesheetSignature; created: boolean }> {
  // (1) Reject if OPEN entries exist (ADR-5)
  await assertNoOpenEntry(employeeId, year, month, db);

  // (2) Idempotency check — if already confirmed, return existing (ADR-4)
  const existing = await db.timesheetSignature.findUnique({
    where: {
      organizationId_employeeId_year_month: {
        organizationId: orgId,
        employeeId,
        year,
        month,
      },
    },
  });

  if (existing) {
    return { signature: existing, created: false };
  }

  // (3) Create signature + audit log atomically (FR-TSS-009, AC-TSS-013)
  try {
    let createdSig!: TimesheetSignature;

    await db.$transaction(async (tx) => {
      createdSig = await (tx as TenantClient).timesheetSignature.create({
        data: {
          organizationId: orgId,
          employeeId,
          year,
          month,
        },
      });

      await auditWriter.write(tx as TenantClient, actorId, orgId, {
        action: 'APPROVE',
        entityType: 'TimesheetSignature',
        entityId: createdSig.id,
        after: {
          employeeId,
          year,
          month,
          confirmedAt: createdSig.confirmedAt.toISOString(),
        },
      });
    });

    return { signature: createdSig, created: true };
  } catch (err) {
    // (4) P2002 race: another request won the race — re-read and return existing
    const prismaErr = err as { code?: string };
    if (prismaErr.code === 'P2002') {
      const raceExisting = await db.timesheetSignature.findUnique({
        where: {
          organizationId_employeeId_year_month: {
            organizationId: orgId,
            employeeId,
            year,
            month,
          },
        },
      });

      if (raceExisting) {
        return { signature: raceExisting, created: false };
      }
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// getMonthlySummary — FR-TSS-003, FR-TSS-015; AC-TSS-001
//
// Returns per-employee hours + confirmation state for a given month.
// Hours are sourced via a raw SQL query matching the reporting module pattern.
// ---------------------------------------------------------------------------

export interface MonthlySummaryResult {
  employeeId: string;
  year: number;
  month: number;
  hours: {
    regularHours: number;
    overtimeHours: number;
    partTimeDeviation: number;
  } | null;
  confirmed: boolean;
  confirmedAt: string | null;
  hasOpenEntry: boolean;
  totalAbsenceDays: number;
  entries: Array<{
    id: string;
    date: string;
    clockIn: string;
    clockOut: string | null;
    status: 'OPEN' | 'CLOSED';
    durationMinutes: number | null;
  }>;
}

type HoursRawRow = {
  regularHours: string;
  overtimeHours: string;
  contractedHoursPerWeek: string;
};

export async function getMonthlySummary(
  employeeId: string,
  year: number,
  month: number,
  orgId: string,
  db: TenantClient,
): Promise<MonthlySummaryResult> {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));

  // Check confirmation status
  const sig = await db.timesheetSignature.findUnique({
    where: {
      organizationId_employeeId_year_month: {
        organizationId: orgId,
        employeeId,
        year,
        month,
      },
    },
  });

  // Check for any OPEN entries
  const openEntry = await db.timeEntry.findFirst({
    where: {
      employeeId,
      status: 'OPEN',
      clockIn: { gte: from, lt: to },
    },
  });

  // Fetch all entries for the month
  const entries = await db.timeEntry.findMany({
    where: {
      employeeId,
      clockIn: { gte: from, lt: to },
    },
    orderBy: { clockIn: 'asc' },
  });

  // Count absence records that overlap this month (FR-TSS-003)
  // Absence.startDate and endDate are @db.Date — compare as plain Date boundaries.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive
  const absenceCount = await db.absence.count({
    where: {
      employeeId,
      startDate: { lt: monthEnd },
      endDate: { gte: monthStart },
    },
  });

  // Compute hours via raw SQL (matches reporting module pattern — UTC basis)
  const hoursRows = await db.$queryRaw<HoursRawRow[]>`
    SELECT
      COALESCE(SUM(
        CASE
          WHEN EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600 <= 9
          THEN EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600
          ELSE 9
        END
      ), 0) AS "regularHours",
      COALESCE(SUM(
        CASE
          WHEN EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600 > 9
          THEN EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600 - 9
          ELSE 0
        END
      ), 0) AS "overtimeHours",
      MAX(e."contractedHoursPerWeek") AS "contractedHoursPerWeek"
    FROM time_entries te
    JOIN employees e ON e.id = te."employeeId"
    WHERE te."employeeId" = ${employeeId}::uuid
      AND te."organizationId" = ${orgId}::uuid
      AND te.status = 'CLOSED'
      AND te."clockOut" IS NOT NULL
      AND te."clockIn" >= ${from}
      AND te."clockIn" < ${to}
  `;

  const daysInMonth = new Date(year, month, 0).getDate();
  const weeksInMonth = daysInMonth / 7;

  let hours: MonthlySummaryResult['hours'] = null;
  if (hoursRows.length > 0 && hoursRows[0]) {
    const row = hoursRows[0];
    const regularHours = Number(row.regularHours);
    const overtimeHours = Number(row.overtimeHours);
    const contractedPerWeek = Number(row.contractedHoursPerWeek ?? 0);
    const expectedHours = contractedPerWeek * weeksInMonth;
    const partTimeDeviation = regularHours - expectedHours;

    hours = { regularHours, overtimeHours, partTimeDeviation };
  }

  const formattedEntries = entries.map((e) => {
    const durationMinutes =
      e.clockOut && e.status === 'CLOSED'
        ? Math.round((e.clockOut.getTime() - e.clockIn.getTime()) / 60000)
        : null;

    return {
      id: e.id,
      date: e.clockIn.toISOString().slice(0, 10),
      clockIn: e.clockIn.toISOString(),
      clockOut: e.clockOut ? e.clockOut.toISOString() : null,
      status: e.status as 'OPEN' | 'CLOSED',
      durationMinutes,
    };
  });

  return {
    employeeId,
    year,
    month,
    hours,
    confirmed: sig !== null,
    confirmedAt: sig ? sig.confirmedAt.toISOString() : null,
    hasOpenEntry: openEntry !== null,
    totalAbsenceDays: absenceCount,
    entries: formattedEntries,
  };
}

// ---------------------------------------------------------------------------
// listConfirmationStatus — FR-TSS-010, FR-TSS-011; AC-TSS-009, AC-TSS-011
//
// Returns all active employees in the org with their confirmation status
// for the given month. Org-scoped via RLS. MANAGER can filter by centerId.
// ---------------------------------------------------------------------------

export interface ConfirmationStatusResult {
  employeeId: string;
  firstName: string;
  lastName: string;
  confirmed: boolean;
  confirmedAt: string | null;
}

export async function listConfirmationStatus(
  year: number,
  month: number,
  centerId: string | undefined,
  db: TenantClient,
): Promise<ConfirmationStatusResult[]> {
  const employees = await db.employee.findMany({
    where: {
      isActive: true,
      ...(centerId ? { primaryCenterId: centerId } : {}),
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  if (employees.length === 0) return [];

  const employeeIds = employees.map((e) => e.id);

  const signatures = await db.timesheetSignature.findMany({
    where: {
      employeeId: { in: employeeIds },
      year,
      month,
    },
  });

  const sigMap = new Map(signatures.map((s) => [s.employeeId, s]));

  return employees.map((emp) => {
    const sig = sigMap.get(emp.id);
    return {
      employeeId: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      confirmed: sig !== undefined,
      confirmedAt: sig ? sig.confirmedAt.toISOString() : null,
    };
  });
}
