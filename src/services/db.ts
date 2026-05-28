// API client — todas las llamadas al servidor (base de datos)

export const api = async (method: string, url: string, body?: any) => {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any;
    throw new Error(err.error || res.statusText);
  }
  return res.json();
};

export function normalizeSale(row: any) {
  const metadata = (() => {
    try { return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata || {}; } catch { return {}; }
  })();
  return {
    ...metadata,
    ...row,
    id: row?.id || metadata.id,
    folio: row?.folio || metadata.folio,
    asesorId: row?.asesor_id || row?.asesorId || metadata.asesorId,
    asesorNombre: row?.asesor_nombre || row?.asesorNombre || metadata.asesorNombre,
    nombres: row?.nombres || metadata.nombres || metadata.clienteNombre,
    apellidoPaterno: row?.apellido_paterno || row?.apellidoPaterno || metadata.apellidoPaterno,
    apellidoMaterno: row?.apellido_materno || row?.apellidoMaterno || metadata.apellidoMaterno,
    apellidos: row?.apellidos || metadata.apellidos,
    telefono: row?.telefono || metadata.telefono,
    telefonoTitular: row?.telefono_titular || row?.telefonoTitular || row?.telefono || metadata.telefonoTitular || metadata.telefono,
    paqueteNombre: row?.paquete_nombre || row?.paqueteNombre || row?.plan || metadata.paqueteNombre || metadata.plan,
    rentaMensual: Number(row?.renta_mensual ?? row?.rentaMensual ?? metadata.rentaMensual ?? 0),
    fechaSolicitud: row?.fecha_solicitud || row?.fechaSolicitud || row?.created_at || metadata.fechaSolicitud,
    status: String(row?.status || metadata.status || 'PENDIENTE').toUpperCase(),
    colonia: row?.colonia || metadata.colonia,
    delegacion: row?.delegacion || row?.municipio || metadata.delegacion || metadata.municipio,
    municipio: row?.municipio || metadata.municipio,
    direccion: row?.direccion || metadata.direccion,
    zona: row?.zona || metadata.zona,
    notes: row?.notas || row?.notes || metadata.notes || '',
    notas: row?.notas || metadata.notas || metadata.notes || '',
  };
}

export function normalizeUser(row: any) {
  return {
    ...row,
    uid: row?.uid,
    displayName: row?.displayName || row?.nombre || row?.username || row?.email,
    role: String(row?.role || '').toUpperCase(),
  };
}

// ── Usuarios ────────────────────────────────────────────────
export const UsersAPI = {
  getAll: () => api('GET', '/api/users'),
  create: (data: any) => api('POST', '/api/users', data),
  update: (uid: string, data: any) => api('PUT', `/api/users/${uid}`, data),
  delete: (uid: string) => api('DELETE', `/api/users/${uid}`),
  login: (username: string, password: string) => api('POST', '/api/auth/login', { username, password }),
};

// ── Ventas ──────────────────────────────────────────────────
export const VentasAPI = {
  getAll: async (asesor_id?: string) => {
    const rows = await api('GET', asesor_id ? `/api/ventas?asesor_id=${asesor_id}` : '/api/ventas');
    return Array.isArray(rows) ? rows.map(normalizeSale) : [];
  },
  create: (data: any) => api('POST', '/api/ventas', data),
  update: (id: string, data: any) => api('PUT', `/api/ventas/${id}`, data),
  delete: (id: string) => api('DELETE', `/api/ventas/${id}`),
};

// ── SIAC ────────────────────────────────────────────────────
export const SiacAPI = {
  getAll: () => api('GET', '/api/siac'),
  create: (data: any) => api('POST', '/api/siac', data),
  bulkCreate: (records: any[]) => api('POST', '/api/siac/bulk', records),
  importCsv: (replace = false) => api('POST', `/api/siac/import${replace ? '?replace=1' : ''}`),
  importSource: (replace = true) => api('POST', '/api/siac/import-source', { replace }),
  importFile: (fileName: string, contentBase64: string, replace = true) => api('POST', '/api/siac/import-file', { fileName, contentBase64, replace }),
  importGoogleDrive: (input: string, replace = true) => api('POST', '/api/siac/import-google-drive', { input, replace }),
  deleteAll: () => api('DELETE', '/api/siac'),
};

export const MorosidadAPI = {
  getAll: () => api('GET', '/api/morosidad'),
  analytics: () => api('GET', '/api/morosidad/analytics'),
  importSource: (replace = true) => api('POST', '/api/morosidad/import-source', { replace }),
  importFile: (fileName: string, contentBase64: string, replace = true) => api('POST', '/api/morosidad/import-file', { fileName, contentBase64, replace }),
};

