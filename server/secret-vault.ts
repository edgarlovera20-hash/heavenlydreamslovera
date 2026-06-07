import { randomUUID } from 'node:crypto';
import { AuditLog, IntegrationSecrets } from './db';
import { encryptSecret, decryptSecret } from './crypto-helpers';
export { encryptSecret, decryptSecret } from './crypto-helpers';

export type SecretStatus = 'active' | 'pending' | 'revoked';

export type SecretInput = {
  id?: string;
  provider: string;
  label: string;
  keyName: string;
  value: string;
  status?: SecretStatus;
  metadata?: Record<string, any>;
};

function normalizeProvider(value: any) {
  return String(value || 'custom').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '-').slice(0, 80) || 'custom';
}

function normalizeKeyName(value: any) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120);
}

function safeMetadata(value: any) {
  if (!value || typeof value !== 'object') return {};
  const clean: Record<string, any> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === null) continue;
    if (typeof raw === 'string') clean[key] = raw.slice(0, 300);
    else if (typeof raw === 'number' || typeof raw === 'boolean') clean[key] = raw;
  }
  return clean;
}

function parseMetadata(value: any) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

export function maskSecretRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    label: row.label,
    keyName: row.key_name,
    valueLast4: row.value_last4 || '',
    status: row.status,
    metadata: parseMetadata(row.metadata),
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listMaskedSecrets() {
  return (IntegrationSecrets.list() as any[]).map(maskSecretRow);
}

export function saveSecret(input: SecretInput, actor: any) {
  const value = String(input.value || '').trim();
  const keyName = normalizeKeyName(input.keyName);
  if (!value) throw new Error('La clave API no puede estar vacía');
  if (!keyName) throw new Error('key_name es requerido');

  const id = input.id || randomUUID();
  const row = {
    id,
    provider: normalizeProvider(input.provider),
    label: String(input.label || keyName).trim().slice(0, 120),
    key_name: keyName,
    encrypted_value: encryptSecret(value),
    value_last4: value.slice(-4),
    status: input.status || 'active',
    metadata: JSON.stringify(safeMetadata(input.metadata)),
    created_by: actor?.sub || actor?.uid || null,
    updated_by: actor?.sub || actor?.uid || null,
    revoked_at: input.status === 'revoked' ? new Date().toISOString() : null,
  };
  IntegrationSecrets.upsert(row);
  auditSecret(input.id ? 'INTEGRATION_SECRET_REPLACED' : 'INTEGRATION_SECRET_CREATED', id, actor, {
    provider: row.provider,
    keyName,
    label: row.label,
    status: row.status,
  });
  return maskSecretRow(IntegrationSecrets.getById(id));
}

export function patchSecret(id: string, patch: any, actor: any) {
  const current = IntegrationSecrets.getById(id) as any;
  if (!current) return null;
  const updates: Record<string, any> = { updated_by: actor?.sub || actor?.uid || null };
  if (patch.provider !== undefined) updates.provider = normalizeProvider(patch.provider);
  if (patch.label !== undefined) updates.label = String(patch.label || current.label).trim().slice(0, 120);
  if (patch.keyName !== undefined || patch.key_name !== undefined) updates.key_name = normalizeKeyName(patch.keyName ?? patch.key_name);
  if (patch.status !== undefined) {
    const status = String(patch.status || '').toLowerCase();
    if (!['active', 'pending', 'revoked'].includes(status)) throw new Error('Estado inválido');
    updates.status = status;
    updates.revoked_at = status === 'revoked' ? new Date().toISOString() : null;
  }
  if (patch.metadata !== undefined) updates.metadata = JSON.stringify(safeMetadata(patch.metadata));
  IntegrationSecrets.patch(id, updates);
  auditSecret('INTEGRATION_SECRET_UPDATED', id, actor, { fields: Object.keys(updates).filter((key) => key !== 'updated_by') });
  return maskSecretRow(IntegrationSecrets.getById(id));
}

export function revokeSecret(id: string, actor: any) {
  const current = IntegrationSecrets.getById(id) as any;
  if (!current) return null;
  IntegrationSecrets.revoke(id, actor?.sub || actor?.uid || null);
  auditSecret('INTEGRATION_SECRET_REVOKED', id, actor, { provider: current.provider, keyName: current.key_name });
  return maskSecretRow(IntegrationSecrets.getById(id));
}

export function deleteSecret(id: string, actor: any) {
  const current = IntegrationSecrets.getById(id) as any;
  if (!current) return false;
  IntegrationSecrets.delete(id);
  auditSecret('INTEGRATION_SECRET_DELETED', id, actor, { provider: current.provider, keyName: current.key_name });
  return true;
}

export function getSecretForServerUse(id: string) {
  const row = IntegrationSecrets.getById(id) as any;
  if (!row || row.status === 'revoked' || row.revoked_at) return null;
  return {
    ...maskSecretRow(row),
    value: decryptSecret(row.encrypted_value).trim(),
  };
}

export function getSecretValue(keyName: string, envFallback = '') {
  const normalized = normalizeKeyName(keyName);
  const row = IntegrationSecrets.getActiveByKeyName(normalized) as any;
  if (row?.encrypted_value) return decryptSecret(row.encrypted_value).trim();
  return String(envFallback || process.env[normalized] || '').trim();
}

export function getProviderSecret(provider: string, fallbackKeyName = '') {
  const normalizedProvider = normalizeProvider(provider);
  const row = IntegrationSecrets.getActiveByProvider(normalizedProvider) as any;
  if (row?.encrypted_value) return decryptSecret(row.encrypted_value).trim();
  return fallbackKeyName ? getSecretValue(fallbackKeyName) : '';
}

export function getProviderConfig(provider: string, fallbackKeyName = '') {
  const normalizedProvider = normalizeProvider(provider);
  const row = IntegrationSecrets.getActiveByProvider(normalizedProvider) as any;
  if (row?.encrypted_value) {
    return {
      value: decryptSecret(row.encrypted_value).trim(),
      metadata: parseMetadata(row.metadata),
      source: 'vault' as const,
      row: maskSecretRow(row),
    };
  }
  return {
    value: fallbackKeyName ? getSecretValue(fallbackKeyName) : '',
    metadata: {},
    source: 'env' as const,
    row: null,
  };
}

export function secretConfigured(keyName: string) {
  return Boolean(getSecretValue(keyName));
}

export function secretSource(keyName: string) {
  const normalized = normalizeKeyName(keyName);
  return IntegrationSecrets.getActiveByKeyName(normalized) ? 'vault' : (process.env[normalized] ? 'env' : 'none');
}

export function auditSecret(action: string, id: string, actor: any, detail: any = {}) {
  AuditLog.insert({
    accion: action,
    entidad: 'integration_secrets',
    entidad_id: id,
    user_id: actor?.sub || actor?.uid || null,
    user_nombre: actor?.name || actor?.nombre || null,
    detalle: JSON.stringify(detail).slice(0, 900),
  });
}
