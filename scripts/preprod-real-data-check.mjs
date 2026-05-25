import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);

const appFiles = tracked.filter(file =>
  /^(src|server)\//.test(file.replace(/\\/g, '/')) &&
  /\.(ts|tsx|js|jsx)$/.test(file)
);

const forbiddenPrefix = 'adh' + 'dreams_';
const forbiddenPatterns = [
  forbiddenPrefix + 'sales',
  forbiddenPrefix + 'users',
  forbiddenPrefix + 'tickets',
  forbiddenPrefix + 'siac',
  forbiddenPrefix + 'morosidad',
  forbiddenPrefix + 'commission_rules',
  forbiddenPrefix + 'package_catalog',
  forbiddenPrefix + 'referrals',
  forbiddenPrefix + 'validation_requests',
  forbiddenPrefix + 'audit_log',
  forbiddenPrefix + 'territories',
  forbiddenPrefix + 'channels',
];

const failures = [];
for (const file of appFiles) {
  const full = join(root, file);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (text.includes(pattern)) failures.push(`${file}: usa ${pattern} como fuente local`);
  }
}

if (failures.length) {
  console.error('Preproduccion real-data check fallo:');
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}

console.log('OK: no hay fuentes de verdad operativas en localStorage legacy.');
