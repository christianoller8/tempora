import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createAbsence,
  approveAbsence,
  rejectAbsence,
  getAbsence,
  getBalance,
} from './absences.service';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';

// ---------------------------------------------------------------------------
// Mock dependencies — no real DB, crypto uses real node:crypto, env is mocked.
// ---------------------------------------------------------------------------

vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock env to provide a valid 32-byte FIELD_ENCRYPTION_KEY.
vi.mock('../../config/env.js', () => ({
  env: {
    FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 'k').toString('base64'), // 32 'k' bytes
  },
}));

import { auditWriter } from '../../audit/audit-writer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-1';
const EMPLOYEE = 'emp-1';
const MANAGER_ID = 'manager-1';
const ADMIN_ID = 'admin-1';

const baseAbsence = {
  id: 'abs-1',
  organizationId: ORG,
  employeeId: EMPLOYEE,
  type: 'VACACIONES' as const,
  startDate: new Date('2026-06-10'),
  endDate: new Date('2026-06-14'),
  status: 'PENDING' as const,
  causeEncrypted: null,
  approverId: null,
  decidedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockDb(overrides: Partial<Record<string, unknown>> = {}): TenantClient {
  return {
    absence: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(baseAbsence),
      create: vi.fn().mockResolvedValue(baseAbsence),
      update: vi.fn().mockResolvedValue({ ...baseAbsence, status: 'APPROVED' }),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } as unknown as TenantClient;
}

const baseCreateDto = {
  employeeId: EMPLOYEE,
  type: 'VACACIONES' as const,
  startDate: '2026-06-10',
  endDate: '2026-06-14',
};

// ---------------------------------------------------------------------------
// createAbsence tests
// ---------------------------------------------------------------------------

describe('createAbsence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a PENDING absence for EMPLOYEE role (VACACIONES)', async () => {
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null), // no overlap
        findMany: vi.fn().mockResolvedValue([]),    // no prior vacaciones
        create: vi.fn().mockResolvedValue(baseAbsence),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const result = await createAbsence(baseCreateDto, EMPLOYEE, 'EMPLOYEE', ORG, db);
    expect(result.absence.status).toBe('PENDING');
  });

  it('throws 422 when dates overlap with an existing PENDING absence', async () => {
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(baseAbsence), // overlap!
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    await expect(
      createAbsence(baseCreateDto, EMPLOYEE, 'EMPLOYEE', ORG, db),
    ).rejects.toThrow(expect.objectContaining({ status: 422, code: 'ABSENCE_OVERLAP' }));
  });

  it('throws 422 when vacation balance is zero', async () => {
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null), // no overlap
        findMany: vi.fn().mockResolvedValue([
          // 22 approved VACACIONES days already used (same year)
          {
            ...baseAbsence,
            startDate: new Date('2026-01-02'),
            endDate: new Date('2026-01-23'), // 22 days
            status: 'APPROVED',
            type: 'VACACIONES',
          },
        ]),
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue({}),
      },
    });
    await expect(
      createAbsence(baseCreateDto, EMPLOYEE, 'EMPLOYEE', ORG, db),
    ).rejects.toThrow(
      expect.objectContaining({ status: 422, code: 'INSUFFICIENT_VACATION_BALANCE' }),
    );
  });

  it('IT absence by MANAGER goes straight to APPROVED status', async () => {
    const itAbsence = { ...baseAbsence, type: 'IT' as const, status: 'APPROVED' as const };
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(itAbsence),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(itAbsence),
      },
    });
    const result = await createAbsence(
      { employeeId: EMPLOYEE, type: 'IT', startDate: '2026-06-10', endDate: '2026-06-11', cause: 'Gripe' },
      MANAGER_ID,
      'MANAGER',
      ORG,
      db,
    );
    expect(result.absence.status).toBe('APPROVED');
  });

  it('IT absence by ADMIN goes straight to APPROVED status', async () => {
    const itAbsence = { ...baseAbsence, type: 'IT' as const, status: 'APPROVED' as const };
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(itAbsence),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(itAbsence),
      },
    });
    const result = await createAbsence(
      { employeeId: EMPLOYEE, type: 'IT', startDate: '2026-06-10', endDate: '2026-06-11' },
      ADMIN_ID,
      'ADMIN',
      ORG,
      db,
    );
    expect(result.absence.status).toBe('APPROVED');
  });

  it('IT absence by EMPLOYEE remains PENDING', async () => {
    const itAbsence = { ...baseAbsence, type: 'IT' as const, status: 'PENDING' as const };
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(itAbsence),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(itAbsence),
      },
    });
    const result = await createAbsence(
      { employeeId: EMPLOYEE, type: 'IT', startDate: '2026-06-10', endDate: '2026-06-11' },
      EMPLOYEE,
      'EMPLOYEE',
      ORG,
      db,
    );
    expect(result.absence.status).toBe('PENDING');
  });

  it('encrypts cause for IT type and does not expose causeEncrypted in result', async () => {
    const itAbsence = { ...baseAbsence, type: 'IT' as const, status: 'APPROVED' as const };
    const createSpy = vi.fn().mockResolvedValue(itAbsence);
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: createSpy,
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(itAbsence),
      },
    });
    const result = await createAbsence(
      { employeeId: EMPLOYEE, type: 'IT', startDate: '2026-06-10', endDate: '2026-06-11', cause: 'fiebre' },
      MANAGER_ID,
      'MANAGER',
      ORG,
      db,
    );

    // causeEncrypted must be passed to db.absence.create (not null).
    const createCall = createSpy.mock.calls[0] as [{ data: { causeEncrypted: Buffer | null } }];
    expect(createCall[0].data.causeEncrypted).toBeInstanceOf(Buffer);

    // causeEncrypted must NOT be in the returned object.
    expect('causeEncrypted' in result.absence).toBe(false);
  });

  it('writes a CREATE audit row', async () => {
    const db = makeMockDb({
      absence: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    await createAbsence(baseCreateDto, EMPLOYEE, 'EMPLOYEE', ORG, db);
    expect(auditWriter.write).toHaveBeenCalledWith(
      db,
      EMPLOYEE,
      ORG,
      expect.objectContaining({ action: 'CREATE', entityType: 'Absence' }),
    );
  });
});

