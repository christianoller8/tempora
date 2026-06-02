import type { Request, Response } from 'express';
import { getDb, getUser } from '../../db-context.js';
import {
  monthlyHoursReport,
  overtimeReport,
  absenteeismReport,
  coverageGapsReport,
  complianceExport,
} from './reporting.service.js';
import { toXlsx } from './exporters/xlsx.js';
import { toPdf } from './exporters/pdf.js';

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
