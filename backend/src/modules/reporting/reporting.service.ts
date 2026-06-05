import { Prisma } from '@prisma/client';
import type { TenantClient } from '../../db/tenant';
import { auditWriter } from '../../audit/audit-writer';
import { ApiError } from '../../middleware/error';

// ---------------------------------------------------------------------------
// Reporting service — satisfies FR-REP-1..9 [GDPR] [COMPLIANCE]
//
// GDPR invariant: causeEncrypted is NEVER included in any report output.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface MonthlyHoursRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  regularHours: number;
  overtimeHours: number;
  partTimeDeviation: number;
}

export interface OvertimeRow {
  employeeId: string;
  firstName: string;
  lastName: string;
  totalOvertimeHours: number;
  overCapLimit: boolean;
}

export interface AbsenteeismRow {
  employeeId: string;
  totalDays: number;
  byType: Record<string, number>;
}

export interface CoverageGapRow {
  assignmentId: string;
  employeeId: string;
  date: string;
  absenceId: string;
}

export interface ComplianceExportResult {
  timeEntries: Record<string, unknown>[];
  auditLogs: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Compliance export DTOs (FR-EXP-04..10) — used by builders in builders/
// ---------------------------------------------------------------------------

export interface ComplianceEntryRow {
  employeeName: string;        // "Last, First"
  category: string;            // EmployeeCategory enum value
  date: string;                // YYYY-MM-DD from clockIn UTC
  clockIn: string;             // HH:mm UTC
  clockOut: string | null;     // HH:mm UTC, or null when OPEN
  durationHours: number | null; // 2-dp decimal hours; null when OPEN
  source: string;
}

export interface ComplianceAuditRow {
  timestamp: string;  // ISO 8601 UTC
  actor: string;      // actorUserId ?? "system"
  entityId: string;   // entityId ?? "—"
  action: string;
  before: string;     // JSON.stringify
  after: string;      // JSON.stringify
}

export interface ComplianceExportData {
  organization: { name: string; cif: string | null };
  dateRange: { from: string; to: string };
  generatedAt: string;          // ISO 8601 UTC
  rows: ComplianceEntryRow[];   // sorted by employeeName, then clockIn
  auditLog: ComplianceAuditRow[]; // sorted by timestamp asc
}

// ---------------------------------------------------------------------------
// Schedule export DTOs (FR-EXP-12..13)
// ---------------------------------------------------------------------------

export interface ScheduleAssignmentRow {
  date: string;       // YYYY-MM-DD
  shiftName: string;  // ShiftTemplate.name
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
}

export interface ScheduleExportData {
  employeeName: string;  // "First Last"
  monthLabel: string;    // e.g. "June 2025"
  year: number;
  month: number;
  generatedAt: string;
  rows: ScheduleAssignmentRow[]; // sorted by date asc
}

// ---------------------------------------------------------------------------
// P5-1: monthlyHoursReport — FR-REP-1, FR-REP-6, FR-REP-8
// ---------------------------------------------------------------------------

type MonthlyRawRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  contractedHoursPerWeek: string;
  regularHours: string;
  overtimeHours: string;
};

type OvertimeRawRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  totalOvertimeHours: string;
};

/**
 * Returns per-employee hours summary for a given month.
 * Queries closed TimeEntries. GDPR: causeEncrypted is excluded.
 * Satisfies FR-REP-1, FR-REP-6, FR-REP-8.
 */
