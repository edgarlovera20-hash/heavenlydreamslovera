import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import qrcode from 'qrcode';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ingestChannelMessage, recordOutgoingChannelMessage, upsertChannelAccount } from './messaging';

type Status = 'disconnected' | 'qr' | 'authenticating' | 'connected';
export type WhatsAppAccount = 'promotores' | 'clientes';

export interface WaMessage {
  id: string;
  from: string;
  fromName: string;
  to?: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  channel: 'whatsapp';
  account: WhatsAppAccount;
  direction?: 'incoming' | 'outgoing';
}

type WaMessageHandler = (msg: WaMessage) => Promise<void> | void;

type WaRuntime = {
  account: WhatsAppAccount;
  label: string;
  externalId: string;
  authPath: string;
  socket: any;
  initPromise: Promise<void> | null;
  currentQR: string | null;
  status: Status;
  lastError: string | null;
  messageHandler: WaMessageHandler | null;
  reconnectAttempts: number;
  restartTimer: ReturnType<typeof setTimeout> | null;
  suppressReconnect: boolean;
  messageBuffer: WaMessage[];
};

const MAX_MESSAGES = 200;
const AUTH_BASE_PATH = path.resolve(process.cwd(), '.baileys_auth');
const ACCOUNT_LABELS: Record<WhatsAppAccount, string> = {
  promotores: 'WhatsApp Promotores',
  clientes: 'WhatsApp Clientes',
};

function hasStoredCredentials(externalId: string) {
  return existsSync(path.resolve(AUTH_BASE_PATH, externalId, 'creds.json'));
}

function defaultPromoterExternalId() {
  if (process.env.WHATSAPP_PROMOTORES_CLIENT_ID) return process.env.WHATSAPP_PROMOTORES_CLIENT_ID;
  if (process.env.WHATSAPP_CLIENT_ID) return process.env.WHATSAPP_CLIENT_ID;
  if (!hasStoredCredentials('heavenly-dreams-promotores') && hasStoredCredentials('heavenly-dreams-main')) {
    return 'heavenly-dreams-main';
  }
  return 'heavenly-dreams-promotores';
}

const ACCOUNT_ENV_IDS: Record<WhatsAppAccount, string> = {
  promotores: defaultPromoterExternalId(),
  clientes: process.env.WHATSAPP_CLIENTES_CLIENT_ID || 'heavenly-dreams-clientes',
};

function makeRuntime(account: WhatsAppAccount): WaRuntime {
  const externalId = ACCOUNT_ENV_IDS[account];
  return {
    account,
    label: ACCOUNT_LABELS[account],
    externalId,
    authPath: path.resolve(AUTH_BASE_PATH, externalId),
    socket: null,
    initPromise: null,
    currentQR: null,
    status: 'disconnected',
    lastError: null,
    messageHandler: null,
    reconnectAttempts: 0,
    restartTimer: null,
    suppressReconnect: false,
    messageBuffer: [],
  };
}

const runtimes: Record<WhatsAppAccount, WaRuntime> = {
  promotores: makeRuntime('promotores'),
  clientes: makeRuntime('clientes'),
};

export function normalizeWhatsAppAccount(value?: any): WhatsAppAccount {
  const raw = String(value || '').trim().toLowerCase();
  if (['cliente', 'clientes', 'client', 'clients', 'customer', 'customers'].includes(raw)) return 'clientes';
  return 'promotores';
}

function runtimeFor(account?: any) {
  return runtimes[normalizeWhatsAppAccount(account)];
}

function storageChatId(account: WhatsAppAccount, jid: string) {
  return `${account}:${jid}`;
}

function parseTarget(value: string, fallbackAccount: WhatsAppAccount) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(promotores|clientes):(.+)$/i);
  return {
    account: match ? normalizeWhatsAppAccount(match[1]) : fallbackAccount,
    target: match ? match[2] : raw,
  };
}

export function getRecentMessages(limit = 50, account?: WhatsAppAccount): WaMessage[] {
  if (account) return runtimeFor(account).messageBuffer.slice(-limit);
  return Object.values(runtimes)
    .flatMap(runtime => runtime.messageBuffer)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-limit);
}

export function getWhatsAppStatus(account?: WhatsAppAccount) {
  if (account) return publicStatus(runtimeFor(account));
  return {
    promotores: publicStatus(runtimes.promotores),
    clientes: publicStatus(runtimes.clientes),
  };
}