// ── Tickets ─────────────────────────────────────────────────
export const TicketsAPI = {
  getAll: () => api('GET', '/api/tickets'),
  create: (data: any) => api('POST', '/api/tickets', data),
  update: (id: string, data: any) => api('PUT', `/api/tickets/${id}`, data),
};

// ── Validaciones ────────────────────────────────────────────
export const ValidationsAPI = {
  getAll: () => api('GET', '/api/validations'),
  create: (data: any) => api('POST', '/api/validations', data),
  update: (id: string, data: any) => api('PUT', `/api/validations/${id}`, data),
};

// ── Referidos ───────────────────────────────────────────────
export const ReferralsAPI = {
  getAll: () => api('GET', '/api/referrals'),
  create: (data: any) => api('POST', '/api/referrals', data),
  update: (id: string, data: any) => api('PUT', `/api/referrals/${id}`, data),
};

// ── Territorios ─────────────────────────────────────────────
export const TerritoriesAPI = {
  getAll: () => api('GET', '/api/territories'),
  create: (data: any) => api('POST', '/api/territories', data),
  update: (id: string, data: any) => api('PUT', `/api/territories/${id}`, data),
  delete: (id: string) => api('DELETE', `/api/territories/${id}`),
};

// ── Cuotas ──────────────────────────────────────────────────
export const QuotasAPI = {
  getAll: () => api('GET', '/api/quotas'),
  getMe: () => api('GET', '/api/quotas/me'),
  set: (userId: string, data: number | { meta: number; periodo?: string; mensaje?: string; notify?: boolean }) =>
    api('PUT', `/api/quotas/${userId}`, typeof data === 'number' ? { meta: data } : data),
};

// ── Comisiones ──────────────────────────────────────────────
export const CommissionsAPI = {
  getAll: () => api('GET', '/api/commissions'),
  create: (data: any) => api('POST', '/api/commissions', data),
  delete: (id: string) => api('DELETE', `/api/commissions/${id}`),
};

// ── Paquetes ────────────────────────────────────────────────
export const PackagesAPI = {
  getAll: () => api('GET', '/api/packages'),
  create: (data: any) => api('POST', '/api/packages', data),
  update: (id: string, data: any) => api('PUT', `/api/packages/${id}`, data),
  delete: (id: string) => api('DELETE', `/api/packages/${id}`),
};

// ── Nóminas ─────────────────────────────────────────────────
export const NominasAPI = {
  getAll: (asesor_id?: string) => api('GET', asesor_id ? `/api/nominas?asesor_id=${asesor_id}` : '/api/nominas'),
  create: (data: any) => api('POST', '/api/nominas', data),
  update: (id: string, data: any) => api('PUT', `/api/nominas/${id}`, data),
};

// ── Anuncios ────────────────────────────────────────────────
export const AnnouncementsAPI = {
  getAll: () => api('GET', '/api/announcements'),
  create: (data: any) => api('POST', '/api/announcements', data),
  delete: (id: string) => api('DELETE', `/api/announcements/${id}`),
};

// ── Configuración ────────────────────────────────────────────
export const SettingsAPI = {
  get: (key: string) => api('GET', `/api/settings/${key}`).then((r: any) => r.value),
  set: (key: string, value: any) => api('PUT', `/api/settings/${key}`, { value }),
};

export const EmailSyncAPI = {
  status: () => api('GET', '/api/email-sync/status'),
  accounts: () => api('GET', '/api/email-sync/accounts'),
  saveAccount: (data: any) => api('POST', '/api/email-sync/accounts', data),
  jobs: (limit = 100) => api('GET', `/api/email-sync/jobs?limit=${limit}`),
  run: (data: any = {}) => api('POST', '/api/email-sync/run', data),
  upload: (data: { fileName: string; contentBase64: string; mimeType?: string; replace?: boolean }) =>
    api('POST', '/api/email-sync/upload', data),
};

// ── Audit Log ────────────────────────────────────────────────
export const AuditAPI = {
  getAll: (limit = 200) => api('GET', `/api/audit?limit=${limit}`),
  record: (data: any) => api('POST', '/api/audit', data),
};

export const ChannelsAPI = {
  getAccounts: () => api('GET', '/api/channels/accounts'),
  upsertAccount: (data: any) => api('POST', '/api/channels/accounts', data),
};

// ── Migración desde localStorage ────────────────────────────
export async function migrateLocalStorageToDb() {
  return { ok: true, migrated: 0 };
}