export async function monthlyHoursReport(
  orgId: string,
  year: number,
  month: number,
  centerId: string | undefined,
  db: TenantClient,
): Promise<MonthlyHoursRow[]> {
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeksInMonth = daysInMonth / 7;

  let rows: MonthlyRawRow[];

  if (centerId) {
    rows = await db.$queryRaw<MonthlyRawRow[]>`
      SELECT
        e.id                AS "employeeId",
        e."firstName",
        e."lastName",
        e."contractedHoursPerWeek",
        COALESCE(SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 <= 9
            THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600
            ELSE 9
          END
        ), 0)               AS "regularHours",
        COALESCE(SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 > 9
            THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 - 9
            ELSE 0
          END
        ), 0)               AS "overtimeHours"
      FROM employees e
      LEFT JOIN time_entries te
        ON te."employeeId" = e.id
        AND te."organizationId" = ${orgId}::uuid
        AND te.status = 'CLOSED'
        AND EXTRACT(YEAR  FROM te."clockIn") = ${year}
        AND EXTRACT(MONTH FROM te."clockIn") = ${month}
        AND te."clockOut" IS NOT NULL
      WHERE e."organizationId" = ${orgId}::uuid
        AND e."primaryCenterId" = ${centerId}::uuid
      GROUP BY e.id, e."firstName", e."lastName", e."contractedHoursPerWeek"
      HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600), 0) > 0
      ORDER BY e."lastName", e."firstName"
    `;
  } else {
    rows = await db.$queryRaw<MonthlyRawRow[]>`
      SELECT
        e.id                AS "employeeId",
        e."firstName",
        e."lastName",
        e."contractedHoursPerWeek",
        COALESCE(SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 <= 9
            THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600
            ELSE 9
          END
        ), 0)               AS "regularHours",
        COALESCE(SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 > 9
            THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 - 9
            ELSE 0
          END
        ), 0)               AS "overtimeHours"
      FROM employees e
      LEFT JOIN time_entries te
        ON te."employeeId" = e.id
        AND te."organizationId" = ${orgId}::uuid
        AND te.status = 'CLOSED'
        AND EXTRACT(YEAR  FROM te."clockIn") = ${year}
        AND EXTRACT(MONTH FROM te."clockIn") = ${month}
        AND te."clockOut" IS NOT NULL
      WHERE e."organizationId" = ${orgId}::uuid
      GROUP BY e.id, e."firstName", e."lastName", e."contractedHoursPerWeek"
      HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600), 0) > 0
      ORDER BY e."lastName", e."firstName"
    `;
  }

  return rows.map((row) => {
    const contractedHoursPerWeek = Number(row.contractedHoursPerWeek ?? 0);
    const regularHours = Number(row.regularHours ?? 0);
    const overtimeHours = Number(row.overtimeHours ?? 0);
    const contractedThisMonth = contractedHoursPerWeek * weeksInMonth;
    const partTimeDeviation = regularHours + overtimeHours - contractedThisMonth;

    return {
      employeeId: row.employeeId,
      firstName: row.firstName,
      lastName: row.lastName,
      regularHours,
      overtimeHours,
      partTimeDeviation,
    };
  });
}

// ---------------------------------------------------------------------------
// P5-2: overtimeReport — FR-REP-2, AC-REP-4
// ---------------------------------------------------------------------------

const ANNUAL_OT_CAP = 80;

/**
 * Returns YTD overtime hours per employee for the given year.
 * Flags employees where total overtime hours exceed the 80h statutory cap.
 * Satisfies FR-REP-2; acceptance: AC-REP-4.
 */
