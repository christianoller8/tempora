import { describe, it, expect } from 'vitest';
import { maxDaily9h } from './max-daily';
import type { RuleContext, RuleSetConfig } from '../types';

const defaultCfg: RuleSetConfig = {
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5,
  params: {},
};

function makeCtx(candidate: RuleContext['candidate']): RuleContext {
  return {
    organizationId: 'org-1',
    employeeId: 'emp-1',
    candidate,
    recentAssignments: [],
    weekAssignments: [],
    annualOvertimeHours: 0,
  };
}

describe('maxDaily9h', () => {
  describe('assignment candidate', () => {
    it('returns null for exactly 9h shift', () => {
      const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '16:00' });
      expect(maxDaily9h.evaluate(ctx, defaultCfg)).toBeNull();
    });

    it('returns warn for 10h shift (exceeds 9h)', () => {
      const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '17:00' });
      const result = maxDaily9h.evaluate(ctx, defaultCfg);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('warn');
      expect(result?.code).toBe('MAX_DAILY_9H');
      expect(result?.meta?.['effectiveHours']).toBe(10);
    });

    it('returns null for 8h shift', () => {
      const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' });
      expect(maxDaily9h.evaluate(ctx, defaultCfg)).toBeNull();
    });

    it('correctly handles overnight shifts (22:00 → 07:00 = 9h)', () => {
      const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '22:00', endsAt: '07:00' });
      expect(maxDaily9h.evaluate(ctx, defaultCfg)).toBeNull();
    });

    it('correctly handles overnight shifts exceeding limit (22:00 → 08:00 = 10h)', () => {
      const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '22:00', endsAt: '08:00' });
      const result = maxDaily9h.evaluate(ctx, defaultCfg);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('warn');
      expect(result?.meta?.['effectiveHours']).toBe(10);
    });

    it('respects custom maxDailyHours', () => {
      const cfg8h = { ...defaultCfg, maxDailyHours: 8 };
      const ctx = makeCtx({ kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '16:00' }); // 9h
      const result = maxDaily9h.evaluate(ctx, cfg8h);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('warn');
    });
  });

  describe('timeEntry candidate', () => {
    it('returns null when clockOut is absent (open entry)', () => {
      const ctx = makeCtx({ kind: 'timeEntry', clockIn: '2026-06-15T07:00:00Z' });
      expect(maxDaily9h.evaluate(ctx, defaultCfg)).toBeNull();
    });

    it('returns warn when clock-out results in > 9h effective', () => {
      const ctx = makeCtx({
        kind: 'timeEntry',
        clockIn: '2026-06-15T07:00:00Z',
        clockOut: '2026-06-15T17:30:00Z', // 10.5h
      });
      const result = maxDaily9h.evaluate(ctx, defaultCfg);
      expect(result).not.toBeNull();
      expect(result?.type).toBe('warn');
      expect(result?.meta?.['effectiveHours']).toBeCloseTo(10.5);
    });

    it('returns null for exactly 9h time entry', () => {
      const ctx = makeCtx({
        kind: 'timeEntry',
        clockIn: '2026-06-15T07:00:00Z',
        clockOut: '2026-06-15T16:00:00Z',
      });
      expect(maxDaily9h.evaluate(ctx, defaultCfg)).toBeNull();
    });

    it('returns null for boundary at exactly maxDailyHours', () => {
      const ctx = makeCtx({
        kind: 'timeEntry',
        clockIn: '2026-06-15T08:00:00Z',
        clockOut: '2026-06-15T17:00:00Z', // exactly 9h
      });
      expect(maxDaily9h.evaluate(ctx, defaultCfg)).toBeNull();
    });
  });
});
