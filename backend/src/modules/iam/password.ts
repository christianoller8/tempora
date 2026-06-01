import argon2 from 'argon2';

/**
 * Hashes a plaintext password using argon2id.
 * The resulting hash is safe to store in the database.
 * The plaintext is never logged or returned.
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

/**
 * Verifies a plaintext password against a stored argon2id hash.
 * Returns `true` if the password matches, `false` otherwise.
 * The plaintext is never logged or returned.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // argon2.verify throws on malformed hashes — treat as mismatch, not an error.
    return false;
  }
}
