import { describe, it, expect, vi } from 'vitest';
import { requireRole } from './require-role';
import { ApiError } from './error';

function makeReq(role: string) {
  return { user: { role } } as never;
}

const res = {} as never;

describe('requireRole', () => {
  it('calls next() with no args when the role matches', () => {
    const next = vi.fn();
    requireRole(['ADMIN'])(makeReq('ADMIN'), res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ApiError 403) when role is not in the allowed list', () => {
    const next = vi.fn();
    requireRole(['ADMIN'])(makeReq('MANAGER'), res, next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('calls next(ApiError 403) for EMPLOYEE when only ADMIN is allowed', () => {
    const next = vi.fn();
    requireRole(['ADMIN'])(makeReq('EMPLOYEE'), res, next);
    const err = next.mock.calls[0][0] as ApiError;
    expect(err.status).toBe(403);
  });

  it('allows any role that appears in the list', () => {
    const next = vi.fn();
    requireRole(['ADMIN', 'MANAGER'])(makeReq('MANAGER'), res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
