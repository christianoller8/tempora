import type { Request, Response } from 'express';
import { z } from 'zod';
import { getDb, getUser } from '../../db-context';
import {
  monthlyHoursReport,
  overtimeReport,
  absenteeismReport,
  coverageGapsReport,
  complianceExport,
  collectComplianceExport,
  collectScheduleExport,
} from './reporting.service';
import { toXlsx } from './exporters/xlsx';
import { toPdf } from './exporters/pdf';
import { buildCompliancePdf } from './builders/compliance-pdf.builder';
import { buildComplianceXlsx } from './builders/compliance-xlsx.builder';
import { buildSchedulePdf } from './builders/schedule-pdf.builder';
import { ApiError } from '../../middleware/error';

// ---------------------------------------------------------------------------
// T07 — Zod schemas for export endpoints (FR-EXP-01, NFR-EXP-04)
// ---------------------------------------------------------------------------

function daysBetween(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
}

const timeEntriesBody = z
  .object({
    from: z.string().date(),
    to: z.string().date(),
    employeeId: z.string().uuid().optional(),
  })
  .refine((b) => b.from <= b.to, { message: 'from must be <= to' })
  .refine((b) => daysBetween(b.from, b.to) <= 366, { message: 'range exceeds 366 days' });

const scheduleBody = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  employeeId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Reporting controller — satisfies FR-REP-1..9 [GDPR] [COMPLIANCE]
//
// GDPR: causeEncrypted is never surfaced by service functions.
// Manager scoping: FR-REP-7 — MANAGER can only see their own center.
// Format selection: AC-REP-3 — format query param selects output (json/xlsx/pdf).
// ---------------------------------------------------------------------------

type ReportFormat = 'xlsx' | 'pdf' | 'json';

function resolveFormat(query: string | undefined): ReportFormat {
  if (query === 'xlsx') return 'xlsx';
  if (query === 'pdf') return 'pdf';
  return 'json';
}

async function sendReport(
  res: Response,
  rows: Record<string, unknown>[],
  format: ReportFormat,
  filename: string,
  columns: { key: string; header: string }[],
  title: string,
): Promise<void> {
  if (format === 'xlsx') {
    const buf = await toXlsx(rows, columns);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buf);
    return;
  }

  if (format === 'pdf') {
    const buf = await toPdf(rows, columns, title);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.send(buf);
    return;
  }

  res.json({ data: rows });
}

// ---------------------------------------------------------------------------
// GET /reports/monthly-hours
// ---------------------------------------------------------------------------

export async function handleMonthlyHours(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as { year?: string; month?: string; centerId?: string; format?: string };

  const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
  const month = q.month ? parseInt(q.month, 10) : new Date().getMonth() + 1;

  // FR-REP-7: MANAGER scoped to own center — AC-REP-2
  const centerId =
    user.role === 'MANAGER'
      ? (user as { centerId?: string }).centerId ?? q.centerId
      : q.centerId;

  const rows = await monthlyHoursReport(user.organizationId, year, month, centerId, db);
  const format = resolveFormat(q.format);

  await sendReport(res, rows as unknown as Record<string, unknown>[], format, `monthly-hours-${year}-${month}`, [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'regularHours', header: 'Regular Hours' },
    { key: 'overtimeHours', header: 'Overtime Hours' },
    { key: 'partTimeDeviation', header: 'Part-time Deviation' },
  ], `Monthly Hours Report — ${year}/${month}`);
}

// ---------------------------------------------------------------------------
// GET /reports/overtime
// ---------------------------------------------------------------------------

export async function handleOvertime(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as { year?: string; employeeId?: string; format?: string };

  const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
  const employeeId = q.employeeId;
  const format = resolveFormat(q.format);

  const rows = await overtimeReport(user.organizationId, year, employeeId, db);

  await sendReport(res, rows as unknown as Record<string, unknown>[], format, `overtime-${year}`, [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'firstName', header: 'First Name' },
    { key: 'lastName', header: 'Last Name' },
    { key: 'totalOvertimeHours', header: 'Total Overtime Hours' },
    { key: 'overCapLimit', header: 'Over 80h Cap' },
  ], `Overtime Report — ${year}`);
}

