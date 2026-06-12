import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const distDir = join(root, 'dist');
const assetsDir = join(distDir, 'assets');

const budgets = [
  { label: 'web css', pattern: /^assets\/app-.*\.css$/, maxKb: 520 },
  { label: 'mobile css', pattern: /^assets\/mobile-.*\.css$/, maxKb: 360 },
  { label: 'maps vendor js', pattern: /^assets\/vendor-maps-.*\.js$/, maxKb: 1100 },
  { label: 'pdf vendor js', pattern: /^assets\/vendor-pdf-.*\.js$/, maxKb: 650 },
  { label: 'charts vendor js', pattern: /^assets\/vendor-charts-.*\.js$/, maxKb: 450 },
  { label: 'mobile entry js', pattern: /^assets\/mobile-.*\.js$/, maxKb: 120 },
  { label: 'new sale form js', pattern: /^assets\/NewSaleForm-.*\.js$/, maxKb: 140 },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

if (!existsSync(assetsDir)) {
  console.error('Bundle budget check requires dist/assets. Run `npm run build` first.');
  process.exit(1);
}

const files = walk(distDir).map(full => ({
  path: relative(distDir, full).replaceAll('\\', '/'),
  kb: statSync(full).size / 1024,
}));

const failures = [];
for (const budget of budgets) {
  const matches = files.filter(file => budget.pattern.test(file.path));
  if (matches.length === 0) {
    failures.push(`${budget.label}: no matching asset found`);
    continue;
  }
  for (const file of matches) {
    if (file.kb > budget.maxKb) {
      failures.push(`${file.path}: ${file.kb.toFixed(1)} KB exceeds ${budget.maxKb} KB budget`);
    }
  }
}

console.log('Bundle budget check');
if (failures.length) {
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  process.exit(1);
}
for (const budget of budgets) {
  const matches = files.filter(file => budget.pattern.test(file.path));
  for (const file of matches) {
    console.log(`OK: ${file.path} ${file.kb.toFixed(1)} KB <= ${budget.maxKb} KB`);
  }
}

