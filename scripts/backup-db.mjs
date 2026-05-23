import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const source = process.env.SQLITE_DB_PATH || join(process.cwd(), 'data', 'heavenlydreams.db');
const targetRoot = process.env.BACKUP_TARGET || join(process.cwd(), 'data', 'backups');

if (!existsSync(source)) {
  console.error(`No existe la base SQLite: ${source}`);
  process.exit(1);
}

mkdirSync(targetRoot, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = join(targetRoot, `${basename(source)}.${stamp}.bak`);
copyFileSync(source, target);
console.log(`Backup creado: ${target}`);
