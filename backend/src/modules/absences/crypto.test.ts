import { describe, it, expect } from 'vitest';
import { encryptCause, decryptCause } from './crypto';
import { randomBytes } from 'node:crypto';

// Generate a valid 32-byte key for tests.
const TEST_KEY = randomBytes(32).toString('base64');

describe('crypto — AES-256-GCM field encryption', () => {
  it('round-trip: decrypted plaintext matches original', () => {
    const plaintext = 'Diagnóstico: gripe estacional';
    const ciphertext = encryptCause(plaintext, TEST_KEY);
    expect(decryptCause(ciphertext, TEST_KEY)).toBe(plaintext);
  });

  it('different plaintexts produce different ciphertexts', () => {
    const a = encryptCause('cause A', TEST_KEY);
    const b = encryptCause('cause B', TEST_KEY);
    expect(a.toString('hex')).not.toBe(b.toString('hex'));
  });

  it('same plaintext produces different ciphertexts each time (random IV)', () => {
    const plaintext = 'same message';
    const a = encryptCause(plaintext, TEST_KEY);
    const b = encryptCause(plaintext, TEST_KEY);
    expect(a.toString('hex')).not.toBe(b.toString('hex'));
  });

  it('wrong key fails to decrypt (throws)', () => {
    const ciphertext = encryptCause('secret cause', TEST_KEY);
    const wrongKey = randomBytes(32).toString('base64');
    expect(() => decryptCause(ciphertext, wrongKey)).toThrow();
  });

  it('tampered ciphertext fails GCM auth tag verification', () => {
    const ciphertext = encryptCause('sensitive', TEST_KEY);
    // Flip a byte in the ciphertext portion (past IV + tag).
    const tampered = Buffer.from(ciphertext);
    tampered[28] ^= 0xff;
    expect(() => decryptCause(tampered, TEST_KEY)).toThrow();
  });

  it('encryptCause returns a Buffer', () => {
    const result = encryptCause('test', TEST_KEY);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('throws when key is not 32 bytes', () => {
    const badKey = Buffer.from('tooshort').toString('base64');
    expect(() => encryptCause('test', badKey)).toThrow(/32 bytes/);
  });
});