export async function overtimeReport(
  orgId: string,
  year: number,
  employeeId: string | undefined,
  db: TenantClient,
): Promise<OvertimeRow[]> {
  let rows: OvertimeRawRow[];

  if (employeeId) {
    rows = await db.$queryRaw<OvertimeRawRow[]>`
      SELECT
        e.id           AS "employeeId",
        e."firstName",
        e."lastName",
        COALESCE(SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 > 9
            THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 - 9
            ELSE 0
          END
        ), 0)          AS "totalOvertimeHours"
      FROM employees e
      LEFT JOIN time_entries te
        ON te."employeeId" = e.id
        AND te."organizationId" = ${orgId}::uuid
        AND te.status = 'CLOSED'
        AND EXTRACT(YEAR FROM te."clockIn") = ${year}
        AND te."clockOut" IS NOT NULL
      WHERE e."organizationId" = ${orgId}::uuid
        AND e.id = ${employeeId}::uuid
      GROUP BY e.id, e."firstName", e."lastName"
      HAVING COALESCE(SUM(
        CASE
          WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 > 9
          THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 - 9
          ELSE 0
        END
      ), 0) > 0
      ORDER BY "totalOvertimeHours" DESC
    `;
  } else {
    rows = await db.$queryRaw<OvertimeRawRow[]>`
      SELECT
        e.id           AS "employeeId",
        e."firstName",
        e."lastName",
        COALESCE(SUM(
          CASE
            WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 > 9
            THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 - 9
            ELSE 0
          END
        ), 0)          AS "totalOvertimeHours"
      FROM employees e
      LEFT JOIN time_entries te
        ON te."employeeId" = e.id
        AND te."organizationId" = ${orgId}::uuid
        AND te.status = 'CLOSED'
        AND EXTRACT(YEAR FROM te."clockIn") = ${year}
        AND te."clockOut" IS NOT NULL
      WHERE e."organizationId" = ${orgId}::uuid
      GROUP BY e.id, e."firstName", e."lastName"
      HAVING COALESCE(SUM(
        CASE
          WHEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 > 9
          THEN EXTRACT(EPOCH FROM (te."clockOut" - te."clockIn")) / 3600 - 9
          ELSE 0
        END
      ), 0) > 0
      ORDER BY "totalOvertimeHours" DESC
    `;
  }

  return rows.map((row) => {
    const totalOvertimeHours = Number(row.totalOvertimeHours ?? 0);
    return {
      employeeId: row.employeeId,
      firstName: row.firstName,
      lastName: row.lastName,
      totalOvertimeHours,
      overCapLimit: totalOvertimeHours > ANNUAL_OT_CAP,
    };
  });
}

// ---------------------------------------------------------------------------
// P5-3: absenteeismReport — FR-REP-3, AC-REP-6
// ---------------------------------------------------------------------------

/**
 * Returns absence day counts by type per employee in the given date range.
 * GDPR: excludes causeEncrypted entirely.
 * Satisfies FR-REP-3; acceptance: AC-REP-6.
 */
export async function absenteeismReport(
  orgId: string,
  startDate: string,
  endDate: string,
  centerId: string | undefined,
  db: TenantClient,
): Promise<AbsenteeismRow[]> {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const where: Prisma.AbsenceWhereInput = {
    organizationId: orgId,
    status: 'APPROVED',
    startDate: { lte: end },
    endDate: { gte: start },
    ...(centerId ? { employee: { primaryCenterId: centerId } } : {}),
  };

  const absences = await db.absence.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      type: true,
      startDate: true,
      endDate: true,
      status: true,
      // causeEncrypted intentionally excluded [GDPR]
    },
  });

  const map = new Map<string, AbsenteeismRow>();

  for (const abs of absences) {
    const absStart = abs.startDate as Date;
    const absEnd = abs.endDate as Date;
    const effectiveStart = absStart > start ? absStart : start;
    const effectiveEnd = absEnd < end ? absEnd : end;
    const days =
      Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const empId = abs.employeeId as string;
    if (!map.has(empId)) {
      map.set(empId, { employeeId: empId, totalDays: 0, byType: {} });
    }

    const row = map.get(empId)!;
    row.totalDays += days;
    const type = abs.type as string;
    row.byType[type] = (row.byType[type] ?? 0) + days;
  }

  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// P5-4: coverageGapsReport — FR-REP-4, AC-REP-5
// ---------------------------------------------------------------------------

/**
 * Returns shift assignments where the assigned employee has an approved
 * absence covering the shift date.
 * Satisfies FR-REP-4; acceptance: AC-REP-5.
 */
