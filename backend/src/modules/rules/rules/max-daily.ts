import type { Rule, RuleCheckResult, RuleContext, RuleSetConfig } from '../types';

// ---------------------------------------------------------------------------
// MAX_DAILY_9H rule
// Effective worked hours in a single work-day must not exceed ruleSet.maxDailyHours.
// For assignments: compute duration from startsAt to endsAt minus breakMinutes.
// For timeEntry: compute duration from clockIn to clockOut.
// Severity: warn (advisory) per design §6.
// ---------------------------------------------------------------------------

function toMinutes(wallClock: string): number {
  const [h, m] = wallClock.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/**
 * Returns duration in hours for an assignment, handling overnight shifts.
 * breakMinutes is not available in RuleContext — treated as 0 at this layer
 * (the service layer may subtract break from endsAt before building context).
 */
function assignmentHours(startsAt: string, endsAt: string): number {
  const startMin = toMinutes(startsAt);
  const endMin = toMinutes(endsAt);
  const durationMin = endMin >= startMin
    ? endMin - startMin
    : 24 * 60 - startMin + endMin; // crosses midnight
  return durationMin / 60;
}

function timeEntryHours(clockIn: string, clockOut: string): number {
  const start = new Date(clockIn).getTime();
  const end = new Date(clockOut).getTime();
  return (end - start) / (1000 * 60 * 60);
}

function dayIndex(date: string): number {
  return Math.floor(new Date(date).getTime() / 86_400_000);
}

function isDayCoveredByAbsence(idx: number, absences: readonly { startDate: string; endDate: string }[]): boolean {
  for (const abs of absences) {
    const absStart = dayIndex(abs.startDate);
    const absEnd = dayIndex(abs.endDate);
    if (idx >= absStart && idx <= absEnd) return true;
  }
  return false;
}

export const maxDaily9h: Rule = {
  code: 'MAX_DAILY_9H',

  evaluate(ctx: RuleContext, cfg: RuleSetConfig): RuleCheckResult | null {
    let effectiveHours: number;

    if (ctx.candidate.kind === 'assignment') {
      // If the candidate date is fully covered by an approved absence, skip the rule.
      const absences = ctx.approvedAbsences ?? [];
      const candidateIdx = dayIndex(ctx.candidate.date);
      if (isDayCoveredByAbsence(candidateIdx, absences)) return null;

      effectiveHours = assignmentHours(ctx.candidate.startsAt, ctx.candidate.endsAt);
    } else if (ctx.candidate.kind === 'timeEntry') {
      if (!ctx.candidate.clockOut) return null; // no clock-out yet, nothing to check

      // If the clock-in day is covered by an approved absence, skip (e.g., admin override).
      const absences = ctx.approvedAbsences ?? [];
      const clockInIdx = dayIndex(ctx.candidate.clockIn);
      if (isDayCoveredByAbsence(clockInIdx, absences)) return null;

      effectiveHours = timeEntryHours(ctx.candidate.clockIn, ctx.candidate.clockOut);
    } else {
      return null;
    }

    if (effectiveHours > cfg.maxDailyHours) {
      return {
        type: 'warn',
        code: 'MAX_DAILY_9H',
        message: `Daily hours exceeded: ${effectiveHours.toFixed(1)}h worked, ${cfg.maxDailyHours}h maximum (Art. 34.3 ET).`,
        meta: {
          effectiveHours,
          maxDailyHours: cfg.maxDailyHours,
        },
      };
    }

    return null;
  },
};
