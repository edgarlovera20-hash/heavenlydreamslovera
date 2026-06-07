import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const DEFAULT_JWT_SECRET = 'dev-heavenly-dreams-change-me';
let warnedDerivedKey = false;

export function encryptionKey() {
  const configured = String(process.env.SECRETS_ENCRYPTION_KEY || '').trim();
  if (configured) {
    const raw = /^[A-Za-z0-9_-]{43,}$/.test(configured)
      ? Buffer.from(configured, 'base64url')
      : Buffer.from(configured, 'base64');
    return raw.length === 32 ? raw : createHash('sha256').update(configured).digest();
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SECRETS_ENCRYPTION_KEY es obligatoria en producción');
  }

  const fallback = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  if (!warnedDerivedKey) {
    warnedDerivedKey = true;
    console.warn('[Vault] SECRETS_ENCRYPTION_KEY no configurada; usando clave derivada de JWT_SECRET solo para desarrollo.');
  }
  return createHash('sha256').update(`heavenly-dreams-secret-vault:${fallback}`).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string) {
  const [version, iv, tag, encrypted] = String(value || '').split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Secreto cifrado inválido');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
