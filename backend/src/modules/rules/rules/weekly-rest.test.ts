import { describe, it, expect } from 'vitest';
import { weeklyRest } from './weekly-rest';
import type { RuleContext, RuleSetConfig, WeekAssignment } from '../types';

const defaultCfg: RuleSetConfig = {
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5, // 36h required
  params: {},
};

function makeCtx(
  candidateDate: string,
  weekAssignments: WeekAssignment[],
): RuleContext {
  return {
    organizationId: 'org-1',
    employeeId: 'emp-1',
    candidate: { kind: 'assignment', date: candidateDate, startsAt: '07:00', endsAt: '15:00' },
    recentAssignments: [],
    weekAssignments,
    annualOvertimeHours: 0,
  };
}

// Helper: build weekAssignments where all days are work days except rest days specified.
function workWeek(
  startDate: string,
  restDayIndices: number[] = [],
): WeekAssignment[] {
  const base = new Date(startDate).getTime();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    return { date, restDay: restDayIndices.includes(i) };
  });
}

describe('weeklyRest', () => {
  it('returns null for a timeEntry candidate (not applicable)', () => {
    const ctx: RuleContext = {
      organizationId: 'org-1',
      employeeId: 'emp-1',
      candidate: { kind: 'timeEntry', clockIn: '2026-06-15T07:00:00Z' },
      recentAssignments: [],
      weekAssignments: [],
      annualOvertimeHours: 0,
    };
    expect(weeklyRest.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('returns null when no weekAssignments and candidate is alone (6 rest days in window)', () => {
    const ctx = makeCtx('2026-06-15', []);
    expect(weeklyRest.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('warns when 7 consecutive work days (no rest in window)', () => {
    // All 7 days are work days → 0h consecutive rest → below 36h threshold
    const week = workWeek('2026-06-09'); // Jun 9 to Jun 15, all work
    // Candidate is Jun 15 (last day); week context covers Jun 9–14
    const nonCandidateDays = week.filter((w) => w.date !== '2026-06-15');
    const ctx = makeCtx('2026-06-15', nonCandidateDays);
    const result = weeklyRest.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('warn');
    expect(result?.code).toBe('WEEKLY_REST_1_5_DAYS');
  });

  it('passes when 2 consecutive rest days exist in the window (48h > 36h)', () => {
    // Window: Jun9(work), Jun10(work), Jun11(work), Jun12(work), Jun13(rest), Jun14(rest), Jun15(work=candidate)
    // Max consecutive rest = 2 days = 48h > 36h → no violation
    const week = workWeek('2026-06-09', [4, 5]); // index 4=Jun 13, index 5=Jun 14 are rest
    const nonCandidateDays = week.filter((w) => w.date !== '2026-06-15');
    const ctx = makeCtx('2026-06-15', nonCandidateDays);
    expect(weeklyRest.evaluate(ctx, defaultCfg)).toBeNull();
  });

  it('warns when only 1 rest day (24h) exists in the window (24h < 36h required)', () => {
    // Window: Jun9-13 work, Jun14 rest, Jun15 work(candidate)
    // Max consecutive rest = 1 day = 24h < 36h → warn
    const week = workWeek('2026-06-09', [5]); // index 5=Jun 14 is rest
    const nonCandidateDays = week.filter((w) => w.date !== '2026-06-15');
    const ctx = makeCtx('2026-06-15', nonCandidateDays);
    const result = weeklyRest.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('warn');
  });

  it('warns when only 24h (1 day) of rest in window with 1.5 day requirement', () => {
    // 6 work days, 1 rest day → 24h max consecutive rest < 36h required
    const week = workWeek('2026-06-09', [6]); // only Jun 15 rest (but candidate is Jun 15, so it's a work day)
    // All 6 previous days are work, candidate is 7th work day → only 0h rest
    const nonCandidateDays = week.filter((w) => w.date !== '2026-06-15');
    const ctx = makeCtx('2026-06-15', nonCandidateDays.map((w) => ({ ...w, restDay: false })));
    const result = weeklyRest.evaluate(ctx, defaultCfg);
    expect(result).not.toBeNull();
    expect(result?.type).toBe('warn');
  });

  it('respects custom weeklyRestDays config (1.0 = 24h)', () => {
    const cfg1day = { ...defaultCfg, weeklyRestDays: 1.0 }; // only 24h required
    // 6 work days with 1 rest day → 24h rest → exactly meets 24h requirement
    const week = workWeek('2026-06-09', [5]); // Jun 14 is rest
    const nonCandidateDays = week.filter((w) => w.date !== '2026-06-15');
    const ctx = makeCtx('2026-06-15', nonCandidateDays);
    expect(weeklyRest.evaluate(ctx, cfg1day)).toBeNull();
  });
});
