import type { Rule, RuleCheckResult, RuleContext, RuleSetConfig } from '../types';

// ---------------------------------------------------------------------------
// WEEKLY_REST_1_5_DAYS rule
// The employee must have at least weeklyRestDays × 24 consecutive rest hours
// within any rolling 7-day window.
// Severity: warn (Art. 37.1 ET — 36h minimum statutory rest).
//
// Implementation strategy:
// The 7-day window is anchored on the candidate date (days 0..6 = candidate
// day - 6 through candidate day inclusive). We mark every day in the window
// as a work day or a rest day, then find the maximum consecutive run of rest
// days inside the window. If that maximum < weeklyRestDays × 24h → warn.
// ---------------------------------------------------------------------------

const HOURS_PER_DAY = 24;

function dayIndex(date: string): number {
  return Math.floor(new Date(date).getTime() / 86_400_000);
}

/**
 * Returns true if the given day index is fully covered by an approved absence.
 * Absence days count as rest days — they must not be counted as work days
 * when checking weekly rest compliance (FR-RULES-6).
 */
function isDayCoveredByAbsence(idx: number, absences: readonly { startDate: string; endDate: string }[]): boolean {
  for (const abs of absences) {
    const absStart = dayIndex(abs.startDate);
    const absEnd = dayIndex(abs.endDate);
    if (idx >= absStart && idx <= absEnd) return true;
  }
  return false;
}

export const weeklyRest: Rule = {
  code: 'WEEKLY_REST_1_5_DAYS',

  evaluate(ctx: RuleContext, cfg: RuleSetConfig): RuleCheckResult | null {
    if (ctx.candidate.kind !== 'assignment') return null;

    const requiredRestHours = cfg.weeklyRestDays * HOURS_PER_DAY;
    const absences = ctx.approvedAbsences ?? [];

    // Build the 7-day window ending on the candidate date (inclusive).
    const candidateIdx = dayIndex(ctx.candidate.date);
    const windowStart = candidateIdx - 6;

    // Create a boolean array: true = work day, false = rest day.
    // Default is rest day; we mark work days as we find them.
    const isWorkDay = new Array<boolean>(7).fill(false);

    // Mark candidate day as a work day (only if NOT covered by an absence).
    if (!isDayCoveredByAbsence(candidateIdx, absences)) {
      isWorkDay[6] = true; // index 6 = candidateIdx in the window
    }

    // Mark days from weekAssignments that fall within the window.
    // Days fully covered by an approved absence are excluded (treated as rest).
    for (const wa of ctx.weekAssignments) {
      const idx = dayIndex(wa.date);
      const offset = idx - windowStart;
      if (offset >= 0 && offset < 7) {
        if (!wa.restDay && !isDayCoveredByAbsence(idx, absences)) {
          isWorkDay[offset] = true;
        }
      }
    }

    // Find the longest consecutive run of rest days within the window.
    let maxRestRun = 0;
    let currentRun = 0;
    for (let i = 0; i < 7; i++) {
      if (!isWorkDay[i]) {
        currentRun++;
        if (currentRun > maxRestRun) maxRestRun = currentRun;
      } else {
        currentRun = 0;
      }
    }

    const maxRestHours = maxRestRun * HOURS_PER_DAY;

    if (maxRestHours < requiredRestHours) {
      return {
        type: 'warn',
        code: 'WEEKLY_REST_1_5_DAYS',
        message: `Insufficient weekly rest: ${maxRestHours}h maximum consecutive rest in 7-day window, ${requiredRestHours}h required (Art. 37.1 ET).`,
        meta: {
          maxRestHoursInWindow: maxRestHours,
          requiredRestHours,
        },
      };
    }

    return null;
  },
};
