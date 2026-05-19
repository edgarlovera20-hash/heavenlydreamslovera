import { Role, SaleStatus, FraudRisk } from '@heavenly/types';

// ============================================================
// Roles hierarchy
// ============================================================
export const ROLES_HIERARCHY: Record<Role, number> = {
  [Role.SUPER_ADMIN]: 7,
  [Role.GERENTE]: 6,
  [Role.ADMINISTRACION]: 5,
  [Role.SUPERVISOR]: 4,
  [Role.PROMOTOR]: 3,
  [Role.COBRANZA]: 2,
  [Role.SOPORTE]: 1,
};

export function hasMinRole(userRole: Role, minRole: Role): boolean {
  return ROLES_HIERARCHY[userRole] >= ROLES_HIERARCHY[minRole];
}

// ============================================================
// Disposable email domains
// ============================================================
export const DISPOSABLE_EMAIL_DOMAINS: string[] = [
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  'maildrop.cc',
  'sharklasers.com',
  'guerrillamailblock.com',
  'grr.la',
  'guerrillamail.info',
  'spam4.me',
  'trashmail.me',
  'dispostable.com',
  'fakeinbox.com',
  'mailnull.com',
  'spamgourmet.com',
  'trashmail.at',
  'crazymailing.com',
  'getairmail.com',
  'spamherelots.com',
];

// ============================================================
// Fraud score levels
// ============================================================
export const FRAUD_SCORE_LEVELS: Record<FraudRisk, [number, number]> = {
  [FraudRisk.LOW]: [0, 30],
  [FraudRisk.MEDIUM]: [31, 70],
  [FraudRisk.HIGH]: [71, 100],
};

export function getFraudRiskLevel(score: number): FraudRisk {
  if (score <= 30) return FraudRisk.LOW;
  if (score <= 70) return FraudRisk.MEDIUM;
  return FraudRisk.HIGH;
}

// ============================================================
// Phone formatting
// ============================================================
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // Keep last 10 digits for Mexican numbers
  const normalized = digits.slice(-10);
  if (normalized.length === 10) {
    return normalized.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return normalized;
}

// ============================================================
// Currency formatting (MXN)
// ============================================================
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ============================================================
// Sale status labels (Spanish)
// ============================================================
export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  [SaleStatus.PENDIENTE]: 'Pendiente',
  [SaleStatus.EN_PROCESO]: 'En Proceso',
  [SaleStatus.VALIDACION]: 'En Validación',
  [SaleStatus.APROBADA]: 'Aprobada',
  [SaleStatus.RECHAZADA]: 'Rechazada',
  [SaleStatus.INSTALADA]: 'Instalada',
  [SaleStatus.CANCELADA]: 'Cancelada',
};

// ============================================================
// Role labels (Spanish)
// ============================================================
export const ROLE_LABELS: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Administrador',
  [Role.GERENTE]: 'Gerente',
  [Role.ADMINISTRACION]: 'Administración',
  [Role.SUPERVISOR]: 'Supervisor',
  [Role.PROMOTOR]: 'Promotor',
  [Role.COBRANZA]: 'Cobranza',
  [Role.SOPORTE]: 'Soporte',
};
