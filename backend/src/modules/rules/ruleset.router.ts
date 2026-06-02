import { Router } from 'express';
import { asyncHandler } from '../../utils/async-handler.js';
import { requireRole } from '../../middleware/require-role.js';
import {
  handleListRuleSets,
  handleCreateRuleSet,
  handleUpdateRuleSet,
} from './ruleset.controller.js';

/**
 * RuleSet router — satisfies FR-RULES-2, FR-RULES-4
 * Mounted at /rule-sets in app.ts.
 * authenticate + tenantContext applied upstream.
 */
export const rulesetRouter = Router();

// GET /rule-sets — any authenticated user can view rule sets.
rulesetRouter.get('/', asyncHandler(handleListRuleSets));

// POST /rule-sets — ADMIN only.
rulesetRouter.post('/', requireRole(['ADMIN']), asyncHandler(handleCreateRuleSet));

// PATCH /rule-sets/:id — ADMIN only.
rulesetRouter.patch('/:id', requireRole(['ADMIN']), asyncHandler(handleUpdateRuleSet));
