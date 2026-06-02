import { describe, it, expect } from 'vitest';
import { minRest12h } from './min-rest';
import type { RuleContext, RuleSetConfig } from '../types';

const defaultCfg: RuleSetConfig = {
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5,
  params: {},
};

function makeCtx(
  candidate: RuleContext['candidate'],
  recentAssignments: RuleContext['recentAssignments'] = [],
): RuleContext {
  return {
    organizationId: 'org-1',
    employeeId: 'emp-1',
    candidate,
    recentAssignments,
    weekAssignments: [],
    annualOvertimeHours: 0,
  };
}

describe('minRest12h', () => {
  it('returns null when candidate is a timeEntry (not applicable)', () => {
    const ctx = makeCtx({ kind: 'timeEntry', clockIn: '2026-06-15T07:00:00Z' });
    expect(minRest12h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('returns null when there are no previous assignments', () => {
    const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' });
    expect(minRest12h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('blocks when gap is 8h (less than 12h required)', () => {
    // Previous shift ends 23:00 on Jun-14; candidate starts 07:00 Jun-15 → 8h gap → block
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      [{ date: '2026-06-14', startsAt: '15:00', endsAt: '23:00' }],
    );
    const result = minRest12h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
    expect(result?.code).toBe('MIN_REST_12H');
    expect((result?.meta?.['actualRestHours'] as number)).toBeLessThan(12);
  });

  it('blocks on exact scenario: prev ends 23:00 Jun-14, candidate starts 07:00 Jun-15 (8h gap)', () => {
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      [{ date: '2026-06-14', startsAt: '15:00', endsAt: '23:00' }],
    );
    const result = minRest12h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
    expect(result?.meta?.['actualRestHours']).toBe(8);
  });

  it('passes when gap is exactly 12h', () => {
    // prev ends 19:00 Jun-14, candidate starts 07:00 Jun-15 → gap = 12h exactly
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      [{ date: '2026-06-14', startsAt: '11:00', endsAt: '19:00' }],
    );
    expect(minRest12h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('blocks when overnight shift ends 06:00 and candidate starts 07:00 (only 1h gap)', () => {
    // prev: Jun-14 22:00 → Jun-15 06:00 (overnight); candidate: Jun-15 07:00 → 1h gap → BLOCK
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      [{ date: '2026-06-14', startsAt: '22:00', endsAt: '06:00' }],
    );
    const result = minRest12h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
  });

  it('handles overnight previous shift correctly (crosses midnight)', () => {
    // prev: Jun-14 22:00 → Jun-15 06:00 (overnight, ends 06:00 Jun-15)
    // candidate: Jun-15 20:00 → Jun-16 04:00  → gap = 14h → pass
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '20:00', endsAt: '04:00' },
      [{ date: '2026-06-14', startsAt: '22:00', endsAt: '06:00' }],
    );
    expect(minRest12h.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('respects org-specific override (10h rest threshold)', () => {
    const cfg10h = { ...defaultCfg, minRestHours: 10 };
    // gap = 11h → should pass with 10h rule
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      [{ date: '2026-06-14', startsAt: '12:00', endsAt: '20:00' }], // ends 20:00, 11h gap to 07:00
    );
    expect(minRest12h.evaluate(ctx, cfg10h)).toBeNull();
  });

  it('uses the most recent (closest) previous shift when multiple exist', () => {
    // Two prev shifts: one with 15h gap (fine), one with 8h gap (violation)
    const ctx = makeCtx(
      { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
      [
        { date: '2026-06-13', startsAt: '07:00', endsAt: '15:00' }, // 40h gap — fine
        { date: '2026-06-14', startsAt: '15:00', endsAt: '23:00' }, // 8h gap — violation
      ],
    );
    const result = minRest12h.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('block');
  });
});
