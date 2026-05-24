import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { infraMode, checkInfraConnections } from './infra';

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
  const localVisionFile = existsSync(join(process.cwd(), 'server', 'google-vision-credentials.json'));
  const jwtConfigured = hasEnv('JWT_SECRET') && process.env.JWT_SECRET !== 'dev-heavenly-dreams-change-me';
  const publicRegistrationOpenInProd = isProduction() && process.env.PUBLIC_REGISTRATION_ENABLED === 'true';
  const postgresConfigured = hasEnv('DATABASE_URL');
  const redisConfigured = hasEnv('REDIS_URL');
  const objectStorageConfigured = hasEnv('DOCUMENT_STORAGE_DIR') || (hasEnv('S3_BUCKET') && hasEnv('S3_ENDPOINT'));
  const ocrConfigured = hasEnv('OLLAMA_URL') || hasEnv('GEMINI_API_KEY');
  const visionConfigured = hasEnv('GOOGLE_APPLICATION_CREDENTIALS_JSON') || hasEnv('GOOGLE_APPLICATION_CREDENTIALS');
  const webauthnConfigured = hasEnv('WEBAUTHN_RP_ID') && hasEnv('WEBAUTHN_ORIGIN');
  const twilioConfigured = hasEnv('TWILIO_ACCOUNT_SID') && hasEnv('TWILIO_AUTH_TOKEN') && hasEnv('TWILIO_FROM_NUMBER');
  const googleOAuthConfigured = hasEnv('GOOGLE_OAUTH_CLIENT_ID') && hasEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const oauthConfigured = googleOAuthConfigured;

  return [
    gate(
      'secrets',
      'Secretos fuera del repo',
      localVisionFile ? 'critical' : 'ok',
      localVisionFile ? 'Hay credenciales Google Vision dentro de server/.' : 'No se detectó service account local trackeable.',
      'Rota la llave filtrada y usa GOOGLE_APPLICATION_CREDENTIALS_JSON o GOOGLE_APPLICATION_CREDENTIALS.',
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
      'OCR multi IA',
      ocrConfigured ? 'ok' : 'warning',
      ocrConfigured ? 'Hay al menos un proveedor IA OCR configurado.' : 'Solo queda Tesseract/local como fallback.',
      'Configura Ollama o Gemini.',
    ),
    gate(
      'google_vision',
      'Google Vision seguro',
      visionConfigured ? 'ok' : 'warning',
      visionConfigured ? 'Google Vision puede usar credenciales por entorno.' : 'Google Vision no está configurado.',
      'Usa variable de entorno, no archivo dentro del repo.',
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
