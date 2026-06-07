import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../server/crypto-helpers.ts';

describe('encryptSecret / decryptSecret', () => {
  it('encrypt then decrypt returns original value', () => {
    const original = 'super-secret-api-key-12345';
    const encrypted = encryptSecret(original);
    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(original);
  });

  it('two encryptions of the same value differ (random IV)', () => {
    const value = 'same-value';
    const enc1 = encryptSecret(value);
    const enc2 = encryptSecret(value);
    expect(enc1).not.toBe(enc2);
  });

  it('encrypted format starts with v1:', () => {
    const encrypted = encryptSecret('test');
    expect(encrypted).toMatch(/^v1:/);
  });
});

describe('decryptSecret error handling', () => {
  it('throws on invalid format (missing version)', () => {
    expect(() => decryptSecret('not-a-valid-format')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => decryptSecret('')).toThrow();
  });

  it('throws on tampered data (corrupted encrypted portion)', () => {
    const encrypted = encryptSecret('real-secret');
    // tamper with the last segment (the encrypted body)
    const parts = encrypted.split(':');
    parts[3] = 'AAAAAAAAAAAAAAAAAAAAAA'; // replace encrypted payload
    const tampered = parts.join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const encrypted = encryptSecret('real-secret');
    const parts = encrypted.split(':');
    parts[2] = 'AAAAAAAAAAAAAAAAAAA'; // replace auth tag
    const tampered = parts.join(':');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
