import { randomUUID } from 'crypto';
import { db, updateById } from './connection';

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

export const CommissionRules = {
  getAll: () => db.prepare('SELECT * FROM commission_rules WHERE activo=1').all(),
  create: (data: any) => db.prepare(`
    INSERT INTO commission_rules (id,min_ventas,max_ventas,tasa,bono_meta)
    VALUES (@id,@min_ventas,@max_ventas,@tasa,@bono_meta)
  `).run(data),
  delete: (id: string) => db.prepare('UPDATE commission_rules SET activo=0 WHERE id=?').run(id),
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
