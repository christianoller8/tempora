import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  monthlyHoursReport,
  overtimeReport,
  absenteeismReport,
  coverageGapsReport,
  complianceExport,
} from './reporting.service.js';
import type { TenantClient } from '../../db/tenant.js';

// ---------------------------------------------------------------------------
// Mock dependencies — no real DB, no real audit
// ---------------------------------------------------------------------------

vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

import { auditWriter } from '../../audit/audit-writer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-1';
const ACTOR = 'admin-1';
const EMP_A = 'emp-a';
const EMP_B = 'emp-b';

function makeMockDb(overrides: Record<string, unknown> = {}): TenantClient {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    timeEntry: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    timeCorrection: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    absence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    shiftAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  } as unknown as TenantClient;
}

// ---------------------------------------------------------------------------
// P5-1: monthlyHoursReport
// ---------------------------------------------------------------------------

describe('monthlyHoursReport', () => {
  it('returns empty array when no time entries exist', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([]),
    });
    const result = await monthlyHoursReport(ORG, 2026, 6, undefined, db);
    expect(result).toEqual([]);
  });

  it('aggregates regular and overtime hours per employee', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([
        {
          employeeId: EMP_A,
          firstName: 'Ana',
          lastName: 'Garcia',
          contractedHoursPerWeek: '40',
          regularHours: '120',
          overtimeHours: '10',
        },
      ]),
    });
    const result = await monthlyHoursReport(ORG, 2026, 6, undefined, db);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      employeeId: EMP_A,
      regularHours: 120,
      overtimeHours: 10,
    });
  });

  it('never includes causeEncrypted field (GDPR)', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([
        {
          employeeId: EMP_A,
          firstName: 'Ana',
          lastName: 'Garcia',
          contractedHoursPerWeek: '40',
          regularHours: '80',
          overtimeHours: '0',
          causeEncrypted: Buffer.from('secret'),
        },
      ]),
    });
    const result = await monthlyHoursReport(ORG, 2026, 6, undefined, db);
    expect(result[0]).not.toHaveProperty('causeEncrypted');
  });

  it('filters by centerId when provided', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([]),
    });
    await monthlyHoursReport(ORG, 2026, 6, 'center-1', db);
    expect((db.$queryRaw as ReturnType<typeof vi.fn>)).toHaveBeenCalledOnce();
  });

  it('computes partTimeDeviation from contractedHoursPerWeek', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([
        {
          employeeId: EMP_A,
          firstName: 'Ana',
          lastName: 'Garcia',
          contractedHoursPerWeek: '20',
          regularHours: '60',
          overtimeHours: '0',
        },
      ]),
    });
    const result = await monthlyHoursReport(ORG, 2026, 6, undefined, db);
    // contractedHoursPerWeek=20, ~4.33 weeks/month => ~86.7h contracted; actual=60 => deviation
    expect(result[0]).toHaveProperty('partTimeDeviation');
    expect(typeof result[0].partTimeDeviation).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// P5-2: overtimeReport
// ---------------------------------------------------------------------------

describe('overtimeReport', () => {
  it('returns empty array when no overtime', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([]),
    });
    const result = await overtimeReport(ORG, 2026, undefined, db);
    expect(result).toEqual([]);
  });

  it('flags employees over 80h cap', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([
        { employeeId: EMP_A, firstName: 'Ana', lastName: 'Garcia', totalOvertimeHours: '85' },
        { employeeId: EMP_B, firstName: 'Bob', lastName: 'Smith', totalOvertimeHours: '40' },
      ]),
    });
    const result = await overtimeReport(ORG, 2026, undefined, db);
    const empA = result.find((r) => r.employeeId === EMP_A);
    const empB = result.find((r) => r.employeeId === EMP_B);
    expect(empA?.overCapLimit).toBe(true);
    expect(empB?.overCapLimit).toBe(false);
  });

  it('filters by employeeId when provided', async () => {
    const db = makeMockDb({
      $queryRaw: vi.fn().mockResolvedValue([
        { employeeId: EMP_A, firstName: 'Ana', lastName: 'Garcia', totalOvertimeHours: '20' },
      ]),
    });
    const result = await overtimeReport(ORG, 2026, EMP_A, db);
    expect(result).toHaveLength(1);
    expect(result[0].employeeId).toBe(EMP_A);
  });
});

// ---------------------------------------------------------------------------
// P5-3: absenteeismReport
// ---------------------------------------------------------------------------

