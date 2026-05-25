// Local auth store — replaces Firebase
export interface LocalUser {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
}

export const auth: { currentUser: LocalUser | null } = {
  currentUser: null,
};

try {
  const saved = localStorage.getItem('hd_session');
  if (saved) auth.currentUser = JSON.parse(saved);
} catch {
  // ignore
}

export const db = {};

// SHA-256 hashing for passwords (Web Crypto API — no extra deps)
export async function hashPassword(plain: string): Promise<string> {
  const bytes = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  // Backwards compatible: if stored value isn't a 64-char hex hash, compare plaintext.
  if (/^[a-f0-9]{64}$/i.test(stored)) {
    return (await hashPassword(plain)) === stored;
  }
  return plain === stored;
}
