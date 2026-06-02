import type { Rule, RuleCheckResult, RuleContext, RuleSetConfig } from '../types.js';

// ---------------------------------------------------------------------------
// MIN_REST_12H rule
// Gap between the end of the most-recent previous assignment and the start
// of the candidate assignment must be >= ruleSet.minRestHours.
// Handles overnight shifts (endsAt < startsAt on the same date).
// ---------------------------------------------------------------------------

/**
 * Parses "HH:MM" wall-clock string to total minutes from midnight.
 */
function toMinutes(wallClock: string): number {
  const [h, m] = wallClock.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Returns the absolute start timestamp in minutes since epoch-day-0 for an
 * assignment, using a zero-based day index derived from the ISO date string.
 * Only the relative gap between two assignments matters, so the epoch anchor
 * does not need to be real calendar time — we just need consistent arithmetic.
 */
function assignmentStartMs(date: string, startsAt: string): number {
  const d = new Date(date);
  const dayIndex = Math.floor(d.getTime() / 86_400_000);
  return dayIndex * 24 * 60 + toMinutes(startsAt);
}

/**
 * Returns the end timestamp in minutes for an assignment.
 * If the shift crosses midnight (endsAt < startsAt), the end is on day + 1.
 */
function assignmentEndMs(date: string, startsAt: string, endsAt: string): number {
  const startMin = toMinutes(startsAt);
  const endMin = toMinutes(endsAt);
  const crossesMidnight = endMin < startMin;

  const d = new Date(date);
  const dayIndex = Math.floor(d.getTime() / 86_400_000);
  const endDayIndex = crossesMidnight ? dayIndex + 1 : dayIndex;
  return endDayIndex * 24 * 60 + endMin;
}

export const minRest12h: Rule = {
  code: 'MIN_REST_12H',

  evaluate(ctx: RuleContext, cfg: RuleSetConfig): RuleCheckResult | null {
    if (ctx.candidate.kind !== 'assignment') return null;

    const { date, startsAt } = ctx.candidate;
    const candidateStart = assignmentStartMs(date, startsAt);

    let closestGapHours = Infinity;
    let closestEnd = -Infinity;

    for (const prev of ctx.recentAssignments) {
      const prevEnd = assignmentEndMs(prev.date, prev.startsAt, prev.endsAt);

      // Only consider previous shifts that end BEFORE the candidate starts.
      // We also skip assignments on the exact same start time (duplicates).
      if (prevEnd >= candidateStart) continue;

      if (prevEnd > closestEnd) {
        closestEnd = prevEnd;
        closestGapHours = (candidateStart - prevEnd) / 60;
      }
    }

    if (closestEnd === -Infinity) return null; // no prior assignments to check

    if (closestGapHours < cfg.minRestHours) {
      return {
        type: 'block',
        code: 'MIN_REST_12H',
        message: `Insufficient rest between shifts: ${closestGapHours.toFixed(1)}h actual, ${cfg.minRestHours}h required (Art. 34.3 ET).`,
        meta: {
          actualRestHours: closestGapHours,
          requiredRestHours: cfg.minRestHours,
        },
      };
    }

    return null;
  },
};