// ---------------------------------------------------------------------------
// GET /reports/absenteeism
// ---------------------------------------------------------------------------

export async function handleAbsenteeism(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as { startDate?: string; endDate?: string; centerId?: string; format?: string };

  const startDate = q.startDate ?? `${new Date().getFullYear()}-01-01`;
  const endDate = q.endDate ?? `${new Date().getFullYear()}-12-31`;

  // FR-REP-7: MANAGER scoped to own center
  const centerId =
    user.role === 'MANAGER'
      ? (user as { centerId?: string }).centerId ?? q.centerId
      : q.centerId;

  const rows = await absenteeismReport(user.organizationId, startDate, endDate, centerId, db);
  const format = resolveFormat(q.format);

  await sendReport(res, rows as unknown as Record<string, unknown>[], format, `absenteeism`, [
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'totalDays', header: 'Total Days' },
    { key: 'byType', header: 'By Type (JSON)' },
  ], `Absenteeism Report — ${startDate} to ${endDate}`);
}

// ---------------------------------------------------------------------------
// GET /reports/coverage
// ---------------------------------------------------------------------------

export async function handleCoverage(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as { centerId?: string; year?: string; month?: string; format?: string };

  // FR-REP-7: MANAGER uses own center if not provided
  const centerId =
    (user.role === 'MANAGER'
      ? (user as { centerId?: string }).centerId ?? q.centerId
      : q.centerId) ?? '';

  const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
  const month = q.month ? parseInt(q.month, 10) : new Date().getMonth() + 1;
  const format = resolveFormat(q.format);

  const rows = await coverageGapsReport(user.organizationId, centerId, year, month, db);

  await sendReport(res, rows as unknown as Record<string, unknown>[], format, `coverage-gaps-${year}-${month}`, [
    { key: 'assignmentId', header: 'Assignment ID' },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'date', header: 'Date' },
    { key: 'absenceId', header: 'Absence ID' },
  ], `Coverage Gaps — ${year}/${month}`);
}

// ---------------------------------------------------------------------------
// GET /reports/compliance — ADMIN only (enforced in router)
// ---------------------------------------------------------------------------

export async function handleCompliance(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const q = req.query as { year?: string; format?: string };

  const year = q.year ? parseInt(q.year, 10) : new Date().getFullYear();
  const format = resolveFormat(q.format) === 'json' ? 'xlsx' : resolveFormat(q.format);

  const result = await complianceExport(user.organizationId, year, user.userId, db);
  const rows = [
    ...result.timeEntries.map((r) => ({ ...r, _type: 'time_entry' })),
    ...result.auditLogs.map((r) => ({ ...r, _type: 'audit_log' })),
  ] as Record<string, unknown>[];

  await sendReport(res, rows, format, `compliance-${year}`, [
    { key: '_type', header: 'Record Type' },
    { key: 'id', header: 'ID' },
    { key: 'employeeId', header: 'Employee ID' },
    { key: 'action', header: 'Action' },
    { key: 'entityType', header: 'Entity Type' },
    { key: 'createdAt', header: 'Created At' },
  ], `Compliance Export — ${year}`);
}

// ---------------------------------------------------------------------------
// T05 — Export handlers (FR-EXP-01..03, ADR-3, ADR-4)
// ---------------------------------------------------------------------------

/**
 * POST /reports/time-entries/pdf
 * Role gate: ADMIN | MANAGER (enforced in router).
 * MANAGER center derived from employee.primaryCenterId (ADR-3, R5).
 */
