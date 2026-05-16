// @ts-ignore
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'heavenlydreams.db');

// Ensure data directory exists
import { mkdirSync } from 'fs';
mkdirSync(join(__dirname, '..', 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── MIGRATIONS ───────────────────────────────────────────────────────────────

// If siac_records has the old schema (missing folio_siac column), recreate it
try {
  const cols = (db as any).prepare('PRAGMA table_info(siac_records)').all() as any[];
  if (cols.length > 0 && !cols.some((c: any) => c.name === 'folio_siac')) {
    db.exec('DROP TABLE IF EXISTS siac_records');
    console.log('[DB] Migración: tabla siac_records recreada con nuevo esquema');
  }
} catch {}

// ─── SCHEMA ───────────────────────────────────────────────────────────────────

db.exec(`
  -- Usuarios del sistema
  CREATE TABLE IF NOT EXISTS users (
    uid         TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    username    TEXT UNIQUE NOT NULL,
    role        TEXT NOT NULL DEFAULT 'ASESOR',
    password    TEXT NOT NULL,
    zona        TEXT,
    puesto      TEXT,
    avatar      TEXT,
    biometric_id TEXT,
    activo      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Ventas / Folios
  CREATE TABLE IF NOT EXISTS ventas (
    id            TEXT PRIMARY KEY,
    folio         TEXT UNIQUE,
    asesor_id     TEXT NOT NULL,
    asesor_nombre TEXT,
    status        TEXT NOT NULL DEFAULT 'pendiente',
    nombres       TEXT,
    apellidos     TEXT,
    telefono      TEXT,
    direccion     TEXT,
    colonia       TEXT,
    municipio     TEXT,
    tipo_cliente  TEXT,
    tipo_servicio TEXT,
    plan          TEXT,
    renta_mensual REAL,
    zona          TEXT,
    notas         TEXT,
    fecha_solicitud TEXT,
    fecha_instalacion TEXT,
    contrato_pdf  TEXT,
    ine_pdf       TEXT,
    comprobante_pdf TEXT,
    metadata      TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (asesor_id) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- Registros SIAC (columna clave: folio_siac)
  CREATE TABLE IF NOT EXISTS siac_records (
    id                  TEXT PRIMARY KEY,
    folio_siac          TEXT UNIQUE NOT NULL,
    fecha_captura       TEXT,
    estrategia          TEXT,
    promotor            TEXT,
    estatus_siac        TEXT,
    tipo_linea          TEXT,
    linea_contratada    TEXT,
    area                TEXT,
    division            TEXT,
    tienda              TEXT,
    paquete             TEXT,
    observaciones       TEXT,
    respuesta_telmex    TEXT,
    motivo_rechazo      TEXT,
    telefono_asignado   TEXT,
    telefono_portado    TEXT,
    os_alta             TEXT,
    fecha_os_alta       TEXT,
    estatus_pisa        TEXT,
    fecha_cambio_estatus TEXT,
    tipo_cliente        TEXT,
    tipo_servicio       TEXT,
    correo              TEXT,
    estatus_etapa       TEXT,
    campana             TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Tickets de soporte
  CREATE TABLE IF NOT EXISTS tickets (
    id          TEXT PRIMARY KEY,
    titulo      TEXT NOT NULL,
    descripcion TEXT,
    status      TEXT NOT NULL DEFAULT 'abierto',
    prioridad   TEXT DEFAULT 'media',
    asesor_id   TEXT,
    asignado_a  TEXT,
    categoria   TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Solicitudes de validación
  CREATE TABLE IF NOT EXISTS validation_requests (
    id            TEXT PRIMARY KEY,
    sale_id       TEXT,
    client_name   TEXT,
    client_phone  TEXT,
    status        TEXT NOT NULL DEFAULT 'pendiente',
    resultado     TEXT,
    notas         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Referidos
  CREATE TABLE IF NOT EXISTS referrals (
    id            TEXT PRIMARY KEY,
    referred_by   TEXT NOT NULL,
    nombre        TEXT,
    telefono      TEXT,
    status        TEXT NOT NULL DEFAULT 'pendiente',
    convertido    INTEGER DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Territorios
  CREATE TABLE IF NOT EXISTS territories (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    asesor_id   TEXT,
    color       TEXT,
    poligono    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cuotas por usuario
  CREATE TABLE IF NOT EXISTS quotas (
    user_id     TEXT PRIMARY KEY,
    meta        INTEGER NOT NULL DEFAULT 0,
    periodo     TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Reglas de comisiones
  CREATE TABLE IF NOT EXISTS commission_rules (
    id          TEXT PRIMARY KEY,
    min_ventas  INTEGER,
    max_ventas  INTEGER,
    tasa        REAL,
    bono_meta   REAL,
    activo      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Catálogo de paquetes
  CREATE TABLE IF NOT EXISTS package_catalog (
    id          TEXT PRIMARY KEY,
    nombre      TEXT NOT NULL,
    megas       INTEGER,
    precio      REAL,
    descripcion TEXT,
    activo      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Log de auditoría
  CREATE TABLE IF NOT EXISTS audit_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    accion      TEXT NOT NULL,
    entidad     TEXT,
    entidad_id  TEXT,
    user_id     TEXT,
    user_nombre TEXT,
    detalle     TEXT,
    ip          TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Configuración general (key-value)
  CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Nóminas
  CREATE TABLE IF NOT EXISTS nominas (
    id          TEXT PRIMARY KEY,
    asesor_id   TEXT NOT NULL,
    periodo     TEXT NOT NULL,
    ventas_count INTEGER DEFAULT 0,
    monto_base  REAL DEFAULT 0,
    comisiones  REAL DEFAULT 0,
    bonos       REAL DEFAULT 0,
    total       REAL DEFAULT 0,
    status      TEXT DEFAULT 'borrador',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Anuncios / Comunicados
  CREATE TABLE IF NOT EXISTS announcements (
    id          TEXT PRIMARY KEY,
    titulo      TEXT NOT NULL,
    contenido   TEXT,
    tipo        TEXT DEFAULT 'info',
    autor_id    TEXT,
    activo      INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed admin user if no users exist
const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
if (userCount === 0) {
  db.prepare(`
    INSERT INTO users (uid, nombre, email, username, role, password, zona, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run('uid_edgar', 'Edgar Lovera', 'edgar@heavenlydreams.com', 'edgar', 'GERENTE', 'admin123', 'CDMX - Edgar Lovera');
  console.log('[DB] Usuario admin inicial creado: edgar / admin123');
}

export default db;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

export const Users = {
  getAll: () => db.prepare('SELECT * FROM users WHERE activo=1 ORDER BY nombre').all(),
  getById: (uid: string) => db.prepare('SELECT * FROM users WHERE uid=?').get(uid),
  getByUsername: (username: string) => db.prepare('SELECT * FROM users WHERE username=?').get(username),
  create: (data: any) => {
    const stmt = db.prepare(`
      INSERT INTO users (uid,nombre,email,username,role,password,zona,puesto,activo)
      VALUES (@uid,@nombre,@email,@username,@role,@password,@zona,@puesto,1)
    `);
    return stmt.run(data);
  },
  update: (uid: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE users SET ${fields},updated_at=datetime('now') WHERE uid=@uid`).run({ ...data, uid });
  },
  delete: (uid: string) => db.prepare("DELETE FROM users WHERE uid=?").run(uid),
};

export const Ventas = {
  getAll: () => db.prepare('SELECT * FROM ventas ORDER BY created_at DESC').all(),
  getByAsesor: (id: string) => db.prepare('SELECT * FROM ventas WHERE asesor_id=? ORDER BY created_at DESC').all(id),
  getById: (id: string) => db.prepare('SELECT * FROM ventas WHERE id=?').get(id),
  create: (data: any) => db.prepare(`
    INSERT INTO ventas (id,folio,asesor_id,asesor_nombre,status,nombres,apellidos,telefono,
      direccion,colonia,municipio,tipo_cliente,tipo_servicio,plan,renta_mensual,zona,notas,
      fecha_solicitud,metadata)
    VALUES (@id,@folio,@asesor_id,@asesor_nombre,@status,@nombres,@apellidos,@telefono,
      @direccion,@colonia,@municipio,@tipo_cliente,@tipo_servicio,@plan,@renta_mensual,@zona,@notas,
      @fecha_solicitud,@metadata)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE ventas SET ${fields},updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
  delete: (id: string) => db.prepare('DELETE FROM ventas WHERE id=?').run(id),
};

export const SiacRecords = {
  getAll: () => db.prepare('SELECT * FROM siac_records ORDER BY fecha_captura DESC').all(),
  search: (folio: string) => db.prepare(
    'SELECT * FROM siac_records WHERE folio_siac LIKE ? ORDER BY fecha_captura DESC LIMIT 50'
  ).all(`%${folio}%`),
  getByFolio: (folio: string) => db.prepare(
    'SELECT * FROM siac_records WHERE folio_siac = ?'
  ).get(folio),
  upsert: (data: any) => db.prepare(`
    INSERT INTO siac_records (
      id, folio_siac, fecha_captura, estrategia, promotor, estatus_siac,
      tipo_linea, linea_contratada, area, division, tienda, paquete,
      observaciones, respuesta_telmex, motivo_rechazo, telefono_asignado,
      telefono_portado, os_alta, fecha_os_alta, estatus_pisa,
      fecha_cambio_estatus, tipo_cliente, tipo_servicio, correo,
      estatus_etapa, campana
    ) VALUES (
      @id, @folio_siac, @fecha_captura, @estrategia, @promotor, @estatus_siac,
      @tipo_linea, @linea_contratada, @area, @division, @tienda, @paquete,
      @observaciones, @respuesta_telmex, @motivo_rechazo, @telefono_asignado,
      @telefono_portado, @os_alta, @fecha_os_alta, @estatus_pisa,
      @fecha_cambio_estatus, @tipo_cliente, @tipo_servicio, @correo,
      @estatus_etapa, @campana
    ) ON CONFLICT(folio_siac) DO UPDATE SET
      estatus_siac=excluded.estatus_siac,
      estatus_pisa=excluded.estatus_pisa,
      estatus_etapa=excluded.estatus_etapa,
      fecha_cambio_estatus=excluded.fecha_cambio_estatus,
      observaciones=excluded.observaciones,
      respuesta_telmex=excluded.respuesta_telmex,
      motivo_rechazo=excluded.motivo_rechazo
  `).run(data),
  deleteAll: () => db.prepare('DELETE FROM siac_records').run(),
  count: () => (db.prepare('SELECT COUNT(*) as c FROM siac_records').get() as any).c,
};

export const Tickets = {
  getAll: () => db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO tickets (id,titulo,descripcion,status,prioridad,asesor_id,categoria)
    VALUES (@id,@titulo,@descripcion,@status,@prioridad,@asesor_id,@categoria)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE tickets SET ${fields},updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
};

export const AuditLog = {
  getAll: (limit = 200) => db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?').all(limit),
  insert: (data: any) => db.prepare(`
    INSERT INTO audit_log (accion,entidad,entidad_id,user_id,user_nombre,detalle)
    VALUES (@accion,@entidad,@entidad_id,@user_id,@user_nombre,@detalle)
  `).run(data),
};

export const Settings = {
  get: (key: string) => {
    const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key) as any;
    return row ? JSON.parse(row.value) : null;
  },
  set: (key: string, value: any) => db.prepare(`
    INSERT INTO settings (key,value,updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(key, JSON.stringify(value)),
};

export const Referrals = {
  getAll: () => db.prepare('SELECT * FROM referrals ORDER BY created_at DESC').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO referrals (id,referred_by,nombre,telefono,status,convertido)
    VALUES (@id,@referred_by,@nombre,@telefono,@status,@convertido)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE referrals SET ${fields} WHERE id=@id`).run({ ...data, id });
  },
};

export const Quotas = {
  getAll: () => db.prepare('SELECT * FROM quotas').all(),
  set: (userId: string, meta: number) => db.prepare(`
    INSERT INTO quotas (user_id,meta,updated_at) VALUES (?,?,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET meta=excluded.meta, updated_at=excluded.updated_at
  `).run(userId, meta),
};

export const CommissionRules = {
  getAll: () => db.prepare('SELECT * FROM commission_rules WHERE activo=1').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO commission_rules (id,min_ventas,max_ventas,tasa,bono_meta)
    VALUES (@id,@min_ventas,@max_ventas,@tasa,@bono_meta)
  `).run(data),
  delete: (id: string) => db.prepare('UPDATE commission_rules SET activo=0 WHERE id=?').run(id),
};

export const PackageCatalog = {
  getAll: () => db.prepare('SELECT * FROM package_catalog WHERE activo=1').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO package_catalog (id,nombre,megas,precio,descripcion)
    VALUES (@id,@nombre,@megas,@precio,@descripcion)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE package_catalog SET ${fields} WHERE id=@id`).run({ ...data, id });
  },
  delete: (id: string) => db.prepare('UPDATE package_catalog SET activo=0 WHERE id=?').run(id),
};

