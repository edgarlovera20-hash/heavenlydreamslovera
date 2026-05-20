import { createReadStream, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import * as path from 'path';

const INPUT  = path.join(__dirname, 'siac_import.csv');
const OUTPUT = path.join(__dirname, 'siac_clean.csv');

const COL_FOLIO = 3;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  result.push(current.trim());
  return result;
}

function rowScore(row: string[]): number {
  return row.filter(c => c && c !== '0').length;
}

async function main() {
  console.log('🧹 Limpiando CSV SIAC...\n');

  const rows: string[][] = [];
  let header = '';

  await new Promise<void>((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(INPUT), crlfDelay: Infinity });
    let firstLine = true;
    rl.on('line', (line) => {
      if (firstLine) { header = line; firstLine = false; return; }
      if (line.trim()) rows.push(parseCsvLine(line));
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });

  console.log(`📄 Filas originales:      ${rows.length}`);

  // Step 1 — remove exact duplicate rows
  const seen = new Set<string>();
  const noDups: string[][] = [];
  for (const row of rows) {
    const key = row.join('|');
    if (!seen.has(key)) { seen.add(key); noDups.push(row); }
  }
  console.log(`🗑️  Duplicados exactos eliminados: ${rows.length - noDups.length}`);

  // Step 2 — deduplicate by FOLIO SIAC keeping most complete row
  const byFolio = new Map<string, string[]>();
  for (const row of noDups) {
    const folio = row[COL_FOLIO]?.trim();
    if (!folio) continue;
    const existing = byFolio.get(folio);
    if (!existing || rowScore(row) > rowScore(existing)) {
      byFolio.set(folio, row);
    }
  }
  console.log(`🗂️  Folios únicos restantes: ${byFolio.size}`);
  console.log(`📉 Total eliminado: ${rows.length - byFolio.size} filas\n`);

  // Step 3 — write clean CSV
  const lines = [header];
  for (const row of byFolio.values()) {
    lines.push(row.map(c => (c.includes(',') ? `"${c}"` : c)).join(','));
  }
  writeFileSync(OUTPUT, lines.join('\n'), 'utf8');

  console.log(`✅ CSV limpio guardado en: siac_clean.csv`);
  console.log(`   Registros finales: ${byFolio.size}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
