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

export function getAuditLog(): AuditEntry[] {
  return [];
}

export async function fetchAuditLog(limit = 200): Promise<AuditEntry[]> {
  const res = await fetch(`/api/audit?limit=${limit}`);
  if (!res.ok) throw new Error('No se pudo cargar la auditoria del servidor');
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).map((row: any) => ({
    id: String(row.id || row.created_at || crypto.randomUUID()),
    timestamp: row.created_at || row.timestamp || new Date().toISOString(),
    action: row.accion || row.action,
    userId: row.user_id || row.userId || '',
    userName: row.user_nombre || row.userName || '',
    targetId: row.entidad_id || row.targetId || '',
    targetLabel: row.entidad || row.targetLabel || '',
    details: row.detalle || row.details || '',
    ip: row.ip,
  }));
}

export function logAudit(
  action: AuditAction,
  userId: string,
  userName: string,
  opts: { targetId?: string; targetLabel?: string; details?: string } = {}
): void {
  fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accion: action,
      entidad: opts.targetLabel || 'frontend',
      entidad_id: opts.targetId || null,
      user_id: userId,
      user_nombre: userName,
      detalle: opts.details || null,
    }),
  }).catch(() => {
    // La auditoria no debe bloquear el flujo principal, pero tampoco se guarda en navegador.
  });
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