export const Nominas = {
  getAll: () => db.prepare('SELECT * FROM nominas ORDER BY created_at DESC').all(),
  getByAsesor: (id: string) => db.prepare('SELECT * FROM nominas WHERE asesor_id=? ORDER BY created_at DESC').all(id),
  create: (data: any) => db.prepare(`
    INSERT INTO nominas (id,asesor_id,periodo,ventas_count,monto_base,comisiones,bonos,total,status)
    VALUES (@id,@asesor_id,@periodo,@ventas_count,@monto_base,@comisiones,@bonos,@total,@status)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE nominas SET ${fields},updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
};

export const Territories = {
  getAll: () => db.prepare('SELECT * FROM territories').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO territories (id,nombre,descripcion,asesor_id,color,poligono)
    VALUES (@id,@nombre,@descripcion,@asesor_id,@color,@poligono)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE territories SET ${fields} WHERE id=@id`).run({ ...data, id });
  },
  delete: (id: string) => db.prepare('DELETE FROM territories WHERE id=?').run(id),
};

export const ValidationRequests = {
  getAll: () => db.prepare('SELECT * FROM validation_requests ORDER BY created_at DESC').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO validation_requests (id,sale_id,client_name,client_phone,status,notas)
    VALUES (@id,@sale_id,@client_name,@client_phone,@status,@notas)
  `).run(data),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE validation_requests SET ${fields},updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
};

export const Announcements = {
  getAll: () => db.prepare('SELECT * FROM announcements WHERE activo=1 ORDER BY created_at DESC').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO announcements (id,titulo,contenido,tipo,autor_id)
    VALUES (@id,@titulo,@contenido,@tipo,@autor_id)
  `).run(data),
  delete: (id: string) => db.prepare('UPDATE announcements SET activo=0 WHERE id=?').run(id),
};
