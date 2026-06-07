import { randomUUID } from 'crypto';
import { db, updateById, parseJson, encryptField, decryptField } from './connection';

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

export const IntegrationSecrets = {
  list: () => db.prepare(`
    SELECT * FROM integration_secrets
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 WHEN 'revoked' THEN 2 ELSE 3 END,
      datetime(updated_at) DESC
  `).all(),
  getById: (id: string) => db.prepare('SELECT * FROM integration_secrets WHERE id=?').get(id),
  getActiveByKeyName: (keyName: string) => db.prepare(`
    SELECT * FROM integration_secrets
    WHERE key_name=? AND status='active' AND revoked_at IS NULL
    ORDER BY datetime(updated_at) DESC
    LIMIT 1
  `).get(keyName),
  getActiveByProvider: (provider: string) => db.prepare(`
    SELECT * FROM integration_secrets
    WHERE provider=? AND status='active' AND revoked_at IS NULL
    ORDER BY datetime(updated_at) DESC
    LIMIT 1
  `).get(provider),
  upsert: (data: any) => db.prepare(`
    INSERT INTO integration_secrets
      (id,provider,label,key_name,encrypted_value,value_last4,status,metadata,created_by,updated_by,revoked_at,created_at,updated_at)
    VALUES
      (@id,@provider,@label,@key_name,@encrypted_value,@value_last4,@status,@metadata,@created_by,@updated_by,@revoked_at,datetime('now'),datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      provider=excluded.provider,
      label=excluded.label,
      key_name=excluded.key_name,
      encrypted_value=excluded.encrypted_value,
      value_last4=excluded.value_last4,
      status=excluded.status,
      metadata=excluded.metadata,
      updated_by=excluded.updated_by,
      revoked_at=excluded.revoked_at,
      updated_at=datetime('now')
  `).run(data),
  patch: (id: string, data: any) => {
    const allowed = ['provider', 'label', 'key_name', 'encrypted_value', 'value_last4', 'status', 'metadata', 'updated_by', 'revoked_at'];
    const keys = Object.keys(data).filter((key) => allowed.includes(key));
    if (!keys.length) return { changes: 0 };
    const fields = keys.map((key) => `${key}=@${key}`).join(',');
    return db.prepare(`UPDATE integration_secrets SET ${fields}, updated_at=datetime('now') WHERE id=@id`).run({ ...data, id });
  },
  revoke: (id: string, updatedBy: string | null = null) => db.prepare(`
    UPDATE integration_secrets
    SET status='revoked', revoked_at=datetime('now'), updated_by=@updatedBy, updated_at=datetime('now')
    WHERE id=@id
  `).run({ id, updatedBy }),
  delete: (id: string) => db.prepare('DELETE FROM integration_secrets WHERE id=?').run(id),
};

