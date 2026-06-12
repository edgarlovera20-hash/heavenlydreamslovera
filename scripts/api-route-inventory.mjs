import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'server.ts',
  'server/didit.ts',
  'server/avatar/avatar.service.ts',
  'server/finance-enterprise.ts',
];

const routePattern = /app\.(get|post|put|patch|delete)\(([^,\n]+),\s*([^,\n)]+)/g;
const routes = [];

function normalizeGuard(rawGuard) {
  const guard = rawGuard.trim();
  if (guard.startsWith('requireRole(')) return 'requireRole(...)';
  if (guard.startsWith('wrap(')) return 'public/wrapped handler';
  if (guard === '(_req' || guard === '(req') return 'public inline handler';
  return guard;
}

for (const file of files) {
  const full = join(root, file);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, 'utf8');
  for (const match of text.matchAll(routePattern)) {
    const [, method, rawPath, rawGuard] = match;
    routes.push({
      file,
      method: method.toUpperCase(),
      path: rawPath.trim().replace(/^["'`]|["'`]$/g, ''),
      guard: normalizeGuard(rawGuard),
    });
  }
}

const byGuard = new Map();
for (const route of routes) {
  byGuard.set(route.guard, (byGuard.get(route.guard) || 0) + 1);
}

console.log('# API route inventory\n');
console.log(`Total routes discovered: ${routes.length}\n`);
console.log('## Routes by guard\n');
console.log('| Guard | Routes |');
console.log('| --- | ---: |');
for (const [guard, count] of [...byGuard.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  console.log(`| \`${guard.replaceAll('|', '\\|')}\` | ${count} |`);
}

console.log('\n## Routes by file\n');
console.log('| File | Routes |');
console.log('| --- | ---: |');
for (const file of files) {
  const count = routes.filter(route => route.file === file).length;
  if (count > 0) console.log(`| \`${file}\` | ${count} |`);
}
