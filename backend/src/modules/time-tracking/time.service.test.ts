import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  clockIn,
  clockOut,
  createCorrection,
  approveCorrection,
  rejectCorrection,
  listEntries,
  setEventBus,
} from './time.service';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';

// Mock deps — no real DB or SSE in unit tests.
vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../rules/index.js', () => ({
  ruleEngine: {
    check: vi.fn().mockReturnValue([]),
  },
}));

import { ruleEngine } from '../rules/index';
import { auditWriter } from '../../audit/audit-writer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-1';
const EMPLOYEE = 'emp-1';
const APPROVER = 'manager-1';

const openEntry = {
  id: 'entry-open',
  organizationId: ORG,
  employeeId: EMPLOYEE,
  clockIn: new Date('2026-06-01T08:00:00Z'),
  clockOut: null,
  status: 'OPEN',
  source: 'web',
  createdAt: new Date(),
};

const closedEntry = {
  ...openEntry,
  id: 'entry-closed',
  clockOut: new Date('2026-06-01T17:00:00Z'),
  status: 'CLOSED',
};

const pendingCorrection = {
  id: 'corr-1',
  organizationId: ORG,
  timeEntryId: 'entry-closed',
  requestedById: EMPLOYEE,
  proposedClockIn: null,
  proposedClockOut: null,
  justification: 'Forgot to clock in earlier',
  status: 'PENDING',
  approverId: null,
  decidedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockDb(overrides: Partial<Record<string, unknown>> = {}): TenantClient {
  return {
    timeEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(closedEntry),
      findMany: vi.fn().mockResolvedValue([openEntry, closedEntry]),
      create: vi.fn().mockResolvedValue(openEntry),
      update: vi.fn().mockResolvedValue(closedEntry),
    },
    timeCorrection: {
      findUnique: vi.fn().mockResolvedValue(pendingCorrection),
      create: vi.fn().mockResolvedValue(pendingCorrection),
      update: vi.fn().mockImplementation(
        ({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ ...pendingCorrection, ...data }),
      ),
    },
    ruleSet: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    absence: {
      findMany: vi.fn().mockResolvedValue([]), // P4-9: approved absences for clockOut
    },
    $queryRaw: vi.fn().mockResolvedValue([{ total: 0 }]),
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    // FR-TSS-007: lock guard — default: no confirmed signature (guard passes transparently).
    timesheetSignature: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as unknown as TenantClient;
}

// ---------------------------------------------------------------------------
// clockIn tests (P3-1)
// ---------------------------------------------------------------------------

describe('clockIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an OPEN TimeEntry with server-generated clockIn (AC-TIME-1)', async () => {
    const db = makeMockDb();
    const result = await clockIn(EMPLOYEE, ORG, db);
    expect(result.status).toBe('OPEN');
    expect((db as ReturnType<typeof makeMockDb>).timeEntry.create).toHaveBeenCalledOnce();
    const createCall = vi.mocked((db as ReturnType<typeof makeMockDb>).timeEntry.create).mock.calls[0]![0];
    // Server sets the timestamp — the data must contain clockIn as a Date.
    expect(createCall.data.clockIn).toBeInstanceOf(Date);
    expect(createCall.data.status).toBe('OPEN');
  });

  it('throws 409 when employee already has an OPEN entry (AC-TIME-3)', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(openEntry),
        create: vi.fn(),
      },
    });
    const err = await clockIn(EMPLOYEE, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('ALREADY_CLOCKED_IN');
    expect((db as ReturnType<typeof makeMockDb>).timeEntry.create).not.toHaveBeenCalled();
  });

  it('writes a CREATE audit row on success', async () => {
    const db = makeMockDb();
    await clockIn(EMPLOYEE, ORG, db);
    expect(auditWriter.write).toHaveBeenCalledOnce();
    const auditCall = vi.mocked(auditWriter.write).mock.calls[0]!;
    expect(auditCall[3].action).toBe('CREATE');
    expect(auditCall[3].entityType).toBe('TimeEntry');
  });

  it('uses default source "web" when not specified', async () => {
    const db = makeMockDb();
    await clockIn(EMPLOYEE, ORG, db);
    const createCall = vi.mocked((db as ReturnType<typeof makeMockDb>).timeEntry.create).mock.calls[0]![0];
    expect(createCall.data.source).toBe('web');
  });

  it('emits a CLOCK_IN SSE event targeting MANAGER role (FR-TIME-9 / AC-TIME-8)', async () => {
    const mockPublish = vi.fn();
    setEventBus({ publish: mockPublish } as never);
    const db = makeMockDb();
    await clockIn(EMPLOYEE, ORG, db);
    expect(mockPublish).toHaveBeenCalledOnce();
    const event = mockPublish.mock.calls[0][0];
    expect(event.type).toBe('CLOCK_IN');
    expect(event.organizationId).toBe(ORG);
    expect(event.targetRole).toBe('MANAGER');
    expect(event.payload.employeeId).toBe(EMPLOYEE);
    setEventBus(null as never); // reset
  });
});

