import { PrismaClient, SaleStatus } from '@prisma/client';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── CSV column indices ────────────────────────────────────────────────────────
const COL = {
  FECHA_CAPTURA: 0,
  ESTRATEGIA: 1,
  CLAVE_USUARIO: 2,
  FOLIO_SIAC: 3,
  ESTATUS_SIAC: 4,
  TIPO_SERVICIO: 5,
  TIPO_CONTRATACION: 6,
  AREA: 7,
  PAQUETE: 8,
  TELEFONO_ASIGNADO: 9,
  TELEFONO_PORTABILIDAD: 10,
  ORDEN_SERVICIO: 11,
  ESTATUS: 12,
  FECHA_POSTEO: 13,
  ETAPA_PISA: 14,
  TELEFONO_TITULAR: 15,
  TIPO_CLIENTE: 16,
  TIPO_PAQUETE: 17,
  GASTOS_INSTALACION: 18,
  CORREO: 19,
};

// ─── Status mapping ────────────────────────────────────────────────────────────
function mapStatus(estatus: string): SaleStatus {
  switch (estatus.trim().toUpperCase()) {
    case 'POSTEADA': return SaleStatus.INSTALADA;
    case 'CANCELADA': return SaleStatus.CANCELADA;
    case 'ABIERTA':   return SaleStatus.EN_PROCESO;
    default:          return SaleStatus.PENDIENTE;
  }
}

