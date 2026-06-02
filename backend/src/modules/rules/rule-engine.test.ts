import { describe, it, expect } from 'vitest';
import { ruleEngine, REGISTRY } from './index';
import type { RuleContext, RuleSetConfig } from './types';

const defaultCfg: RuleSetConfig = {
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5,
  params: {},
};

function makeBaseCtx(): RuleContext {
  return {
    organizationId: 'org-1',
    employeeId: 'emp-1',
    candidate: { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
    recentAssignments: [],
    weekAssignments: [],
    annualOvertimeHours: 0,
  };
}

describe('ruleEngine (integration)', () => {
  it('REGISTRY contains exactly 4 rules', () => {
    expect(REGISTRY).toHaveLength(4);
  });

  it('returns empty array when no rules are violated', () => {
    const ctx = makeBaseCtx();
    const results = ruleEngine.check(ctx, defaultCfg);
    expect(results).toHaveLength(0);
  });

  it('returns all triggered violations (no short-circuit)', () => {
    // Trigger both MIN_REST and MAX_DAILY by having a too-close shift AND a long shift
    const ctx: RuleContext = {
      ...makeBaseCtx(),
      // Long shift: 07:00 → 17:00 = 10h → triggers MAX_DAILY warn
      candidate: { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '17:00' },
      // Previous shift ended 01:00 — only 6h gap → triggers MIN_REST block
      recentAssignments: [{ date: '2026-06-14', startsAt: '17:00', endsAt: '01:00' }],
    };
    const results = ruleEngine.check(ctx, defaultCfg);
    const codes = results.map((r) => r.code);
    expect(codes).toContain('MIN_REST_12H');
    expect(codes).toContain('MAX_DAILY_9H');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('does not produce side effects — no DB calls possible (pure function test)', () => {
    // This is a structural test: the engine function only calls evaluate() on rules
    // and returns an array. We verify it returns a plain array with no async behavior.
    const ctx = makeBaseCtx();
    const result = ruleEngine.check(ctx, defaultCfg);
    expect(Array.isArray(result)).toBe(true);
    // Not a Promise
    expect(result instanceof Promise).toBe(false);
  });

  it('returns BLOCK results mixed with WARN results', () => {
    // Trigger: MIN_REST (block) + MAX_DAILY (warn)
    // prev ends 22:00 Jun-14; candidate starts 07:00 Jun-15 → 9h gap → BLOCK (< 12h)
    // candidate 07:00 → 17:00 = 10h → WARN (> 9h daily)
    const ctx: RuleContext = {
      ...makeBaseCtx(),
      candidate: { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '17:00' },
      recentAssignments: [{ date: '2026-06-14', startsAt: '14:00', endsAt: '22:00' }],
    };
    const results = ruleEngine.check(ctx, defaultCfg);
    const types = results.map((r) => r.type);
    expect(types).toContain('block');
    expect(types).toContain('warn');
  });

  it('respects org-specific ruleSet overrides', () => {
    const customCfg: RuleSetConfig = {
      minRestHours: 10,   // lenient
      maxDailyHours: 12,  // generous
      maxAnnualOvertime: 100,
      weeklyRestDays: 1.5,
      params: {},
    };
    // 11h gap to prev shift — ok with 10h rule, blocked with 12h rule
    const ctx: RuleContext = {
      ...makeBaseCtx(),
      recentAssignments: [{ date: '2026-06-14', startsAt: '12:00', endsAt: '20:00' }],
      candidate: { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '15:00' },
    };
    expect(ruleEngine.check(ctx, customCfg)).toHaveLength(0);
  });

  it('blocks on annual OT cap: 78h + 3h OT assignment = 81h (AC-RULES-3)', () => {
    const ctx: RuleContext = {
      ...makeBaseCtx(),
      annualOvertimeHours: 78,
      candidate: { kind: 'assignment', date: '2026-06-15', startsAt: '07:00', endsAt: '19:00' }, // 12h → 3h OT
    };
    const results = ruleEngine.check(ctx, defaultCfg);
    const blocked = results.filter((r) => r.type === 'block');
    expect(blocked.some((r) => r.code === 'MAX_ANNUAL_OT_80H')).toBe(true);
  });
});
