import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'data', 'heavenlydreams.db'));

const email = 'edgarlovera20@gmail.com';
const username = 'edgarlovera20';
const password = 'Elovera1964';
const nombre = 'Edgar Lovera';
const role = 'GERENTE';

const existing = db.prepare('SELECT uid, activo FROM users WHERE email=? OR username=?').get(email, username);

if (existing) {
  db.prepare("UPDATE users SET activo=1, password=?, updated_at=datetime('now') WHERE uid=?").run(password, existing.uid);
  console.log('Usuario actualizado y habilitado. UID:', existing.uid);
} else {
  const uid = randomUUID();
  db.prepare(`
    INSERT INTO users (uid, nombre, email, username, role, password, activo)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(uid, nombre, email, username, role, password);
  console.log('Usuario creado. UID:', uid);
}

db.close();
console.log('Listo. Credenciales: usuario=' + username + ' / contraseña=' + password);