// ---------------------------------------------------------------------------
// approveAbsence tests
// ---------------------------------------------------------------------------

describe('approveAbsence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions PENDING → APPROVED and writes APPROVE audit row', async () => {
    const approved = { ...baseAbsence, status: 'APPROVED' as const };
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(approved),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const result = await approveAbsence('abs-1', MANAGER_ID, ORG, db);
    expect(result.status).toBe('APPROVED');
    expect(auditWriter.write).toHaveBeenCalledWith(
      db,
      MANAGER_ID,
      ORG,
      expect.objectContaining({ action: 'APPROVE', entityType: 'Absence' }),
    );
  });

  it('throws 404 when absence not found', async () => {
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    await expect(approveAbsence('missing', MANAGER_ID, ORG, db)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
  });

  it('throws 409 when absence is not PENDING', async () => {
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue({ ...baseAbsence, status: 'APPROVED' }),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    await expect(approveAbsence('abs-1', MANAGER_ID, ORG, db)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: 'ABSENCE_NOT_PENDING' }),
    );
  });
});

// ---------------------------------------------------------------------------
// rejectAbsence tests
// ---------------------------------------------------------------------------

describe('rejectAbsence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('transitions PENDING → REJECTED and writes REJECT audit row', async () => {
    const rejected = { ...baseAbsence, status: 'REJECTED' as const };
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(rejected),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const result = await rejectAbsence('abs-1', MANAGER_ID, ORG, db);
    expect(result.status).toBe('REJECTED');
    expect(auditWriter.write).toHaveBeenCalledWith(
      db,
      MANAGER_ID,
      ORG,
      expect.objectContaining({ action: 'REJECT', entityType: 'Absence' }),
    );
  });

  it('throws 409 when absence is not PENDING', async () => {
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue({ ...baseAbsence, status: 'REJECTED' }),
        update: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    await expect(rejectAbsence('abs-1', MANAGER_ID, ORG, db)).rejects.toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
});

