import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRuleSet, updateRuleSet, listRuleSets } from './ruleset.service';
import type { TenantClient } from '../../db/tenant';
import { ApiError } from '../../middleware/error';

vi.mock('../../audit/audit-writer.js', () => ({
  auditWriter: {
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

import { auditWriter } from '../../audit/audit-writer';

const ORG = 'org-1';
const ADMIN_ID = 'admin-1';

const baseRuleSet = {
  id: 'rs-1',
  organizationId: ORG,
  name: 'Convenio General',
  isDefault: true,
  minRestHours: 12,
  maxDailyHours: 9,
  maxAnnualOvertime: 80,
  weeklyRestDays: 1.5,
  params: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeMockDb(overrides: Partial<Record<string, unknown>> = {}): TenantClient {
  return {
    ruleSet: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(baseRuleSet),
      findMany: vi.fn().mockResolvedValue([baseRuleSet]),
      create: vi.fn().mockResolvedValue(baseRuleSet),
      update: vi.fn().mockResolvedValue(baseRuleSet),
    },
    ...overrides,
  } as unknown as TenantClient;
}

describe('createRuleSet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a RuleSet with provided config', async () => {
    const db = makeMockDb();
    const result = await createRuleSet(
      { name: 'Convenio General', isDefault: true },
      ORG,
      ADMIN_ID,
      db,
    );
    expect(result.name).toBe('Convenio General');
    expect(auditWriter.write).toHaveBeenCalledWith(
      db,
      ADMIN_ID,
      ORG,
      expect.objectContaining({ action: 'CREATE', entityType: 'RuleSet' }),
    );
  });

  it('throws 409 when name conflicts with existing RuleSet', async () => {
    const db = makeMockDb({
      ruleSet: {
        findFirst: vi.fn().mockResolvedValue(baseRuleSet), // name exists
        findUnique: vi.fn().mockResolvedValue(baseRuleSet),
        findMany: vi.fn().mockResolvedValue([baseRuleSet]),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    await expect(
      createRuleSet({ name: 'Convenio General' }, ORG, ADMIN_ID, db),
    ).rejects.toThrow(expect.objectContaining({ status: 409, code: 'RULESET_NAME_CONFLICT' }));
  });

  it('applies statutory defaults when params omitted', async () => {
    const createSpy = vi.fn().mockResolvedValue(baseRuleSet);
    const db = makeMockDb({
      ruleSet: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(baseRuleSet),
        findMany: vi.fn().mockResolvedValue([baseRuleSet]),
        create: createSpy,
        update: vi.fn(),
      },
    });
    await createRuleSet({ name: 'Statutory' }, ORG, ADMIN_ID, db);
    const [callArg] = createSpy.mock.calls[0] as [{ data: { minRestHours: number } }];
    expect(callArg.data.minRestHours).toBe(12);
  });
});

describe('updateRuleSet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('partially updates the RuleSet and writes audit row', async () => {
    const updated = { ...baseRuleSet, minRestHours: 10 };
    const db = makeMockDb({
      ruleSet: {
        findFirst: vi.fn().mockResolvedValue(null), // no name conflict
        findUnique: vi.fn().mockResolvedValue(baseRuleSet),
        findMany: vi.fn().mockResolvedValue([baseRuleSet]),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue(updated),
      },
    });
    const result = await updateRuleSet('rs-1', { minRestHours: 10 }, ORG, ADMIN_ID, db);
    expect(Number(result.minRestHours)).toBe(10);
    expect(auditWriter.write).toHaveBeenCalledWith(
      db,
      ADMIN_ID,
      ORG,
      expect.objectContaining({ action: 'UPDATE', entityType: 'RuleSet' }),
    );
  });

  it('throws 404 when RuleSet does not exist', async () => {
    const db = makeMockDb({
      ruleSet: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    await expect(
      updateRuleSet('missing', { name: 'new' }, ORG, ADMIN_ID, db),
    ).rejects.toThrow(expect.objectContaining({ status: 404, code: 'NOT_FOUND' }));
  });
});

describe('listRuleSets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns all RuleSets for the org', async () => {
    const db = makeMockDb();
    const result = await listRuleSets(ORG, db);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Convenio General');
  });

  it('returns empty array when no rule sets configured', async () => {
    const db = makeMockDb({
      ruleSet: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
      },
    });
    const result = await listRuleSets(ORG, db);
    expect(result).toHaveLength(0);
  });
});
