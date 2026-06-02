import { describe, it, expect } from 'vitest';
import { maxAnnualOt80h } from './max-annual-ot.js';
import type { RuleContext, RuleSetConfig } from '../types.js';

const defaultCfg: RuleSetConfig = {
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5,
  params: {},
};

function makeCtx(
  candidate: RuleContext['candidate'],
  annualOvertimeHours: number,
): RuleContext {
  return {
    organizationId: 'org-1',
    employeeId: 'emp-1',
    candidate,
    recentAssignments: [],
    weekAssignments: [],
    annualOvertimeHours,
  };
}

describe('maxAnnualOt80h', () => {
  it('returns null for a normal 8h shift that generates no OT', () => {
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      75,
    );
    expect(maxAnnualOt80h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('blocks when accumulated OT + candidate OT exceeds 80h cap (AC-RULES-3)', () => {
    // 78h accumulated + 3h candidate OT = 81h → block
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '19:00' }, // 12h → 3h OT
      78,
    );
    const result = maxAnnualOt80h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
    expect(result?.code).toBe('MAX_ANNUAL_OT_80H');
    expect(result?.meta?.['projectedTotal']).toBe(81);
  });

  it('passes when projected total is exactly 80h', () => {
    // 77h accumulated + 3h OT = exactly 80h → pass (not exceeding)
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '19:00' }, // 12h → 3h OT
      77,
    );
    expect(maxAnnualOt80h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('blocks when projected total just exceeds 80h (80.1h)', () => {
    // 79.5h accumulated + 1h OT (10h shift) = 80.5h → block
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '17:00' }, // 10h → 1h OT
      79.5,
    );
    const result = maxAnnualOt80h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
  });

  it('handles timeEntry candidate with clockOut generating OT', () => {
    // 75h accumulated; clock out after 11h session (2h OT) → 77h total → no block
    const ctx = makeCtx(
      {
        kind: 'timeEntry',
        clockIn: '2026-06-15T07:00:00Z',
        clockOut: '2026-06-15T18:00:00Z', // 11h → 2h OT
      },
      75,
    );
    expect(maxAnnualOt80h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('blocks timeEntry when accumulated + candidate exceeds cap', () => {
    // 79h accumulated; 11h session → 2h OT → total 81h → block
    const ctx = makeCtx(
      {
        kind: 'timeEntry',
        clockIn: '2026-06-15T07:00:00Z',
        clockOut: '2026-06-15T18:00:00Z', // 11h → 2h OT
      },
      79,
    );
    const result = maxAnnualOt80h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
  });

  it('returns null for open timeEntry (no clockOut)', () => {
    const ctx = makeCtx(
      { kind: 'timeEntry', clockIn: '2026-06-15T07:00:00Z' },
      79,
    );
    expect(maxAnnualOt80h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('respects custom org maxAnnualOvertime', () => {
    const cfg100h = { ...defaultCfg, maxAnnualOvertime: 100 };
    // 79h accumulated + 3h OT = 82h → within 100h limit → pass
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '19:00' },
      79,
    );
    expect(maxAnnualOt80h.evaluate(ctx, cfg100h)).toBeNull();
  });
});
