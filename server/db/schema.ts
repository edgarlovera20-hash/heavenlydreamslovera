import { db, updateById, encryptSecret } from './connection';
import { hashPassword, isPasswordHash } from '../passwords';
import { randomUUID } from 'crypto';

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
} catch (e: any) {
  // Silently ignore "no such table" on first run — table is created right below
  if (!(e?.code === 'SQLITE_ERROR' && String(e?.message || '').includes('no such table'))) {
    console.warn('[DB] Migración siac_records omitida:', e);
  }
}

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

  CREATE TABLE IF NOT EXISTS user_avatars (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL UNIQUE,
    avatar_url      TEXT,
    border_style    TEXT NOT NULL DEFAULT 'neural',
    colors          TEXT,
    effects         TEXT,
    animation_speed REAL NOT NULL DEFAULT 1,
    rarity          TEXT NOT NULL DEFAULT 'rare',
    ai_generated    INTEGER NOT NULL DEFAULT 1,
    status_effect   TEXT NOT NULL DEFAULT 'online',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(uid) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS integration_secrets (
    id              TEXT PRIMARY KEY,
    provider        TEXT NOT NULL,
    label           TEXT NOT NULL,
    key_name        TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    value_last4     TEXT,
    status          TEXT NOT NULL DEFAULT 'active',
    metadata        TEXT,
    created_by      TEXT,
    updated_by      TEXT,
    revoked_at      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- CRM operativo para Consulta y Seguimiento
  CREATE TABLE IF NOT EXISTS crm_followups (
    id             TEXT PRIMARY KEY,
    folio_siac     TEXT NOT NULL,
    action         TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pendiente',
    next_at        TEXT,
    responsible_id TEXT,
    responsible_name TEXT,
    comment        TEXT,
    metadata       TEXT,
    created_by     TEXT,
    created_by_name TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_notes (
    id              TEXT PRIMARY KEY,
    folio_siac      TEXT NOT NULL,
    note            TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'media',
    visibility      TEXT NOT NULL DEFAULT 'equipo',
    attachments     TEXT,
    created_by      TEXT,
    created_by_name TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS crm_visibility_rules (
    id          TEXT PRIMARY KEY,
    scope_type  TEXT NOT NULL DEFAULT 'role',
    scope_id    TEXT NOT NULL,
    field       TEXT NOT NULL,
    visible     INTEGER NOT NULL DEFAULT 1,
    updated_by  TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(scope_type, scope_id, field)
  );

  CREATE TABLE IF NOT EXISTS crm_saved_searches (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    filters     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Automatizacion Email -> CSV/XLSX -> CRM
  CREATE TABLE IF NOT EXISTS email_sync_accounts (
    id              TEXT PRIMARY KEY,
    provider        TEXT NOT NULL DEFAULT 'gmail',
    label           TEXT NOT NULL,
    email           TEXT,
    query           TEXT,
    client_id       TEXT,
    client_secret   TEXT,
    refresh_token   TEXT,
    enabled         INTEGER NOT NULL DEFAULT 0,
    last_run_at     TEXT,
    last_error      TEXT,
    created_by      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS email_sync_jobs (
    id               TEXT PRIMARY KEY,
    account_id       TEXT,
    provider         TEXT NOT NULL DEFAULT 'gmail',
    source           TEXT NOT NULL DEFAULT 'manual',
    message_id       TEXT,
    sender           TEXT,
    subject          TEXT,
    file_name        TEXT,
    file_type        TEXT,
    detected_type    TEXT,
    status           TEXT NOT NULL DEFAULT 'queued',
    imported         INTEGER NOT NULL DEFAULT 0,
    skipped          INTEGER NOT NULL DEFAULT 0,
    errors           TEXT,
    warnings         TEXT,
    metadata         TEXT,
    fingerprint      TEXT,
    started_at       TEXT,
    finished_at      TEXT,
    created_by       TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(message_id, file_name)
  );

  CREATE TABLE IF NOT EXISTS email_sync_attachments (
    id          TEXT PRIMARY KEY,
    job_id      TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    mime_type   TEXT,
    size_bytes  INTEGER DEFAULT 0,
    fingerprint TEXT,
    storage_ref TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES email_sync_jobs(id) ON DELETE CASCADE
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

  CREATE TABLE IF NOT EXISTS didit_checks (
    id                   TEXT PRIMARY KEY,
    kind                 TEXT NOT NULL,
    provider_request_id  TEXT,
    status               TEXT,
    vendor_data          TEXT,
    capture_id           TEXT,
    document_file_ids    TEXT,
    request_summary      TEXT,
    response_json        TEXT,
    created_by           TEXT,
    created_at           TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (capture_id) REFERENCES capturas(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(uid) ON DELETE SET NULL
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
  CREATE INDEX IF NOT EXISTS idx_crm_followups_folio ON crm_followups (folio_siac, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_crm_followups_status ON crm_followups (status, next_at);
  CREATE INDEX IF NOT EXISTS idx_crm_notes_folio ON crm_notes (folio_siac, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_crm_visibility_scope ON crm_visibility_rules (scope_type, scope_id);
  CREATE INDEX IF NOT EXISTS idx_crm_saved_user ON crm_saved_searches (user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_sync_jobs_created ON email_sync_jobs (created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_sync_jobs_status ON email_sync_jobs (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_sync_jobs_type ON email_sync_jobs (detected_type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_email_sync_accounts_enabled ON email_sync_accounts (enabled, updated_at DESC);
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
  CREATE INDEX IF NOT EXISTS idx_morosidad_cliente ON morosidad (cliente_id);
  CREATE INDEX IF NOT EXISTS idx_morosidad_folio   ON morosidad (folio);
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
  CREATE INDEX IF NOT EXISTS idx_didit_checks_kind ON didit_checks (kind, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_didit_checks_capture ON didit_checks (capture_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_didit_checks_status ON didit_checks (status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_user_avatars_user ON user_avatars (user_id);

  -- Performance indexes for 1000-concurrent-user load
  CREATE INDEX IF NOT EXISTS idx_crm_followups_folio_status  ON crm_followups (folio_siac, status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_crm_notes_folio_vis         ON crm_notes (folio_siac, visibility);
  CREATE INDEX IF NOT EXISTS idx_morosidad_status_dias       ON morosidad (status_cobranza, dias_atraso DESC);
  CREATE INDEX IF NOT EXISTS idx_clientes_crm_status_follow  ON clientes_crm (status_cliente, proximo_seguimiento);
  CREATE INDEX IF NOT EXISTS idx_validation_req_status_order ON validation_requests (status, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_siac_morosidad_field        ON siac_records (morosidad);
  CREATE INDEX IF NOT EXISTS idx_agent_decisions_message     ON agent_decisions (message_id);
  CREATE INDEX IF NOT EXISTS idx_agent_outbox_status_conv    ON agent_outbox (status, conversation_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_channel_msgs_conv_dir       ON channel_messages (conversation_id, direction, created_at DESC);
`);

// Migrate existing plaintext email_sync_accounts credentials to AES-256-GCM
(function migrateEmailSyncCredentials() {
  try {
    const rows = db.prepare('SELECT id, client_secret, refresh_token FROM email_sync_accounts').all() as any[];
    const updateStmt = db.prepare('UPDATE email_sync_accounts SET client_secret=@cs, refresh_token=@rt WHERE id=@id');
    for (const row of rows) {
      let changed = false;
      let cs = row.client_secret;
      let rt = row.refresh_token;
      if (cs && !String(cs).startsWith('v1:')) { cs = encryptSecret(cs); changed = true; }
      if (rt && !String(rt).startsWith('v1:')) { rt = encryptSecret(rt); changed = true; }
      if (changed) updateStmt.run({ id: row.id, cs, rt });
    }
  } catch {
    // Table may not exist yet on first run; schema creation above handles it
  }
})();

export function passwordForStorage(value: any) {
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