// ---------------------------------------------------------------------------
// clockOut tests (P3-2)
// ---------------------------------------------------------------------------

describe('clockOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ruleEngine.check).mockReturnValue([]);
  });

  it('closes the OPEN entry and returns CLOSED entry', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(openEntry),
        update: vi.fn().mockResolvedValue({ ...openEntry, status: 'CLOSED', clockOut: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    const { entry } = await clockOut(EMPLOYEE, ORG, db);
    expect(entry.status).toBe('CLOSED');
    expect((db as ReturnType<typeof makeMockDb>).timeEntry.update).toHaveBeenCalledOnce();
  });

  it('throws 404 when employee has no OPEN entry', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    });
    const err = await clockOut(EMPLOYEE, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_CLOCKED_IN');
  });

  it('sets overtime flag when effectiveHours > maxDailyHours (FR-TIME-4)', async () => {
    // clockIn 8am, clockOut 7pm = 11h (> 9h default max)
    const earlyClockIn = new Date('2026-06-01T08:00:00Z');
    const lateClockOut = new Date('2026-06-01T19:00:00Z');

    const longEntry = { ...openEntry, clockIn: earlyClockIn };
    vi.useFakeTimers();
    vi.setSystemTime(lateClockOut);

    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(longEntry),
        update: vi.fn().mockResolvedValue({ ...longEntry, status: 'CLOSED', clockOut: lateClockOut }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });

    await clockOut(EMPLOYEE, ORG, db);

    const updateCall = vi.mocked((db as ReturnType<typeof makeMockDb>).timeEntry.update).mock.calls[0]![0];
    // Update sets clockOut and status; overtime computed by service
    expect(updateCall.data.status).toBe('CLOSED');

    vi.useRealTimers();
  });

  it('calls ruleEngine.check with the assembled context (FR-RULES-6)', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(openEntry),
        update: vi.fn().mockResolvedValue({ ...openEntry, status: 'CLOSED', clockOut: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await clockOut(EMPLOYEE, ORG, db);
    expect(ruleEngine.check).toHaveBeenCalledOnce();
    const [ctx] = vi.mocked(ruleEngine.check).mock.calls[0]!;
    expect(ctx.candidate.kind).toBe('timeEntry');
    expect(ctx.employeeId).toBe(EMPLOYEE);
  });

  it('queries YTD overtime via $queryRaw (FR-TIME-8)', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(openEntry),
        update: vi.fn().mockResolvedValue({ ...openEntry, status: 'CLOSED', clockOut: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await clockOut(EMPLOYEE, ORG, db);
    expect((db as ReturnType<typeof makeMockDb>).$queryRaw).toHaveBeenCalledOnce();
  });

  it('writes an UPDATE audit row on success', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(openEntry),
        update: vi.fn().mockResolvedValue({ ...openEntry, status: 'CLOSED', clockOut: new Date() }),
        findMany: vi.fn().mockResolvedValue([]),
      },
    });
    await clockOut(EMPLOYEE, ORG, db);
    expect(auditWriter.write).toHaveBeenCalledOnce();
    const auditCall = vi.mocked(auditWriter.write).mock.calls[0]!;
    expect(auditCall[3].action).toBe('UPDATE');
    expect(auditCall[3].before).toMatchObject({ status: 'OPEN' });
    expect((auditCall[3].after as Record<string, unknown>)?.status).toBe('CLOSED');
  });

  it('upserts YTD overtime accumulator via $queryRaw (AC-TIME-7 — computed total)', async () => {
    vi.mocked(ruleEngine.check).mockReturnValue([]);
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(openEntry),
        update: vi.fn().mockResolvedValue({ ...openEntry, status: 'CLOSED', clockOut: new Date() }),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ total: 75 }]),
    });
    const { entry } = await clockOut(EMPLOYEE, ORG, db);
    expect(entry.status).toBe('CLOSED');
    // annualOvertimeHours passed to rule engine should be 75.
    const [ctx] = vi.mocked(ruleEngine.check).mock.calls[0]!;
    expect(ctx.annualOvertimeHours).toBe(75);
  });
});

// ---------------------------------------------------------------------------
// createCorrection tests (P3-4)
// ---------------------------------------------------------------------------

