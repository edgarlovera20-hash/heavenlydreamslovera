import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/)
  .filter(Boolean);

const operationalDataPatterns = [
  /^server\/siac-data\.csv$/i,
  /^server\/source-data\/.*\.(csv|xlsx|xls)$/i,
  /^data\/.*\.(csv|xlsx|xls|sqlite|db)$/i,
];

const findings = tracked
  .filter(file => operationalDataPatterns.some(pattern => pattern.test(file.replaceAll('\\', '/'))))
  .map(file => {
    const full = join(root, file);
    return {
      file,
      kb: existsSync(full) ? statSync(full).size / 1024 : 0,
    };
  });

console.log('Repository data audit');
if (!findings.length) {
  console.log('OK: no tracked operational CSV/XLSX/database files found.');
  process.exit(0);
}

for (const finding of findings) {
  console.log(`WARN: tracked operational data candidate: ${finding.file} (${finding.kb.toFixed(1)} KB)`);
}

if (process.env.STRICT_DATA_AUDIT === 'true') {
  console.error('FAIL: tracked operational data candidates are not allowed when STRICT_DATA_AUDIT=true.');
  process.exit(1);
}

console.log('OK: audit completed in warning mode. Set STRICT_DATA_AUDIT=true to fail on tracked data candidates.');

