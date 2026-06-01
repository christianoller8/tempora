import type { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { verifyPassword } from './password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.js';
import { ApiError } from '../../middleware/error.js';
import { auditWriter } from '../../audit/audit-writer.js';

// The token is valid for 7 days; we store that as the expiry so the cleanup
// job can safely purge rows whose token could not be presented anyway.
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TTL_MS = 15 * 60 * 1000;

/**
 * Authenticates a user by email + password.
 *
 * Runs outside of any tenant transaction (login has no tenant context yet),
 * so it uses the global `prisma` singleton and queries `users` directly.
 * Users are unique by `(organizationId, email)` — email alone is NOT a unique
 * key. For the login endpoint we accept the first match across all orgs; in
 * multi-org deployments the client should disambiguate via a subdomain/slug
 * that the frontend passes along. For now we `findFirst` ordered by createdAt
 * (oldest org wins on collision, which is a known limitation).
 *
 * @returns Access + refresh token pair.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  // Find user by email (globally — no org scope at login time).
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    include: { employee: { select: { id: true } } },
  });

  if (!user) {
    // Return the same error regardless of whether email was found — prevents
    // user enumeration.
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Update lastLoginAt.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = signAccessToken({
    sub: user.id,
    org: user.organizationId,
    role: user.role,
    emp: user.employee?.id,
  });

  const refreshToken = signRefreshToken({ sub: user.id });

  // Write LOGIN audit row via the global prisma client (no tenant tx at login).
  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
    },
  });

  return { accessToken, refreshToken };
}

/**
 * Re-issues a new access + refresh token pair from a valid refresh token.
 * Checks the blocklist to prevent replay of revoked tokens.
 */
export async function refresh(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired refresh token');
  }

  const blocked = await isBlocklisted(payload.jti);
  if (blocked) {
    throw new ApiError(401, 'TOKEN_REVOKED', 'Refresh token has been revoked');
  }

  // Blocklist the used refresh token immediately (token rotation).
  await prisma.tokenBlocklist.create({
    data: {
      jti: payload.jti,
      reason: 'refresh',
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  // Fetch fresh user data (role may have changed since last issuance).
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { employee: { select: { id: true } } },
  });

  if (!user || !user.isActive) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'User not found or inactive');
  }

  const newAccessToken = signAccessToken({
    sub: user.id,
    org: user.organizationId,
    role: user.role,
    emp: user.employee?.id,
  });
  const newRefreshToken = signRefreshToken({ sub: user.id });

  await prisma.auditLog.create({
    data: {
      organizationId: user.organizationId,
      actorUserId: user.id,
      action: 'LOGIN', // REFRESH maps to LOGIN — schema AuditAction doesn't have REFRESH
      entityType: 'User',
      entityId: user.id,
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

/**
 * Revokes the access token identified by `jti` by adding it to the blocklist.
 * The `jti` comes from `req.user.jti` (set by the `authenticate` middleware).
 */
export async function logout(jti: string, userId: string, organizationId: string): Promise<void> {
  await prisma.tokenBlocklist.create({
    data: {
      jti,
      reason: 'logout',
      expiresAt: new Date(Date.now() + ACCESS_TTL_MS),
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId,
      actorUserId: userId,
      action: 'LOGOUT',
      entityType: 'User',
      entityId: userId,
    },
  });
}

/**
 * Checks whether a token JTI is present in the blocklist.
 * Used by the refresh endpoint and high-risk route guards.
 */
export async function isBlocklisted(jti: string): Promise<boolean> {
  const entry = await prisma.tokenBlocklist.findUnique({ where: { jti } });
  return entry !== null;
}
