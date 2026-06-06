import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before importing the controller
// ---------------------------------------------------------------------------

vi.mock('../../db-context', () => ({
  getDb: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('./absences.service', () => ({
  listAbsences: vi.fn().mockResolvedValue([]),
  createAbsence: vi.fn(),
  getAbsence: vi.fn(),
  approveAbsence: vi.fn(),
  rejectAbsence: vi.fn(),
  getBalance: vi.fn(),
}));

import { getDb, getUser } from '../../db-context';
import {
  listAbsences,
  approveAbsence,
  rejectAbsence,
  getAbsence,
} from './absences.service';
import {
  handleListAbsences,
  handleApproveAbsence,
  handleRejectAbsence,
  handleGetAbsence,
} from './absences.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-uuid';
const EMP_ID = 'emp-uuid';
const USER_ID = 'user-uuid';
const MANAGER_ID = 'manager-uuid';

function makeMockRes(): Response {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  return { json, status } as unknown as Response;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    query: {},
    params: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

const mockDb = {} as ReturnType<typeof getDb>;

// ---------------------------------------------------------------------------
// FR-ABS-27 — Employee self-scoping on list
// ---------------------------------------------------------------------------

describe('handleListAbsences — employee self-scoping (FR-ABS-27)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forces employeeId = user.employeeId for EMPLOYEE role', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP_ID,
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(listAbsences).mockResolvedValue([]);

    const res = makeMockRes();
    await handleListAbsences(makeReq({ query: {} }), res);

    expect(listAbsences).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: EMP_ID }),
      mockDb,
    );
  });

  it('uses sentinel __none__ when EMPLOYEE has no employeeId on token', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: undefined,
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(listAbsences).mockResolvedValue([]);

    const res = makeMockRes();
    await handleListAbsences(makeReq({ query: {} }), res);

    expect(listAbsences).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: '__none__' }),
      mockDb,
    );
  });

  it('does NOT force employeeId for ADMIN role — passes query param through', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: MANAGER_ID,
      organizationId: ORG,
      role: 'ADMIN',
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(listAbsences).mockResolvedValue([]);

    const res = makeMockRes();
    // Admin passes no query params — employeeId should be undefined (returns all).
    await handleListAbsences(makeReq({ query: {} }), res);

    expect(listAbsences).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: undefined }),
      mockDb,
    );
  });

  it('ADMIN can filter by explicit employeeId query param', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: MANAGER_ID,
      organizationId: ORG,
      role: 'ADMIN',
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(listAbsences).mockResolvedValue([]);

    const res = makeMockRes();
    await handleListAbsences(makeReq({ query: { employeeId: EMP_ID } }), res);

    expect(listAbsences).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: EMP_ID }),
      mockDb,
    );
  });
});

// ---------------------------------------------------------------------------
// D7 / FR-ABS-27 — handleGetAbsence ownership guard
// ---------------------------------------------------------------------------

describe('handleGetAbsence — ownership guard (D7, FR-ABS-27)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes requesterEmployeeId to service for EMPLOYEE role', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP_ID,
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(getAbsence).mockResolvedValue({
      id: 'abs-1',
      organizationId: ORG,
      employeeId: EMP_ID,
      type: 'VACACIONES',
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-14'),
      status: 'APPROVED',
      approverId: null,
      decidedAt: null,
      decisionComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = makeMockRes();
    await handleGetAbsence(makeReq({ params: { id: 'abs-1' } }), res);

    expect(getAbsence).toHaveBeenCalledWith('abs-1', ORG, USER_ID, mockDb, EMP_ID);
  });

  it('passes undefined requesterEmployeeId for ADMIN role', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: MANAGER_ID,
      organizationId: ORG,
      role: 'ADMIN',
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(getAbsence).mockResolvedValue({
      id: 'abs-1',
      organizationId: ORG,
      employeeId: EMP_ID,
      type: 'VACACIONES',
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-14'),
      status: 'APPROVED',
      approverId: null,
      decidedAt: null,
      decisionComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = makeMockRes();
    await handleGetAbsence(makeReq({ params: { id: 'abs-1' } }), res);

    expect(getAbsence).toHaveBeenCalledWith('abs-1', ORG, MANAGER_ID, mockDb, undefined);
  });

  it('passes sentinel __none__ when EMPLOYEE has no employeeId on token', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: undefined,
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(getAbsence).mockRejectedValue({ status: 404, code: 'NOT_FOUND' });

    const res = makeMockRes();
    await expect(handleGetAbsence(makeReq({ params: { id: 'abs-1' } }), res)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(getAbsence).toHaveBeenCalledWith('abs-1', ORG, USER_ID, mockDb, '__none__');
  });
});

// ---------------------------------------------------------------------------
// FR-ABS-24 — approve/reject comment forwarding
// ---------------------------------------------------------------------------

describe('handleApproveAbsence — comment forwarding (FR-ABS-24)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards comment from body to approveAbsence service', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: MANAGER_ID,
      organizationId: ORG,
      role: 'MANAGER',
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(approveAbsence).mockResolvedValue({
      id: 'abs-1',
      organizationId: ORG,
      employeeId: EMP_ID,
      type: 'VACACIONES',
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-14'),
      status: 'APPROVED',
      approverId: MANAGER_ID,
      decidedAt: new Date(),
      decisionComment: 'Approved for August',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = makeMockRes();
    await handleApproveAbsence(
      makeReq({ params: { id: 'abs-1' }, body: { comment: 'Approved for August' } }),
      res,
    );

    expect(approveAbsence).toHaveBeenCalledWith('abs-1', MANAGER_ID, ORG, mockDb, 'Approved for August');
  });

  it('forwards undefined comment when body is empty', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: MANAGER_ID,
      organizationId: ORG,
      role: 'MANAGER',
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(approveAbsence).mockResolvedValue({
      id: 'abs-1',
      organizationId: ORG,
      employeeId: EMP_ID,
      type: 'VACACIONES',
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-14'),
      status: 'APPROVED',
      approverId: MANAGER_ID,
      decidedAt: new Date(),
      decisionComment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = makeMockRes();
    await handleApproveAbsence(makeReq({ params: { id: 'abs-1' }, body: {} }), res);

    expect(approveAbsence).toHaveBeenCalledWith('abs-1', MANAGER_ID, ORG, mockDb, undefined);
  });
});

describe('handleRejectAbsence — comment forwarding (FR-ABS-24)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards comment from body to rejectAbsence service', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: MANAGER_ID,
      organizationId: ORG,
      role: 'MANAGER',
      jti: 'jti',
    });
    vi.mocked(getDb).mockReturnValue(mockDb);
    vi.mocked(rejectAbsence).mockResolvedValue({
      id: 'abs-1',
      organizationId: ORG,
      employeeId: EMP_ID,
      type: 'VACACIONES',
      startDate: new Date('2026-06-10'),
      endDate: new Date('2026-06-14'),
      status: 'REJECTED',
      approverId: MANAGER_ID,
      decidedAt: new Date(),
      decisionComment: 'Outside policy window',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = makeMockRes();
    await handleRejectAbsence(
      makeReq({ params: { id: 'abs-1' }, body: { comment: 'Outside policy window' } }),
      res,
    );

    expect(rejectAbsence).toHaveBeenCalledWith('abs-1', MANAGER_ID, ORG, mockDb, 'Outside policy window');
  });
});
