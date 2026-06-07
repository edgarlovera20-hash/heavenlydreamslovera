import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, needsPasswordRehash } from '../server/passwords.ts';

describe('hashPassword', () => {
  it('produces scrypt$v1$ format', () => {
    const hash = hashPassword('mysecretpassword');
    expect(hash).toMatch(/^scrypt\$v1\$/);
  });

  it('throws when password is empty', () => {
    expect(() => hashPassword('')).toThrow();
  });
});

describe('verifyPassword', () => {
  it('returns true for correct password', () => {
    const plain = 'correct-horse-battery';
    const hash = hashPassword(plain);
    expect(verifyPassword(plain, hash)).toBe(true);
  });

  it('returns false for wrong password', () => {
    const hash = hashPassword('correct-password');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('returns false for empty plain password', () => {
    const hash = hashPassword('some-password');
    expect(verifyPassword('', hash)).toBe(false);
  });

  it('returns false for empty stored hash', () => {
    expect(verifyPassword('some-password', '')).toBe(false);
  });

  it('returns false for both empty inputs', () => {
    expect(verifyPassword('', '')).toBe(false);
  });
});

describe('needsPasswordRehash', () => {
  it('returns false for scrypt hash', () => {
    const hash = hashPassword('password123');
    expect(needsPasswordRehash(hash)).toBe(false);
  });

  it('returns true for sha256 hex string', () => {
    // 64-char hex string (sha256 format)
    const sha256Hex = 'a'.repeat(64);
    expect(needsPasswordRehash(sha256Hex)).toBe(true);
  });

  it('returns true for plain text', () => {
    expect(needsPasswordRehash('plaintext')).toBe(true);
  });
});
