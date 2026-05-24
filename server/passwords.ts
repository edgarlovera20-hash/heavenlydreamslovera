import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const PREFIX = 'scrypt';
const VERSION = 'v1';

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isPasswordHash(value: any) {
  return String(value || '').startsWith(`${PREFIX}$${VERSION}$`);
}

export function hashPassword(plain: string) {
  const password = String(plain || '');
  if (!password) throw new Error('Password requerido');
  const salt = randomBytes(16).toString('base64url');
  const key = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${PREFIX}$${VERSION}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${key.toString('base64url')}`;
}

export function verifyPassword(plain: string, stored: string) {
  const password = String(plain || '');
  const value = String(stored || '');
  if (!password || !value) return false;

  if (isPasswordHash(value)) {
    const [algorithm, version, nRaw, rRaw, pRaw, salt, expectedRaw] = value.split('$');
    if (algorithm !== PREFIX || version !== VERSION || !salt || !expectedRaw) return false;
    const expected = Buffer.from(expectedRaw, 'base64url');
    const key = scryptSync(password, salt, expected.length, {
      N: Number(nRaw),
      r: Number(rRaw),
      p: Number(pRaw),
    });
    return safeEqual(key, expected);
  }

  if (/^[a-f0-9]{64}$/i.test(value)) {
    const hash = createHash('sha256').update(password).digest('hex');
    return safeEqual(Buffer.from(hash), Buffer.from(value));
  }

  return safeEqual(Buffer.from(password), Buffer.from(value));
}

export function needsPasswordRehash(stored: string) {
  return !isPasswordHash(stored);
}
