// API client — todas las llamadas al servidor (base de datos)

const api = async (method: string, url: string, body?: any) => {
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
  getAll: (asesor_id?: string) => api('GET', asesor_id ? `/api/ventas?asesor_id=${asesor_id}` : '/api/ventas'),
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
  set: (userId: string, meta: number) => api('PUT', `/api/quotas/${userId}`, { meta }),
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

// ── Audit Log ────────────────────────────────────────────────
export const AuditAPI = {
  getAll: (limit = 200) => api('GET', `/api/audit?limit=${limit}`),
};

// ── Migración desde localStorage ────────────────────────────
export async function migrateLocalStorageToDb() {
  const MIGRATION_KEY = 'hd_db_migrated_v1';
  if (localStorage.getItem(MIGRATION_KEY)) return;

  const migrations = [
    { key: 'adhdreams_users', lsKey: 'adhdreams_users' },
    { key: 'adhdreams_sales', lsKey: 'adhdreams_sales' },
  ];

  for (const { key, lsKey } of migrations) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        await api('POST', '/api/migrate', { key, data });
        console.log(`[DB] Migrado ${lsKey}: ${data.length} registros`);
      }
    } catch (e) {
      console.warn(`[DB] Error migrando ${lsKey}:`, e);
    }
  }

  localStorage.setItem(MIGRATION_KEY, '1');
  console.log('[DB] Migración desde localStorage completada');
}
