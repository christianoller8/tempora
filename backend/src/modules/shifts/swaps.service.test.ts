import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestSwap, approveSwap, rejectSwap } from './swaps.service.js';
import type { TenantClient } from '../../db/tenant.js';
import { ApiError } from '../../middleware/error.js';

vi.mock('../rules/index.js', () => ({
  ruleEngine: {
    check: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ruleEngine } from '../rules/index.js';

const requesterTemplate = { id: 'tmpl-req', startTime: '07:00', endTime: '15:00' };
const targetTemplate = { id: 'tmpl-tgt', startTime: '15:00', endTime: '23:00' };

const requesterAssignment = {
  id: 'assign-req',
  employeeId: 'emp-req',
  scheduleId: 'sched-1',
  date: new Date('2026-06-15'),
  shiftTemplateId: 'tmpl-req',
  shiftTemplate: requesterTemplate,
};

const targetAssignment = {
  id: 'assign-tgt',
  employeeId: 'emp-tgt',
  scheduleId: 'sched-1',
  date: new Date('2026-06-16'),
  shiftTemplateId: 'tmpl-tgt',
  shiftTemplate: targetTemplate,
};

const pendingSwap = {
  id: 'swap-1',
  organizationId: 'org-1',
  requesterAssignmentId: 'assign-req',
  targetAssignmentId: 'assign-tgt',
  status: 'REQUESTED',
  reason: null,
  approverId: null,
  decidedAt: null,
  requesterAssignment,
  targetAssignment,
};

function makeMockDb(overrides: Partial<Record<string, unknown>> = {}): TenantClient {
  return {
    shiftAssignment: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (where.id === 'assign-req') return Promise.resolve(requesterAssignment);
        if (where.id === 'assign-tgt') return Promise.resolve(targetAssignment);
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    shiftSchedule: {
      findUnique: vi.fn().mockResolvedValue({ id: 'sched-1', status: 'DRAFT' }),
    },
    ruleSet: { findFirst: vi.fn().mockResolvedValue(null) },
    cambioTurno: {
      create: vi.fn().mockResolvedValue({ ...pendingSwap }),
      findUnique: vi.fn().mockResolvedValue({ ...pendingSwap }),
      update: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...pendingSwap, ...args.data }),
      ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    absence: { findMany: vi.fn().mockResolvedValue([]) }, // P4-9: approved absences
    $queryRaw: vi.fn().mockResolvedValue([{ total: 0 }]),
    ...overrides,
  } as unknown as TenantClient;
}

describe('requestSwap', () => {
  it('creates a REQUESTED swap with both assignment IDs (FR-SHIFT-8)', async () => {
    const db = makeMockDb();
    const result = await requestSwap(
      { requesterAssignmentId: 'assign-req', targetAssignmentId: 'assign-tgt', reason: 'Family event' },
      'org-1',
      'user-1',
      db,
    );
    expect(result.status).toBe('REQUESTED');
    expect((db as ReturnType<typeof makeMockDb>).cambioTurno.create).toHaveBeenCalledOnce();
  });

  it('throws 404 when requester assignment not found', async () => {
    const db = makeMockDb({
      shiftAssignment: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    });
    await expect(
      requestSwap({ requesterAssignmentId: 'assign-missing' }, 'org-1', 'user-1', db),
    ).rejects.toThrow(expect.objectContaining({ status: 404 }));
  });
});

describe('approveSwap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ruleEngine.check).mockReturnValue([]);
  });

  it('swaps assignments and marks swap as APPROVED (AC-SHIFT-6)', async () => {
    const db = makeMockDb();
    const result = await approveSwap('swap-1', 'org-1', 'manager-1', db);
    expect(result.swap.status).toBe('APPROVED');
    // Both assignments should have been updated.
    expect((db as ReturnType<typeof makeMockDb>).shiftAssignment.update).toHaveBeenCalledTimes(2);
  });

  it('throws 422 when BLOCK violations exist after swap (AC-SHIFT-7)', async () => {
    vi.mocked(ruleEngine.check).mockReturnValue([
      { type: 'block', code: 'MIN_REST_12H', message: 'Insufficient rest', meta: {} },
    ]);
    const db = makeMockDb();
    const err = await approveSwap('swap-1', 'org-1', 'manager-1', db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('RULE_VIOLATION');
    // Assignments must NOT have been swapped.
    expect((db as ReturnType<typeof makeMockDb>).shiftAssignment.update).not.toHaveBeenCalled();
  });

  it('runs Rules Engine on BOTH employees post-swap state', async () => {
    const db = makeMockDb();
    await approveSwap('swap-1', 'org-1', 'manager-1', db);
    // ruleEngine.check is called once per employee (2 calls).
    expect(vi.mocked(ruleEngine.check)).toHaveBeenCalledTimes(2);
    const [firstCtx] = vi.mocked(ruleEngine.check).mock.calls[0]!;
    const [secondCtx] = vi.mocked(ruleEngine.check).mock.calls[1]!;
    // First check is for requester employee getting target's date/template.
    expect(firstCtx.employeeId).toBe('emp-req');
    // Second check is for target employee getting requester's date/template.
    expect(secondCtx.employeeId).toBe('emp-tgt');
  });

  it('throws 404 when swap not found', async () => {
    const db = makeMockDb({
      cambioTurno: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(approveSwap('swap-missing', 'org-1', 'manager-1', db)).rejects.toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  it('throws 409 when swap is not in REQUESTED status', async () => {
    const db = makeMockDb({
      cambioTurno: {
        findUnique: vi.fn().mockResolvedValue({ ...pendingSwap, status: 'APPROVED' }),
      },
    });
    await expect(approveSwap('swap-1', 'org-1', 'manager-1', db)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: 'SWAP_NOT_PENDING' }),
    );
  });

  it('passes warnings through without throwing (WARN-only violations)', async () => {
    vi.mocked(ruleEngine.check).mockReturnValue([
      { type: 'warn', code: 'MAX_DAILY_9H', message: 'Long day', meta: {} },
    ]);
    const db = makeMockDb();
    const result = await approveSwap('swap-1', 'org-1', 'manager-1', db);
    expect(result.warnings).toHaveLength(2); // one per employee check
    expect(result.swap.status).toBe('APPROVED');
  });
});

describe('rejectSwap', () => {
  it('marks swap as REJECTED', async () => {
    const db = makeMockDb();
    const result = await rejectSwap('swap-1', 'org-1', 'manager-1', db);
    expect(result.status).toBe('REJECTED');
  });

  it('throws 409 when swap is already decided', async () => {
    const db = makeMockDb({
      cambioTurno: {
        findUnique: vi.fn().mockResolvedValue({ ...pendingSwap, status: 'REJECTED' }),
      },
    });
    await expect(rejectSwap('swap-1', 'org-1', 'manager-1', db)).rejects.toThrow(
      expect.objectContaining({ status: 409 }),
    );
  });
});
