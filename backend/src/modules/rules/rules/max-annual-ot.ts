import type { Rule, RuleCheckResult, RuleContext, RuleSetConfig } from '../types';

// ---------------------------------------------------------------------------
// MAX_ANNUAL_OT_80H rule
// Accumulated annual overtime + candidate overtime must not exceed
// ruleSet.maxAnnualOvertime (default 80h — Art. 35.2 ET).
// Severity: block.
// ---------------------------------------------------------------------------

/**
 * Computes the overtime hours contributed by the candidate.
 * For an assignment: hours beyond maxDailyHours.
 * For a timeEntry with clockOut: hours beyond maxDailyHours.
 */
function candidateOvertimeHours(ctx: RuleContext, cfg: RuleSetConfig): number {
  if (ctx.candidate.kind === 'assignment') {
    const startMin = toMinutes(ctx.candidate.startsAt);
    const endMin = toMinutes(ctx.candidate.endsAt);
    const durationMin = endMin >= startMin
      ? endMin - startMin
      : 24 * 60 - startMin + endMin;
    const durationHours = durationMin / 60;
    return Math.max(0, durationHours - cfg.maxDailyHours);
  }

  if (ctx.candidate.kind === 'timeEntry' && ctx.candidate.clockOut) {
    const start = new Date(ctx.candidate.clockIn).getTime();
    const end = new Date(ctx.candidate.clockOut).getTime();
    const durationHours = (end - start) / (1000 * 60 * 60);
    return Math.max(0, durationHours - cfg.maxDailyHours);
  }

  return 0;
}

function toMinutes(wallClock: string): number {
  const [h, m] = wallClock.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export const maxAnnualOt80h: Rule = {
  code: 'MAX_ANNUAL_OT_80H',

  evaluate(ctx: RuleContext, cfg: RuleSetConfig): RuleCheckResult | null {
    const candidateOT = candidateOvertimeHours(ctx, cfg);
    if (candidateOT === 0) return null; // candidate doesn't generate OT; skip

    const projectedTotal = ctx.annualOvertimeHours + candidateOT;

    if (projectedTotal > cfg.maxAnnualOvertime) {
      return {
        type: 'block',
        code: 'MAX_ANNUAL_OT_80H',
        message: `Annual overtime cap exceeded: ${projectedTotal.toFixed(1)}h projected, ${cfg.maxAnnualOvertime}h maximum (Art. 35.2 ET).`,
        meta: {
          currentAnnualOt: ctx.annualOvertimeHours,
          candidateOt: candidateOT,
          projectedTotal,
          maxAnnualOvertime: cfg.maxAnnualOvertime,
        },
      };
    }

    return null;
  },
};