export async function handleTimeEntriesPdf(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  // Validate body (T07)
  const parseResult = timeEntriesBody.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', parseResult.error.issues[0]?.message ?? 'Invalid request body');
  }
  const body = parseResult.data;

  // MANAGER center scoping (ADR-3 / R5 — fail-closed)
  let managerCenterId: string | undefined;
  if (user.role === 'MANAGER') {
    if (!user.employeeId) {
      managerCenterId = '__none__'; // fail-closed: no employee record → empty result
    } else {
      const mgr = await db.employee.findUnique({
        where: { id: user.employeeId },
        select: { primaryCenterId: true },
      });
      managerCenterId = (mgr?.primaryCenterId as string | null) ?? '__none__';
    }
  }

  // employeeId existence check (404)
  if (body.employeeId) {
    const emp = await db.employee.findUnique({
      where: { id: body.employeeId },
      select: { id: true, organizationId: true },
    });
    if (!emp || (emp.organizationId as string) !== user.organizationId) {
      throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
    }
  }

  const data = await collectComplianceExport(
    user.organizationId,
    body.from,
    body.to,
    body.employeeId,
    managerCenterId,
    db,
  );

  const buf = await buildCompliancePdf(data);
  const filename = `time-entries-${body.from}-${body.to}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

/**
 * POST /reports/time-entries/excel
 * Same flow as handleTimeEntriesPdf but uses the XLSX builder.
 * Role gate: ADMIN | MANAGER (enforced in router).
 */
export async function handleTimeEntriesExcel(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const parseResult = timeEntriesBody.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', parseResult.error.issues[0]?.message ?? 'Invalid request body');
  }
  const body = parseResult.data;

  let managerCenterId: string | undefined;
  if (user.role === 'MANAGER') {
    if (!user.employeeId) {
      managerCenterId = '__none__';
    } else {
      const mgr = await db.employee.findUnique({
        where: { id: user.employeeId },
        select: { primaryCenterId: true },
      });
      managerCenterId = (mgr?.primaryCenterId as string | null) ?? '__none__';
    }
  }

  if (body.employeeId) {
    const emp = await db.employee.findUnique({
      where: { id: body.employeeId },
      select: { id: true, organizationId: true },
    });
    if (!emp || (emp.organizationId as string) !== user.organizationId) {
      throw new ApiError(404, 'NOT_FOUND', 'Employee not found');
    }
  }

  const data = await collectComplianceExport(
    user.organizationId,
    body.from,
    body.to,
    body.employeeId,
    managerCenterId,
    db,
  );

  const buf = await buildComplianceXlsx(data);
  const filename = `time-entries-${body.from}-${body.to}.xlsx`;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

/**
 * POST /reports/schedule/pdf
 * Role gate: ADMIN | MANAGER | EMPLOYEE (enforced in router).
 * EMPLOYEE role is restricted to their own schedule (FR-EXP-14).
 */
export async function handleSchedulePdf(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const parseResult = scheduleBody.safeParse(req.body);
  if (!parseResult.success) {
    throw new ApiError(400, 'VALIDATION_ERROR', parseResult.error.issues[0]?.message ?? 'Invalid request body');
  }
  const body = parseResult.data;

  // Resolve target employee (FR-EXP-14)
  let targetEmployeeId: string;

  if (user.role === 'EMPLOYEE') {
    if (body.employeeId && body.employeeId !== user.employeeId) {
      // EMPLOYEE trying to access another employee's schedule → 403
      throw new ApiError(403, 'FORBIDDEN', 'EMPLOYEE may only export their own schedule');
    }
    // Default to own employeeId; if user has no employeeId, fail-closed
    if (!user.employeeId) {
      throw new ApiError(403, 'FORBIDDEN', 'No employee record associated with this user');
    }
    targetEmployeeId = user.employeeId;
  } else {
    // ADMIN or MANAGER: use provided employeeId or own
    targetEmployeeId = body.employeeId ?? user.employeeId ?? '';
    if (!targetEmployeeId) {
      throw new ApiError(400, 'BAD_REQUEST', 'employeeId is required');
    }
  }

  const data = await collectScheduleExport(
    user.organizationId,
    body.year,
    body.month,
    targetEmployeeId,
    db,
  );

  const buf = await buildSchedulePdf(data);
  const filename = `schedule-${body.year}-${String(body.month).padStart(2, '0')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}
