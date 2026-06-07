// @ts-ignore
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { encryptSecret, decryptSecret } from '../crypto-helpers';

export { randomUUID, encryptSecret, decryptSecret };

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'data', 'heavenlydreams.db');

// Ensure data directory exists
mkdirSync(join(__dirname, '..', '..', 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('cache_size = -32000');  // 32MB page cache
db.pragma('temp_store = memory');

export default db;
export { db };

// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

export function pickAllowed(data: any, allowed: string[]) {
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
  }
  return out;
}

export function updateById(table: string, idColumn: string, id: string, data: any, allowed: string[]) {
  const clean = pickAllowed(data || {}, allowed);
  const keys = Object.keys(clean);
  if (!keys.length) return { changes: 0 };
  const fields = keys.map(k => `${k}=@${k}`).join(',');
  return db.prepare(`UPDATE ${table} SET ${fields},updated_at=datetime('now') WHERE ${idColumn}=@id`).run({ ...clean, id });
}

export function parseJson(value: any, fallback: any = null) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function encryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  try { return encryptSecret(value); } catch { return value; }
}

export function decryptField(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('v1:')) return value;
  try { return decryptSecret(value); } catch { return null; }
}