export function hasWhatsAppCredentials(account?: WhatsAppAccount) {
  return hasStoredCredentials(runtimeFor(account).externalId);
}

function publicStatus(runtime: WaRuntime) {
  return {
    account: runtime.account,
    label: runtime.label,
    status: runtime.status,
    error: runtime.lastError,
    engine: 'baileys',
    sessionPath: runtime.authPath,
    externalId: runtime.externalId,
    reconnecting: Boolean(runtime.restartTimer),
    credentialsPresent: hasStoredCredentials(runtime.externalId),
  };
}

function persistStatus(runtime: WaRuntime, nextStatus = runtime.status) {
  upsertChannelAccount({
    channel: 'whatsapp',
    label: runtime.label,
    externalId: runtime.externalId,
    status: nextStatus,
    metadata: {
      account: runtime.account,
      engine: 'baileys',
      sessionPath: runtime.authPath,
      error: runtime.lastError,
    },
  });
}

export function getWhatsAppQR(account?: WhatsAppAccount) {
  return runtimeFor(account).currentQR;
}

export function setWhatsAppMessageHandler(handler: WaMessageHandler | null, account?: WhatsAppAccount) {
  if (account) {
    runtimeFor(account).messageHandler = handler;
    return;
  }
  runtimes.promotores.messageHandler = handler;
}

export function setWhatsAppClientesMessageHandler(handler: WaMessageHandler | null) {
  runtimes.clientes.messageHandler = handler;
}

function normalizePhoneOrJid(value: string) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Número de WhatsApp vacío.');
  const parsed = parseTarget(raw, 'promotores');
  if (parsed.target.includes('@')) return parsed.target;
  const cleaned = parsed.target.replace(/\D/g, '');
  if (cleaned.length < 10) throw new Error('Captura un número de WhatsApp con lada.');
  return `${cleaned}@s.whatsapp.net`;
}

function extractBody(message: any): string {
  const payload = message?.message || {};
  const text = (
    payload.conversation ||
    payload.extendedTextMessage?.text ||
    payload.imageMessage?.caption ||
    payload.videoMessage?.caption ||
    payload.documentMessage?.caption ||
    payload.buttonsResponseMessage?.selectedDisplayText ||
    payload.listResponseMessage?.title ||
    ''
  ).trim();
  if (text) return text;
  if (payload.stickerMessage) return '[sticker recibido]';
  if (payload.imageMessage) return '[imagen recibida: posible INE o expediente]';
  if (payload.documentMessage) {
    const fileName = payload.documentMessage.fileName || payload.documentMessage.title || 'documento';
    return `[documento recibido: ${fileName}]`;
  }
  if (payload.audioMessage) return '[audio recibido]';
  if (payload.videoMessage) return '[video recibido]';
  if (payload.contactMessage || payload.contactsArrayMessage) return '[contacto recibido]';
  if (payload.locationMessage || payload.liveLocationMessage) return '[ubicacion recibida]';
  return '[mensaje recibido sin texto]';
}

function messageTypes(message: any) {
  return Object.keys(message?.message || {});
}

function normalizeTimestamp(value: any) {
  if (!value) return Date.now();
  if (typeof value === 'number') return value * 1000;
  if (typeof value?.toNumber === 'function') return value.toNumber() * 1000;
  return Date.now();
}

function pushMessage(runtime: WaRuntime, entry: WaMessage) {
  if (!entry.body) return;
  if (runtime.messageBuffer.some(m => m.id === entry.id)) return;
  runtime.messageBuffer.push(entry);
  if (runtime.messageBuffer.length > MAX_MESSAGES) runtime.messageBuffer.shift();
}

async function closeCurrentSocket(runtime: WaRuntime) {
  if (runtime.restartTimer) {
    clearTimeout(runtime.restartTimer);
    runtime.restartTimer = null;
  }
  if (!runtime.socket) return;
  const previous = runtime.socket;
  runtime.socket = null;
  try {
    previous.ev?.removeAllListeners?.();
    previous.end?.(undefined);
  } catch {
    // Socket may already be closed; this should not block a clean restart.
  }
}

async function clearAuthState(runtime: WaRuntime, reason: string) {
  const base = `${AUTH_BASE_PATH}${path.sep}`;
  if (!runtime.authPath.startsWith(base)) {
    throw new Error('Ruta de sesión WhatsApp inválida.');
  }
  await fs.rm(runtime.authPath, { recursive: true, force: true });
  console.log(`[WA:${runtime.account}] Sesión local limpiada: ${reason}`);
}

