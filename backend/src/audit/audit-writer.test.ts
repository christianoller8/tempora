import { describe, it, expect, vi } from 'vitest';
import { AuditWriter } from './audit-writer';
import type { TenantClient } from '../db/tenant';

function makeMockDb() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  } as unknown as TenantClient;
}

describe('AuditWriter.write', () => {
  it('calls db.auditLog.create exactly once', async () => {
    const db = makeMockDb();
    const writer = new AuditWriter();
    await writer.write(db, 'actor-1', 'org-1', { action: 'CREATE', entityType: 'Employee', entityId: 'emp-1' });
    expect((db as ReturnType<typeof makeMockDb>).auditLog.create).toHaveBeenCalledOnce();
  });

  it('persists all required fields on the audit row', async () => {
    const db = makeMockDb();
    const writer = new AuditWriter();
    const event = { action: 'UPDATE' as const, entityType: 'TimeEntry', entityId: 'te-1', before: { status: 'OPEN' }, after: { status: 'CLOSED' } };
    await writer.write(db, 'actor-2', 'org-2', event);
    const [call] = (db as ReturnType<typeof makeMockDb>).auditLog.create.mock.calls;
    expect(call[0].data).toMatchObject({
      organizationId: 'org-2',
      actorUserId: 'actor-2',
      action: 'UPDATE',
      entityType: 'TimeEntry',
      entityId: 'te-1',
      before: { status: 'OPEN' },
      after: { status: 'CLOSED' },
    });
  });

  it('captures ip and userAgent from the optional request object', async () => {
    const db = makeMockDb();
    const writer = new AuditWriter();
    const mockReq = {
      ip: '127.0.0.1',
      header: vi.fn().mockReturnValue('Mozilla/5.0'),
    } as never;
    await writer.write(db, 'actor-3', 'org-3', { action: 'LOGIN', entityType: 'Session' }, mockReq);
    const [call] = (db as ReturnType<typeof makeMockDb>).auditLog.create.mock.calls;
    expect(call[0].data.ip).toBe('127.0.0.1');
    expect(call[0].data.userAgent).toBe('Mozilla/5.0');
  });

  it('sets ip and userAgent to null when no request is provided', async () => {
    const db = makeMockDb();
    const writer = new AuditWriter();
    await writer.write(db, 'actor-4', 'org-4', { action: 'LOGOUT', entityType: 'Session' });
    const [call] = (db as ReturnType<typeof makeMockDb>).auditLog.create.mock.calls;
    expect(call[0].data.ip).toBeNull();
    expect(call[0].data.userAgent).toBeNull();
  });
});