export async function coverageGapsReport(
  orgId: string,
  centerId: string,
  year: number,
  month: number,
  db: TenantClient,
): Promise<CoverageGapRow[]> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const assignments = await db.shiftAssignment.findMany({
    where: {
      organizationId: orgId,
      date: { gte: monthStart, lte: monthEnd },
      schedule: { centerId },
    },
    select: { id: true, employeeId: true, date: true },
  });

  if (assignments.length === 0) return [];

  const employeeIds = [...new Set(assignments.map((a) => a.employeeId as string))];

  const absences = await db.absence.findMany({
    where: {
      organizationId: orgId,
      employeeId: { in: employeeIds },
      status: 'APPROVED',
      startDate: { lte: monthEnd },
      endDate: { gte: monthStart },
    },
    select: { id: true, employeeId: true, startDate: true, endDate: true },
  });

  const gaps: CoverageGapRow[] = [];

  for (const assignment of assignments) {
    const date = assignment.date as Date;
    const empId = assignment.employeeId as string;

    const coveringAbsence = absences.find((abs) => {
      if ((abs.employeeId as string) !== empId) return false;
      const absStart = abs.startDate as Date;
      const absEnd = abs.endDate as Date;
      return absStart <= date && absEnd >= date;
    });

    if (coveringAbsence) {
      gaps.push({
        assignmentId: assignment.id as string,
        employeeId: empId,
        date: date.toISOString().slice(0, 10),
        absenceId: coveringAbsence.id as string,
      });
    }
  }

  return gaps;
}

// ---------------------------------------------------------------------------
// P5-11: complianceExport — ADMIN only (enforced in router)
// ---------------------------------------------------------------------------

/**
 * Exports all closed TimeEntries and AuditLog rows for the given year.
 * Writes its own audit row for the export action [COMPLIANCE].
 * GDPR: causeEncrypted is never included.
 * Satisfies FR-REP-9 [COMPLIANCE].
 */
export async function complianceExport(
  orgId: string,
  year: number,
  actorId: string,
  db: TenantClient,
): Promise<ComplianceExportResult> {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const timeEntries = await db.timeEntry.findMany({
    where: {
      organizationId: orgId,
      status: 'CLOSED',
      clockIn: { gte: yearStart, lt: yearEnd },
    },
    select: {
      id: true,
      employeeId: true,
      clockIn: true,
      clockOut: true,
      status: true,
      source: true,
      createdAt: true,
      // causeEncrypted excluded [GDPR]
    },
    orderBy: { clockIn: 'asc' },
  });

  const auditLogs = await db.auditLog.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: yearStart, lt: yearEnd },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Write audit row for the export itself [COMPLIANCE]
  await auditWriter.write(db, actorId, orgId, {
    action: 'READ',
    entityType: 'ComplianceExport',
    after: { year, exportedAt: new Date().toISOString() },
  });

  return {
    timeEntries: timeEntries as unknown as Record<string, unknown>[],
    auditLogs: auditLogs as unknown as Record<string, unknown>[],
  };
}

// ---------------------------------------------------------------------------
// collectComplianceExport — FR-EXP-01..10
// ---------------------------------------------------------------------------

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function endOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Collects time entries + audit log for a date range and shapes them into
 * the ComplianceExportData DTO consumed by the PDF/XLSX builders.
 *
 * R3: includes OPEN entries (no status filter).
 * R5: MANAGER center scoping via managerCenterId derived from employee record.
 * Satisfies FR-EXP-01..10.
 */