function shouldClearSession(code: number | undefined) {
  return code === DisconnectReason.loggedOut || code === DisconnectReason.badSession;
}

function shouldReconnect(code: number | undefined) {
  return [
    DisconnectReason.restartRequired,
    DisconnectReason.connectionClosed,
    DisconnectReason.connectionLost,
    DisconnectReason.timedOut,
  ].includes(code as DisconnectReason);
}

function scheduleRestart(runtime: WaRuntime, reason: string) {
  if (runtime.suppressReconnect || runtime.restartTimer) return;
  runtime.status = 'authenticating';
  runtime.currentQR = null;
  runtime.lastError = null;
  runtime.restartTimer = setTimeout(async () => {
    runtime.restartTimer = null;
    try {
      console.log(`[WA:${runtime.account}] Reiniciando socket: ${reason}`);
      await initWhatsApp(runtime.account);
    } catch (err) {
      runtime.status = 'disconnected';
      runtime.lastError = err instanceof Error ? err.message : 'No se pudo reiniciar WhatsApp.';
    }
  }, 900);
}

async function startBaileysSocket(runtime: WaRuntime) {
  const { state, saveCreds } = await useMultiFileAuthState(runtime.authPath);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as any }));
  const nextSocket = makeWASocket({
    auth: state,
    browser: [runtime.label, 'Chrome', '1.0.0'],
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: false,
    version,
  });

  runtime.socket = nextSocket;
  runtime.status = 'authenticating';
  runtime.lastError = null;
  runtime.currentQR = null;
  persistStatus(runtime);

  nextSocket.ev.on('creds.update', saveCreds);

  nextSocket.ev.on('connection.update', async (update: any) => {
    if (update.qr) {
      runtime.currentQR = await qrcode.toDataURL(update.qr);
      runtime.status = 'qr';
      runtime.lastError = null;
      persistStatus(runtime);
      console.log(`[WA:${runtime.account}] QR generado, escanea con tu teléfono`);
    }

    if (update.connection === 'connecting') {
      runtime.status = runtime.currentQR ? 'qr' : 'authenticating';
      persistStatus(runtime);
    }

    if (update.connection === 'open') {
      runtime.status = 'connected';
      runtime.currentQR = null;
      runtime.lastError = null;
      runtime.reconnectAttempts = 0;
      persistStatus(runtime);
      console.log(`[WA:${runtime.account}] Conectado y listo`);
    }

    if (update.connection === 'close') {
      const code = update.lastDisconnect?.error?.output?.statusCode;
      const resetSession = shouldClearSession(code);
      const reconnectable = shouldReconnect(code) || resetSession;
      runtime.currentQR = null;
      runtime.socket = null;
      console.log(`[WA:${runtime.account}] Desconectado:`, code || update.lastDisconnect?.error?.message || 'sin código');

      if (runtime.suppressReconnect) {
        runtime.status = 'disconnected';
        runtime.lastError = null;
        runtime.reconnectAttempts = 0;
        persistStatus(runtime);
        return;
      }

      if (resetSession) {
        try {
          await clearAuthState(runtime, `codigo ${code}`);
        } catch (err) {
          console.warn(`[WA:${runtime.account}] No se pudo limpiar la sesión local:`, err);
        }
      }

      if (reconnectable && runtime.reconnectAttempts < 5) {
        runtime.reconnectAttempts += 1;
        scheduleRestart(runtime, resetSession ? 'credenciales anteriores inválidas' : `codigo ${code}`);
        return;
      }

      runtime.status = 'disconnected';
      runtime.lastError = resetSession
        ? 'Sesión cerrada. Presiona Regenerar QR para vincular WhatsApp de nuevo.'
        : 'WhatsApp se desconectó. Presiona vincular para reintentar.';
      persistStatus(runtime);
    }
  });

  nextSocket.ev.on('messages.upsert', async ({ messages, type }: any) => {
    if (type !== 'notify') return;
    for (const msg of messages || []) {
      if (!msg?.message || msg.key?.fromMe) continue;
      const body = extractBody(msg);
      if (!body) continue;
      const remoteJid = msg.key.remoteJid || '';
      const storedChatId = storageChatId(runtime.account, remoteJid);
      const entry: WaMessage = {
        id: msg.key.id || `${remoteJid}-${Date.now()}`,
        from: remoteJid,
        fromName: msg.pushName || remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', ''),
        body,
        timestamp: normalizeTimestamp(msg.messageTimestamp),
        isGroup: remoteJid.endsWith('@g.us'),
        channel: 'whatsapp',
        account: runtime.account,
        direction: 'incoming',
      };
      pushMessage(runtime, entry);
      await ingestChannelMessage({
        id: `whatsapp:${runtime.account}:${entry.id}`,
        channel: 'whatsapp',
        externalChatId: storedChatId,
        direction: 'incoming',
        body: entry.body,
        fromName: entry.fromName,
        timestamp: entry.timestamp,
        isGroup: entry.isGroup,
        metadata: { rawId: entry.id, account: runtime.account, jid: entry.from, messageTypes: messageTypes(msg) },
      });
      if (runtime.messageHandler) {
        try {
          await runtime.messageHandler(entry);
        } catch (err) {
          console.warn(`[WA:${runtime.account}] Error en asistente WhatsApp:`, err);
        }
      }
    }
  });
}

