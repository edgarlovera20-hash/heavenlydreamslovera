import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Heavenly Dreams Enterprise Platform...');

  // Create main company
  const company = await prisma.company.upsert({
    where: { rfc: 'XAXX010101000' },
    update: {},
    create: {
      id: 'company-heavenly-main',
      name: 'Heavenly Dreams',
      rfc: 'XAXX010101000',
      plan: 'enterprise',
    },
  });
  console.log(`✅ Company: ${company.name}`);

  // Create users
  const users = [
    { username: 'edgar', nombre: 'Edgar Lovera', email: 'edgar@heavenlydreams.com', role: Role.GERENTE, zona: 'CDMX - Edgar Lovera', password: 'admin123' },
    { username: 'super', nombre: 'Super Admin', email: 'super@heavenlydreams.com', role: Role.SUPER_ADMIN, password: 'super123' },
    { username: 'supervisor', nombre: 'Supervisor Demo', email: 'supervisor@heavenlydreams.com', role: Role.SUPERVISOR, password: 'demo123' },
    { username: 'promotor', nombre: 'Promotor Demo', email: 'promotor@heavenlydreams.com', role: Role.PROMOTOR, password: 'demo123' },
    { username: 'cobranza', nombre: 'Agente Cobranza', email: 'cobranza@heavenlydreams.com', role: Role.COBRANZA, password: 'demo123' },
  ];

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10);
    const created = await prisma.user.upsert({
      where: { username: u.username },
      update: {},
      create: {
        id: randomUUID(),
        companyId: company.id,
        nombre: u.nombre,
        email: u.email,
        username: u.username,
        password: hash,
        role: u.role,
        zona: u.zona,
        active: true,
      },
    });
    console.log(`✅ User: ${created.username} (${created.role})`);
  }

  // Create package catalog
  const packages = [
    { nombre: 'Telmex 100MB', megas: 100, precio: 399, descripcion: 'Internet 100 Mbps + Claro TV' },
    { nombre: 'Telmex 300MB', megas: 300, precio: 499, descripcion: 'Internet 300 Mbps + Claro TV' },
    { nombre: 'Telmex 500MB', megas: 500, precio: 649, descripcion: 'Internet 500 Mbps + Claro TV' },
    { nombre: 'Telmex 1GB', megas: 1000, precio: 849, descripcion: 'Internet 1 Gbps + Claro TV' },
  ];

  for (const pkg of packages) {
    await prisma.packageCatalog.create({
      data: { id: randomUUID(), companyId: company.id, ...pkg, active: true },
    }).catch(() => {}); // ignore duplicates
  }
  console.log('✅ Package catalog seeded');

  // Create knowledge base entries
  const kbEntries = [
    {
      title: 'Paquetes Telmex 2025',
      content: 'Ofrecemos paquetes desde 100MB hasta 1GB de internet + Claro TV. Precios desde $399 hasta $849 mensuales.',
      category: 'PROMOCION',
    },
    {
      title: 'Proceso de instalación',
      content: 'La instalación toma entre 3 y 7 días hábiles. Se requiere INE vigente y comprobante de domicilio no mayor a 3 meses.',
      category: 'ONBOARDING',
    },
    {
      title: 'Política de cobranza',
      content: 'El pago debe realizarse antes del día 10 de cada mes. Cuentas con más de 30 días de atraso se suspenden.',
      category: 'COBRANZA',
    },
    {
      title: 'Documentos requeridos para alta',
      content: 'Se requiere: INE vigente (ambos lados), comprobante de domicilio reciente (CFE, agua, teléfono), y firma de contrato.',
      category: 'FAQ',
    },
  ];

  for (const entry of kbEntries) {
    await prisma.knowledgeBase.create({
      data: {
        id: randomUUID(),
        companyId: company.id,
        title: entry.title,
        content: entry.content,
        category: entry.category,
        embedding: [],
        active: true,
      },
    }).catch(() => {});
  }
  console.log('✅ Knowledge base seeded');

  console.log('\n🎉 Seed completed!');
  console.log('📝 Login credentials:');
  console.log('   edgar / admin123  (GERENTE)');
  console.log('   super / super123  (SUPER_ADMIN)');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
