export type AuditAction =
  | 'VENTA_CREADA' | 'VENTA_APROBADA' | 'VENTA_RECHAZADA' | 'VENTA_EDITADA'
  | 'USUARIO_CREADO' | 'USUARIO_EDITADO' | 'USUARIO_DESACTIVADO'
  | 'META_ESTABLECIDA' | 'COMISION_CALCULADA'
  | 'PAQUETE_CREADO' | 'PAQUETE_EDITADO' | 'PAQUETE_DESACTIVADO'
  | 'TERRITORIO_ASIGNADO' | 'EXPORTACION'
  | 'LOGIN' | 'LOGOUT';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId: string;
  userName: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  ip?: string;
}

const KEY = 'adhdreams_audit_log';
const MAX_ENTRIES = 500;

export function getAuditLog(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function logAudit(
  action: AuditAction,
  userId: string,
  userName: string,
  opts: { targetId?: string; targetLabel?: string; details?: string } = {}
): void {
  const entries = getAuditLog();
  const entry: AuditEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    action,
    userId,
    userName,
    ...opts,
  };
  entries.unshift(entry); // newest first
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export const ACTION_LABELS: Record<AuditAction, string> = {
  VENTA_CREADA:          'Venta creada',
  VENTA_APROBADA:        'Venta aprobada',
  VENTA_RECHAZADA:       'Venta rechazada',
  VENTA_EDITADA:         'Venta editada',
  USUARIO_CREADO:        'Usuario creado',
  USUARIO_EDITADO:       'Usuario editado',
  USUARIO_DESACTIVADO:   'Usuario desactivado',
  META_ESTABLECIDA:      'Meta establecida',
  COMISION_CALCULADA:    'Comisión calculada',
  PAQUETE_CREADO:        'Paquete creado',
  PAQUETE_EDITADO:       'Paquete editado',
  PAQUETE_DESACTIVADO:   'Paquete desactivado',
  TERRITORIO_ASIGNADO:   'Territorio asignado',
  EXPORTACION:           'Exportación de datos',
  LOGIN:                 'Inicio de sesión',
  LOGOUT:                'Cierre de sesión',
};
