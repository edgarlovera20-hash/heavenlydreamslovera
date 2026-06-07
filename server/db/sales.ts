import { randomUUID } from 'crypto';
import { db, updateById, parseJson, encryptField, decryptField } from './connection';

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
  getPage: ({ limit = 200, offset = 0, q = '', updatedSince = '', filters = {}, auth = null }: { limit?: number; offset?: number; q?: string; updatedSince?: string; filters?: Record<string, any>; auth?: any }) => {
    const where: string[] = [];
    const params: Record<string, any> = { limit, offset };
    if (q) {
      where.push(`(
        folio_siac LIKE @q OR telefono_asignado LIKE @q OR telefono_portado LIKE @q
        OR telefono_referencia LIKE @q OR os_alta LIKE @q OR tienda LIKE @q
        OR zona LIKE @q OR distrito LIKE @q OR colonia LIKE @q OR correo LIKE @q
        OR paquete LIKE @q OR usuario LIKE @q OR promotor LIKE @q
      )`);
      params.q = `%${q}%`;
    }
    if (updatedSince) {
      where.push('datetime(created_at) >= datetime(@updatedSince)');
      params.updatedSince = updatedSince;
    }
    const allowedFilters = ['estatus_siac', 'usuario', 'zona', 'tienda', 'estrategia', 'morosidad', 'tipo_linea', 'paquete', 'area', 'colonia'];
    for (const key of allowedFilters) {
      const value = filters?.[key];
      if (value != null && String(value).trim() !== '') {
        where.push(`${key} = @${key}`);
        params[key] = String(value).trim();
      }
    }
    const dateFrom = String(filters?.dateFrom || '').trim();
    const dateTo = String(filters?.dateTo || '').trim();
    if (dateFrom) {
      where.push(`date(CASE WHEN fecha_captura LIKE '__/__/____' THEN substr(fecha_captura, 7, 4) || '-' || substr(fecha_captura, 4, 2) || '-' || substr(fecha_captura, 1, 2) ELSE fecha_captura END) >= date(@dateFrom)`);
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      where.push(`date(CASE WHEN fecha_captura LIKE '__/__/____' THEN substr(fecha_captura, 7, 4) || '-' || substr(fecha_captura, 4, 2) || '-' || substr(fecha_captura, 1, 2) ELSE fecha_captura END) <= date(@dateTo)`);
      params.dateTo = dateTo;
    }
    const role = String(auth?.role || '').toUpperCase();
    if (role === 'ASESOR' || role === 'VENDEDOR' || role === 'PROMOTOR') {
      where.push('(usuario = @authName OR promotor = @authName OR usuario = @authUsername OR promotor = @authUsername)');
      params.authName = String(auth?.name || '');
      params.authUsername = String(auth?.sub || '');
    }
    return db.prepare(`
      SELECT * FROM siac_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY ${siacDateOrder}
      LIMIT @limit OFFSET @offset
    `).all(params);
  },
  countPage: ({ q = '', updatedSince = '', filters = {}, auth = null }: { q?: string; updatedSince?: string; filters?: Record<string, any>; auth?: any }) => {
    const where: string[] = [];
    const params: Record<string, any> = {};
    if (q) {
      where.push(`(
        folio_siac LIKE @q OR telefono_asignado LIKE @q OR telefono_portado LIKE @q
        OR telefono_referencia LIKE @q OR os_alta LIKE @q OR tienda LIKE @q
        OR zona LIKE @q OR distrito LIKE @q OR colonia LIKE @q OR correo LIKE @q
        OR paquete LIKE @q OR usuario LIKE @q OR promotor LIKE @q
      )`);
      params.q = `%${q}%`;
    }
    if (updatedSince) {
      where.push('datetime(created_at) >= datetime(@updatedSince)');
      params.updatedSince = updatedSince;
    }
    const allowedFilters = ['estatus_siac', 'usuario', 'zona', 'tienda', 'estrategia', 'morosidad', 'tipo_linea', 'paquete', 'area', 'colonia'];
    for (const key of allowedFilters) {
      const value = filters?.[key];
      if (value != null && String(value).trim() !== '') {
        where.push(`${key} = @${key}`);
        params[key] = String(value).trim();
      }
    }
    const dateFrom = String(filters?.dateFrom || '').trim();
    const dateTo = String(filters?.dateTo || '').trim();
    if (dateFrom) {
      where.push(`date(CASE WHEN fecha_captura LIKE '__/__/____' THEN substr(fecha_captura, 7, 4) || '-' || substr(fecha_captura, 4, 2) || '-' || substr(fecha_captura, 1, 2) ELSE fecha_captura END) >= date(@dateFrom)`);
      params.dateFrom = dateFrom;
    }
    if (dateTo) {
      where.push(`date(CASE WHEN fecha_captura LIKE '__/__/____' THEN substr(fecha_captura, 7, 4) || '-' || substr(fecha_captura, 4, 2) || '-' || substr(fecha_captura, 1, 2) ELSE fecha_captura END) <= date(@dateTo)`);
      params.dateTo = dateTo;
    }
    const role = String(auth?.role || '').toUpperCase();
    if (role === 'ASESOR' || role === 'VENDEDOR' || role === 'PROMOTOR') {
      where.push('(usuario = @authName OR promotor = @authName OR usuario = @authUsername OR promotor = @authUsername)');
      params.authName = String(auth?.name || '');
      params.authUsername = String(auth?.sub || '');
    }
    const row = db.prepare(`
      SELECT COUNT(*) as total FROM siac_records
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    `).get(params) as any;
    return row?.total ?? 0;
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

export const CrmFollowups = {
  getByFolio: (folio: string) => db.prepare('SELECT * FROM crm_followups WHERE folio_siac=? ORDER BY created_at DESC').all(folio).map((row: any) => ({ ...row, metadata: parseJson(row.metadata, {}) })),
  create: (data: any) => db.prepare(`
    INSERT INTO crm_followups
      (id,folio_siac,action,status,next_at,responsible_id,responsible_name,comment,metadata,created_by,created_by_name)
    VALUES
      (@id,@folio_siac,@action,@status,@next_at,@responsible_id,@responsible_name,@comment,@metadata,@created_by,@created_by_name)
  `).run({
    id: data.id || randomUUID(),
    folio_siac: data.folio_siac,
    action: data.action,
    status: data.status || 'pendiente',
    next_at: data.next_at || null,
    responsible_id: data.responsible_id || null,
    responsible_name: data.responsible_name || null,
    comment: data.comment || null,
    metadata: JSON.stringify(data.metadata || {}),
    created_by: data.created_by || null,
    created_by_name: data.created_by_name || null,
  }),
};

export const CrmNotes = {
  getByFolio: (folio: string, includePrivate = false) => db.prepare(`
    SELECT * FROM crm_notes
    WHERE folio_siac=? ${includePrivate ? '' : "AND visibility != 'gerencia'"}
    ORDER BY created_at DESC
  `).all(folio).map((row: any) => ({ ...row, attachments: parseJson(row.attachments, []) })),
  create: (data: any) => db.prepare(`
    INSERT INTO crm_notes
      (id,folio_siac,note,priority,visibility,attachments,created_by,created_by_name)
    VALUES
      (@id,@folio_siac,@note,@priority,@visibility,@attachments,@created_by,@created_by_name)
  `).run({
    id: data.id || randomUUID(),
    folio_siac: data.folio_siac,
    note: data.note,
    priority: data.priority || 'media',
    visibility: data.visibility || 'equipo',
    attachments: JSON.stringify(data.attachments || []),
    created_by: data.created_by || null,
    created_by_name: data.created_by_name || null,
  }),
};

export const CrmVisibilityRules = {
  getAll: () => db.prepare('SELECT * FROM crm_visibility_rules ORDER BY scope_type, scope_id, field').all().map((row: any) => ({ ...row, visible: row.visible === 1 })),
  getForScope: (scopeType: string, scopeId: string) => db.prepare('SELECT * FROM crm_visibility_rules WHERE scope_type=? AND scope_id=?').all(scopeType, scopeId).map((row: any) => ({ ...row, visible: row.visible === 1 })),
  setMany: (rules: any[], updatedBy: string | null) => {
    const stmt = db.prepare(`
      INSERT INTO crm_visibility_rules (id,scope_type,scope_id,field,visible,updated_by,updated_at)
      VALUES (@id,@scope_type,@scope_id,@field,@visible,@updated_by,datetime('now'))
      ON CONFLICT(scope_type,scope_id,field) DO UPDATE SET
        visible=excluded.visible,
        updated_by=excluded.updated_by,
        updated_at=datetime('now')
    `);
    const tx = db.transaction((items: any[]) => {
      for (const rule of items) {
        stmt.run({
          id: rule.id || randomUUID(),
          scope_type: rule.scope_type || 'role',
          scope_id: String(rule.scope_id || '').toUpperCase(),
          field: rule.field,
          visible: rule.visible === false || rule.visible === 0 ? 0 : 1,
          updated_by: updatedBy,
        });
      }
    });
    tx(rules);
  },
};

export const CrmSavedSearches = {
  getByUser: (userId: string) => db.prepare('SELECT * FROM crm_saved_searches WHERE user_id=? ORDER BY updated_at DESC').all(userId).map((row: any) => ({ ...row, filters: parseJson(row.filters, {}) })),
  create: (data: any) => db.prepare(`
    INSERT INTO crm_saved_searches (id,user_id,name,filters)
    VALUES (@id,@user_id,@name,@filters)
  `).run({
    id: data.id || randomUUID(),
    user_id: data.user_id,
    name: data.name,
    filters: JSON.stringify(data.filters || {}),
  }),
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
