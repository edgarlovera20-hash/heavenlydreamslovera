function cleanDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .toLowerCase();
}

function cleanUrl(value: string) {
  return value.trim().replace(/\/$/, '');
}

function domainFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return cleanDomain(value);
  }
}

export function getConfiguredDomain() {
  const explicitDomain = cleanDomain(process.env.APP_DOMAIN || process.env.PUBLIC_DOMAIN || '');
  if (explicitDomain) return explicitDomain;
  const appUrl = cleanUrl(process.env.APP_URL || process.env.OAUTH_CALLBACK_BASE_URL || '');
  return appUrl ? domainFromUrl(appUrl) : '';
}

export function getPublicAppUrl() {
  const explicitUrl = cleanUrl(process.env.APP_URL || '');
  if (explicitUrl) return explicitUrl;
  const domain = getConfiguredDomain();
  return domain ? `https://${domain}` : '';
}

export function configureRuntimeDomainEnv() {
  const publicUrl = getPublicAppUrl();
  const domain = getConfiguredDomain();
  if (!publicUrl || !domain) return;

  process.env.APP_URL ||= publicUrl;
  process.env.OAUTH_CALLBACK_BASE_URL ||= publicUrl;
  process.env.TWILIO_WEBHOOK_BASE_URL ||= publicUrl;
  process.env.WEBAUTHN_RP_ID ||= domain;
  process.env.WEBAUTHN_ORIGIN ||= publicUrl;
}

configureRuntimeDomainEnv();