// ─── Parse Mexican date dd/mm/yyyy ────────────────────────────────────────────
function parseDate(raw: string): Date | null {
  if (!raw || raw.trim() === '') return null;
  const [d, m, y] = raw.trim().split('/');
  if (!d || !m || !y) return null;
  const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00Z`);
  return isNaN(date.getTime()) ? null : date;
}

// ─── Parse CSV line respecting quoted fields ───────────────────────────────────
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

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Iniciando importación SIAC...\n');

  // 1. Ensure company exists
  let company = await prisma.company.findFirst({ where: { rfc: 'HEAVEN001' } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        id: randomUUID(),
        nombre: 'Heavenly Dreams',
        rfc: 'HEAVEN001',
        telefono: '5500000000',
        email: 'admin@heavenlydreams.mx',
        activa: true,
      },
    });
    console.log('✅ Empresa creada:', company.nombre);
  } else {
    console.log('✅ Empresa encontrada:', company.nombre);
  }

  // 2. Read CSV and collect all rows (use cleaned file if available)
  const cleanCsv  = path.join(__dirname, 'siac_clean.csv');
  const rawCsv    = path.join(__dirname, 'siac_import.csv');
  const csvPath   = require('fs').existsSync(cleanCsv) ? cleanCsv : rawCsv;
  console.log(`📄 Leyendo: ${require('path').basename(csvPath)}`);
  const rows: string[][] = [];

  await new Promise<void>((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(csvPath), crlfDelay: Infinity });
    let firstLine = true;
    rl.on('line', (line) => {
      if (firstLine) { firstLine = false; return; } // skip header
      if (line.trim()) rows.push(parseCsvLine(line));
    });
    rl.on('close', resolve);
    rl.on('error', reject);
  });

  console.log(`📄 Registros a importar: ${rows.length}\n`);

  // 3. Index by FOLIO_SIAC (CSV limpio ya viene deduplicado)
  const byFolio = new Map<string, string[]>();
  for (const row of rows) {
    const folio = row[COL.FOLIO_SIAC]?.trim();
    if (folio) byFolio.set(folio, row);
  }

  // 4. Collect unique CLAVE_USUARIO values
  const claves = new Set<string>();
  for (const row of byFolio.values()) {
    const clave = row[COL.CLAVE_USUARIO]?.trim();
    if (clave) claves.add(clave);
  }
  console.log(`👥 Promotores únicos: ${claves.size}`);

  // 5. Create/get User (PROMOTOR) for each CLAVE_USUARIO
  const asesorMap = new Map<string, string>(); // clave → userId
  const passwordHash = await bcrypt.hash('promotor123', 10);

  for (const clave of claves) {
    const username = `promotor_${clave}`;
    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          id: randomUUID(),
          companyId: company.id,
          username,
          email: `${clave}@heavenly.internal`,
          nombre: '',
          apellido: '',
          password: passwordHash,
          role: 'PROMOTOR',
          active: true,
        },
      });
    }
    asesorMap.set(clave, user.id);
  }
  console.log(`✅ Promotores listos: ${asesorMap.size}\n`);

  // 6. Import Sales
  let created = 0;
  let skipped = 0;
  let errors  = 0;

  const entries = Array.from(byFolio.entries());

  for (let i = 0; i < entries.length; i++) {
    const [folio, row] = entries[i];
    const claveUsuario  = row[COL.CLAVE_USUARIO]?.trim() ?? '';
    const asesorId      = asesorMap.get(claveUsuario);

    if (!asesorId) { skipped++; continue; }

    try {
      // Check if sale already exists
      const existing = await prisma.sale.findUnique({ where: { folio } });
      if (existing) { skipped++; continue; }

      const telefonoTitular = row[COL.TELEFONO_TITULAR]?.trim() ?? '';
      const telefonoAsignado = row[COL.TELEFONO_ASIGNADO]?.trim() ?? '';
      const correo           = row[COL.CORREO]?.trim() ?? '';

      await prisma.sale.create({
        data: {
          id:              randomUUID(),
          companyId:       company.id,
          asesorId,
          folio,
          status:          mapStatus(row[COL.ESTATUS] ?? ''),
          telefono:        telefonoTitular !== '0' ? telefonoTitular : (telefonoAsignado !== '0' ? telefonoAsignado : null),
          email:           correo || null,
          tipoCliente:     row[COL.TIPO_CLIENTE]?.trim() || null,
          tipoServicio:    row[COL.TIPO_SERVICIO]?.trim() || null,
          plan:            row[COL.PAQUETE]?.trim() || null,
          zona:            row[COL.AREA]?.trim() || null,
          fechaSolicitud:  parseDate(row[COL.FECHA_CAPTURA] ?? ''),
          fechaInstalacion: parseDate(row[COL.FECHA_POSTEO] ?? ''),
          notas:           row[COL.GASTOS_INSTALACION]?.trim() || null,
          metadata: {
            estrategia:        row[COL.ESTRATEGIA]?.trim() || null,
            estatusSiac:       row[COL.ESTATUS_SIAC]?.trim() || null,
            tipoContratacion:  row[COL.TIPO_CONTRATACION]?.trim() || null,
            telefonoAsignado:  telefonoAsignado !== '0' ? telefonoAsignado : null,
            telefonoPortabilidad: row[COL.TELEFONO_PORTABILIDAD]?.trim() !== '0' ? row[COL.TELEFONO_PORTABILIDAD]?.trim() : null,
            ordenServicio:     row[COL.ORDEN_SERVICIO]?.trim() !== '0' ? row[COL.ORDEN_SERVICIO]?.trim() : null,
            etapaPisa:         row[COL.ETAPA_PISA]?.trim() || null,
            tipoPaquete:       row[COL.TIPO_PAQUETE]?.trim() || null,
            gastosInstalacion: row[COL.GASTOS_INSTALACION]?.trim() || null,
          },
        },
      });

      created++;

      if (created % 500 === 0) {
        console.log(`  ⏳ Importados: ${created} / ${byFolio.size}`);
      }
    } catch (err: unknown) {
      errors++;
      if (errors <= 5) {
        console.error(`  ❌ Error en folio ${folio}:`, (err as Error).message);
      }
    }
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Ventas creadas:    ${created}`);
  console.log(`⏭️  Omitidas (ya existían): ${skipped}`);
  console.log(`❌ Errores:          ${errors}`);
  console.log('─────────────────────────────────────────');
  console.log('\n🎉 Importación SIAC completada.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
