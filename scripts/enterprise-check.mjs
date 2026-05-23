import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

const packageJson = readJson('package.json');
if (packageJson.dependencies?.['whatsapp-web.js']) {
  fail('Dependencia legada whatsapp-web.js sigue instalada; Baileys debe ser el motor único.');
}

if (existsSync(join(root, 'server', 'google-vision-credentials.json'))) {
  fail('server/google-vision-credentials.json existe. Rota esa llave y usa variables de entorno.');
}

const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/);

const envExample = readFileSync(join(root, '.env.example'), 'utf8');
for (const required of [
  'JWT_SECRET',
  'DATABASE_URL',
  'REDIS_URL',
  'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  'DOCUMENT_STORAGE_DIR',
  'TWILIO_ACCOUNT_SID',
  'WEBAUTHN_RP_ID',
]) {
  if (!envExample.includes(required)) fail(`.env.example no documenta ${required}.`);
}

for (const runtimeDir of ['.baileys_auth', 'data/document_storage']) {
  const gitignore = readFileSync(join(root, '.gitignore'), 'utf8');
  if (!gitignore.includes(runtimeDir)) warn(`.gitignore no menciona ${runtimeDir}.`);
}

const sourceFiles = tracked.filter(file =>
  /\.(ts|tsx|js|json|env|md)$/.test(file) &&
  !file.startsWith('package-lock') &&
  !file.startsWith('node_modules/'));
for (const file of sourceFiles) {
  if (!existsSync(join(root, file))) continue;
  const text = readFileSync(join(root, file), 'utf8');
  if (/-----BEGIN PRIVATE KEY-----/.test(text)) fail(`Llave privada detectada en ${file}.`);
}

console.log('Enterprise check');
for (const message of warnings) console.log(`WARN: ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`FAIL: ${message}`);
  process.exit(1);
}
console.log('OK: seguridad base, secretos, env y dependencias críticas revisadas.');
