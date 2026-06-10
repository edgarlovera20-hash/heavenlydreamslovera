/**
 * WhatsApp Cloud API (Meta Business Platform)
 * Integración con la API oficial — alternativa/complemento a Baileys.
 *
 * Variables de entorno requeridas:
 *   WHATSAPP_CLOUD_TOKEN           – Token de acceso permanente generado en Meta
 *   WHATSAPP_CLOUD_PHONE_NUMBER_ID – ID del número registrado (ej. 118504843801885)
 *   WHATSAPP_CLOUD_VERIFY_TOKEN    – Token arbitrario que configuras en el webhook de Meta
 *   WHATSAPP_CLOUD_APP_SECRET      – App Secret de tu app en Meta (para verificar firma)
 */

import crypto from 'node:crypto';
import { ingestChannelMessage, recordOutgoingChannelMessage, upsertChannelAccount } from './messaging';

const GRAPH_API_VERSION = 'v25.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function getConfig() {
  return {
    token: process.env.WHATSAPP_CLOUD_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? '',
    verifyToken: process.env.WHATSAPP_CLOUD_VERIFY_TOKEN ?? '',
    appSecret: process.env.WHATSAPP_CLOUD_APP_SECRET ?? '',
  };
}

export function isCloudConfigured(): boolean {
  const { token, phoneNumberId } = getConfig();
  return Boolean(token && phoneNumberId);
}

// ── Sending ─────────────────────────────────────────────────────────────────

export interface CloudSendOptions {
  to: string;
  type?: 'text';
  text: string;
  previewUrl?: boolean;
}

export async function sendCloudMessage(opts: CloudSendOptions): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const { token, phoneNumberId } = getConfig();
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp Cloud API no configurada (WHATSAPP_CLOUD_TOKEN / WHATSAPP_CLOUD_PHONE_NUMBER_ID)' };
  }
  const to = normalizePhone(opts.to);
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: opts.previewUrl ?? false, body: opts.text },
  };
  try {
    const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as any;
    if (!res.ok) {
      return { ok: false, error: data?.error?.message ?? `HTTP ${res.status}` };
    }
    const messageId: string = data?.messages?.[0]?.id ?? '';
    await recordOutgoingChannelMessage({
      id: messageId || crypto.randomUUID(),
      channel: 'whatsapp',
      externalChatId: `cloud:${to}`,
      direction: 'outgoing',
      body: opts.text,
      toId: to,
      timestamp: Date.now(),
    });
    return { ok: true, messageId };
  } catch (err: any) {
    return { ok: false, error: err?.message ?? 'Error de red' };
  }
}

// ── Webhook verification (GET) ───────────────────────────────────────────────

export function handleWebhookVerification(query: Record<string, any>): { status: number; body: string } {
  const { verifyToken } = getConfig();
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (mode === 'subscribe' && token === verifyToken) {
    return { status: 200, body: String(challenge) };
  }
  return { status: 403, body: 'Forbidden' };
}

// ── Webhook payload (POST) ───────────────────────────────────────────────────

export async function handleWebhookPayload(rawBody: Buffer, signature: string): Promise<void> {
  const { appSecret } = getConfig();
  if (appSecret) {
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ''))) {
      throw new Error('Firma del webhook inválida');
    }
  }
  const payload = JSON.parse(rawBody.toString('utf8'));
  await processWebhookPayload(payload);
}

async function processWebhookPayload(payload: any): Promise<void> {
  const entries: any[] = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      if (!value) continue;
      const phoneNumberId: string = value.metadata?.phone_number_id ?? '';
      await ensureCloudAccount(phoneNumberId);
      for (const msg of value?.messages ?? []) {
        await ingestCloudMessage(msg, value.contacts ?? [], phoneNumberId);
      }
    }
  }
}

async function ingestCloudMessage(msg: any, contacts: any[], phoneNumberId: string): Promise<void> {
  const from: string = msg.from ?? '';
  const contact = contacts.find((c: any) => c.wa_id === from);
  const fromName: string = contact?.profile?.name ?? from;
  const body = extractMessageBody(msg);
  if (!body) return;
  await ingestChannelMessage({
    id: msg.id ?? crypto.randomUUID(),
    channel: 'whatsapp',
    externalChatId: `cloud:${from}`,
    direction: 'incoming',
    body,
    fromName,
    timestamp: Number(msg.timestamp ?? 0) * 1000,
    isGroup: false,
    metadata: { phoneNumberId, type: msg.type, raw: msg },
  });
}

function extractMessageBody(msg: any): string {
  switch (msg.type) {
    case 'text': return msg.text?.body ?? '';
    case 'image': return msg.image?.caption ?? '[imagen]';
    case 'video': return msg.video?.caption ?? '[video]';
    case 'audio': return '[audio]';
    case 'document': return msg.document?.filename ?? '[documento]';
    case 'location': return `[ubicación] lat:${msg.location?.latitude} lng:${msg.location?.longitude}`;
    case 'sticker': return '[sticker]';
    default: return '';
  }
}

async function ensureCloudAccount(phoneNumberId: string): Promise<void> {
  try {
    await upsertChannelAccount({
      externalId: `cloud-${phoneNumberId}`,
      channel: 'whatsapp',
      label: 'WhatsApp Cloud API',
      status: 'connected',
      metadata: { phoneNumberId, provider: 'meta_cloud' },
    });
  } catch {}
}

// ── Phone normalization ──────────────────────────────────────────────────────

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}
