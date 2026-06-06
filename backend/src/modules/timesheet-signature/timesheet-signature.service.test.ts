import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiError } from '../../middleware/error';
import type { TenantClient } from '../../db/tenant';

// ---------------------------------------------------------------------------
// Mocks — hoisted before service imports
// ---------------------------------------------------------------------------

vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

// Import after mock registration
import { auditWriter } from '../../audit/audit-writer';
import {
  assertMonthNotConfirmed,
  assertNoOpenEntry,
  confirmMonth,
  getMonthlySummary,
  listConfirmationStatus,
} from './timesheet-signature.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-uuid-0000-0000-000000000001';
const EMP = 'emp-uuid-0000-0000-000000000001';
const ACTOR = 'user-uuid-000-0000-000000000001';

const NOW = new Date('2026-03-15T10:00:00.000Z');
const SIG = {
  id: 'sig-uuid-0000-0000-000000000001',
  organizationId: ORG,
  employeeId: EMP,
  year: 2026,
  month: 3,
  confirmedAt: NOW,
  createdAt: NOW,
};

function makeDb(overrides: Record<string, unknown> = {}): TenantClient {
  return {
    timesheetSignature: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(SIG),
      findMany: vi.fn().mockResolvedValue([]),
    },
    timeEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 } }),
    },
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    absence: {
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn().mockImplementation(async (cb: (tx: TenantClient) => Promise<unknown>) => {
      return cb({
        timesheetSignature: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(SIG),
        },
        auditLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      } as unknown as TenantClient);
    }),
    ...overrides,
  } as unknown as TenantClient;
}

// ---------------------------------------------------------------------------
// assertMonthNotConfirmed
// ---------------------------------------------------------------------------

describe('assertMonthNotConfirmed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves (does not throw) when no signature exists for the month', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });

    // Should NOT throw — month is not confirmed
    await expect(assertMonthNotConfirmed(EMP, new Date('2026-03-15T10:00:00.000Z'), ORG, db)).resolves.toBeUndefined();
  });

  it('throws 409 MONTH_LOCKED when a signature exists for the month', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(SIG),
      },
    });

    await expect(assertMonthNotConfirmed(EMP, new Date('2026-03-15T10:00:00.000Z'), ORG, db)).rejects.toMatchObject({
      status: 409,
      code: 'MONTH_LOCKED',
    });
  });

  it('uses UTC month extraction — last day of March (UTC) is still March', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(SIG),
      },
    });

    // 2026-03-31 23:59:59.999Z is still March in UTC
    await expect(
      assertMonthNotConfirmed(EMP, new Date('2026-03-31T23:59:59.999Z'), ORG, db),
    ).rejects.toMatchObject({ status: 409, code: 'MONTH_LOCKED' });
  });

  it('does NOT throw for a different month even when March is confirmed', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null), // April not confirmed
      },
    });

    await expect(
      assertMonthNotConfirmed(EMP, new Date('2026-04-01T00:00:00.000Z'), ORG, db),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// assertNoOpenEntry
// ---------------------------------------------------------------------------

describe('assertNoOpenEntry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('resolves when no OPEN entries exist in the month', async () => {
    const db = makeDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    await expect(assertNoOpenEntry(EMP, 2026, 3, db)).resolves.toBeUndefined();
  });

  it('throws 422 OPEN_ENTRIES_EXIST when an OPEN entry exists in the month', async () => {
    const db = makeDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'entry-1',
          status: 'OPEN',
          clockIn: new Date('2026-03-10T08:00:00.000Z'),
        }),
      },
    });

    await expect(assertNoOpenEntry(EMP, 2026, 3, db)).rejects.toMatchObject({
      status: 422,
      code: 'OPEN_ENTRIES_EXIST',
    });
  });
});

// ---------------------------------------------------------------------------
// confirmMonth
// ---------------------------------------------------------------------------

