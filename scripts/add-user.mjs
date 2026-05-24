import Database from 'better-sqlite3';
import { randomBytes, randomUUID, scryptSync } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'heavenlydreams.db'));

const email = process.env.HD_ADMIN_EMAIL || '';
const username = process.env.HD_ADMIN_USERNAME || '';
const password = process.env.HD_ADMIN_PASSWORD || '';
const nombre = process.env.HD_ADMIN_NAME || username || email;
const role = process.env.HD_ADMIN_ROLE || 'GERENTE';

function usage() {
  console.error([
    'Faltan variables para crear/actualizar usuario.',
    'Uso:',
    '  HD_ADMIN_EMAIL=persona@dominio.com HD_ADMIN_USERNAME=persona HD_ADMIN_PASSWORD="..." node scripts/add-user.mjs',
    'Opcional:',
    '  HD_ADMIN_NAME="Nombre" HD_ADMIN_ROLE=GERENTE',
  ].join('\n'));
  process.exit(1);
}

function hashPassword(plain) {
  const salt = randomBytes(16).toString('base64url');
  const key = scryptSync(String(plain), salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$v1$16384$8$1$${salt}$${key.toString('base64url')}`;
}

if (!email || !username || !password) usage();

const existing = db.prepare('SELECT uid, activo FROM users WHERE email=? OR username=?').get(email, username);
const storedPassword = hashPassword(password);

if (existing) {
  db.prepare("UPDATE users SET activo=1, password=?, updated_at=datetime('now') WHERE uid=?").run(storedPassword, existing.uid);
  console.log('Usuario actualizado y habilitado. UID:', existing.uid);
} else {
  const uid = randomUUID();
  db.prepare(`
    INSERT INTO users (uid, nombre, email, username, role, password, activo)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(uid, nombre, email, username, role, storedPassword);
  console.log('Usuario creado. UID:', uid);
}

db.close();
console.log(`Listo. Usuario=${username}. La contraseña no se imprime ni se guarda en claro.`);