describe('absenteeismReport', () => {
  it('returns empty array when no absences', async () => {
    const db = makeMockDb({
      absence: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const result = await absenteeismReport(ORG, '2026-01-01', '2026-06-30', undefined, db);
    expect(result).toEqual([]);
  });

  it('counts absence days by type per employee', async () => {
    const start = new Date('2026-06-10');
    const end = new Date('2026-06-14');
    const db = makeMockDb({
      absence: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'abs-1',
            employeeId: EMP_A,
            type: 'VACACIONES',
            startDate: start,
            endDate: end,
            status: 'APPROVED',
            causeEncrypted: null,
          },
        ]),
      },
    });
    const result = await absenteeismReport(ORG, '2026-01-01', '2026-12-31', undefined, db);
    expect(result).toHaveLength(1);
    expect(result[0].employeeId).toBe(EMP_A);
    expect(result[0].byType['VACACIONES']).toBeGreaterThan(0);
  });

  it('never includes causeEncrypted field (GDPR)', async () => {
    const db = makeMockDb({
      absence: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'abs-2',
            employeeId: EMP_A,
            type: 'IT',
            startDate: new Date('2026-03-01'),
            endDate: new Date('2026-03-05'),
            status: 'APPROVED',
            causeEncrypted: Buffer.from('medical'),
          },
        ]),
      },
    });
    const result = await absenteeismReport(ORG, '2026-01-01', '2026-12-31', undefined, db);
    expect(result[0]).not.toHaveProperty('causeEncrypted');
    // byType should NOT include IT cause text
    expect(JSON.stringify(result)).not.toContain('medical');
  });
});

// ---------------------------------------------------------------------------
// P5-4: coverageGapsReport
// ---------------------------------------------------------------------------

describe('coverageGapsReport', () => {
  it('returns empty array when no gaps', async () => {
    const db = makeMockDb({
      shiftAssignment: { findMany: vi.fn().mockResolvedValue([]) },
      absence: { findMany: vi.fn().mockResolvedValue([]) },
    });
    const result = await coverageGapsReport(ORG, 'center-1', 2026, 6, db);
    expect(result).toEqual([]);
  });

  it('identifies shift with employee who has approved absence on that date', async () => {
    const shiftDate = new Date('2026-06-10');
    const db = makeMockDb({
      shiftAssignment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'sa-1',
            employeeId: EMP_A,
            date: shiftDate,
            scheduleId: 'sched-1',
            shiftTemplateId: 'tmpl-1',
          },
        ]),
      },
      absence: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'abs-1',
            employeeId: EMP_A,
            startDate: new Date('2026-06-09'),
            endDate: new Date('2026-06-12'),
            status: 'APPROVED',
          },
        ]),
      },
    });
    const result = await coverageGapsReport(ORG, 'center-1', 2026, 6, db);
    expect(result).toHaveLength(1);
    expect(result[0].assignmentId).toBe('sa-1');
    expect(result[0].employeeId).toBe(EMP_A);
  });
});

// ---------------------------------------------------------------------------
// P5-11: complianceExport
// ---------------------------------------------------------------------------

describe('complianceExport', () => {
  it('returns timeEntries and auditLogs for the year', async () => {
    const db = makeMockDb({
      timeEntry: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'te-1', employeeId: EMP_A, clockIn: new Date('2026-01-01'), clockOut: new Date('2026-01-01'), status: 'CLOSED' },
        ]),
      },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'al-1', action: 'CREATE', entityType: 'TimeEntry', createdAt: new Date('2026-01-01') },
        ]),
        create: vi.fn().mockResolvedValue({}),
      },
    });
    const result = await complianceExport(ORG, 2026, ACTOR, db);
    expect(result).toHaveProperty('timeEntries');
    expect(result).toHaveProperty('auditLogs');
    expect(result.timeEntries).toHaveLength(1);
  });

  it('never includes causeEncrypted in export (GDPR)', async () => {
    const db = makeMockDb({
      timeEntry: { findMany: vi.fn().mockResolvedValue([]) },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
    });
    const result = await complianceExport(ORG, 2026, ACTOR, db);
    expect(JSON.stringify(result)).not.toContain('causeEncrypted');
  });

  it('writes its own audit log row for the export action', async () => {
    const db = makeMockDb({
      timeEntry: { findMany: vi.fn().mockResolvedValue([]) },
      auditLog: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
    });
    vi.mocked(auditWriter.write).mockClear();
    await complianceExport(ORG, 2026, ACTOR, db);
    expect(auditWriter.write).toHaveBeenCalledOnce();
  });
});