export async function initWhatsApp(account?: WhatsAppAccount): Promise<void> {
  const runtime = runtimeFor(account);
  runtime.suppressReconnect = false;
  if (runtime.socket && (runtime.status === 'connected' || runtime.status === 'qr' || runtime.status === 'authenticating')) {
    return runtime.initPromise || Promise.resolve();
  }
  if (runtime.initPromise) return runtime.initPromise;

  runtime.initPromise = (async () => {
    await closeCurrentSocket(runtime);
    runtime.status = 'authenticating';
    runtime.currentQR = null;
    runtime.lastError = null;
    await startBaileysSocket(runtime);
  })().catch((err: Error) => {
    runtime.status = 'disconnected';
    runtime.currentQR = null;
    runtime.lastError = err?.message || 'No se pudo iniciar WhatsApp con Baileys.';
    persistStatus(runtime);
    console.error(`[WA:${runtime.account}] Error inicializando:`, err);
  }).finally(() => {
    runtime.initPromise = null;
  });

  return runtime.initPromise;
}

export async function sendWhatsAppMessage(phone: string, message: string, account: WhatsAppAccount = 'promotores') {
  const parsed = parseTarget(phone, account);
  const runtime = runtimeFor(parsed.account);
  if (!runtime.socket || runtime.status !== 'connected') {
    throw new Error(`${runtime.label} no está conectado. Conecta primero escaneando el QR.`);
  }
  const jid = normalizePhoneOrJid(parsed.target);
  const body = String(message || '').trim();
  const result = await runtime.socket.sendMessage(jid, { text: body });
  const messageId = result?.key?.id || `sent-${jid}-${Date.now()}`;
  pushMessage(runtime, {
    id: messageId,
    from: 'crm',
    fromName: runtime.label,
    to: jid,
    body,
    timestamp: Date.now(),
    isGroup: jid.endsWith('@g.us'),
    channel: 'whatsapp',
    account: runtime.account,
    direction: 'outgoing',
  });
  await recordOutgoingChannelMessage({
    id: `whatsapp:${runtime.account}:${messageId}`,
    channel: 'whatsapp',
    externalChatId: storageChatId(runtime.account, jid),
    direction: 'outgoing',
    body,
    fromName: runtime.label,
    toId: jid,
    timestamp: Date.now(),
    isGroup: jid.endsWith('@g.us'),
    metadata: { engine: 'baileys', account: runtime.account, jid },
  });
  return { ok: true, id: result?.key?.id, account: runtime.account };
}

export function sendWhatsAppClientMessage(phone: string, message: string) {
  return sendWhatsAppMessage(phone, message, 'clientes');
}

export function sendWhatsAppPromoterMessage(phone: string, message: string) {
  return sendWhatsAppMessage(phone, message, 'promotores');
}

export async function logoutWhatsApp(account?: WhatsAppAccount) {
  const runtime = runtimeFor(account);
  runtime.suppressReconnect = true;
  if (runtime.socket) {
    try {
      await runtime.socket.logout();
    } catch {
      // The session may already be invalid. We still reset local runtime state.
    }
  }
  await closeCurrentSocket(runtime);
  await clearAuthState(runtime, 'logout manual').catch(() => {});
  runtime.currentQR = null;
  runtime.status = 'disconnected';
  runtime.lastError = null;
  runtime.reconnectAttempts = 0;
  persistStatus(runtime);
}
