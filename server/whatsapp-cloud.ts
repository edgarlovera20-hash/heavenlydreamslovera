import { createHmac, timingSafeEqual } from 'node:crypto';
import { ingestChannelMessage, recordOutgoingChannelMessage, upsertChannelAccount } from './messaging';

type CloudStatus = {
  configured: boolean;
  status: 'connected' | 'missing_config';
  engine: 'cloud-api';
  account: 'seguimiento';
  label: string;
  phoneNumberId: string | null;
  businessAccountId: string | null;
  graphVersion: string;
  webhookPath: string;
};

const GRAPH_VERSION = process.env.WHATSAPP_CLOUD_GRAPH_VERSION || 'v23.0';
const ACCOUNT = 'seguimiento';
const LABEL = 'WhatsApp Cloud API Seguimiento';

function env(name: string) {
  return String(process.env[name] || '').trim();
}

function accessToken() {
  return env('WHATSAPP_CLOUD_ACCESS_TOKEN') || env('ACCESS_TOKEN');
}

function appSecret() {
  return env('WHATSAPP_CLOUD_APP_SECRET') || env('APP_SECRET');
}

function verifyToken() {
  return env('WHATSAPP_CLOUD_VERIFY_TOKEN') || env('VERIFY_TOKEN');
}

function phoneNumberId() {
  return env('WHATSAPP_CLOUD_PHONE_NUMBER_ID') || env('PHONE_NUMBER_ID');
}

function businessAccountId() {
  return env('WHATSAPP_CLOUD_WABA_ID') || env('WABA_ID');
}

function configured() {
  return Boolean(accessToken() && phoneNumberId());
}

export function getWhatsAppCloudStatus(): CloudStatus {
  const status: CloudStatus = {
    configured: configured(),
    status: configured() ? 'connected' : 'missing_config',
    engine: 'cloud-api',
    account: ACCOUNT,
    label: LABEL,
    phoneNumberId: phoneNumberId() || null,
    businessAccountId: businessAccountId() || null,
    graphVersion: GRAPH_VERSION,
    webhookPath: '/webhooks/whatsapp-cloud',
  };
  upsertChannelAccount({
    channel: 'whatsapp',
    label: LABEL,
    externalId: status.phoneNumberId || 'whatsapp-cloud-seguimiento',
    status: status.status,
    metadata: {
      account: ACCOUNT,
      audience: 'clientes',
      engine: status.engine,
      businessAccountId: status.businessAccountId,
      webhookPath: status.webhookPath,
    },
  });
  return status;
}

export function verifyWhatsAppCloudChallenge(query: any) {
  const mode = String(query?.['hub.mode'] || '');
  const token = String(query?.['hub.verify_token'] || '');
  const challenge = String(query?.['hub.challenge'] || '');
  if (mode !== 'subscribe' || !verifyToken() || token !== verifyToken()) return null;
  return challenge;
}

export function verifyWhatsAppCloudSignature(rawBody: Buffer, signatureHeader: any) {
  const secret = appSecret();
  if (!secret) return true;
  const rawSignature = String(signatureHeader || '');
  const signature = rawSignature.startsWith('sha256=') ? rawSignature.slice(7) : rawSignature;
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const left = Buffer.from(signature, 'hex');
  const right = Buffer.from(expected, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizePhone(value: any) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) throw new Error('Telefono destino requerido');
  return digits.startsWith('52') ? digits : `52${digits.slice(-10)}`;
}

function extractText(message: any) {
  const type = String(message?.type || 'unknown');
  if (type === 'text') return String(message?.text?.body || '').trim();
  if (type === 'button') return String(message?.button?.text || message?.button?.payload || '').trim();
  if (type === 'interactive') {
    return String(
      message?.interactive?.button_reply?.title ||
      message?.interactive?.button_reply?.id ||
      message?.interactive?.list_reply?.title ||
      message?.interactive?.list_reply?.id ||
      ''
    ).trim();
  }
  if (type === 'image') return String(message?.image?.caption || '[imagen recibida]').trim();
  if (type === 'document') return String(message?.document?.caption || message?.document?.filename || '[documento recibido]').trim();
  if (type === 'audio') return '[audio recibido]';
  if (type === 'video') return String(message?.video?.caption || '[video recibido]').trim();
  if (type === 'location') return '[ubicacion recibida]';
  if (type === 'contacts') return '[contacto recibido]';
  return '[mensaje recibido por WhatsApp Cloud API]';
}

export async function ingestWhatsAppCloudWebhook(body: any) {
  getWhatsAppCloudStatus();
  const ingested: any[] = [];
  if (body?.object !== 'whatsapp_business_account') return { ok: true, ignored: true, ingested };

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const senderPhoneNumberId = value?.metadata?.phone_number_id || phoneNumberId() || 'cloud';
      const contactsByWaId = new Map<string, string>();
      for (const contact of value.contacts || []) {
        if (contact?.wa_id) contactsByWaId.set(String(contact.wa_id), String(contact?.profile?.name || contact.wa_id));
      }
      for (const message of value.messages || []) {
        const from = String(message.from || '').trim();
        const bodyText = extractText(message);
        const result = await ingestChannelMessage({
          id: String(message.id || `cloud-${Date.now()}-${from}`),
          channel: 'whatsapp',
          externalChatId: `${ACCOUNT}:${from}`,
          direction: 'incoming',
          body: bodyText,
          fromName: contactsByWaId.get(from) || from,
          toId: senderPhoneNumberId,
          timestamp: Number(message.timestamp || 0) ? Number(message.timestamp) * 1000 : Date.now(),
          metadata: {
            account: ACCOUNT,
            audience: 'clientes',
            engine: 'cloud-api',
            phoneNumberId: senderPhoneNumberId,
            rawType: message.type,
          },
        });
        ingested.push(result);
      }
    }
  }
  return { ok: true, ingested: ingested.length };
}

export async function sendWhatsAppCloudMessage(to: string, message: string) {
  const token = accessToken();
  const senderPhoneNumberId = phoneNumberId();
  if (!token || !senderPhoneNumberId) {
    throw new Error('Configura WHATSAPP_CLOUD_ACCESS_TOKEN y WHATSAPP_CLOUD_PHONE_NUMBER_ID');
  }
  const normalizedTo = normalizePhone(to);
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${senderPhoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'text',
      text: { preview_url: false, body: String(message || '').slice(0, 4096) },
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || `WhatsApp Cloud API fallo: ${response.status}`);
  }
  await recordOutgoingChannelMessage({
    id: String(data?.messages?.[0]?.id || `cloud-out-${Date.now()}-${normalizedTo}`),
    channel: 'whatsapp',
    externalChatId: `${ACCOUNT}:${normalizedTo}`,
    direction: 'outgoing',
    body: message,
    toId: normalizedTo,
    timestamp: Date.now(),
    metadata: {
      account: ACCOUNT,
      audience: 'clientes',
      engine: 'cloud-api',
      phoneNumberId: senderPhoneNumberId,
      graphResponse: data,
    },
  });
  return { ok: true, engine: 'cloud-api', to: normalizedTo, response: data };
}
