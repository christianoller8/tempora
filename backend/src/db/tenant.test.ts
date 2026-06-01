import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withTenant } from './tenant';
import { prisma } from './prisma';

vi.mock('./prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe('withTenant', () => {
  const mockExecuteRaw = vi.fn().mockResolvedValue(1);
  const mockTx = { $executeRaw: mockExecuteRaw } as unknown as Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation(
      (fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
    mockExecuteRaw.mockClear();
  });

  it('wraps fn in a Prisma transaction', async () => {
    await withTenant('org-1', vi.fn().mockResolvedValue(null));
    expect(prisma.$transaction).toHaveBeenCalledOnce();
  });

  it('calls $executeRaw once to set app.current_org', async () => {
    await withTenant('org-1', vi.fn().mockResolvedValue(null));
    expect(mockExecuteRaw).toHaveBeenCalledOnce();
  });

  it('passes the organizationId as the interpolated value in set_config', async () => {
    const orgId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    await withTenant(orgId, vi.fn().mockResolvedValue(null));
    // Tagged template: fn`...${x}...` → fn(strings, x). Second arg is the orgId.
    expect(mockExecuteRaw.mock.calls[0][1]).toBe(orgId);
  });

  it('passes the transaction client to fn', async () => {
    const fn = vi.fn().mockResolvedValue(null);
    await withTenant('org-1', fn);
    expect(fn).toHaveBeenCalledWith(mockTx);
  });

  it('returns the value resolved by fn', async () => {
    const result = await withTenant('org-1', vi.fn().mockResolvedValue({ id: '42' }));
    expect(result).toEqual({ id: '42' });
  });
});