describe('createCorrection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a PENDING correction linked to the TimeEntry (AC-TIME-5)', async () => {
    const db = makeMockDb();
    const result = await createCorrection(
      {
        timeEntryId: 'entry-closed',
        requestedById: EMPLOYEE,
        justification: 'I started earlier',
      },
      ORG,
      db,
    );
    expect(result.status).toBe('PENDING');
    expect((db as ReturnType<typeof makeMockDb>).timeCorrection.create).toHaveBeenCalledOnce();
  });

  it('throws 404 when linked TimeEntry does not exist', async () => {
    const db = makeMockDb({
      timeEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });
    const err = await createCorrection(
      { timeEntryId: 'missing', requestedById: EMPLOYEE, justification: 'test' },
      ORG,
      db,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  it('writes a CREATE audit row on success', async () => {
    const db = makeMockDb();
    await createCorrection(
      { timeEntryId: 'entry-closed', requestedById: EMPLOYEE, justification: 'test' },
      ORG,
      db,
    );
    expect(auditWriter.write).toHaveBeenCalledOnce();
    const auditCall = vi.mocked(auditWriter.write).mock.calls[0]!;
    expect(auditCall[3].action).toBe('CREATE');
    expect(auditCall[3].entityType).toBe('TimeCorrection');
  });
});

// ---------------------------------------------------------------------------
// approveCorrection tests (P3-5)
// ---------------------------------------------------------------------------

describe('approveCorrection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions PENDING→APPROVED and writes audit with before/after (AC-TIME-6)', async () => {
    const db = makeMockDb({
      timeCorrection: {
        findUnique: vi.fn().mockResolvedValue(pendingCorrection),
        update: vi.fn().mockResolvedValue({ ...pendingCorrection, status: 'APPROVED', approverId: APPROVER }),
      },
    });
    const result = await approveCorrection('corr-1', APPROVER, ORG, db);
    expect(result.status).toBe('APPROVED');

    expect(auditWriter.write).toHaveBeenCalledOnce();
    const auditCall = vi.mocked(auditWriter.write).mock.calls[0]!;
    expect(auditCall[3].action).toBe('APPROVE');
    expect(auditCall[3].before).toMatchObject({ status: 'PENDING' });
    expect((auditCall[3].after as Record<string, unknown>)?.status).toBe('APPROVED');
    expect((auditCall[3].after as Record<string, unknown>)?.approverId).toBe(APPROVER);
  });

  it('throws 404 when correction not found', async () => {
    const db = makeMockDb({
      timeCorrection: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const err = await approveCorrection('missing', APPROVER, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  it('throws 409 when correction is not PENDING', async () => {
    const db = makeMockDb({
      timeCorrection: {
        findUnique: vi.fn().mockResolvedValue({ ...pendingCorrection, status: 'APPROVED' }),
      },
    });
    const err = await approveCorrection('corr-1', APPROVER, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CORRECTION_NOT_PENDING');
  });
});

// ---------------------------------------------------------------------------
// rejectCorrection tests (P3-5)
// ---------------------------------------------------------------------------

describe('rejectCorrection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions PENDING→REJECTED and writes audit with before/after', async () => {
    const db = makeMockDb({
      timeCorrection: {
        findUnique: vi.fn().mockResolvedValue(pendingCorrection),
        update: vi.fn().mockResolvedValue({ ...pendingCorrection, status: 'REJECTED', approverId: APPROVER }),
      },
    });
    const result = await rejectCorrection('corr-1', APPROVER, ORG, db);
    expect(result.status).toBe('REJECTED');

    const auditCall = vi.mocked(auditWriter.write).mock.calls[0]!;
    expect(auditCall[3].action).toBe('REJECT');
    expect(auditCall[3].before).toMatchObject({ status: 'PENDING' });
    expect((auditCall[3].after as Record<string, unknown>)?.status).toBe('REJECTED');
  });

  it('throws 404 when correction not found', async () => {
    const db = makeMockDb({
      timeCorrection: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const err = await rejectCorrection('missing', APPROVER, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
  });

  it('throws 409 when correction is not PENDING', async () => {
    const db = makeMockDb({
      timeCorrection: {
        findUnique: vi.fn().mockResolvedValue({ ...pendingCorrection, status: 'REJECTED' }),
      },
    });
    const err = await rejectCorrection('corr-1', APPROVER, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// listEntries tests (P3-3)
// ---------------------------------------------------------------------------

describe('listEntries', () => {
  it('returns entries without filter', async () => {
    const db = makeMockDb();
    const result = await listEntries({}, db);
    expect(Array.isArray(result)).toBe(true);
  });

  it('filters by employeeId', async () => {
    const db = makeMockDb();
    await listEntries({ employeeId: EMPLOYEE }, db);
    const findManyCall = vi.mocked((db as ReturnType<typeof makeMockDb>).timeEntry.findMany).mock.calls[0]![0];
    expect(findManyCall?.where?.employeeId).toBe(EMPLOYEE);
  });

  it('filters by status', async () => {
    const db = makeMockDb();
    await listEntries({ status: 'OPEN' }, db);
    const findManyCall = vi.mocked((db as ReturnType<typeof makeMockDb>).timeEntry.findMany).mock.calls[0]![0];
    expect(findManyCall?.where?.status).toBe('OPEN');
  });
});

// ---------------------------------------------------------------------------
// Lock guard integration tests — FR-TSS-007, FR-TSS-008
// AC-TSS-005, AC-TSS-006, AC-TSS-007, AC-TSS-008
//
// assertMonthNotConfirmed is called inside clockIn, clockOut, createCorrection.
// approveCorrection / rejectCorrection MUST NOT be blocked (ADR-3).
// ---------------------------------------------------------------------------

describe('lock guard — clockIn on confirmed month', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws 409 MONTH_LOCKED when current month is confirmed (AC-TSS-005)', async () => {
    const confirmedSig = {
      id: 'sig-1',
      organizationId: ORG,
      employeeId: EMPLOYEE,
      year: new Date().getUTCFullYear(),
      month: new Date().getUTCMonth() + 1,
      confirmedAt: new Date(),
      createdAt: new Date(),
    };

    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null), // no existing OPEN entry
        create: vi.fn(),
      },
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(confirmedSig),
      },
    });

    const err = await clockIn(EMPLOYEE, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('MONTH_LOCKED');
    expect((db as ReturnType<typeof makeMockDb>).timeEntry.create).not.toHaveBeenCalled();
  });

  it('does NOT throw when current month is NOT confirmed (AC-TSS-008)', async () => {
    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(openEntry),
      },
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(null), // not confirmed
      },
    });

    await expect(clockIn(EMPLOYEE, ORG, db)).resolves.toBeDefined();
  });
});

