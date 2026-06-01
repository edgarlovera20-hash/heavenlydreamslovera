import { getSecretValue } from './secret-vault';

function requiredEnv(name: string) {
  const value = getSecretValue(name);
  if (!value) throw new Error(`${name} no configurado`);
  return value;
}

function basicAuth(accountSid: string, authToken: string) {
  return Buffer.from(`${accountSid}:${authToken}`).toString('base64');
}

function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function twilioConfigured() {
  return Boolean(getSecretValue('TWILIO_ACCOUNT_SID') && getSecretValue('TWILIO_AUTH_TOKEN') && getSecretValue('TWILIO_FROM_NUMBER'));
}

export function getTwilioFromNumber() {
  return getSecretValue('TWILIO_FROM_NUMBER') || null;
}

export function getTwilioWebhookToken() {
  return getSecretValue('TWILIO_WEBHOOK_TOKEN') || getSecretValue('VOICE_WEBHOOK_TOKEN') || null;
}

function appendWebhookToken(rawUrl: string) {
  const token = getTwilioWebhookToken();
  if (!token) return rawUrl;
  const url = new URL(rawUrl);
  url.searchParams.set('token', token);
  return url.toString();
}

export function buildValidationTwiML(message: string) {
  const voice = process.env.TWILIO_VOICE || 'Polly.Mia-Neural';
  const cleanMessage = message || 'Hola, te llamamos de Heavenly Dreams para validar tu solicitud. Un asesor dará seguimiento.';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="${escapeXml(voice)}">${escapeXml(cleanMessage)}</Say>
  <Pause length="1"/>
  <Say language="es-MX" voice="${escapeXml(voice)}">Gracias. Esta llamada quedó registrada para validación.</Say>
</Response>`;
}

export async function createTwilioCall(to: string, message: string, options: { url?: string } = {}) {
  const accountSid = requiredEnv('TWILIO_ACCOUNT_SID');
  const authToken = requiredEnv('TWILIO_AUTH_TOKEN');
  const from = requiredEnv('TWILIO_FROM_NUMBER');
  const webhookBaseUrl = getSecretValue('TWILIO_WEBHOOK_BASE_URL') || process.env.APP_URL || '';
  if (!webhookBaseUrl) throw new Error('TWILIO_WEBHOOK_BASE_URL o APP_URL requerido para TwiML');

  const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`);
  const params = new URLSearchParams({
    To: to,
    From: from,
    MachineDetection: 'Enable',
  });
  if (options.url) {
    params.set('Url', appendWebhookToken(options.url));
  } else {
    params.set('Twiml', buildValidationTwiML(message));
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth(accountSid, authToken)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || `Twilio ${res.status}`);
  return data;
}
