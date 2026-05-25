// @ts-ignore
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, isPasswordHash } from './passwords';

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

// Add new columns to siac_records if they don't exist yet
const newSiacCols = [
  { name: 'source_id',           def: 'TEXT' },
  { name: 'telefono_referencia', def: 'TEXT' },
  { name: 'zona',               def: 'TEXT' },
  { name: 'distrito',           def: 'TEXT' },
  { name: 'colonia',            def: 'TEXT' },
  { name: 'usuario',            def: 'TEXT' },
  { name: 'morosidad',          def: 'TEXT' },
];
try {
  const existingCols = ((db as any).prepare('PRAGMA table_info(siac_records)').all() as any[]).map((c: any) => c.name);
  for (const col of newSiacCols) {
    if (!existingCols.includes(col.name)) {
      db.exec(`ALTER TABLE siac_records ADD COLUMN ${col.name} ${col.def}`);
      console.log(`[DB] Migración: columna siac_records.${col.name} añadida`);
    }
  }
} catch (e) { console.warn('[DB] Migración siac_records omitida:', e); }

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
    source_id           TEXT,
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
    telefono_referencia TEXT,
    zona                TEXT,
    distrito            TEXT,
    colonia             TEXT,
    usuario             TEXT,
    morosidad           TEXT,
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
    mensaje     TEXT,
    updated_by  TEXT,
    notified_at TEXT,
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

  -- Sesiones con refresh-token rotativo
  CREATE TABLE IF NOT EXISTS sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    refresh_token TEXT UNIQUE NOT NULL,
    expires_at    TEXT NOT NULL,
    revoked_at    TEXT,
    ip            TEXT,
    user_agent    TEXT,
    webauthn_verified INTEGER NOT NULL DEFAULT 0,
    webauthn_enrollment_required INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Cuentas externas OAuth/OIDC enlazadas a usuarios internos
  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email            TEXT NOT NULL,
    email_verified   INTEGER NOT NULL DEFAULT 0,
    display_name     TEXT,
    avatar_url       TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_user_id),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Inventario empresarial: modems, SIMs, uniformes y activos
  CREATE TABLE IF NOT EXISTS inventory_items (
    id            TEXT PRIMARY KEY,
    sku           TEXT,
    tipo          TEXT NOT NULL,
    nombre        TEXT NOT NULL,
    serial        TEXT,
    estado        TEXT NOT NULL DEFAULT 'disponible',
    assigned_to   TEXT,
    sale_id       TEXT,
    notes         TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Eventos del sistema para automatizaciones y trazabilidad
  CREATE TABLE IF NOT EXISTS system_events (
    id          TEXT PRIMARY KEY,
    event       TEXT NOT NULL,
    payload     TEXT,
    actor_id    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cola durable local para trabajos IA; Redis/BullMQ puede reemplazar el transport
  CREATE TABLE IF NOT EXISTS ai_jobs (
    id          TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    payload     TEXT,
    status      TEXT NOT NULL DEFAULT 'queued',
    priority    INTEGER DEFAULT 5,
    attempts    INTEGER DEFAULT 0,
    result      TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Automatizacion Telmex: trabajos desacoplados, evidencias y folios devueltos por workers
  CREATE TABLE IF NOT EXISTS telmex_automation_jobs (
    id             TEXT PRIMARY KEY,
    action         TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'queued',
    current_step   TEXT,
    progress       INTEGER NOT NULL DEFAULT 0,
    sale_id        TEXT,
    captura_id     TEXT,
    user_id        TEXT,
    folio          TEXT,
    payload        TEXT,
    result         TEXT,
    error          TEXT,
    evidence       TEXT,
    attempts       INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sale_id) REFERENCES ventas(id) ON DELETE SET NULL,
    FOREIGN KEY (captura_id) REFERENCES capturas(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- Reglas de automatización accionadas por eventos
  CREATE TABLE IF NOT EXISTS automation_rules (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    event       TEXT NOT NULL,
    conditions  TEXT,
    actions     TEXT NOT NULL,
    enabled     INTEGER DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cuentas, conversaciones y mensajes de canales atendidos por agentes
  CREATE TABLE IF NOT EXISTS channel_accounts (
    id          TEXT PRIMARY KEY,
    channel     TEXT NOT NULL,
    label       TEXT,
    external_id TEXT,
    status      TEXT NOT NULL DEFAULT 'disconnected',
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(channel, external_id)
  );

  CREATE TABLE IF NOT EXISTS channel_conversations (
    id              TEXT PRIMARY KEY,
    channel         TEXT NOT NULL,
    external_chat_id TEXT NOT NULL,
    display_name    TEXT,
    status          TEXT NOT NULL DEFAULT 'nuevo',
    assigned_to     TEXT,
    intent          TEXT,
    confidence      REAL NOT NULL DEFAULT 0,
    memory          TEXT,
    last_message_at INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(channel, external_chat_id)
  );

  CREATE TABLE IF NOT EXISTS channel_messages (
    id               TEXT PRIMARY KEY,
    conversation_id  TEXT NOT NULL,
    channel          TEXT NOT NULL,
    external_chat_id TEXT NOT NULL,
    direction        TEXT NOT NULL,
    body             TEXT NOT NULL,
    from_name        TEXT,
    to_id            TEXT,
    timestamp        INTEGER NOT NULL,
    is_group         INTEGER NOT NULL DEFAULT 0,
    metadata         TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES channel_conversations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS agent_decisions (
    id                TEXT PRIMARY KEY,
    conversation_id   TEXT NOT NULL,
    message_id        TEXT,
    agent             TEXT NOT NULL,
    intent            TEXT NOT NULL,
    confidence        REAL NOT NULL DEFAULT 0,
    extracted_fields  TEXT,
    proposed_reply    TEXT,
    proposed_actions  TEXT,
    requires_approval INTEGER NOT NULL DEFAULT 1,
    status            TEXT NOT NULL DEFAULT 'pending_approval',
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES channel_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES channel_messages(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS agent_tasks (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',
    due_at          TEXT,
    assigned_to     TEXT,
    metadata        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES channel_conversations(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS agent_profiles (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    role            TEXT,
    personality     TEXT,
    self_knowledge  TEXT,
    knowledge_base  TEXT,
    learned_notes   TEXT,
    metadata        TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_outbox (
    id              TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    decision_id     TEXT,
    type            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending_approval',
    channel         TEXT NOT NULL,
    target          TEXT NOT NULL,
    message         TEXT,
    action          TEXT,
    payload         TEXT,
    result          TEXT,
    error           TEXT,
    approved_by     TEXT,
    approved_at     TEXT,
    rejected_by     TEXT,
    rejected_at     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES channel_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (decision_id) REFERENCES agent_decisions(id) ON DELETE SET NULL
  );

  -- Métricas/KPIs capturados por módulos y workers
  CREATE TABLE IF NOT EXISTS metrics (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    value       REAL NOT NULL DEFAULT 1,
    tags        TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Capturas completas: solicitud, validacion, instalacion y trazabilidad comercial
  CREATE TABLE IF NOT EXISTS capturas (
    id                    TEXT PRIMARY KEY,
    venta_id              TEXT,
    folio                 TEXT UNIQUE,
    fecha_captura         TEXT NOT NULL DEFAULT (datetime('now')),
    vendedor_id           TEXT,
    supervisor_id         TEXT,
    cliente_nombre        TEXT,
    telefono              TEXT,
    correo                TEXT,
    curp                  TEXT,
    rfc                   TEXT,
    ine_numero            TEXT,
    tipo_servicio         TEXT,
    paquete               TEXT,
    status_captura        TEXT NOT NULL DEFAULT 'PENDIENTE',
    status_validacion     TEXT NOT NULL DEFAULT 'PENDIENTE',
    status_instalacion    TEXT NOT NULL DEFAULT 'PENDIENTE',
    status_documentos     TEXT NOT NULL DEFAULT 'PENDIENTE',
    fecha_instalacion     TEXT,
    tipo_vialidad         TEXT,
    calle                 TEXT,
    numero_exterior       TEXT,
    numero_interior       TEXT,
    edificio              TEXT,
    departamento          TEXT,
    piso                  TEXT,
    torre                 TEXT,
    manzana               TEXT,
    lote                  TEXT,
    privada               TEXT,
    sector                TEXT,
    etapa                 TEXT,
    unidad_habitacional   TEXT,
    referencias           TEXT,
    codigo_postal         TEXT,
    colonia               TEXT,
    ciudad                TEXT,
    delegacion            TEXT,
    direccion_completa    TEXT,
    latitud               REAL,
    longitud              REAL,
    precision_gps         REAL,
    gps_timestamp         TEXT,
    observaciones         TEXT,
    metadata              TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE SET NULL,
    FOREIGN KEY (vendedor_id) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- Documentos por captura: existencia, validacion y rechazo
  CREATE TABLE IF NOT EXISTS documentos_cliente (
    id                 TEXT PRIMARY KEY,
    captura_id         TEXT NOT NULL,
    tipo_documento     TEXT NOT NULL,
    archivo_url        TEXT,
    archivo_nombre     TEXT,
    status_documento   TEXT NOT NULL DEFAULT 'PENDIENTE',
    validado_por       TEXT,
    fecha_validacion   TEXT,
    observaciones      TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(captura_id, tipo_documento),
    FOREIGN KEY (captura_id) REFERENCES capturas(id) ON DELETE CASCADE,
    FOREIGN KEY (validado_por) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- Archivos fisicos asociados a expedientes, con huella para agente archivero
  CREATE TABLE IF NOT EXISTS document_files (
    id                 TEXT PRIMARY KEY,
    captura_id         TEXT,
    venta_id           TEXT,
    tipo_documento     TEXT NOT NULL,
    archivo_nombre     TEXT NOT NULL,
    mime_type          TEXT,
    size_bytes         INTEGER NOT NULL DEFAULT 0,
    sha256             TEXT NOT NULL,
    storage_provider   TEXT NOT NULL DEFAULT 'local',
    storage_path       TEXT NOT NULL,
    review_status      TEXT NOT NULL DEFAULT 'PENDIENTE',
    manipulation_score REAL,
    review_notes       TEXT,
    uploaded_by        TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (captura_id) REFERENCES capturas(id) ON DELETE CASCADE,
    FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- CRM de clientes para seguimiento, bienvenida, retencion y cobranza preventiva
  CREATE TABLE IF NOT EXISTS clientes_crm (
    id                    TEXT PRIMARY KEY,
    captura_id            TEXT,
    folio                 TEXT UNIQUE,
    nombre                TEXT,
    telefono              TEXT,
    whatsapp              TEXT,
    correo                TEXT,
    direccion             TEXT,
    fecha_alta            TEXT,
    status_cliente        TEXT NOT NULL DEFAULT 'NUEVO',
    ultimo_contacto       TEXT,
    proximo_seguimiento   TEXT,
    nivel_satisfaccion    INTEGER,
    riesgo_cancelacion    TEXT DEFAULT 'BAJO',
    vendedor_asignado     TEXT,
    metadata              TEXT,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (captura_id) REFERENCES capturas(id) ON DELETE SET NULL,
    FOREIGN KEY (vendedor_asignado) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- Morosidad y cobranza
  CREATE TABLE IF NOT EXISTS morosidad (
    id                 TEXT PRIMARY KEY,
    folio              TEXT,
    cliente_id         TEXT,
    monto_adeudo       REAL NOT NULL DEFAULT 0,
    dias_atraso        INTEGER NOT NULL DEFAULT 0,
    fecha_vencimiento  TEXT,
    ultimo_pago        TEXT,
    status_cobranza    TEXT NOT NULL DEFAULT 'PREVENTIVA',
    gestor_asignado    TEXT,
    convenio           INTEGER NOT NULL DEFAULT 0,
    observaciones      TEXT,
    metadata           TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cliente_id) REFERENCES clientes_crm(id) ON DELETE CASCADE,
    FOREIGN KEY (gestor_asignado) REFERENCES users(uid) ON DELETE SET NULL
  );

  -- Estatus consultable de folios
  CREATE TABLE IF NOT EXISTS estatus_folios (
    id                 TEXT PRIMARY KEY,
    captura_id         TEXT,
    folio              TEXT UNIQUE,
    status_actual      TEXT NOT NULL DEFAULT 'CAPTURADO',
    subestatus         TEXT,
    area_actual        TEXT,
    tecnico_asignado   TEXT,
    fecha_movimiento   TEXT NOT NULL DEFAULT (datetime('now')),
    observaciones      TEXT,
    documentos_faltantes TEXT,
    avance             INTEGER NOT NULL DEFAULT 20,
    metadata           TEXT,
    created_at         TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (captura_id) REFERENCES capturas(id) ON DELETE CASCADE
  );

  -- Bitacora empresarial ampliada para cambios, exportaciones, accesos, IP y dispositivo
  CREATE TABLE IF NOT EXISTS logs_sistema (
    id          TEXT PRIMARY KEY,
    accion      TEXT NOT NULL,
    entidad     TEXT,
    entidad_id  TEXT,
    user_id     TEXT,
    detalle     TEXT,
    ip          TEXT,
    dispositivo TEXT,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Credenciales WebAuthn verificadas por servidor
  CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    credential_id       TEXT UNIQUE NOT NULL,
    public_key          TEXT NOT NULL,
    counter             INTEGER NOT NULL DEFAULT 0,
    transports          TEXT,
    device_type         TEXT,
    backed_up           INTEGER DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
  );

  -- Challenges temporales para registro/login WebAuthn
  CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    challenge   TEXT NOT NULL,
    type        TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Finanzas Enterprise: ciclo semanal Telmex/SocioMax, facturacion, tesoreria y auditoria
  CREATE TABLE IF NOT EXISTS weekly_financial_cycles (
    id                   TEXT PRIMARY KEY,
    semana               INTEGER NOT NULL,
    anio                 INTEGER NOT NULL,
    empresa              TEXT,
    gerente              TEXT,
    fecha_reporte        TEXT,
    fecha_factura        TEXT,
    fecha_deposito       TEXT,
    estado               TEXT NOT NULL DEFAULT 'REPORTE_RECIBIDO',
    pago_gerente         REAL NOT NULL DEFAULT 0,
    iva                  REAL NOT NULL DEFAULT 0,
    descuentos           REAL NOT NULL DEFAULT 0,
    total_pago_gerente   REAL NOT NULL DEFAULT 0,
    total_pago_promotor  REAL NOT NULL DEFAULT 0,
    total_facturar       REAL NOT NULL DEFAULT 0,
    monto_depositado     REAL NOT NULL DEFAULT 0,
    diferencia           REAL NOT NULL DEFAULT 0,
    xml_url              TEXT,
    pdf_url              TEXT,
    captura_url          TEXT,
    captura_file_id      TEXT,
    uuid_sat             TEXT,
    ocr_text             TEXT,
    ocr_provider         TEXT,
    ocr_confidence       REAL,
    metadata             TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE VIEW IF NOT EXISTS financial_cycles AS
    SELECT * FROM weekly_financial_cycles;

  CREATE TABLE IF NOT EXISTS financial_movements (
    id             TEXT PRIMARY KEY,
    cycle_id       TEXT,
    type           TEXT NOT NULL,
    category       TEXT NOT NULL,
    description    TEXT,
    amount         REAL NOT NULL DEFAULT 0,
    direction      TEXT NOT NULL DEFAULT 'egreso',
    movement_date  TEXT NOT NULL DEFAULT (datetime('now')),
    source         TEXT,
    status         TEXT NOT NULL DEFAULT 'registrado',
    metadata       TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cycle_id) REFERENCES weekly_financial_cycles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS financial_alerts (
    id          TEXT PRIMARY KEY,
    cycle_id    TEXT,
    type        TEXT NOT NULL,
    severity    TEXT NOT NULL DEFAULT 'warning',
    title       TEXT NOT NULL,
    message     TEXT,
    status      TEXT NOT NULL DEFAULT 'open',
    amount      REAL,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cycle_id) REFERENCES weekly_financial_cycles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS financial_invoices (
    id             TEXT PRIMARY KEY,
    cycle_id       TEXT NOT NULL,
    uuid_sat       TEXT,
    fecha_factura  TEXT,
    subtotal       REAL NOT NULL DEFAULT 0,
    iva            REAL NOT NULL DEFAULT 0,
    total          REAL NOT NULL DEFAULT 0,
    xml_url        TEXT,
    pdf_url        TEXT,
    xml_file_id    TEXT,
    pdf_file_id    TEXT,
    rfc_emisor     TEXT,
    rfc_receptor   TEXT,
    status         TEXT NOT NULL DEFAULT 'validada',
    metadata       TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cycle_id) REFERENCES weekly_financial_cycles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS financial_deposits (
    id               TEXT PRIMARY KEY,
    cycle_id         TEXT NOT NULL,
    fecha_deposito   TEXT NOT NULL,
    monto            REAL NOT NULL DEFAULT 0,
    banco            TEXT,
    referencia       TEXT,
    comprobante_url  TEXT,
    file_id          TEXT,
    status           TEXT NOT NULL DEFAULT 'registrado',
    metadata         TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cycle_id) REFERENCES weekly_financial_cycles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS financial_predictions (
    id          TEXT PRIMARY KEY,
    period      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    prediction  TEXT NOT NULL,
    confidence  REAL NOT NULL DEFAULT 0,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS financial_audit_logs (
    id          TEXT PRIMARY KEY,
    cycle_id    TEXT,
    action      TEXT NOT NULL,
    actor_id    TEXT,
    detail      TEXT,
    metadata    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cycle_id) REFERENCES weekly_financial_cycles(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS financial_files (
    id                TEXT PRIMARY KEY,
    cycle_id          TEXT,
    tipo              TEXT NOT NULL,
    file_name         TEXT NOT NULL,
    mime_type         TEXT,
    size_bytes        INTEGER NOT NULL DEFAULT 0,
    sha256            TEXT NOT NULL,
    storage_provider  TEXT NOT NULL DEFAULT 'local',
    storage_path      TEXT NOT NULL,
    download_url      TEXT,
    uploaded_by       TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (cycle_id) REFERENCES weekly_financial_cycles(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(uid) ON DELETE SET NULL
  );
`);

function ensureColumn(table: string, name: string, definition: string) {
  const cols = (db as any).prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c: any) => c.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    console.log(`[DB] Migracion: columna ${table}.${name} anadida`);
  }
}

try {
  ensureColumn('sessions', 'webauthn_verified', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('sessions', 'webauthn_enrollment_required', 'INTEGER NOT NULL DEFAULT 0');
} catch (e) { console.warn('[DB] Migracion sessions omitida:', e); }

try {
  ensureColumn('quotas', 'mensaje', 'TEXT');
  ensureColumn('quotas', 'updated_by', 'TEXT');
  ensureColumn('quotas', 'notified_at', 'TEXT');
} catch (e) { console.warn('[DB] Migracion quotas omitida:', e); }

try {
  [
    { name: 'provider', def: 'TEXT' },
    { name: 'provider_call_id', def: 'TEXT' },
    { name: 'conversation_id', def: 'TEXT' },
    { name: 'call_sid', def: 'TEXT' },
    { name: 'attempts', def: 'INTEGER NOT NULL DEFAULT 0' },
    { name: 'call_status', def: 'TEXT' },
    { name: 'proposed_result', def: 'TEXT' },
    { name: 'summary', def: 'TEXT' },
    { name: 'transcript_json', def: 'TEXT' },
    { name: 'provider_payload_json', def: 'TEXT' },
    { name: 'sale_snapshot_json', def: 'TEXT' },
    { name: 'last_error', def: 'TEXT' },
    { name: 'review_status', def: "TEXT NOT NULL DEFAULT 'pending'" },
    { name: 'script_type', def: 'TEXT' },
    { name: 'reviewed_by', def: 'TEXT' },
    { name: 'reviewed_at', def: 'TEXT' },
  ].forEach((col) => ensureColumn('validation_requests', col.name, col.def));
} catch (e) { console.warn('[DB] Migracion validation_requests omitida:', e); }

// ─── INDEXES ──────────────────────────────────────────────────────────────────
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ventas_asesor    ON ventas (asesor_id);
  CREATE INDEX IF NOT EXISTS idx_ventas_status    ON ventas (status);
  CREATE INDEX IF NOT EXISTS idx_ventas_created   ON ventas (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ventas_zona      ON ventas (zona);
  CREATE INDEX IF NOT EXISTS idx_siac_folio       ON siac_records (folio_siac);
  CREATE INDEX IF NOT EXISTS idx_siac_created     ON siac_records (fecha_captura DESC);
  CREATE INDEX IF NOT EXISTS idx_siac_estatus     ON siac_records (estatus_siac);
  CREATE INDEX IF NOT EXISTS idx_siac_promotor    ON siac_records (promotor);
  CREATE INDEX IF NOT EXISTS idx_audit_created    ON audit_log (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_user       ON audit_log (user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_entidad    ON audit_log (entidad, entidad_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets (status);
  CREATE INDEX IF NOT EXISTS idx_tickets_asesor   ON tickets (asesor_id);
  CREATE INDEX IF NOT EXISTS idx_nominas_asesor   ON nominas (asesor_id);
  CREATE INDEX IF NOT EXISTS idx_referrals_by     ON referrals (referred_by);
  CREATE INDEX IF NOT EXISTS idx_valreq_sale      ON validation_requests (sale_id);
  CREATE INDEX IF NOT EXISTS idx_valreq_status    ON validation_requests (status);
  CREATE INDEX IF NOT EXISTS idx_sessions_token   ON sessions (refresh_token);
  CREATE INDEX IF NOT EXISTS idx_oauth_email      ON oauth_accounts (provider, email);
  CREATE INDEX IF NOT EXISTS idx_oauth_user       ON oauth_accounts (user_id);
  CREATE INDEX IF NOT EXISTS idx_inventory_estado ON inventory_items (estado);
  CREATE INDEX IF NOT EXISTS idx_events_name      ON system_events (event, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ai_jobs_status   ON ai_jobs (status, priority, created_at);
  CREATE INDEX IF NOT EXISTS idx_telmex_jobs_status ON telmex_automation_jobs (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_telmex_jobs_sale ON telmex_automation_jobs (sale_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_channel_conversations_last ON channel_conversations (last_message_at DESC);
  CREATE INDEX IF NOT EXISTS idx_channel_messages_conversation ON channel_messages (conversation_id, timestamp ASC);
  CREATE INDEX IF NOT EXISTS idx_channel_messages_recent ON channel_messages (timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_agent_outbox_status ON agent_outbox (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_metrics_name     ON metrics (name, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_capturas_folio   ON capturas (folio);
  CREATE INDEX IF NOT EXISTS idx_capturas_vendedor ON capturas (vendedor_id, fecha_captura DESC);
  CREATE INDEX IF NOT EXISTS idx_capturas_status  ON capturas (status_captura, status_validacion, status_instalacion);
  CREATE INDEX IF NOT EXISTS idx_capturas_geo     ON capturas (colonia, ciudad, paquete);
  CREATE INDEX IF NOT EXISTS idx_docs_captura     ON documentos_cliente (captura_id, tipo_documento);
  CREATE INDEX IF NOT EXISTS idx_docs_status      ON documentos_cliente (status_documento);
  CREATE INDEX IF NOT EXISTS idx_doc_files_capture ON document_files (captura_id, tipo_documento);
  CREATE INDEX IF NOT EXISTS idx_doc_files_sha     ON document_files (sha256);
  CREATE INDEX IF NOT EXISTS idx_doc_files_review  ON document_files (review_status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_clientes_folio   ON clientes_crm (folio);
  CREATE INDEX IF NOT EXISTS idx_clientes_vendedor ON clientes_crm (vendedor_asignado, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_clientes_status  ON clientes_crm (status_cliente, proximo_seguimiento);
  CREATE INDEX IF NOT EXISTS idx_morosidad_dias   ON morosidad (dias_atraso DESC);
  CREATE INDEX IF NOT EXISTS idx_morosidad_status ON morosidad (status_cobranza, dias_atraso DESC);
  CREATE INDEX IF NOT EXISTS idx_folios_status    ON estatus_folios (status_actual, fecha_movimiento DESC);
  CREATE INDEX IF NOT EXISTS idx_logs_created     ON logs_sistema (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_logs_entidad     ON logs_sistema (entidad, entidad_id);
  CREATE INDEX IF NOT EXISTS idx_webauthn_user    ON webauthn_credentials (user_id);
  CREATE INDEX IF NOT EXISTS idx_webauthn_ch_user ON webauthn_challenges (user_id, type);
  CREATE INDEX IF NOT EXISTS idx_fin_cycles_week  ON weekly_financial_cycles (anio, semana, empresa);
  CREATE INDEX IF NOT EXISTS idx_fin_cycles_state ON weekly_financial_cycles (estado, fecha_reporte DESC);
  CREATE INDEX IF NOT EXISTS idx_fin_mov_cycle    ON financial_movements (cycle_id, movement_date DESC);
  CREATE INDEX IF NOT EXISTS idx_fin_alerts_open  ON financial_alerts (status, severity, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fin_alerts_cycle ON financial_alerts (cycle_id, type, status);
  CREATE INDEX IF NOT EXISTS idx_fin_inv_cycle    ON financial_invoices (cycle_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_fin_inv_uuid     ON financial_invoices (uuid_sat);
  CREATE INDEX IF NOT EXISTS idx_fin_dep_cycle    ON financial_deposits (cycle_id, fecha_deposito DESC);
  CREATE INDEX IF NOT EXISTS idx_fin_files_cycle  ON financial_files (cycle_id, tipo);
`);

function passwordForStorage(value: any) {
  const password = String(value || '');
  if (!password) throw new Error('Password requerido');
  return isPasswordHash(password) ? password : hashPassword(password);
}

// Seed admin user if no users exist
const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
if (userCount === 0 && process.env.NODE_ENV !== 'production') {
  const devPassword = process.env.DEV_ADMIN_PASSWORD || `dev-${randomUUID().slice(0, 8)}`;
  db.prepare(`
    INSERT INTO users (uid, nombre, email, username, role, password, zona, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run('uid_edgar', 'Edgar Lovera', 'edgar@heavenlydreams.com', 'edgar', 'GERENTE', passwordForStorage(devPassword), 'CDMX - Edgar Lovera');
  console.log(`[DB] Usuario admin inicial creado: edgar / contraseña temporal: ${devPassword}`);
}

export default db;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function pickAllowed(data: any, allowed: string[]) {
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(data, key)) out[key] = data[key];
  }
  return out;
}

function updateById(table: string, idColumn: string, id: string, data: any, allowed: string[]) {
  const clean = pickAllowed(data || {}, allowed);
  const keys = Object.keys(clean);
  if (!keys.length) return { changes: 0 };
  const fields = keys.map(k => `${k}=@${k}`).join(',');
  return db.prepare(`UPDATE ${table} SET ${fields},updated_at=datetime('now') WHERE ${idColumn}=@id`).run({ ...clean, id });
}

export const Users = {
  getAll: () => db.prepare('SELECT * FROM users ORDER BY nombre').all(),
  getById: (uid: string) => db.prepare('SELECT * FROM users WHERE uid=?').get(uid),
  getByUsername: (username: string) => db.prepare('SELECT * FROM users WHERE username=?').get(username),
  getByEmail: (email: string) => db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(email),
  create: (data: any) => {
    const clean = { ...data, password: passwordForStorage(data.password) };
    const stmt = db.prepare(`
      INSERT INTO users (uid,nombre,email,username,role,password,zona,puesto,activo)
      VALUES (@uid,@nombre,@email,@username,@role,@password,@zona,@puesto,@activo)
    `);
    return stmt.run(clean);
  },
  update: (uid: string, data: any) => {
    const clean = { ...data };
    if (Object.prototype.hasOwnProperty.call(clean, 'password') && clean.password) {
      clean.password = passwordForStorage(clean.password);
    }
    return updateById('users', 'uid', uid, clean, ['nombre', 'email', 'username', 'role', 'password', 'zona', 'puesto', 'avatar', 'biometric_id', 'activo']);
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
  update: (id: string, data: any) => updateById('ventas', 'id', id, data, ['folio', 'asesor_id', 'asesor_nombre', 'status', 'nombres', 'apellidos', 'telefono', 'direccion', 'colonia', 'municipio', 'tipo_cliente', 'tipo_servicio', 'plan', 'renta_mensual', 'zona', 'notas', 'fecha_solicitud', 'fecha_instalacion', 'contrato_pdf', 'ine_pdf', 'comprobante_pdf', 'metadata']),
  delete: (id: string) => db.prepare('DELETE FROM ventas WHERE id=?').run(id),
};

const siacDateOrder = `
  CASE
    WHEN fecha_captura LIKE '__/__/____' THEN substr(fecha_captura, 7, 4) || '-' || substr(fecha_captura, 4, 2) || '-' || substr(fecha_captura, 1, 2)
    ELSE fecha_captura
  END DESC
`;

export const SiacRecords = {
  getAll: () => db.prepare(`SELECT * FROM siac_records ORDER BY ${siacDateOrder}`).all(),
  getPage: ({ limit = 200, offset = 0, q = '', updatedSince = '' }: { limit?: number; offset?: number; q?: string; updatedSince?: string }) => {
    const where: string[] = [];
    const params: Record<string, any> = { limit, offset };
    if (q) {
      where.push(`(
        folio_siac LIKE @q OR telefono_asignado LIKE @q OR telefono_portado LIKE @q
        OR telefono_referencia LIKE @q OR os_alta LIKE @q OR tienda LIKE @q
        OR zona LIKE @q OR distrito LIKE @q OR colonia LIKE @q
      )`);
      params.q = `%${q}%`;
    }
    if (updatedSince) {
      where.push('datetime(created_at) >= datetime(@updatedSince)');
      params.updatedSince = updatedSince;
    }
    return db.prepare(`
      SELECT * FROM siac_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${siacDateOrder}
      LIMIT @limit OFFSET @offset
    `).all(params);
  },
  search: (folio: string) => db.prepare(
    `SELECT * FROM siac_records
      WHERE folio_siac LIKE @q
         OR telefono_asignado LIKE @q
         OR telefono_portado LIKE @q
         OR telefono_referencia LIKE @q
         OR os_alta LIKE @q
         OR tienda LIKE @q
         OR zona LIKE @q
         OR distrito LIKE @q
         OR colonia LIKE @q
      ORDER BY ${siacDateOrder}
      LIMIT 50`
  ).all({ q: `%${folio}%` }),
  getByFolio: (folio: string) => db.prepare(
    'SELECT * FROM siac_records WHERE folio_siac = ?'
  ).get(folio),
  upsert: (data: any) => db.prepare(`
    INSERT INTO siac_records (
      id, source_id, folio_siac, fecha_captura, estrategia, promotor, estatus_siac,
      tipo_linea, linea_contratada, area, division, tienda, paquete,
      observaciones, respuesta_telmex, motivo_rechazo, telefono_asignado,
      telefono_portado, os_alta, fecha_os_alta, estatus_pisa,
      fecha_cambio_estatus, tipo_cliente, tipo_servicio, correo,
      estatus_etapa, campana, telefono_referencia, zona, distrito, colonia,
      usuario, morosidad
    ) VALUES (
      @id, @source_id, @folio_siac, @fecha_captura, @estrategia, @promotor, @estatus_siac,
      @tipo_linea, @linea_contratada, @area, @division, @tienda, @paquete,
      @observaciones, @respuesta_telmex, @motivo_rechazo, @telefono_asignado,
      @telefono_portado, @os_alta, @fecha_os_alta, @estatus_pisa,
      @fecha_cambio_estatus, @tipo_cliente, @tipo_servicio, @correo,
      @estatus_etapa, @campana, @telefono_referencia, @zona, @distrito, @colonia,
      @usuario, @morosidad
    ) ON CONFLICT(folio_siac) DO UPDATE SET
      source_id=excluded.source_id,
      fecha_captura=excluded.fecha_captura,
      estrategia=excluded.estrategia,
      promotor=excluded.promotor,
      estatus_siac=excluded.estatus_siac,
      tipo_linea=excluded.tipo_linea,
      linea_contratada=excluded.linea_contratada,
      area=excluded.area,
      division=excluded.division,
      tienda=excluded.tienda,
      paquete=excluded.paquete,
      estatus_pisa=excluded.estatus_pisa,
      estatus_etapa=excluded.estatus_etapa,
      telefono_asignado=excluded.telefono_asignado,
      telefono_portado=excluded.telefono_portado,
      os_alta=excluded.os_alta,
      fecha_os_alta=excluded.fecha_os_alta,
      fecha_cambio_estatus=excluded.fecha_cambio_estatus,
      tipo_cliente=excluded.tipo_cliente,
      tipo_servicio=excluded.tipo_servicio,
      correo=excluded.correo,
      campana=excluded.campana,
      observaciones=excluded.observaciones,
      respuesta_telmex=excluded.respuesta_telmex,
      motivo_rechazo=excluded.motivo_rechazo,
      telefono_referencia=excluded.telefono_referencia,
      zona=excluded.zona,
      distrito=excluded.distrito,
      colonia=excluded.colonia,
      usuario=excluded.usuario,
      morosidad=excluded.morosidad
  `).run({ source_id: null, usuario: null, morosidad: null, ...data }),
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
  getPage: ({ limit = 200, offset = 0, updatedSince = '' }: { limit?: number; offset?: number; updatedSince?: string }) => {
    if (updatedSince) {
      return db.prepare(`
        SELECT * FROM audit_log
        WHERE datetime(created_at) >= datetime(@updatedSince)
        ORDER BY created_at DESC
        LIMIT @limit OFFSET @offset
      `).all({ limit, offset, updatedSince });
    }
    return db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT @limit OFFSET @offset').all({ limit, offset });
  },
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
  getByUser: (userId: string) => db.prepare('SELECT * FROM quotas WHERE user_id=?').get(userId),
  set: (userId: string, input: any) => db.prepare(`
    INSERT INTO quotas (user_id,meta,periodo,mensaje,updated_by,notified_at,updated_at)
    VALUES (@user_id,@meta,@periodo,@mensaje,@updated_by,@notified_at,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      meta=excluded.meta,
      periodo=excluded.periodo,
      mensaje=excluded.mensaje,
      updated_by=excluded.updated_by,
      notified_at=excluded.notified_at,
      updated_at=excluded.updated_at
  `).run({
    user_id: userId,
    meta: Number(input?.meta || 0),
    periodo: input?.periodo || null,
    mensaje: input?.mensaje || null,
    updated_by: input?.updated_by || null,
    notified_at: input?.notified_at || null,
  }),
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

export const WeeklyFinancialCycles = {
  getAll: (limit = 200) => db.prepare('SELECT * FROM weekly_financial_cycles ORDER BY anio DESC, semana DESC, created_at DESC LIMIT ?').all(limit),
  getById: (id: string) => db.prepare('SELECT * FROM weekly_financial_cycles WHERE id=?').get(id),
  findDuplicates: (semana: number, anio: number, empresa: string, excludeId = '') => db.prepare(`
    SELECT * FROM weekly_financial_cycles
    WHERE semana=@semana AND anio=@anio AND lower(COALESCE(empresa,''))=lower(COALESCE(@empresa,''))
      AND (@excludeId='' OR id<>@excludeId)
    ORDER BY created_at DESC
  `).all({ semana, anio, empresa: empresa || '', excludeId }),
  create: (data: any) => db.prepare(`
    INSERT INTO weekly_financial_cycles (
      id, semana, anio, empresa, gerente, fecha_reporte, fecha_factura, fecha_deposito,
      estado, pago_gerente, iva, descuentos, total_pago_gerente, total_pago_promotor,
      total_facturar, monto_depositado, diferencia, xml_url, pdf_url, captura_url,
      captura_file_id, uuid_sat, ocr_text, ocr_provider, ocr_confidence, metadata
    ) VALUES (
      @id, @semana, @anio, @empresa, @gerente, @fecha_reporte, @fecha_factura, @fecha_deposito,
      @estado, @pago_gerente, @iva, @descuentos, @total_pago_gerente, @total_pago_promotor,
      @total_facturar, @monto_depositado, @diferencia, @xml_url, @pdf_url, @captura_url,
      @captura_file_id, @uuid_sat, @ocr_text, @ocr_provider, @ocr_confidence, @metadata
    )
  `).run({
    fecha_factura: null,
    fecha_deposito: null,
    estado: 'REPORTE_RECIBIDO',
    pago_gerente: 0,
    iva: 0,
    descuentos: 0,
    total_pago_gerente: 0,
    total_pago_promotor: 0,
    total_facturar: 0,
    monto_depositado: 0,
    diferencia: 0,
    xml_url: null,
    pdf_url: null,
    captura_url: null,
    captura_file_id: null,
    uuid_sat: null,
    ocr_text: null,
    ocr_provider: null,
    ocr_confidence: null,
    metadata: null,
    ...data,
  }),
  update: (id: string, data: any) => updateById('weekly_financial_cycles', 'id', id, data, [
    'semana', 'anio', 'empresa', 'gerente', 'fecha_reporte', 'fecha_factura', 'fecha_deposito',
    'estado', 'pago_gerente', 'iva', 'descuentos', 'total_pago_gerente', 'total_pago_promotor',
    'total_facturar', 'monto_depositado', 'diferencia', 'xml_url', 'pdf_url', 'captura_url',
    'captura_file_id', 'uuid_sat', 'ocr_text', 'ocr_provider', 'ocr_confidence', 'metadata',
  ]),
};

export const FinancialMovements = {
  getAll: (limit = 300) => db.prepare('SELECT * FROM financial_movements ORDER BY movement_date DESC, created_at DESC LIMIT ?').all(limit),
  getById: (id: string) => db.prepare('SELECT * FROM financial_movements WHERE id=?').get(id),
  getByCycle: (cycleId: string) => db.prepare('SELECT * FROM financial_movements WHERE cycle_id=? ORDER BY movement_date DESC, created_at DESC').all(cycleId),
  getFixedExpenses: (limit = 300) => db.prepare(`
    SELECT * FROM financial_movements
    WHERE source='fixed_expense' AND direction='egreso'
    ORDER BY movement_date DESC, created_at DESC
    LIMIT ?
  `).all(limit),
  create: (data: any) => db.prepare(`
    INSERT INTO financial_movements (id,cycle_id,type,category,description,amount,direction,movement_date,source,status,metadata)
    VALUES (@id,@cycle_id,@type,@category,@description,@amount,@direction,@movement_date,@source,@status,@metadata)
  `).run({
    id: data.id || randomUUID(),
    cycle_id: data.cycle_id || null,
    type: data.type || 'manual',
    category: data.category || 'general',
    description: data.description || null,
    amount: Number(data.amount || 0),
    direction: data.direction || 'egreso',
    movement_date: data.movement_date || new Date().toISOString(),
    source: data.source || 'manual',
    status: data.status || 'registrado',
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
  delete: (id: string) => db.prepare('DELETE FROM financial_movements WHERE id=?').run(id),
  deleteByCycleSource: (cycleId: string, source: string) => db.prepare('DELETE FROM financial_movements WHERE cycle_id=? AND source=?').run(cycleId, source),
};

export const FinancialAlerts = {
  getAll: (limit = 300) => db.prepare("SELECT * FROM financial_alerts ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, created_at DESC LIMIT ?").all(limit),
  getOpen: (limit = 100) => db.prepare("SELECT * FROM financial_alerts WHERE status='open' ORDER BY created_at DESC LIMIT ?").all(limit),
  getByCycle: (cycleId: string) => db.prepare('SELECT * FROM financial_alerts WHERE cycle_id=? ORDER BY created_at DESC').all(cycleId),
  upsert: (data: any) => {
    const existing = db.prepare("SELECT * FROM financial_alerts WHERE COALESCE(cycle_id,'')=COALESCE(@cycle_id,'') AND type=@type AND status='open' ORDER BY created_at DESC LIMIT 1").get({
      cycle_id: data.cycle_id || null,
      type: data.type,
    }) as any;
    if (existing) {
      return updateById('financial_alerts', 'id', existing.id, data, ['severity', 'title', 'message', 'amount', 'metadata', 'status']);
    }
    return db.prepare(`
      INSERT INTO financial_alerts (id,cycle_id,type,severity,title,message,status,amount,metadata)
      VALUES (@id,@cycle_id,@type,@severity,@title,@message,@status,@amount,@metadata)
    `).run({
      id: data.id || randomUUID(),
      cycle_id: data.cycle_id || null,
      type: data.type,
      severity: data.severity || 'warning',
      title: data.title,
      message: data.message || null,
      status: data.status || 'open',
      amount: data.amount ?? null,
      metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
    });
  },
  resolve: (id: string, metadata: any = {}) => updateById('financial_alerts', 'id', id, { status: 'resolved', metadata: JSON.stringify(metadata || {}) }, ['status', 'metadata']),
};

export const FinancialInvoices = {
  getAll: (limit = 200) => db.prepare('SELECT * FROM financial_invoices ORDER BY created_at DESC LIMIT ?').all(limit),
  getByCycle: (cycleId: string) => db.prepare('SELECT * FROM financial_invoices WHERE cycle_id=? ORDER BY created_at DESC').all(cycleId),
  create: (data: any) => db.prepare(`
    INSERT INTO financial_invoices (
      id,cycle_id,uuid_sat,fecha_factura,subtotal,iva,total,xml_url,pdf_url,xml_file_id,pdf_file_id,
      rfc_emisor,rfc_receptor,status,metadata
    ) VALUES (
      @id,@cycle_id,@uuid_sat,@fecha_factura,@subtotal,@iva,@total,@xml_url,@pdf_url,@xml_file_id,@pdf_file_id,
      @rfc_emisor,@rfc_receptor,@status,@metadata
    )
  `).run({
    id: data.id || randomUUID(),
    cycle_id: data.cycle_id,
    uuid_sat: data.uuid_sat || null,
    fecha_factura: data.fecha_factura || null,
    subtotal: Number(data.subtotal || 0),
    iva: Number(data.iva || 0),
    total: Number(data.total || 0),
    xml_url: data.xml_url || null,
    pdf_url: data.pdf_url || null,
    xml_file_id: data.xml_file_id || null,
    pdf_file_id: data.pdf_file_id || null,
    rfc_emisor: data.rfc_emisor || null,
    rfc_receptor: data.rfc_receptor || null,
    status: data.status || 'validada',
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
};

export const FinancialDeposits = {
  getAll: (limit = 200) => db.prepare('SELECT * FROM financial_deposits ORDER BY fecha_deposito DESC, created_at DESC LIMIT ?').all(limit),
  getByCycle: (cycleId: string) => db.prepare('SELECT * FROM financial_deposits WHERE cycle_id=? ORDER BY fecha_deposito DESC, created_at DESC').all(cycleId),
  create: (data: any) => db.prepare(`
    INSERT INTO financial_deposits (id,cycle_id,fecha_deposito,monto,banco,referencia,comprobante_url,file_id,status,metadata)
    VALUES (@id,@cycle_id,@fecha_deposito,@monto,@banco,@referencia,@comprobante_url,@file_id,@status,@metadata)
  `).run({
    id: data.id || randomUUID(),
    cycle_id: data.cycle_id,
    fecha_deposito: data.fecha_deposito || new Date().toISOString(),
    monto: Number(data.monto || 0),
    banco: data.banco || null,
    referencia: data.referencia || null,
    comprobante_url: data.comprobante_url || null,
    file_id: data.file_id || null,
    status: data.status || 'registrado',
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
};

export const FinancialPredictions = {
  getRecent: (limit = 50) => db.prepare('SELECT * FROM financial_predictions ORDER BY created_at DESC LIMIT ?').all(limit),
  create: (data: any) => db.prepare(`
    INSERT INTO financial_predictions (id,period,kind,prediction,confidence,metadata)
    VALUES (@id,@period,@kind,@prediction,@confidence,@metadata)
  `).run({
    id: data.id || randomUUID(),
    period: data.period,
    kind: data.kind,
    prediction: data.prediction,
    confidence: Number(data.confidence || 0),
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
};

export const FinancialAuditLogs = {
  getByCycle: (cycleId: string) => db.prepare('SELECT * FROM financial_audit_logs WHERE cycle_id=? ORDER BY created_at DESC').all(cycleId),
  insert: (data: any) => db.prepare(`
    INSERT INTO financial_audit_logs (id,cycle_id,action,actor_id,detail,metadata)
    VALUES (@id,@cycle_id,@action,@actor_id,@detail,@metadata)
  `).run({
    id: data.id || randomUUID(),
    cycle_id: data.cycle_id || null,
    action: data.action,
    actor_id: data.actor_id || null,
    detail: data.detail || null,
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
};

export const FinancialFiles = {
  getById: (id: string) => db.prepare('SELECT * FROM financial_files WHERE id=?').get(id),
  create: (data: any) => db.prepare(`
    INSERT INTO financial_files (
      id,cycle_id,tipo,file_name,mime_type,size_bytes,sha256,storage_provider,storage_path,download_url,uploaded_by
    ) VALUES (
      @id,@cycle_id,@tipo,@file_name,@mime_type,@size_bytes,@sha256,@storage_provider,@storage_path,@download_url,@uploaded_by
    )
  `).run(data),
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
  getById: (id: string) => db.prepare('SELECT * FROM validation_requests WHERE id=?').get(id),
  getBySaleId: (saleId: string) => db.prepare('SELECT * FROM validation_requests WHERE sale_id=? ORDER BY created_at DESC').all(saleId),
  create: (data: any) => {
    const allowed = [
      'id', 'sale_id', 'client_name', 'client_phone', 'status', 'resultado', 'notas',
      'provider', 'provider_call_id', 'conversation_id', 'call_sid', 'attempts',
      'call_status', 'proposed_result', 'summary', 'transcript_json', 'provider_payload_json',
      'sale_snapshot_json', 'last_error', 'review_status', 'script_type', 'reviewed_by', 'reviewed_at',
    ];
    const values = Object.fromEntries(allowed.map((key) => [key, data[key] ?? null]));
    values.status = values.status || 'pendiente';
    values.attempts = Number(values.attempts || 0);
    values.review_status = values.review_status || 'pending';
    const columns = allowed.filter((key) => values[key] !== undefined);
    const params = columns.map((key) => `@${key}`).join(',');
    return db.prepare(`INSERT INTO validation_requests (${columns.join(',')}) VALUES (${params})`).run(values);
  },
  update: (id: string, data: any) => {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k}=@${k}`).join(',');
    if (!fields) return { changes: 0 };
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

export const Sessions = {
  create: (data: any) => db.prepare(`
    INSERT INTO sessions (id,user_id,refresh_token,expires_at,ip,user_agent,webauthn_verified,webauthn_enrollment_required)
    VALUES (@id,@user_id,@refresh_token,@expires_at,@ip,@user_agent,@webauthn_verified,@webauthn_enrollment_required)
  `).run(data),
  getByRefreshToken: (token: string) => db.prepare('SELECT * FROM sessions WHERE refresh_token=?').get(token),
  revoke: (token: string) => db.prepare("UPDATE sessions SET revoked_at=datetime('now') WHERE refresh_token=?").run(token),
};

export const OAuthAccounts = {
  getByProviderUser: (provider: string, providerUserId: string) => db.prepare(
    'SELECT * FROM oauth_accounts WHERE provider=? AND provider_user_id=?'
  ).get(provider, providerUserId),
  upsert: (data: any) => db.prepare(`
    INSERT INTO oauth_accounts
      (id,user_id,provider,provider_user_id,email,email_verified,display_name,avatar_url)
    VALUES
      (@id,@user_id,@provider,@provider_user_id,@email,@email_verified,@display_name,@avatar_url)
    ON CONFLICT(provider, provider_user_id) DO UPDATE SET
      user_id=excluded.user_id,
      email=excluded.email,
      email_verified=excluded.email_verified,
      display_name=excluded.display_name,
      avatar_url=excluded.avatar_url,
      updated_at=datetime('now')
  `).run(data),
};

export const InventoryItems = {
  getAll: () => db.prepare('SELECT * FROM inventory_items ORDER BY created_at DESC').all(),
  getById: (id: string) => db.prepare('SELECT * FROM inventory_items WHERE id=?').get(id),
  create: (data: any) => db.prepare(`
    INSERT INTO inventory_items (id,sku,tipo,nombre,serial,estado,assigned_to,sale_id,notes)
    VALUES (@id,@sku,@tipo,@nombre,@serial,@estado,@assigned_to,@sale_id,@notes)
  `).run(data),
  update: (id: string, data: any) => updateById('inventory_items', 'id', id, data, ['sku', 'tipo', 'nombre', 'serial', 'estado', 'assigned_to', 'sale_id', 'notes']),
  delete: (id: string) => db.prepare('DELETE FROM inventory_items WHERE id=?').run(id),
};

export const AiJobs = {
  getAll: () => db.prepare('SELECT * FROM ai_jobs ORDER BY created_at DESC LIMIT 200').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO ai_jobs (id,type,payload,status,priority,attempts,result,error)
    VALUES (@id,@type,@payload,@status,@priority,@attempts,@result,@error)
  `).run(data),
  next: () => db.prepare(`
    SELECT * FROM ai_jobs WHERE status='queued' ORDER BY priority ASC, created_at ASC LIMIT 1
  `).get(),
  update: (id: string, data: any) => {
    const fields = Object.keys(data).map(k => `${k}=@${k}`).join(',');
    return db.prepare(`UPDATE ai_jobs SET ${fields},updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
};

export const TelmexAutomationJobs = {
  getAll: (limit = 200) => db.prepare('SELECT * FROM telmex_automation_jobs ORDER BY created_at DESC LIMIT ?').all(limit),
  getById: (id: string) => db.prepare('SELECT * FROM telmex_automation_jobs WHERE id=?').get(id),
  getBySale: (saleId: string) => db.prepare('SELECT * FROM telmex_automation_jobs WHERE sale_id=? ORDER BY created_at DESC').all(saleId),
  create: (data: any) => db.prepare(`
    INSERT INTO telmex_automation_jobs
      (id,action,status,current_step,progress,sale_id,captura_id,user_id,folio,payload,result,error,evidence,attempts)
    VALUES
      (@id,@action,@status,@current_step,@progress,@sale_id,@captura_id,@user_id,@folio,@payload,@result,@error,@evidence,@attempts)
  `).run(data),
  update: (id: string, data: any) => updateById(
    'telmex_automation_jobs',
    'id',
    id,
    data,
    ['status', 'current_step', 'progress', 'sale_id', 'captura_id', 'user_id', 'folio', 'payload', 'result', 'error', 'evidence', 'attempts']
  ),
};

export const AutomationRules = {
  getAll: () => db.prepare('SELECT * FROM automation_rules ORDER BY created_at DESC').all(),
  getEnabledByEvent: (event: string) => db.prepare(
    'SELECT * FROM automation_rules WHERE enabled=1 AND event=? ORDER BY created_at DESC'
  ).all(event),
  create: (data: any) => db.prepare(`
    INSERT INTO automation_rules (id,name,event,conditions,actions,enabled)
    VALUES (@id,@name,@event,@conditions,@actions,@enabled)
  `).run(data),
  update: (id: string, data: any) => updateById('automation_rules', 'id', id, data, ['name', 'event', 'conditions', 'actions', 'enabled']),
  delete: (id: string) => db.prepare('DELETE FROM automation_rules WHERE id=?').run(id),
};

function parseJson(value: any, fallback: any = null) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeConversation(row: any) {
  return row ? { ...row, memory: parseJson(row.memory, {}) } : null;
}

function normalizeMessage(row: any) {
  return row ? {
    ...row,
    conversationId: row.conversation_id,
    externalChatId: row.external_chat_id,
    fromName: row.from_name,
    isGroup: Boolean(row.is_group),
    metadata: parseJson(row.metadata, {}),
  } : null;
}

function normalizeDecision(row: any) {
  return row ? {
    ...row,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    extractedFields: parseJson(row.extracted_fields, {}),
    proposedActions: parseJson(row.proposed_actions, []),
    requiresApproval: Boolean(row.requires_approval),
  } : null;
}

function normalizeOutbox(row: any) {
  return row ? {
    ...row,
    conversationId: row.conversation_id,
    decisionId: row.decision_id,
    payload: parseJson(row.payload, {}),
    result: parseJson(row.result, null),
  } : null;
}

function normalizeAgentProfile(row: any) {
  return row ? {
    ...row,
    selfKnowledge: row.self_knowledge,
    knowledgeBase: row.knowledge_base,
    learnedNotes: parseJson(row.learned_notes, []),
    metadata: parseJson(row.metadata, {}),
  } : null;
}

const DEFAULT_ARIUX_MESSAGE = 'Hola, soy ARIUX 🤖 asistente virtual de Heavenly Dreams ✨. Estoy aquí para ayudarte y servirte en consulta de folios 🔎, guardar expedientes 📁 e iniciar flujos de captura 📝. ¿Qué necesitas hoy?';
const LEGACY_RECEPTIONIST_SELF_KNOWLEDGE = 'Soy ARIUX, el agente de WhatsApp y Telegram para promotores de Heavenly Dreams. Ayudo a consultar datos, iniciar conversaciones y ordenar informacion antes de pasarla al flujo operativo.';
const LEGACY_RECEPTIONIST_KNOWLEDGE_BASE = 'Para nuevo cliente debo pedir nombre, telefono, direccion, colonia, paquete de interes y documentos. Para folios debo pedir el folio SIAC y devolver el estatus disponible. Si falta informacion, hago preguntas cortas y concretas.';
const DEFAULT_AGENT_FUNCTIONS = [
  {
    id: 'consulta_folios',
    emoji: '🔎',
    title: 'Consulta de folios',
    description: 'Pedir folio SIAC, buscar estatus disponible y responder con el siguiente paso.',
    enabled: true,
  },
  {
    id: 'guardar_expedientes',
    emoji: '📁',
    title: 'Guardar expedientes',
    description: 'Ordenar documentos, imagenes, PDF y datos recibidos antes de pasarlos al flujo operativo.',
    enabled: true,
  },
  {
    id: 'iniciar_captura',
    emoji: '📝',
    title: 'Iniciar flujos de captura',
    description: 'Recolectar nombre, telefono, direccion, colonia, paquete y documentos para nueva venta.',
    enabled: true,
  },
  {
    id: 'seguimiento_chat',
    emoji: '💬',
    title: 'Atencion por chat',
    description: 'Responder dudas por WhatsApp o Telegram con tono claro, cordial y accionable.',
    enabled: true,
  },
];

const DEFAULT_RECEPTIONIST_PROFILE = {
  id: 'promoter_receptionist',
  name: 'ARIUX',
  role: 'Agente de promotores',
  personality: 'Cordial, claro, rapido y profesional. Habla como apoyo de campo: directo, atento y sin sonar como robot generico.',
  self_knowledge: DEFAULT_ARIUX_MESSAGE,
  knowledge_base: 'Funciones activas: 🔎 consultar folios SIAC, 📁 guardar expedientes, 📝 iniciar captura de venta y 💬 orientar por WhatsApp o Telegram. Para nuevo cliente debo pedir nombre, telefono, direccion, colonia, paquete de interes y documentos. Para folios debo pedir el folio SIAC y devolver el estatus disponible. Si falta informacion, hago preguntas cortas y concretas.',
  learned_notes: JSON.stringify([]),
  metadata: JSON.stringify({
    audience: 'promotores',
    channel: 'whatsapp_telegram',
    defaultMessage: DEFAULT_ARIUX_MESSAGE,
    functions: DEFAULT_AGENT_FUNCTIONS,
    humor: 'Ligero y respetuoso; solo usa humor cuando ayuda a bajar tension.',
    responseStyle: 'Responde breve, claro, accionable y con siguiente paso concreto.',
  }),
};

export const ChannelAccounts = {
  getAll: () => db.prepare('SELECT * FROM channel_accounts ORDER BY channel, created_at DESC').all(),
  upsert: (data: any) => db.prepare(`
    INSERT INTO channel_accounts (id,channel,label,external_id,status,metadata)
    VALUES (@id,@channel,@label,@external_id,@status,@metadata)
    ON CONFLICT(channel, external_id) DO UPDATE SET
      label=excluded.label,
      status=excluded.status,
      metadata=excluded.metadata,
      updated_at=datetime('now')
  `).run({
    ...data,
    id: data.id || randomUUID(),
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
};

export const ChannelConversations = {
  getAll: (limit = 200) => (db.prepare(`
    SELECT c.*,
      (SELECT body FROM channel_messages m WHERE m.conversation_id=c.id ORDER BY m.timestamp DESC LIMIT 1) AS last_body,
      (SELECT COUNT(*) FROM agent_outbox o WHERE o.conversation_id=c.id AND o.status='pending_approval') AS pending_outbox
    FROM channel_conversations c
    ORDER BY COALESCE(c.last_message_at, 0) DESC, c.created_at DESC
    LIMIT ?
  `).all(limit) as any[]).map(normalizeConversation),
  getById: (id: string) => normalizeConversation(db.prepare('SELECT * FROM channel_conversations WHERE id=?').get(id)),
  getByChannelChat: (channel: string, externalChatId: string) => normalizeConversation(db.prepare(
    'SELECT * FROM channel_conversations WHERE channel=? AND external_chat_id=?'
  ).get(channel, externalChatId)),
  upsert: (data: any) => {
    const id = data.id || randomUUID();
    db.prepare(`
      INSERT INTO channel_conversations
        (id,channel,external_chat_id,display_name,status,assigned_to,intent,confidence,memory,last_message_at)
      VALUES
        (@id,@channel,@external_chat_id,@display_name,@status,@assigned_to,@intent,@confidence,@memory,@last_message_at)
      ON CONFLICT(channel, external_chat_id) DO UPDATE SET
        display_name=COALESCE(excluded.display_name, channel_conversations.display_name),
        status=COALESCE(excluded.status, channel_conversations.status),
        intent=COALESCE(excluded.intent, channel_conversations.intent),
        confidence=CASE WHEN excluded.confidence > 0 THEN excluded.confidence ELSE channel_conversations.confidence END,
        memory=COALESCE(excluded.memory, channel_conversations.memory),
        last_message_at=MAX(COALESCE(channel_conversations.last_message_at, 0), COALESCE(excluded.last_message_at, 0)),
        updated_at=datetime('now')
    `).run({
      id,
      channel: data.channel,
      external_chat_id: data.external_chat_id,
      display_name: data.display_name || null,
      status: data.status || 'nuevo',
      assigned_to: data.assigned_to || null,
      intent: data.intent || null,
      confidence: Number(data.confidence || 0),
      memory: data.memory == null ? null : typeof data.memory === 'string' ? data.memory : JSON.stringify(data.memory),
      last_message_at: Number(data.last_message_at || Date.now()),
    });
    return ChannelConversations.getByChannelChat(data.channel, data.external_chat_id) || ChannelConversations.getById(id);
  },
  update: (id: string, data: any) => {
    const update = { ...data };
    if (Object.prototype.hasOwnProperty.call(update, 'memory') && typeof update.memory !== 'string') update.memory = JSON.stringify(update.memory || {});
    return updateById('channel_conversations', 'id', id, update, ['display_name', 'status', 'assigned_to', 'intent', 'confidence', 'memory', 'last_message_at']);
  },
};

export const ChannelMessages = {
  getRecent: (limit = 150, updatedSince = '') => {
    const rows = updatedSince
      ? db.prepare(`
          SELECT m.* FROM channel_messages m
          WHERE m.timestamp >= @sinceMs OR datetime(m.created_at) >= datetime(@updatedSince)
          ORDER BY m.timestamp DESC LIMIT @limit
        `).all({ limit, updatedSince, sinceMs: Date.parse(updatedSince) || 0 })
      : db.prepare(`
          SELECT m.* FROM channel_messages m ORDER BY m.timestamp DESC LIMIT ?
        `).all(limit);
    return (rows as any[]).map(normalizeMessage).reverse();
  },
  getByConversation: (conversationId: string, limit = 200, updatedSince = '') => {
    const rows = updatedSince
      ? db.prepare(`
          SELECT * FROM channel_messages
          WHERE conversation_id=@conversationId
            AND (timestamp >= @sinceMs OR datetime(created_at) >= datetime(@updatedSince))
          ORDER BY timestamp ASC LIMIT @limit
        `).all({ conversationId, limit, updatedSince, sinceMs: Date.parse(updatedSince) || 0 })
      : db.prepare(`
          SELECT * FROM channel_messages WHERE conversation_id=? ORDER BY timestamp ASC LIMIT ?
        `).all(conversationId, limit);
    return (rows as any[]).map(normalizeMessage);
  },
  getById: (id: string) => normalizeMessage(db.prepare('SELECT * FROM channel_messages WHERE id=?').get(id)),
  create: (data: any) => {
    const result = db.prepare(`
      INSERT OR IGNORE INTO channel_messages
        (id,conversation_id,channel,external_chat_id,direction,body,from_name,to_id,timestamp,is_group,metadata)
      VALUES
        (@id,@conversation_id,@channel,@external_chat_id,@direction,@body,@from_name,@to_id,@timestamp,@is_group,@metadata)
    `).run({
      ...data,
      timestamp: Number(data.timestamp || Date.now()),
      is_group: data.is_group ? 1 : 0,
      metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
    });
    return { created: result.changes > 0, message: ChannelMessages.getById(data.id) };
  },
};

export const AgentDecisions = {
  getRecent: (limit = 100) => (db.prepare('SELECT * FROM agent_decisions ORDER BY created_at DESC LIMIT ?').all(limit) as any[]).map(normalizeDecision),
  getByMessage: (messageId: string) => normalizeDecision(db.prepare('SELECT * FROM agent_decisions WHERE message_id=? ORDER BY created_at DESC LIMIT 1').get(messageId)),
  getByConversation: (conversationId: string, limit = 100) => (db.prepare(
    'SELECT * FROM agent_decisions WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?'
  ).all(conversationId, limit) as any[]).map(normalizeDecision),
  create: (data: any) => {
    db.prepare(`
      INSERT INTO agent_decisions
        (id,conversation_id,message_id,agent,intent,confidence,extracted_fields,proposed_reply,proposed_actions,requires_approval,status)
      VALUES
        (@id,@conversation_id,@message_id,@agent,@intent,@confidence,@extracted_fields,@proposed_reply,@proposed_actions,@requires_approval,@status)
    `).run({
      ...data,
      id: data.id || randomUUID(),
      confidence: Number(data.confidence || 0),
      extracted_fields: typeof data.extracted_fields === 'string' ? data.extracted_fields : JSON.stringify(data.extracted_fields || {}),
      proposed_actions: typeof data.proposed_actions === 'string' ? data.proposed_actions : JSON.stringify(data.proposed_actions || []),
      requires_approval: data.requires_approval === false ? 0 : 1,
      status: data.status || 'pending_approval',
    });
  },
};

export const AgentTasks = {
  getAll: (limit = 100) => db.prepare('SELECT * FROM agent_tasks ORDER BY created_at DESC LIMIT ?').all(limit),
  create: (data: any) => db.prepare(`
    INSERT INTO agent_tasks (id,conversation_id,type,title,status,due_at,assigned_to,metadata)
    VALUES (@id,@conversation_id,@type,@title,@status,@due_at,@assigned_to,@metadata)
  `).run({
    ...data,
    id: data.id || randomUUID(),
    status: data.status || 'open',
    metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
  }),
  update: (id: string, data: any) => updateById('agent_tasks', 'id', id, data, ['type', 'title', 'status', 'due_at', 'assigned_to', 'metadata']),
};

export const AgentProfiles = {
  getById: (id: string) => {
    let row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
    if (row && id === DEFAULT_RECEPTIONIST_PROFILE.id && String(row.name || '').trim().toLowerCase() === 'agente heavenly') {
      const existing = normalizeAgentProfile(row) as any;
      AgentProfiles.upsert({
        id,
        name: DEFAULT_RECEPTIONIST_PROFILE.name,
        role: DEFAULT_RECEPTIONIST_PROFILE.role,
        personality: existing?.personality || DEFAULT_RECEPTIONIST_PROFILE.personality,
        selfKnowledge: existing?.selfKnowledge || DEFAULT_RECEPTIONIST_PROFILE.self_knowledge,
        knowledgeBase: existing?.knowledgeBase || DEFAULT_RECEPTIONIST_PROFILE.knowledge_base,
        learnedNotes: existing?.learnedNotes || [],
        metadata: {
          ...parseJson(DEFAULT_RECEPTIONIST_PROFILE.metadata, {}),
          ...(existing?.metadata || {}),
          migratedFrom: 'Agente Heavenly',
        },
      });
      row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
    }
    if (row && id === DEFAULT_RECEPTIONIST_PROFILE.id) {
      const existing = normalizeAgentProfile(row) as any;
      const metadata = existing?.metadata || {};
      const needsDefaultMessage = !metadata.defaultMessage;
      const needsDefaultFunctions = !Array.isArray(metadata.functions);
      const needsLegacySelfKnowledge = String(existing?.selfKnowledge || '').trim() === LEGACY_RECEPTIONIST_SELF_KNOWLEDGE;
      const needsLegacyKnowledgeBase = String(existing?.knowledgeBase || '').trim() === LEGACY_RECEPTIONIST_KNOWLEDGE_BASE;
      if (needsDefaultMessage || needsDefaultFunctions || needsLegacySelfKnowledge || needsLegacyKnowledgeBase) {
        AgentProfiles.upsert({
          id,
          name: existing?.name || DEFAULT_RECEPTIONIST_PROFILE.name,
          role: existing?.role || DEFAULT_RECEPTIONIST_PROFILE.role,
          personality: existing?.personality || DEFAULT_RECEPTIONIST_PROFILE.personality,
          selfKnowledge: needsLegacySelfKnowledge ? DEFAULT_RECEPTIONIST_PROFILE.self_knowledge : existing?.selfKnowledge,
          knowledgeBase: needsLegacyKnowledgeBase ? DEFAULT_RECEPTIONIST_PROFILE.knowledge_base : existing?.knowledgeBase,
          learnedNotes: existing?.learnedNotes || [],
          metadata: {
            ...parseJson(DEFAULT_RECEPTIONIST_PROFILE.metadata, {}),
            ...metadata,
            defaultMessage: metadata.defaultMessage || DEFAULT_ARIUX_MESSAGE,
            functions: Array.isArray(metadata.functions) ? metadata.functions : DEFAULT_AGENT_FUNCTIONS,
          },
        });
        row = db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id) as any;
      }
    }
    if (row) return normalizeAgentProfile(row);
    if (id === DEFAULT_RECEPTIONIST_PROFILE.id) {
      AgentProfiles.upsert(DEFAULT_RECEPTIONIST_PROFILE);
      return normalizeAgentProfile(db.prepare('SELECT * FROM agent_profiles WHERE id=?').get(id));
    }
    return null;
  },
  upsert: (data: any) => {
    const clean = {
      id: data.id,
      name: data.name || DEFAULT_RECEPTIONIST_PROFILE.name,
      role: data.role || DEFAULT_RECEPTIONIST_PROFILE.role,
      personality: data.personality || '',
      self_knowledge: data.self_knowledge ?? data.selfKnowledge ?? '',
      knowledge_base: data.knowledge_base ?? data.knowledgeBase ?? '',
      learned_notes: typeof data.learned_notes === 'string'
        ? data.learned_notes
        : JSON.stringify(data.learnedNotes || data.learned_notes || []),
      metadata: typeof data.metadata === 'string' ? data.metadata : JSON.stringify(data.metadata || {}),
    };
    return db.prepare(`
      INSERT INTO agent_profiles
        (id,name,role,personality,self_knowledge,knowledge_base,learned_notes,metadata)
      VALUES
        (@id,@name,@role,@personality,@self_knowledge,@knowledge_base,@learned_notes,@metadata)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        role=excluded.role,
        personality=excluded.personality,
        self_knowledge=excluded.self_knowledge,
        knowledge_base=excluded.knowledge_base,
        learned_notes=excluded.learned_notes,
        metadata=excluded.metadata,
        updated_at=datetime('now')
    `).run(clean);
  },
  update: (id: string, data: any) => {
    const existing = AgentProfiles.getById(id) as any;
    if (!existing) return null;
    AgentProfiles.upsert({
      id,
      name: data.name ?? existing.name,
      role: data.role ?? existing.role,
      personality: data.personality ?? existing.personality,
      selfKnowledge: data.selfKnowledge ?? data.self_knowledge ?? existing.selfKnowledge,
      knowledgeBase: data.knowledgeBase ?? data.knowledge_base ?? existing.knowledgeBase,
      learnedNotes: data.learnedNotes ?? data.learned_notes ?? existing.learnedNotes ?? [],
      metadata: data.metadata ?? existing.metadata ?? {},
    });
    return AgentProfiles.getById(id);
  },
};

export const AgentOutbox = {
  getAll: (limit = 200) => (db.prepare(`
    SELECT o.*, c.display_name, c.intent
    FROM agent_outbox o
    LEFT JOIN channel_conversations c ON c.id=o.conversation_id
    ORDER BY CASE o.status WHEN 'pending_approval' THEN 0 ELSE 1 END, o.created_at DESC
    LIMIT ?
  `).all(limit) as any[]).map(normalizeOutbox),
  getByConversation: (conversationId: string, limit = 100) => (db.prepare(
    'SELECT * FROM agent_outbox WHERE conversation_id=? ORDER BY created_at DESC LIMIT ?'
  ).all(conversationId, limit) as any[]).map(normalizeOutbox),
  getById: (id: string) => normalizeOutbox(db.prepare('SELECT * FROM agent_outbox WHERE id=?').get(id)),
  create: (data: any) => {
    const id = data.id || randomUUID();
    db.prepare(`
      INSERT INTO agent_outbox
        (id,conversation_id,decision_id,type,status,channel,target,message,action,payload,result,error)
      VALUES
        (@id,@conversation_id,@decision_id,@type,@status,@channel,@target,@message,@action,@payload,@result,@error)
    `).run({
      ...data,
      id,
      status: data.status || 'pending_approval',
      payload: typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload || {}),
      result: data.result == null ? null : typeof data.result === 'string' ? data.result : JSON.stringify(data.result),
      error: data.error || null,
    });
    return AgentOutbox.getById(id);
  },
  update: (id: string, data: any) => {
    const update = { ...data };
    if (Object.prototype.hasOwnProperty.call(update, 'payload') && typeof update.payload !== 'string') update.payload = JSON.stringify(update.payload || {});
    if (Object.prototype.hasOwnProperty.call(update, 'result') && typeof update.result !== 'string') update.result = JSON.stringify(update.result || null);
    return updateById('agent_outbox', 'id', id, update, ['status', 'message', 'action', 'payload', 'result', 'error', 'approved_by', 'approved_at', 'rejected_by', 'rejected_at']);
  },
};

export const Metrics = {
  getRecent: (limit = 200) => db.prepare('SELECT * FROM metrics ORDER BY created_at DESC LIMIT ?').all(limit),
  insert: (data: any) => db.prepare(`
    INSERT INTO metrics (id,name,value,tags) VALUES (@id,@name,@value,@tags)
  `).run(data),
};

export const Capturas = {
  getAll: () => db.prepare('SELECT * FROM capturas ORDER BY fecha_captura DESC').all(),
  getById: (id: string) => db.prepare('SELECT * FROM capturas WHERE id=?').get(id),
  getByFolio: (folio: string) => db.prepare('SELECT * FROM capturas WHERE folio=?').get(folio),
  create: (data: any) => db.prepare(`
    INSERT INTO capturas (
      id, venta_id, folio, fecha_captura, vendedor_id, supervisor_id,
      cliente_nombre, telefono, correo, curp, rfc, ine_numero,
      tipo_servicio, paquete, status_captura, status_validacion, status_instalacion,
      status_documentos, fecha_instalacion, tipo_vialidad, calle, numero_exterior,
      numero_interior, edificio, departamento, piso, torre, manzana, lote, privada,
      sector, etapa, unidad_habitacional, referencias, codigo_postal, colonia,
      ciudad, delegacion, direccion_completa, latitud, longitud, precision_gps,
      gps_timestamp, observaciones, metadata
    ) VALUES (
      @id, @venta_id, @folio, @fecha_captura, @vendedor_id, @supervisor_id,
      @cliente_nombre, @telefono, @correo, @curp, @rfc, @ine_numero,
      @tipo_servicio, @paquete, @status_captura, @status_validacion, @status_instalacion,
      @status_documentos, @fecha_instalacion, @tipo_vialidad, @calle, @numero_exterior,
      @numero_interior, @edificio, @departamento, @piso, @torre, @manzana, @lote, @privada,
      @sector, @etapa, @unidad_habitacional, @referencias, @codigo_postal, @colonia,
      @ciudad, @delegacion, @direccion_completa, @latitud, @longitud, @precision_gps,
      @gps_timestamp, @observaciones, @metadata
    )
    ON CONFLICT(folio) DO UPDATE SET
      venta_id=excluded.venta_id,
      vendedor_id=excluded.vendedor_id,
      cliente_nombre=excluded.cliente_nombre,
      telefono=excluded.telefono,
      correo=excluded.correo,
      curp=excluded.curp,
      tipo_servicio=excluded.tipo_servicio,
      paquete=excluded.paquete,
      status_captura=excluded.status_captura,
      status_validacion=excluded.status_validacion,
      status_instalacion=excluded.status_instalacion,
      status_documentos=excluded.status_documentos,
      fecha_instalacion=excluded.fecha_instalacion,
      tipo_vialidad=excluded.tipo_vialidad,
      calle=excluded.calle,
      numero_exterior=excluded.numero_exterior,
      numero_interior=excluded.numero_interior,
      edificio=excluded.edificio,
      departamento=excluded.departamento,
      piso=excluded.piso,
      torre=excluded.torre,
      manzana=excluded.manzana,
      lote=excluded.lote,
      privada=excluded.privada,
      sector=excluded.sector,
      etapa=excluded.etapa,
      unidad_habitacional=excluded.unidad_habitacional,
      referencias=excluded.referencias,
      codigo_postal=excluded.codigo_postal,
      colonia=excluded.colonia,
      ciudad=excluded.ciudad,
      delegacion=excluded.delegacion,
      direccion_completa=excluded.direccion_completa,
      latitud=excluded.latitud,
      longitud=excluded.longitud,
      precision_gps=excluded.precision_gps,
      gps_timestamp=excluded.gps_timestamp,
      observaciones=excluded.observaciones,
      metadata=excluded.metadata,
      updated_at=datetime('now')
  `).run(data),
  update: (id: string, data: any) => updateById('capturas', 'id', id, data, [
    'supervisor_id', 'cliente_nombre', 'telefono', 'correo', 'curp', 'rfc', 'ine_numero',
    'tipo_servicio', 'paquete', 'status_captura', 'status_validacion', 'status_instalacion',
    'status_documentos', 'fecha_instalacion', 'tipo_vialidad', 'calle', 'numero_exterior',
    'numero_interior', 'edificio', 'departamento', 'piso', 'torre', 'manzana', 'lote',
    'privada', 'sector', 'etapa', 'unidad_habitacional', 'referencias', 'codigo_postal',
    'colonia', 'ciudad', 'delegacion', 'direccion_completa', 'latitud', 'longitud',
    'precision_gps', 'gps_timestamp', 'observaciones', 'metadata',
  ]),
};

export const DocumentosCliente = {
  getByCaptura: (capturaId: string) => db.prepare('SELECT * FROM documentos_cliente WHERE captura_id=? ORDER BY tipo_documento').all(capturaId),
  upsert: (data: any) => db.prepare(`
    INSERT INTO documentos_cliente
      (id,captura_id,tipo_documento,archivo_url,archivo_nombre,status_documento,validado_por,fecha_validacion,observaciones)
    VALUES
      (@id,@captura_id,@tipo_documento,@archivo_url,@archivo_nombre,@status_documento,@validado_por,@fecha_validacion,@observaciones)
    ON CONFLICT(captura_id,tipo_documento) DO UPDATE SET
      archivo_url=excluded.archivo_url,
      archivo_nombre=excluded.archivo_nombre,
      status_documento=excluded.status_documento,
      validado_por=excluded.validado_por,
      fecha_validacion=excluded.fecha_validacion,
      observaciones=excluded.observaciones,
      updated_at=datetime('now')
  `).run(data),
};

export const DocumentFiles = {
  getAll: (limit = 300) => db.prepare('SELECT * FROM document_files ORDER BY created_at DESC LIMIT ?').all(limit),
  getPage: ({ limit = 300, offset = 0, updatedSince = '' }: { limit?: number; offset?: number; updatedSince?: string }) => {
    if (updatedSince) {
      return db.prepare(`
        SELECT * FROM document_files
        WHERE datetime(created_at) >= datetime(@updatedSince)
        ORDER BY created_at DESC
        LIMIT @limit OFFSET @offset
      `).all({ limit, offset, updatedSince });
    }
    return db.prepare('SELECT * FROM document_files ORDER BY created_at DESC LIMIT @limit OFFSET @offset').all({ limit, offset });
  },
  getById: (id: string) => db.prepare('SELECT * FROM document_files WHERE id=?').get(id),
  getByCapture: (captureId: string) => db.prepare('SELECT * FROM document_files WHERE captura_id=? ORDER BY created_at DESC').all(captureId),
  create: (data: any) => db.prepare(`
    INSERT INTO document_files
      (id,captura_id,venta_id,tipo_documento,archivo_nombre,mime_type,size_bytes,sha256,storage_provider,storage_path,review_status,manipulation_score,review_notes,uploaded_by)
    VALUES
      (@id,@captura_id,@venta_id,@tipo_documento,@archivo_nombre,@mime_type,@size_bytes,@sha256,@storage_provider,@storage_path,@review_status,@manipulation_score,@review_notes,@uploaded_by)
  `).run(data),
  updateReview: (id: string, data: any) => updateById('document_files', 'id', id, data, ['review_status', 'manipulation_score', 'review_notes']),
};

export const ClientesCrm = {
  getAll: () => db.prepare('SELECT * FROM clientes_crm ORDER BY created_at DESC').all(),
  getById: (id: string) => db.prepare('SELECT * FROM clientes_crm WHERE id=?').get(id),
  upsert: (data: any) => db.prepare(`
    INSERT INTO clientes_crm
      (id,captura_id,folio,nombre,telefono,whatsapp,correo,direccion,fecha_alta,status_cliente,ultimo_contacto,proximo_seguimiento,nivel_satisfaccion,riesgo_cancelacion,vendedor_asignado,metadata)
    VALUES
      (@id,@captura_id,@folio,@nombre,@telefono,@whatsapp,@correo,@direccion,@fecha_alta,@status_cliente,@ultimo_contacto,@proximo_seguimiento,@nivel_satisfaccion,@riesgo_cancelacion,@vendedor_asignado,@metadata)
    ON CONFLICT(folio) DO UPDATE SET
      captura_id=excluded.captura_id,
      nombre=excluded.nombre,
      telefono=excluded.telefono,
      whatsapp=excluded.whatsapp,
      correo=excluded.correo,
      direccion=excluded.direccion,
      status_cliente=excluded.status_cliente,
      proximo_seguimiento=excluded.proximo_seguimiento,
      riesgo_cancelacion=excluded.riesgo_cancelacion,
      vendedor_asignado=excluded.vendedor_asignado,
      metadata=excluded.metadata,
      updated_at=datetime('now')
  `).run(data),
  update: (id: string, data: any) => updateById('clientes_crm', 'id', id, data, [
    'nombre', 'telefono', 'whatsapp', 'correo', 'direccion', 'fecha_alta',
    'status_cliente', 'ultimo_contacto', 'proximo_seguimiento',
    'nivel_satisfaccion', 'riesgo_cancelacion', 'vendedor_asignado', 'metadata',
  ]),
};

export const Morosidad = {
  getAll: () => db.prepare('SELECT * FROM morosidad ORDER BY dias_atraso DESC, created_at DESC').all(),
  upsert: (data: any) => db.prepare(`
    INSERT INTO morosidad
      (id,folio,cliente_id,monto_adeudo,dias_atraso,fecha_vencimiento,ultimo_pago,status_cobranza,gestor_asignado,convenio,observaciones,metadata)
    VALUES
      (@id,@folio,@cliente_id,@monto_adeudo,@dias_atraso,@fecha_vencimiento,@ultimo_pago,@status_cobranza,@gestor_asignado,@convenio,@observaciones,@metadata)
    ON CONFLICT(id) DO UPDATE SET
      monto_adeudo=excluded.monto_adeudo,
      dias_atraso=excluded.dias_atraso,
      fecha_vencimiento=excluded.fecha_vencimiento,
      ultimo_pago=excluded.ultimo_pago,
      status_cobranza=excluded.status_cobranza,
      gestor_asignado=excluded.gestor_asignado,
      convenio=excluded.convenio,
      observaciones=excluded.observaciones,
      metadata=excluded.metadata,
      updated_at=datetime('now')
  `).run(data),
};

export const EstatusFolios = {
  getAll: () => db.prepare('SELECT * FROM estatus_folios ORDER BY fecha_movimiento DESC').all(),
  upsert: (data: any) => db.prepare(`
    INSERT INTO estatus_folios
      (id,captura_id,folio,status_actual,subestatus,area_actual,tecnico_asignado,fecha_movimiento,observaciones,documentos_faltantes,avance,metadata)
    VALUES
      (@id,@captura_id,@folio,@status_actual,@subestatus,@area_actual,@tecnico_asignado,@fecha_movimiento,@observaciones,@documentos_faltantes,@avance,@metadata)
    ON CONFLICT(folio) DO UPDATE SET
      captura_id=excluded.captura_id,
      status_actual=excluded.status_actual,
      subestatus=excluded.subestatus,
      area_actual=excluded.area_actual,
      tecnico_asignado=excluded.tecnico_asignado,
      fecha_movimiento=excluded.fecha_movimiento,
      observaciones=excluded.observaciones,
      documentos_faltantes=excluded.documentos_faltantes,
      avance=excluded.avance,
      metadata=excluded.metadata,
      updated_at=datetime('now')
  `).run(data),
};

export const LogsSistema = {
  insert: (data: any) => db.prepare(`
    INSERT INTO logs_sistema (id,accion,entidad,entidad_id,user_id,detalle,ip,dispositivo,metadata)
    VALUES (@id,@accion,@entidad,@entidad_id,@user_id,@detalle,@ip,@dispositivo,@metadata)
  `).run(data),
};

export const WebAuthnCredentials = {
  getByUser: (userId: string) => db.prepare('SELECT * FROM webauthn_credentials WHERE user_id=? ORDER BY created_at DESC').all(userId),
  getByCredentialId: (credentialId: string) => db.prepare('SELECT * FROM webauthn_credentials WHERE credential_id=?').get(credentialId),
  create: (data: any) => db.prepare(`
    INSERT INTO webauthn_credentials
      (id,user_id,credential_id,public_key,counter,transports,device_type,backed_up)
    VALUES
      (@id,@user_id,@credential_id,@public_key,@counter,@transports,@device_type,@backed_up)
  `).run(data),
  updateCounter: (credentialId: string, counter: number) => db.prepare(`
    UPDATE webauthn_credentials SET counter=?, updated_at=datetime('now') WHERE credential_id=?
  `).run(counter, credentialId),
};

export const WebAuthnChallenges = {
  set: (data: any) => db.prepare(`
    INSERT INTO webauthn_challenges (id,user_id,challenge,type,expires_at)
    VALUES (@id,@user_id,@challenge,@type,@expires_at)
  `).run(data),
  consume: (userId: string, type: string, challenge: string) => {
    const row = db.prepare(`
      SELECT * FROM webauthn_challenges
      WHERE user_id=? AND type=? AND challenge=? AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(userId, type, challenge) as any;
    if (row) db.prepare('DELETE FROM webauthn_challenges WHERE id=?').run(row.id);
    return row;
  },
  clearExpired: () => db.prepare("DELETE FROM webauthn_challenges WHERE expires_at <= datetime('now')").run(),
};
