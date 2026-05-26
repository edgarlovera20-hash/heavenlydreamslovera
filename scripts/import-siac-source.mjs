import { importSiacSource, SIAC_IMPORTER_VERSION } from '../server/source-data-importer.ts';
import { Settings, SiacRecords } from '../server/db.ts';

const sourcePath = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
const replace = !process.argv.includes('--append');

if (!sourcePath) {
  console.error('Uso: npx tsx scripts/import-siac-source.mjs <archivo.csv|xlsx> [--append]');
  process.exit(1);
}

const before = SiacRecords.count();
const result = await importSiacSource({ sourcePath, replace });
Settings.set('siac_primary_source_fingerprint', result.fingerprint);
Settings.set('siac_primary_importer_version', SIAC_IMPORTER_VERSION);
const after = SiacRecords.count();

console.log(JSON.stringify({ ok: true, before, after, ...result }, null, 2));