export async function collectComplianceExport(
  orgId: string,
  from: string,
  to: string,
  employeeId: string | undefined,
  managerCenterId: string | undefined,
  db: TenantClient,
): Promise<ComplianceExportData> {
  const fromDate = new Date(from);
  const toDate = endOfDay(to);

  // 1. Org details (RLS scopes to current org automatically)
  const org = await db.organization.findFirst({
    select: { name: true, cif: true },
  });

  // 2. Time entries — no status filter (R3: OPEN + CLOSED)
  const entries = await db.timeEntry.findMany({
    where: {
      organizationId: orgId,
      clockIn: { gte: fromDate, lte: toDate },
      ...(employeeId ? { employeeId } : {}),
      ...(managerCenterId
        ? { employee: { primaryCenterId: managerCenterId } }
        : {}),
    },
    select: {
      clockIn: true,
      clockOut: true,
      source: true,
      employee: {
        select: {
          firstName: true,
          lastName: true,
          category: true,
        },
      },
    },
    orderBy: { clockIn: 'asc' },
  });

  // 3. Audit log — TimeEntry entity type, within range
  const auditEntries = await db.auditLog.findMany({
    where: {
      organizationId: orgId,
      entityType: 'TimeEntry',
      createdAt: { gte: fromDate, lte: toDate },
    },
    orderBy: { createdAt: 'asc' },
  });

  // 4. Shape time entry rows
  const rows: ComplianceEntryRow[] = entries.map((e) => {
    const emp = e.employee as { firstName: string; lastName: string; category: string };
    const employeeName = `${emp.lastName}, ${emp.firstName}`;
    const clockInDate = e.clockIn as Date;
    const clockOutDate = e.clockOut as Date | null;

    const date = clockInDate.toISOString().slice(0, 10);
    const clockInStr = clockInDate.toISOString().slice(11, 16);
    const clockOutStr = clockOutDate ? clockOutDate.toISOString().slice(11, 16) : null;
    const durationHours = clockOutDate
      ? round2((clockOutDate.getTime() - clockInDate.getTime()) / 3_600_000)
      : null;

    return {
      employeeName,
      category: String(emp.category),
      date,
      clockIn: clockInStr,
      clockOut: clockOutStr,
      durationHours,
      source: String(e.source),
    };
  });

  // Sort: employeeName asc, then clockIn asc
  rows.sort((a, b) => {
    if (a.employeeName < b.employeeName) return -1;
    if (a.employeeName > b.employeeName) return 1;
    if (a.clockIn < b.clockIn) return -1;
    if (a.clockIn > b.clockIn) return 1;
    return 0;
  });

  // 5. Shape audit rows (R4: actorUserId??"system", entityId??"—")
  const auditLog: ComplianceAuditRow[] = auditEntries.map((a) => ({
    timestamp: (a.createdAt as Date).toISOString(),
    actor: (a.actorUserId as string | null) ?? 'system',
    entityId: (a.entityId as string | null) ?? '—',
    action: String(a.action),
    before: JSON.stringify((a.before as unknown) ?? null),
    after: JSON.stringify((a.after as unknown) ?? null),
  }));

  return {
    organization: {
      name: org?.name ?? '—',
      cif: (org?.cif as string | null) ?? null,
    },
    dateRange: { from, to },
    generatedAt: new Date().toISOString(),
    rows,
    auditLog,
  };
}

// ---------------------------------------------------------------------------
// collectScheduleExport — FR-EXP-12..14
// ---------------------------------------------------------------------------

/**
 * Collects shift assignments for an employee/month and shapes them into
 * the ScheduleExportData DTO consumed by the schedule PDF builder.
 *
 * Throws ApiError(404) when the employee record is not found.
 * Satisfies FR-EXP-12..14.
 */
export async function collectScheduleExport(
  orgId: string,
  year: number,
  month: number,
  employeeId: string,
  db: TenantClient,
): Promise<ScheduleExportData> {
  // 1. Employee lookup (404 if missing)
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, organizationId: true },
  });

  if (!employee || (employee.organizationId as string) !== orgId) {
    throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
  }

  // 2. Month boundaries (UTC)
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const assignments = await db.shiftAssignment.findMany({
    where: {
      organizationId: orgId,
      employeeId,
      date: { gte: monthStart, lte: monthEnd },
    },
    select: {
      date: true,
      shiftTemplate: {
        select: {
          name: true,
          startTime: true,
          endTime: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // 3. Shape rows
  const rows: ScheduleAssignmentRow[] = assignments.map((a) => {
    const tmpl = a.shiftTemplate as { name: string; startTime: string; endTime: string };
    return {
      date: (a.date as Date).toISOString().slice(0, 10),
      shiftName: tmpl.name,
      startTime: tmpl.startTime,
      endTime: tmpl.endTime,
    };
  });

  const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;

  return {
    employeeName: `${(employee.firstName as string)} ${(employee.lastName as string)}`,
    monthLabel,
    year,
    month,
    generatedAt: new Date().toISOString(),
    rows,
  };
}