export const Announcements = {
  getAll: () => db.prepare('SELECT * FROM announcements WHERE activo=1 ORDER BY created_at DESC').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO announcements (id,titulo,contenido,tipo,autor_id)
    VALUES (@id,@titulo,@contenido,@tipo,@autor_id)
  `).run(data),
  delete: (id: string) => db.prepare('UPDATE announcements SET activo=0 WHERE id=?').run(id),
};

export const Metrics = {
  getRecent: (limit = 200) => db.prepare('SELECT * FROM metrics ORDER BY created_at DESC LIMIT ?').all(limit),
  insert: (data: any) => db.prepare(`
    INSERT INTO metrics (id,name,value,tags) VALUES (@id,@name,@value,@tags)
  `).run(data),
};

export const LogsSistema = {
  insert: (data: any) => db.prepare(`
    INSERT INTO logs_sistema (id,accion,entidad,entidad_id,user_id,detalle,ip,dispositivo,metadata)
    VALUES (@id,@accion,@entidad,@entidad_id,@user_id,@detalle,@ip,@dispositivo,@metadata)
  `).run(data),
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

export const DiditChecks = {
  getRecent: (limit = 100) => db.prepare('SELECT * FROM didit_checks ORDER BY created_at DESC LIMIT ?').all(limit),
  getById: (id: string) => db.prepare('SELECT * FROM didit_checks WHERE id=?').get(id),
  create: (data: any) => db.prepare(`
    INSERT INTO didit_checks (
      id,kind,provider_request_id,status,vendor_data,capture_id,document_file_ids,request_summary,response_json,created_by
    ) VALUES (
      @id,@kind,@provider_request_id,@status,@vendor_data,@capture_id,@document_file_ids,@request_summary,@response_json,@created_by
    )
  `).run({
    id: data.id || randomUUID(),
    kind: data.kind,
    provider_request_id: data.provider_request_id || null,
    status: data.status || null,
    vendor_data: data.vendor_data || null,
    capture_id: data.capture_id || null,
    document_file_ids: typeof data.document_file_ids === 'string' ? data.document_file_ids : JSON.stringify(data.document_file_ids || []),
    request_summary: typeof data.request_summary === 'string' ? data.request_summary : JSON.stringify(data.request_summary || {}),
    response_json: typeof data.response_json === 'string' ? data.response_json : JSON.stringify(data.response_json || {}),
    created_by: data.created_by || null,
  }),
};

function decryptEmailAccount(row: any) {
  if (!row) return row;
  return {
    ...row,
    client_secret: decryptField(row.client_secret),
    refresh_token: decryptField(row.refresh_token),
  };
}

export const EmailSync = {
  listAccounts: () => db.prepare(`
    SELECT id,provider,label,email,query,enabled,last_run_at,last_error,created_by,created_at,updated_at
    FROM email_sync_accounts
    ORDER BY updated_at DESC
  `).all(),
  getAccount: (id: string) => decryptEmailAccount(db.prepare('SELECT * FROM email_sync_accounts WHERE id=?').get(id)),
  getDefaultAccount: () => decryptEmailAccount(db.prepare('SELECT * FROM email_sync_accounts WHERE enabled=1 ORDER BY updated_at DESC LIMIT 1').get()),
  upsertAccount: (data: any) => db.prepare(`
    INSERT INTO email_sync_accounts
      (id,provider,label,email,query,client_id,client_secret,refresh_token,enabled,created_by,updated_at)
    VALUES
      (@id,@provider,@label,@email,@query,@client_id,@client_secret,@refresh_token,@enabled,@created_by,datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      provider=excluded.provider,
      label=excluded.label,
      email=excluded.email,
      query=excluded.query,
      client_id=COALESCE(excluded.client_id, email_sync_accounts.client_id),
      client_secret=COALESCE(excluded.client_secret, email_sync_accounts.client_secret),
      refresh_token=COALESCE(excluded.refresh_token, email_sync_accounts.refresh_token),
      enabled=excluded.enabled,
      last_error=NULL,
      updated_at=datetime('now')
  `).run({
    id: data.id || 'gmail-primary',
    provider: data.provider || 'gmail',
    label: data.label || 'Gmail principal',
    email: data.email || null,
    query: data.query || null,
    client_id: data.client_id || null,
    client_secret: encryptField(data.client_secret),
    refresh_token: encryptField(data.refresh_token),
    enabled: data.enabled ? 1 : 0,
    created_by: data.created_by || null,
  }),
  markAccountRun: (id: string, error: any = null) => db.prepare(`
    UPDATE email_sync_accounts
    SET last_run_at=datetime('now'), last_error=@last_error, updated_at=datetime('now')
    WHERE id=@id
  `).run({ id, last_error: error ? String(error).slice(0, 1000) : null }),
  listJobs: (limit = 100) => db.prepare(`
    SELECT * FROM email_sync_jobs ORDER BY created_at DESC LIMIT ?
  `).all(limit).map((row: any) => ({
    ...row,
    errors: parseJson(row.errors, []),
    warnings: parseJson(row.warnings, []),
    metadata: parseJson(row.metadata, {}),
  })),
  findJobByMessageFile: (messageId: string, fileName: string) => db.prepare(`
    SELECT * FROM email_sync_jobs WHERE message_id=? AND file_name=?
  `).get(messageId, fileName),
  createJob: (data: any) => {
    const job = {
      id: data.id || randomUUID(),
      account_id: data.account_id || null,
      provider: data.provider || 'gmail',
      source: data.source || 'manual',
      message_id: data.message_id || null,
      sender: data.sender || null,
      subject: data.subject || null,
      file_name: data.file_name || null,
      file_type: data.file_type || null,
      detected_type: data.detected_type || null,
      status: data.status || 'queued',
      imported: Number(data.imported || 0),
      skipped: Number(data.skipped || 0),
      errors: JSON.stringify(data.errors || []),
      warnings: JSON.stringify(data.warnings || []),
      metadata: JSON.stringify(data.metadata || {}),
      fingerprint: data.fingerprint || null,
      started_at: data.started_at || null,
      finished_at: data.finished_at || null,
      created_by: data.created_by || null,
    };
    db.prepare(`
      INSERT INTO email_sync_jobs
        (id,account_id,provider,source,message_id,sender,subject,file_name,file_type,detected_type,status,imported,skipped,errors,warnings,metadata,fingerprint,started_at,finished_at,created_by)
      VALUES
        (@id,@account_id,@provider,@source,@message_id,@sender,@subject,@file_name,@file_type,@detected_type,@status,@imported,@skipped,@errors,@warnings,@metadata,@fingerprint,@started_at,@finished_at,@created_by)
    `).run(job);
    return job;
  },
  updateJob: (id: string, data: any) => {
    const clean = { ...data };
    if (Array.isArray(clean.errors)) clean.errors = JSON.stringify(clean.errors);
    if (Array.isArray(clean.warnings)) clean.warnings = JSON.stringify(clean.warnings);
    if (clean.metadata && typeof clean.metadata !== 'string') clean.metadata = JSON.stringify(clean.metadata);
    return updateById('email_sync_jobs', 'id', id, clean, [
      'detected_type', 'status', 'imported', 'skipped', 'errors', 'warnings', 'metadata',
      'fingerprint', 'started_at', 'finished_at',
    ]);
  },
  addAttachment: (data: any) => db.prepare(`
    INSERT INTO email_sync_attachments (id,job_id,file_name,mime_type,size_bytes,fingerprint,storage_ref)
    VALUES (@id,@job_id,@file_name,@mime_type,@size_bytes,@fingerprint,@storage_ref)
  `).run({
    id: data.id || randomUUID(),
    job_id: data.job_id,
    file_name: data.file_name,
    mime_type: data.mime_type || null,
    size_bytes: Number(data.size_bytes || 0),
    fingerprint: data.fingerprint || null,
    storage_ref: data.storage_ref || null,
  }),
  summary: () => ({
    accounts: db.prepare('SELECT COUNT(*) AS c FROM email_sync_accounts').get(),
    jobs: db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        SUM(imported) AS imported,
        SUM(skipped) AS skipped
      FROM email_sync_jobs
    `).get(),
    recent: EmailSync.listJobs(8),
  }),
};
