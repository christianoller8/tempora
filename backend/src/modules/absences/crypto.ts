import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// ---------------------------------------------------------------------------
// AES-256-GCM field-level encryption for GDPR special-category data.
// Used exclusively for Absence.causeEncrypted — the IT sick-leave cause.
//
// Key: 32-byte value encoded as base64 (44 chars), from env.FIELD_ENCRYPTION_KEY.
// Format: [12-byte IV][16-byte auth tag][N-byte ciphertext]
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * @param plaintext  - The sensitive text to encrypt (e.g., IT absence cause).
 * @param keyBase64  - 32-byte encryption key encoded as base64 (44 chars).
 * @returns Buffer with layout: [12 IV bytes][16 auth-tag bytes][ciphertext bytes]
 */
export function encryptCause(plaintext: string, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`FIELD_ENCRYPTION_KEY must decode to 32 bytes; got ${key.length}`);
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Layout: IV | TAG | CIPHERTEXT
  return Buffer.concat([iv, tag, encrypted]);
}

/**
 * Decrypts a ciphertext buffer produced by encryptCause.
 *
 * @param ciphertext - Buffer with layout [12 IV bytes][16 tag bytes][ciphertext].
 * @param keyBase64  - Same 32-byte key used for encryption, base64-encoded.
 * @returns Decrypted plaintext string.
 * @throws If the key is wrong or the ciphertext has been tampered with.
 */
export function decryptCause(ciphertext: Buffer, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error(`FIELD_ENCRYPTION_KEY must decode to 32 bytes; got ${key.length}`);
  }

  const iv = ciphertext.subarray(0, IV_BYTES);
  const tag = ciphertext.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const encrypted = ciphertext.subarray(IV_BYTES + TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}
