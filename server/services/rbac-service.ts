export type AppRole = 'GERENTE' | 'ADMINISTRACION' | 'SUPERVISOR' | 'RECLUTADOR' | 'VENDEDOR' | 'ASESOR' | string;

export const MANAGER_ROLE = 'GERENTE';
export const OPS_ROLES = ['GERENTE', 'ADMINISTRACION', 'SUPERVISOR'];
export const SALES_ROLES = ['ASESOR', 'VENDEDOR'];
export const RECRUITING_ROLES = ['RECLUTADOR'];
export const APP_ROLES = ['GERENTE', 'ADMINISTRACION', 'SUPERVISOR', 'RECLUTADOR', 'VENDEDOR', 'ASESOR'];

export function normalizeRole(value: any): AppRole {
  return String(value || '').trim().toUpperCase();
}

export function isManagerRole(role: any) {
  return normalizeRole(role) === MANAGER_ROLE;
}

export function isManagerAuth(auth: any) {
  return isManagerRole(auth?.role);
}

export function canManageAuth(auth: any) {
  return isManagerAuth(auth);
}

export function canOperateAuth(auth: any) {
  return OPS_ROLES.includes(normalizeRole(auth?.role));
}

export function canUseChatAuth(auth: any) {
  return APP_ROLES.includes(normalizeRole(auth?.role));
}

export function canUseMobileAuth(auth: any) {
  return APP_ROLES.includes(normalizeRole(auth?.role));
}

export function canApproveHumanAuth(auth: any) {
  return isManagerAuth(auth);
}

export function canAccessUserRecord(auth: any, uid: any) {
  if (!auth) return false;
  return canManageAuth(auth) || String(auth.sub || '') === String(uid || '');
}
