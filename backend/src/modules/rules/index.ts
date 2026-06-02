import type { Rule, RuleEngine, RuleCheckResult } from './types.js';
import { minRest12h } from './rules/min-rest.js';
import { maxDaily9h } from './rules/max-daily.js';
import { maxAnnualOt80h } from './rules/max-annual-ot.js';
import { weeklyRest } from './rules/weekly-rest.js';
import type { RuleContext, RuleSetConfig } from './types.js';

// ---------------------------------------------------------------------------
// Rules Registry and Engine (design §6)
// Pure domain service — no Express, no Prisma, no I/O.
// All rules run deterministically; multiple violations are all reported
// (no short-circuit) per spec FR-RULES-3 and Constraints §rules-engine.
// ---------------------------------------------------------------------------

export const REGISTRY: Rule[] = [minRest12h, maxDaily9h, maxAnnualOt80h, weeklyRest];

export const ruleEngine: RuleEngine = {
  check(context: RuleContext, ruleSet: RuleSetConfig): RuleCheckResult[] {
    return REGISTRY
      .map((rule) => rule.evaluate(context, ruleSet))
      .filter((r): r is RuleCheckResult => r !== null);
  },
};

// Re-export types for convenience
export type { RuleContext, RuleSetConfig, RuleCheckResult, Rule, RuleEngine };