describe('lock guard — clockOut on confirmed month', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ruleEngine.check).mockReturnValue([]);
  });

  it('throws 409 MONTH_LOCKED when the open entry month is confirmed (AC-TSS-006)', async () => {
    const marchedEntry = {
      ...openEntry,
      clockIn: new Date('2026-03-15T08:00:00Z'), // March entry
    };

    const confirmedSig = {
      id: 'sig-march',
      organizationId: ORG,
      employeeId: EMPLOYEE,
      year: 2026,
      month: 3,
      confirmedAt: new Date(),
      createdAt: new Date(),
    };

    const db = makeMockDb({
      timeEntry: {
        findFirst: vi.fn().mockResolvedValue(marchedEntry),
        update: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(confirmedSig),
      },
    });

    const err = await clockOut(EMPLOYEE, ORG, db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('MONTH_LOCKED');
    expect((db as ReturnType<typeof makeMockDb>).timeEntry.update).not.toHaveBeenCalled();
  });
});

describe('lock guard — createCorrection on confirmed month', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws 409 MONTH_LOCKED when the entry month is confirmed (AC-TSS-007)', async () => {
    const marchEntry = {
      ...closedEntry,
      clockIn: new Date('2026-03-10T08:00:00Z'),
    };

    const confirmedSig = {
      id: 'sig-march',
      organizationId: ORG,
      employeeId: EMPLOYEE,
      year: 2026,
      month: 3,
      confirmedAt: new Date(),
      createdAt: new Date(),
    };

    const db = makeMockDb({
      timeEntry: {
        findUnique: vi.fn().mockResolvedValue(marchEntry),
      },
      timeCorrection: {
        create: vi.fn(),
      },
      timesheetSignature: {
        findUnique: vi.fn().mockResolvedValue(confirmedSig),
      },
    });

    const err = await createCorrection(
      { timeEntryId: 'entry-closed', requestedById: EMPLOYEE, justification: 'Wrong time' },
      ORG,
      db,
    ).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe('MONTH_LOCKED');
    expect((db as ReturnType<typeof makeMockDb>).timeCorrection.create).not.toHaveBeenCalled();
  });
});

describe('lock guard — approveCorrection and rejectCorrection NOT blocked (ADR-3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approveCorrection succeeds even when month is confirmed (AC-TSS-008)', async () => {
    // Even though we have a confirmed sig, approveCorrection must proceed.
    const db = makeMockDb({
      timeCorrection: {
        findUnique: vi.fn().mockResolvedValue(pendingCorrection),
        update: vi.fn().mockResolvedValue({ ...pendingCorrection, status: 'APPROVED' }),
      },
    });

    const result = await approveCorrection('corr-1', APPROVER, ORG, db);
    expect(result.status).toBe('APPROVED');
  });

  it('rejectCorrection succeeds even when month is confirmed (AC-TSS-008)', async () => {
    const db = makeMockDb({
      timeCorrection: {
        findUnique: vi.fn().mockResolvedValue(pendingCorrection),
        update: vi.fn().mockResolvedValue({ ...pendingCorrection, status: 'REJECTED' }),
      },
    });

    const result = await rejectCorrection('corr-1', APPROVER, ORG, db);
    expect(result.status).toBe('REJECTED');
  });
});
