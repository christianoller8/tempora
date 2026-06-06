import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// ---------------------------------------------------------------------------
// Mocks — hoisted before controller imports
// ---------------------------------------------------------------------------

vi.mock('../../db-context', () => ({
  getDb: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('./timesheet-signature.service', () => ({
  confirmMonth: vi.fn(),
  getMonthlySummary: vi.fn(),
  listConfirmationStatus: vi.fn(),
}));

import { getDb, getUser } from '../../db-context';
import {
  confirmMonth,
  getMonthlySummary,
  listConfirmationStatus,
} from './timesheet-signature.service';
import {
  handleConfirm,
  handleGetSummary,
  handleGetStatus,
} from './timesheet-signature.controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG = 'org-uuid-0000-0000-000000000001';
const EMP = 'emp-uuid-0000-0000-000000000001';
const USER_ID = 'user-uuid-000-0000-000000000001';

const NOW = new Date('2026-03-15T10:00:00.000Z');

const mockSig = {
  id: 'sig-uuid-0000-0000-000000000001',
  organizationId: ORG,
  employeeId: EMP,
  year: 2026,
  month: 3,
  confirmedAt: NOW,
  createdAt: NOW,
};

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
// handleConfirm
// ---------------------------------------------------------------------------

describe('handleConfirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('returns 201 and data on first confirmation (created=true)', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP,
      jti: 'jti-1',
    });

    vi.mocked(confirmMonth).mockResolvedValue({ signature: mockSig, created: true });

    const req = makeReq({ body: { year: 2026, month: 3 } });
    const res = makeMockRes();

    await handleConfirm(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: mockSig.id, alreadyConfirmed: false }),
    });
  });

  it('returns 200 and data on re-confirmation (created=false)', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP,
      jti: 'jti-1',
    });

    vi.mocked(confirmMonth).mockResolvedValue({ signature: mockSig, created: false });

    const req = makeReq({ body: { year: 2026, month: 3 } });
    const res = makeMockRes();

    await handleConfirm(req, res);

    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: mockSig.id, alreadyConfirmed: true }),
    });
  });

  it('EMPLOYEE cannot confirm another employee — employeeId is forced to own', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP,
      jti: 'jti-1',
    });

    vi.mocked(confirmMonth).mockResolvedValue({ signature: mockSig, created: true });

    // Body tries to set another employee's ID — should be ignored for EMPLOYEE role
    const req = makeReq({ body: { year: 2026, month: 3, employeeId: 'other-emp-id' } });
    const res = makeMockRes();

    await handleConfirm(req, res);

    // The service must have been called with the token's employeeId, not the body's
    expect(confirmMonth).toHaveBeenCalledWith(EMP, 2026, 3, USER_ID, ORG, mockDb);
  });

  it('throws 422 when year is missing from body', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP,
      jti: 'jti-1',
    });

    const req = makeReq({ body: { month: 3 } }); // year missing
    const res = makeMockRes();

    await expect(handleConfirm(req, res)).rejects.toMatchObject({ status: 422, code: 'INVALID_PARAMS' });
  });
});

// ---------------------------------------------------------------------------
// handleGetSummary
// ---------------------------------------------------------------------------

describe('handleGetSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('EMPLOYEE is forced to own employeeId and gets summary', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP,
      jti: 'jti-1',
    });

    const summary = {
      employeeId: EMP,
      year: 2026,
      month: 3,
      hours: null,
      confirmed: false,
      confirmedAt: null,
      hasOpenEntry: false,
      totalAbsenceDays: 0,
      entries: [],
    };
    vi.mocked(getMonthlySummary).mockResolvedValue(summary);

    const req = makeReq({ query: { year: '2026', month: '3' } });
    const res = makeMockRes();

    await handleGetSummary(req, res);

    expect(getMonthlySummary).toHaveBeenCalledWith(EMP, 2026, 3, ORG, mockDb);
    expect(res.json).toHaveBeenCalledWith({ data: summary });
  });

  it('throws 422 when month is out of range in query', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'EMPLOYEE',
      employeeId: EMP,
      jti: 'jti-1',
    });

    const req = makeReq({ query: { year: '2026', month: '13' } }); // month=13 invalid
    const res = makeMockRes();

    await expect(handleGetSummary(req, res)).rejects.toMatchObject({ status: 422, code: 'INVALID_PARAMS' });
  });

  it('MANAGER can specify a different employeeId', async () => {
    const OTHER_EMP = '00000000-0000-0000-0000-000000000002';
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'MANAGER',
      employeeId: EMP,
      jti: 'jti-1',
    });

    const summary = {
      employeeId: OTHER_EMP,
      year: 2026,
      month: 3,
      hours: null,
      confirmed: true,
      confirmedAt: NOW.toISOString(),
      hasOpenEntry: false,
      totalAbsenceDays: 0,
      entries: [],
    };
    vi.mocked(getMonthlySummary).mockResolvedValue(summary);

    const req = makeReq({ query: { year: '2026', month: '3', employeeId: OTHER_EMP } });
    const res = makeMockRes();

    await handleGetSummary(req, res);

    expect(getMonthlySummary).toHaveBeenCalledWith(OTHER_EMP, 2026, 3, ORG, mockDb);
  });
});

// ---------------------------------------------------------------------------
// handleGetStatus
// ---------------------------------------------------------------------------

describe('handleGetStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDb).mockReturnValue(mockDb);
  });

  it('throws 422 when year is missing from status query', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'MANAGER',
      employeeId: EMP,
      jti: 'jti-1',
    });

    const req = makeReq({ query: { month: '3' } }); // year missing
    const res = makeMockRes();

    await expect(handleGetStatus(req, res)).rejects.toMatchObject({ status: 422, code: 'INVALID_PARAMS' });
  });

  it('MANAGER gets status list for given month', async () => {
    vi.mocked(getUser).mockReturnValue({
      userId: USER_ID,
      organizationId: ORG,
      role: 'MANAGER',
      employeeId: EMP,
      jti: 'jti-1',
    });

    const statusList = [
      { employeeId: EMP, firstName: 'Ana', lastName: 'Garcia', confirmed: true, confirmedAt: NOW.toISOString() },
      { employeeId: 'emp-2', firstName: 'Luis', lastName: 'Perez', confirmed: false, confirmedAt: null },
    ];
    vi.mocked(listConfirmationStatus).mockResolvedValue(statusList);

    const req = makeReq({ query: { year: '2026', month: '3' } });
    const res = makeMockRes();

    await handleGetStatus(req, res);

    expect(listConfirmationStatus).toHaveBeenCalledWith(2026, 3, undefined, mockDb);
    expect(res.json).toHaveBeenCalledWith({
      data: expect.objectContaining({
        items: statusList,
        summary: { total: 2, confirmed: 1, pending: 1 },
      }),
    });
  });
});
