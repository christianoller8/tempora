import type { Request, Response } from 'express';
import { getDb, getUser } from '../../db-context';
import { createRuleSet, updateRuleSet, listRuleSets } from './ruleset.service';

// ---------------------------------------------------------------------------
// RuleSet controller — satisfies FR-RULES-2, FR-RULES-4
// ADMIN-only on write operations (enforced in router via requireRole).
// ---------------------------------------------------------------------------

/**
 * GET /rule-sets
 * Lists all RuleSets for the org. Default ruleset marked with isDefault=true.
 */
export async function handleListRuleSets(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();

  const ruleSets = await listRuleSets(user.organizationId, db);
  res.json({ data: ruleSets });
}

/**
 * POST /rule-sets
 * Creates a new RuleSet. ADMIN only.
 */
export async function handleCreateRuleSet(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const body = req.body as {
    name: string;
    isDefault?: boolean;
    minRestHours?: number;
    maxDailyHours?: number;
    maxAnnualOvertime?: number;
    weeklyRestDays?: number;
    params?: Record<string, unknown>;
  };

  const ruleSet = await createRuleSet(body, user.organizationId, user.userId, db);
  res.status(201).json({ data: ruleSet });
}

/**
 * PATCH /rule-sets/:id
 * Partially updates a RuleSet. ADMIN only.
 */
export async function handleUpdateRuleSet(req: Request, res: Response): Promise<void> {
  const user = getUser();
  const db = getDb();
  const body = req.body as {
    name?: string;
    isDefault?: boolean;
    minRestHours?: number;
    maxDailyHours?: number;
    maxAnnualOvertime?: number;
    weeklyRestDays?: number;
    params?: Record<string, unknown>;
  };

  const ruleSet = await updateRuleSet(req.params['id'] as string, body, user.organizationId, user.userId, db);
  res.json({ data: ruleSet });
}
