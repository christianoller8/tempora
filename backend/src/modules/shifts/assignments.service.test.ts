import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAssignment } from './assignments.service';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';

// Mock the rules engine to control test outcomes.
vi.mock('../rules/index.js', () => ({
  ruleEngine: {
    check: vi.fn().mockReturnValue([]),
  },
}));

// Mock auditWriter to avoid DB dependency.
vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ruleEngine } from '../rules/index';

function makeMockDb(overrides: Partial<Record<string, unknown>> = {}): TenantClient {
  const defaultSchedule = { id: 'sched-1', status: 'DRAFT', centerId: 'c-1' };
  const defaultTemplate = { id: 'tmpl-1', startTime: '07:00', endTime: '15:00' };
  const defaultAssignment = {
    id: 'assign-1',
    organizationId: 'org-1',
    employeeId: 'emp-1',
    scheduleId: 'sched-1',
    shiftTemplateId: 'tmpl-1',
    departmentId: null,
    date: new Date('2026-06-15'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    shiftSchedule: { findUnique: vi.fn().mockResolvedValue(defaultSchedule) },
    shiftTemplate: { findUnique: vi.fn().mockResolvedValue(defaultTemplate) },
    ruleSet: { findFirst: vi.fn().mockResolvedValue(null) }, // null → use defaults
    shiftAssignment: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(defaultAssignment),
    },
    absence: { findMany: vi.fn().mockResolvedValue([]) }, // P4-9: approved absences
    $queryRaw: vi.fn().mockResolvedValue([{ total: 0 }]),
    ...overrides,
  } as unknown as TenantClient;
}

const baseDto = {
  scheduleId: 'sched-1',
  employeeId: 'emp-1',
  shiftTemplateId: 'tmpl-1',
  date: '2026-06-15',
};

describe('createAssignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ruleEngine.check).mockReturnValue([]);
  });

  it('creates assignment when no rule violations', async () => {
    const db = makeMockDb();
    const result = await createAssignment(baseDto, 'org-1', 'user-1', db);
    expect(result.assignment.id).toBe('assign-1');
    expect(result.warnings).toHaveLength(0);
    expect((db as ReturnType<typeof makeMockDb>).shiftAssignment.create).toHaveBeenCalledOnce();
  });

  it('throws 409 when schedule is not DRAFT', async () => {
    const db = makeMockDb({
      shiftSchedule: { findUnique: vi.fn().mockResolvedValue({ id: 'sched-1', status: 'PUBLISHED' }) },
    });
    await expect(createAssignment(baseDto, 'org-1', 'user-1', db)).rejects.toThrow(
      expect.objectContaining({ status: 409, code: 'SCHEDULE_NOT_DRAFT' }),
    );
  });

  it('throws 404 when schedule not found', async () => {
    const db = makeMockDb({
      shiftSchedule: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(createAssignment(baseDto, 'org-1', 'user-1', db)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
  });

  it('throws 404 when shift template not found', async () => {
    const db = makeMockDb({
      shiftTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    await expect(createAssignment(baseDto, 'org-1', 'user-1', db)).rejects.toThrow(
      expect.objectContaining({ status: 404, code: 'NOT_FOUND' }),
    );
  });

  it('throws 422 RULE_VIOLATION when BLOCK violations exist (AC-RULES-1)', async () => {
    vi.mocked(ruleEngine.check).mockReturnValue([
      { type: 'block', code: 'MIN_REST_12H', message: 'Insufficient rest', meta: {} },
    ]);
    const db = makeMockDb();
    const err = await createAssignment(baseDto, 'org-1', 'user-1', db).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe('RULE_VIOLATION');
    // Assignment must NOT be persisted on BLOCK.
    expect((db as ReturnType<typeof makeMockDb>).shiftAssignment.create).not.toHaveBeenCalled();
  });

  it('returns warnings without throwing when only WARN violations exist', async () => {
    vi.mocked(ruleEngine.check).mockReturnValue([
      { type: 'warn', code: 'MAX_DAILY_9H', message: 'Daily hours exceeded', meta: {} },
    ]);
    const db = makeMockDb();
    const result = await createAssignment(baseDto, 'org-1', 'user-1', db);
    expect(result.assignment).toBeDefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.code).toBe('MAX_DAILY_9H');
    // Assignment IS persisted when only warnings.
    expect((db as ReturnType<typeof makeMockDb>).shiftAssignment.create).toHaveBeenCalledOnce();
  });

  it('calls ruleEngine.check with assembled RuleContext', async () => {
    const db = makeMockDb();
    await createAssignment(baseDto, 'org-1', 'user-1', db);
    expect(ruleEngine.check).toHaveBeenCalledOnce();
    const [ctx, cfg] = vi.mocked(ruleEngine.check).mock.calls[0]!;
    expect(ctx.candidate.kind).toBe('assignment');
    if (ctx.candidate.kind === 'assignment') {
      expect(ctx.candidate.date).toBe('2026-06-15');
      expect(ctx.candidate.startsAt).toBe('07:00');
    }
    expect(cfg.minRestHours).toBe(12); // default when no ruleSet in DB
  });

  it('uses org-specific RuleSet when available (AC-RULES-2)', async () => {
    const db = makeMockDb({
      ruleSet: {
        findFirst: vi.fn().mockResolvedValue({
          minRestHours: 10,
          maxDailyHours: 9,
          maxAnnualOvertime: 80,
          weeklyRestDays: 1.5,
          params: {},
        }),
      },
    });
    await createAssignment(baseDto, 'org-1', 'user-1', db);
    const [, cfg] = vi.mocked(ruleEngine.check).mock.calls[0]!;
    expect(cfg.minRestHours).toBe(10); // org override applied
  });
});
