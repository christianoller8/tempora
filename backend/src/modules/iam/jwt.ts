import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env';

interface AccessPayload {
  sub: string;    // userId
  org: string;    // organizationId
  role: string;   // Role
  emp?: string;   // employeeId (optional — admins without HR record)
  jti: string;    // unique token ID for blocklist lookups
}

interface RefreshPayload {
  sub: string;    // userId
  jti: string;    // unique token ID for blocklist lookups
}

export type { AccessPayload, RefreshPayload };

/**
 * Signs a new access token with a freshly-generated jti.
 * TTL comes from `env.JWT_ACCESS_TTL` (default '15m').
 */
export function signAccessToken(payload: Omit<AccessPayload, 'jti'>): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload, jti }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Signs a new refresh token with a freshly-generated jti.
 * TTL comes from `env.JWT_REFRESH_TTL` (default '7d').
 */
export function signRefreshToken(payload: Omit<RefreshPayload, 'jti'>): string {
  const jti = randomUUID();
  return jwt.sign({ ...payload, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies an access token and returns the decoded payload.
 * Throws if the token is expired, tampered with, or otherwise invalid.
 */
export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload;
}

/**
 * Verifies a refresh token and returns the decoded payload.
 * Throws if the token is expired, tampered with, or otherwise invalid.
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload;
}
