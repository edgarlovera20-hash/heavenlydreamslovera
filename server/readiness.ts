import { infraMode, checkInfraConnections } from './infra';
import { getOllamaUrl } from './ai-config';

type GateStatus = 'ok' | 'warning' | 'critical';

export interface ReadinessGate {
  id: string;
  label: string;
  status: GateStatus;
  detail: string;
  fix?: string;
}

function hasEnv(name: string) {
  return Boolean(String(process.env[name] || '').trim());
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function gate(id: string, label: string, status: GateStatus, detail: string, fix?: string): ReadinessGate {
  return { id, label, status, detail, fix };
}

export function getReadinessGates(): ReadinessGate[] {
  const jwtConfigured = hasEnv('JWT_SECRET') && process.env.JWT_SECRET !== 'dev-heavenly-dreams-change-me';
  const publicRegistrationOpenInProd = isProduction() && process.env.PUBLIC_REGISTRATION_ENABLED === 'true';
  const postgresConfigured = hasEnv('DATABASE_URL');
  const redisConfigured = hasEnv('REDIS_URL');
  const objectStorageConfigured = hasEnv('DOCUMENT_STORAGE_DIR') || (hasEnv('S3_BUCKET') && hasEnv('S3_ENDPOINT'));
  const ollamaUrl = getOllamaUrl();
  const ocrConfigured = Boolean(ollamaUrl);
  const webauthnConfigured = hasEnv('WEBAUTHN_RP_ID') && hasEnv('WEBAUTHN_ORIGIN');
  const twilioConfigured = hasEnv('TWILIO_ACCOUNT_SID') && hasEnv('TWILIO_AUTH_TOKEN') && hasEnv('TWILIO_FROM_NUMBER');
  const googleOAuthConfigured = hasEnv('GOOGLE_OAUTH_CLIENT_ID') && hasEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const oauthConfigured = googleOAuthConfigured;

  return [
    gate(
      'secrets',
      'Secretos fuera del repo',
      'ok',
      'OCR documental opera con IA local; no requiere service account de Google Vision.',
      'Mantén OAuth/Drive/Maps por variables de entorno cuando aplique.',
    ),
    gate(
      'jwt',
      'JWT_SECRET fuerte',
      jwtConfigured ? 'ok' : isProduction() ? 'critical' : 'warning',
      jwtConfigured ? 'JWT_SECRET está definido.' : 'JWT_SECRET usa valor dev o está vacío.',
      'Define JWT_SECRET largo y único en producción.',
    ),
    gate(
      'public_registration',
      'Registro público controlado',
      publicRegistrationOpenInProd ? 'warning' : 'ok',
      publicRegistrationOpenInProd ? 'Registro público abierto explícitamente en producción.' : 'Registro público cerrado por defecto en producción.',
      'Usa invitaciones para altas productivas o revisa PUBLIC_REGISTRATION_ENABLED.',
    ),
    gate(
      'postgres',
      'PostgreSQL productivo',
      postgresConfigured ? 'ok' : 'warning',
      postgresConfigured ? 'DATABASE_URL configurado.' : 'La app usa SQLite como fallback.',
      'Configura DATABASE_URL y ejecuta migraciones/backups.',
    ),
    gate(
      'redis_bullmq',
      'Redis/BullMQ',
      redisConfigured ? 'ok' : 'warning',
      redisConfigured ? 'REDIS_URL configurado para colas/eventos.' : 'Colas y eventos usan fallback local.',
      'Configura REDIS_URL para workers reales.',
    ),
    gate(
      'document_storage',
      'Storage documental',
      objectStorageConfigured ? 'ok' : 'warning',
      objectStorageConfigured ? 'Storage documental configurado.' : 'Se usará data/document_storage local.',
      'Configura DOCUMENT_STORAGE_DIR o S3/MinIO para producción.',
    ),
    gate(
      'ocr_providers',
      'OCR local privado',
      ocrConfigured ? 'ok' : 'warning',
      ocrConfigured ? `Ollama local primario: ${ollamaUrl}; Tesseract queda como fallback local.` : 'Tesseract local queda disponible, pero falta URL de Ollama.',
      'Instala Ollama en el servidor y conserva OCR_PRIMARY=ollama.',
    ),
    gate(
      'webauthn',
      'WebAuthn dominio real',
      webauthnConfigured ? 'ok' : 'warning',
      webauthnConfigured ? 'RP ID y origin definidos.' : 'Faltan WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN.',
      'Configura HTTPS y dominio final para passkeys.',
    ),
    gate(
      'twilio',
      'Twilio llamadas autónomas',
      twilioConfigured ? 'ok' : 'warning',
      twilioConfigured ? 'Twilio listo para llamadas salientes.' : 'Faltan credenciales Twilio.',
      'Define TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER.',
    ),
    gate(
      'oauth',
      'OAuth Google',
      oauthConfigured ? 'ok' : 'warning',
      oauthConfigured ? 'Google OAuth está configurado.' : 'Login/registro externo queda deshabilitado hasta configurar credenciales.',
      'Define GOOGLE_OAUTH_CLIENT_ID/SECRET y callback HTTPS.',
    ),
    gate(
      'rbac_tests',
      'Matriz RBAC verificable',
      hasEnv('CI') ? 'ok' : 'warning',
      hasEnv('CI') ? 'CI activo para pruebas.' : 'Ejecuta npm run enterprise:check y agrega smoke tests con servidor.',
      'Conecta estos checks a GitHub Actions o pipeline del servidor.',
    ),
    gate(
      'observability',
      'Observabilidad',
      hasEnv('LOG_DRAIN_URL') || hasEnv('SENTRY_DSN') ? 'ok' : 'warning',
      hasEnv('LOG_DRAIN_URL') || hasEnv('SENTRY_DSN') ? 'Log drain/error tracking configurado.' : 'Solo logs locales y métricas SQLite.',
      'Configura SENTRY_DSN o LOG_DRAIN_URL.',
    ),
    gate(
      'backups',
      'Backups',
      hasEnv('BACKUP_TARGET') ? 'ok' : 'warning',
      hasEnv('BACKUP_TARGET') ? 'Destino de backup configurado.' : 'No hay destino de backup declarado.',
      'Configura BACKUP_TARGET y prueba restauración.',
    ),
    gate(
      'performance',
      'Performance frontend',
      hasEnv('VITE_BUNDLE_BUDGET_OK') ? 'ok' : 'warning',
      hasEnv('VITE_BUNDLE_BUDGET_OK') ? 'Presupuesto de bundle marcado como revisado.' : 'Revisar chunks pesados de mapas/PDF/charts.',
      'Mantén lazy loading y revisa build warnings.',
    ),
    gate(
      'dependency_audit',
      'Auditoría de dependencias',
      hasEnv('NPM_AUDIT_REVIEWED') ? 'ok' : 'warning',
      hasEnv('NPM_AUDIT_REVIEWED') ? 'Auditoría marcada como revisada.' : 'Ejecuta npm audit y documenta excepciones.',
      'Corre npm audit y elimina dependencias legadas.',
    ),
  ];
}

export async function getEnterpriseReadiness() {
  const gates = getReadinessGates();
  const connections = await checkInfraConnections();
  const critical = gates.filter(g => g.status === 'critical').length;
  const warning = gates.filter(g => g.status === 'warning').length;
  const ok = gates.filter(g => g.status === 'ok').length;
  const score = Math.round((ok / gates.length) * 100);

  return {
    score,
    ok,
    warning,
    critical,
    total: gates.length,
    mode: process.env.NODE_ENV || 'development',
    infra: infraMode(),
    connections,
    gates,
  };
}