describe('confirmMonth', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a TimesheetSignature and one AuditLog on first confirm', async () => {
    const mockCreate = vi.fn().mockResolvedValue(SIG);
    const mockAuditWrite = vi.spyOn(auditWriter, 'write').mockResolvedValue(undefined);

    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null), // not yet confirmed
        create: mockCreate,
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null), // no OPEN entries
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: TenantClient) => Promise<unknown>) => {
        const tx = {
          timesheetSignature: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: mockCreate,
          },
          auditLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        } as unknown as TenantClient;
        return cb(tx);
      }),
    });

    const result = await confirmMonth(EMP, 2026, 3, ACTOR, ORG, db);

    expect(result.created).toBe(true);
    expect(result.signature.id).toBe(SIG.id);
    expect(result.signature.year).toBe(2026);
    expect(result.signature.month).toBe(3);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockAuditWrite).toHaveBeenCalledOnce();
    expect(mockAuditWrite).toHaveBeenCalledWith(
      expect.anything(), // tx
      ACTOR,
      ORG,
      expect.objectContaining({ action: 'APPROVE', entityType: 'TimesheetSignature' }),
    );
  });

  it('returns existing signature with created=false on re-confirm — no second AuditLog', async () => {
    const mockAuditWrite = vi.spyOn(auditWriter, 'write').mockResolvedValue(undefined);

    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(SIG), // already confirmed
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });

    const result = await confirmMonth(EMP, 2026, 3, ACTOR, ORG, db);

    expect(result.created).toBe(false);
    expect(result.signature.id).toBe(SIG.id);
    expect(result.signature.confirmedAt).toBe(SIG.confirmedAt);
    // No second audit write when idempotent
    expect(mockAuditWrite).not.toHaveBeenCalled();
  });

  it('throws 422 OPEN_ENTRIES_EXIST when OPEN entries exist in the month', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'entry-open-1',
          status: 'OPEN',
          clockIn: new Date('2026-03-10T08:00:00.000Z'),
        }),
      },
    });

    await expect(confirmMonth(EMP, 2026, 3, ACTOR, ORG, db)).rejects.toMatchObject({
      status: 422,
      code: 'OPEN_ENTRIES_EXIST',
    });
  });

  it('handles P2002 race condition — returns existing signature with created=false', async () => {
    const p2002Error = Object.assign(new Error('Unique constraint violation'), {
      code: 'P2002',
    });
    const mockCreate = vi.fn().mockRejectedValue(p2002Error);
    vi.spyOn(auditWriter, 'write').mockResolvedValue(undefined);

    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null) // first check: not confirmed yet
          .mockResolvedValueOnce(SIG), // re-read after P2002
        create: mockCreate,
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (cb: (tx: TenantClient) => Promise<unknown>) => {
        const tx = {
          timesheetSignature: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: mockCreate,
          },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        } as unknown as TenantClient;
        return cb(tx);
      }),
    });

    const result = await confirmMonth(EMP, 2026, 3, ACTOR, ORG, db);
    expect(result.created).toBe(false);
    expect(result.signature.id).toBe(SIG.id);
  });
});

// ---------------------------------------------------------------------------
// getMonthlySummary
// ---------------------------------------------------------------------------

describe('getMonthlySummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns confirmed=true and confirmedAt when signature exists', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(SIG),
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null), // no OPEN entries
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    });

    const result = await getMonthlySummary(EMP, 2026, 3, ORG, db);

    expect(result.confirmed).toBe(true);
    expect(result.confirmedAt).toBe(SIG.confirmedAt.toISOString());
    expect(result.hasOpenEntry).toBe(false);
  });

  it('returns confirmed=false and confirmedAt=null when no signature exists', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    });

    const result = await getMonthlySummary(EMP, 2026, 3, ORG, db);

    expect(result.confirmed).toBe(false);
    expect(result.confirmedAt).toBeNull();
  });

  it('returns hasOpenEntry=true when an OPEN entry exists in the month', async () => {
    const db = makeDb({
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'entry-open',
          status: 'OPEN',
          clockIn: new Date('2026-03-20T08:00:00.000Z'),
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      $queryRaw: vi.fn().mockResolvedValue([]),
    });

    const result = await getMonthlySummary(EMP, 2026, 3, ORG, db);

    expect(result.hasOpenEntry).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// listConfirmationStatus
// ---------------------------------------------------------------------------

describe('listConfirmationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all employees with confirmed=true for those who have a signature', async () => {
    const employees = [
      { id: EMP, firstName: 'Ana', lastName: 'Garcia' },
      { id: 'emp-2', firstName: 'Luis', lastName: 'Perez' },
    ];
    const signatures = [SIG]; // only EMP confirmed

    const db = makeDb({
      employee: {
        findMany: vi.fn().mockResolvedValue(employees),
      },
      timesheetSignature: {
        findMany: vi.fn().mockResolvedValue(signatures),
      },
    });

    const result = await listConfirmationStatus(2026, 3, undefined, db);

    expect(result).toHaveLength(2);
    const anaRow = result.find((r) => r.employeeId === EMP);
    const luisRow = result.find((r) => r.employeeId === 'emp-2');
    expect(anaRow?.confirmed).toBe(true);
    expect(anaRow?.confirmedAt).toBe(SIG.confirmedAt.toISOString());
    expect(luisRow?.confirmed).toBe(false);
    expect(luisRow?.confirmedAt).toBeNull();
  });

  it('returns empty array when there are no employees', async () => {
    const db = makeDb({
      employee: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      timesheetSignature: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    const result = await listConfirmationStatus(2026, 3, undefined, db);
    expect(result).toHaveLength(0);
  });
});
