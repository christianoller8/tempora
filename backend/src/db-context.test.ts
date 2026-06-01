import { describe, it, expect } from 'vitest';
import { requestContext, getDb, getUser } from './db-context';

const mockDb = {} as Parameters<typeof getDb>[never];
const mockUser = { userId: 'u1', organizationId: 'o1', role: 'ADMIN' as const, jti: 'jti-1' };

describe('getDb', () => {
  it('throws when called outside a tenant context', () => {
    expect(() => getDb()).toThrow('No tenant context');
  });

  it('returns the db client when inside a tenant context', () => {
    return requestContext.run({ db: mockDb as never, user: mockUser }, () => {
      expect(getDb()).toBe(mockDb);
    });
  });
});

describe('getUser', () => {
  it('throws when called outside a tenant context', () => {
    expect(() => getUser()).toThrow('No auth context');
  });

  it('returns the user when inside a tenant context', () => {
    return requestContext.run({ db: mockDb as never, user: mockUser }, () => {
      expect(getUser()).toBe(mockUser);
    });
  });
});