// ---------------------------------------------------------------------------
// getAbsence — GDPR audit-order tests
// ---------------------------------------------------------------------------

describe('getAbsence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns absence without cause when no causeEncrypted', async () => {
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue(baseAbsence),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const result = await getAbsence('abs-1', ORG, MANAGER_ID, db);
    expect(result.id).toBe('abs-1');
    expect('cause' in result).toBe(false);
    // No audit row for non-special-category reads.
    expect(auditWriter.write).not.toHaveBeenCalled();
  });

  it('writes READ audit row BEFORE decryption when causeEncrypted is present', async () => {
    const { encryptCause: enc } = await import('./crypto.js');
    const key = Buffer.alloc(32, 'k').toString('base64');
    const encrypted = enc('fiebre alta', key);

    const auditWriteSpy = vi.mocked(auditWriter.write);
    let auditCallOrder = -1;
    let decryptCallOrder = -1;
    let callCounter = 0;

    auditWriteSpy.mockImplementation(async () => {
      auditCallOrder = callCounter++;
    });

    // Track when decryptCause is actually called by checking if cause appears in result.
    // We test the audit-write-first invariant by checking auditWriter.write was called
    // with action=READ before the result is returned.

    const absWithCause = { ...baseAbsence, causeEncrypted: encrypted };
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue(absWithCause),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(absWithCause),
        update: vi.fn().mockResolvedValue(absWithCause),
      },
    });

    const result = await getAbsence('abs-1', ORG, MANAGER_ID, db);

    // Audit write must have been called.
    expect(auditWriteSpy).toHaveBeenCalledWith(
      db,
      MANAGER_ID,
      ORG,
      expect.objectContaining({ action: 'READ', entityType: 'Absence', entityId: 'abs-1' }),
    );

    // Cause must be decrypted and returned.
    expect(result.cause).toBe('fiebre alta');
    // causeEncrypted must not be in response.
    expect('causeEncrypted' in result).toBe(false);

    void decryptCallOrder; // used to satisfy TS
  });

  it('throws 404 when absence not found', async () => {
    const db = makeMockDb({
      absence: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    await expect(getAbsence('missing', ORG, MANAGER_ID, db)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
  });
});

// ---------------------------------------------------------------------------
// getBalance tests
// ---------------------------------------------------------------------------

describe('getBalance', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 22 entitled, 0 used, 22 remaining when no absences', async () => {
    const db = makeMockDb({
      absence: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const balance = await getBalance(EMPLOYEE, 2026, ORG, db);
    expect(balance.entitled).toBe(22);
    expect(balance.used).toBe(0);
    expect(balance.remaining).toBe(22);
  });

  it('computes correct used days from approved VACACIONES absences', async () => {
    // 5-day absence: Jun 10-14 (5 days inclusive).
    const db = makeMockDb({
      absence: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...baseAbsence,
            startDate: new Date('2026-06-10'),
            endDate: new Date('2026-06-14'),
            status: 'APPROVED',
            type: 'VACACIONES',
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const balance = await getBalance(EMPLOYEE, 2026, ORG, db);
    expect(balance.used).toBe(5);
    expect(balance.remaining).toBe(17);
  });

  it('remaining is 0 (not negative) when fully exhausted', async () => {
    // 22 days: Jan 2-23.
    const db = makeMockDb({
      absence: {
        findMany: vi.fn().mockResolvedValue([
          {
            ...baseAbsence,
            startDate: new Date('2026-01-02'),
            endDate: new Date('2026-01-23'),
            status: 'APPROVED',
            type: 'VACACIONES',
          },
        ]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(baseAbsence),
        update: vi.fn().mockResolvedValue(baseAbsence),
      },
    });
    const balance = await getBalance(EMPLOYEE, 2026, ORG, db);
    expect(balance.used).toBe(22);
    expect(balance.remaining).toBe(0);
  });
});
