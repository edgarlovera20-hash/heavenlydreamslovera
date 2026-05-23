import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import Pino from 'pino';
import qrcode from 'qrcode';
import fs from 'node:fs/promises';
import path from 'node:path';

type Status = 'disconnected' | 'qr' | 'authenticating' | 'connected';

export interface WaMessage {
  id: string;
  from: string;
  fromName: string;
  to?: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  channel: 'whatsapp';
  direction?: 'incoming' | 'outgoing';
}

type WaMessageHandler = (msg: WaMessage) => Promise<void> | void;

let socket: any = null;
let initPromise: Promise<void> | null = null;
let currentQR: string | null = null;
let status: Status = 'disconnected';
let lastError: string | null = null;
let messageHandler: WaMessageHandler | null = null;
let reconnectAttempts = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let suppressReconnect = false;

const messageBuffer: WaMessage[] = [];
const MAX_MESSAGES = 200;
const AUTH_BASE_PATH = path.resolve(process.cwd(), '.baileys_auth');
const AUTH_DATA_PATH = path.resolve(AUTH_BASE_PATH, process.env.WHATSAPP_CLIENT_ID || 'heavenly-dreams-main');

export function getRecentMessages(limit = 50): WaMessage[] {
  return messageBuffer.slice(-limit);
}

export function getWhatsAppStatus() {
  return {
    status,
    error: lastError,
    engine: 'baileys',
    sessionPath: AUTH_DATA_PATH,
    reconnecting: Boolean(restartTimer),
  };
}

export function getWhatsAppQR() {
  return currentQR;
}

export function setWhatsAppMessageHandler(handler: WaMessageHandler | null) {
  messageHandler = handler;
}

function normalizePhoneOrJid(value: string) {
  const raw = String(value || '').trim();
  if (!raw) throw new Error('Número de WhatsApp vacío.');
  if (raw.includes('@')) return raw;
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.length < 10) throw new Error('Captura un número de WhatsApp con lada.');
  return `${cleaned}@s.whatsapp.net`;
}

function extractBody(message: any): string {
  const payload = message?.message || {};
  return (
    payload.conversation ||
    payload.extendedTextMessage?.text ||
    payload.imageMessage?.caption ||
    payload.videoMessage?.caption ||
    payload.documentMessage?.caption ||
    payload.buttonsResponseMessage?.selectedDisplayText ||
    payload.listResponseMessage?.title ||
    ''
  ).trim();
}

function normalizeTimestamp(value: any) {
  if (!value) return Date.now();
  if (typeof value === 'number') return value * 1000;
  if (typeof value?.toNumber === 'function') return value.toNumber() * 1000;
  return Date.now();
}

function pushMessage(entry: WaMessage) {
  if (!entry.body) return;
  if (messageBuffer.some(m => m.id === entry.id)) return;
  messageBuffer.push(entry);
  if (messageBuffer.length > MAX_MESSAGES) messageBuffer.shift();
}

async function closeCurrentSocket() {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (!socket) return;
  const previous = socket;
  socket = null;
  try {
    previous.ev?.removeAllListeners?.();
    previous.end?.(undefined);
  } catch {
    // Socket may already be closed; this should not block a clean restart.
  }
}

async function clearAuthState(reason: string) {
  const base = `${AUTH_BASE_PATH}${path.sep}`;
  if (!AUTH_DATA_PATH.startsWith(base)) {
    throw new Error('Ruta de sesión WhatsApp inválida.');
  }
  await fs.rm(AUTH_DATA_PATH, { recursive: true, force: true });
  console.log(`[WA:Baileys] Sesión local limpiada: ${reason}`);
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

function scheduleRestart(reason: string) {
  if (suppressReconnect || restartTimer) return;
  status = 'authenticating';
  currentQR = null;
  lastError = null;
  restartTimer = setTimeout(async () => {
    restartTimer = null;
    try {
      console.log(`[WA:Baileys] Reiniciando socket: ${reason}`);
      await initWhatsApp();
    } catch (err) {
      status = 'disconnected';
      lastError = err instanceof Error ? err.message : 'No se pudo reiniciar WhatsApp.';
    }
  }, 900);
}

async function startBaileysSocket() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DATA_PATH);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined as any }));
  const nextSocket = makeWASocket({
    auth: state,
    browser: ['Heavenly Dreams CRM', 'Chrome', '1.0.0'],
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: false,
    version,
  });

  socket = nextSocket;
  status = 'authenticating';
  lastError = null;
  currentQR = null;

  nextSocket.ev.on('creds.update', saveCreds);

  nextSocket.ev.on('connection.update', async (update: any) => {
    if (update.qr) {
      currentQR = await qrcode.toDataURL(update.qr);
      status = 'qr';
      lastError = null;
      console.log('[WA:Baileys] QR generado, escanea con tu teléfono');
    }

    if (update.connection === 'connecting') {
      status = currentQR ? 'qr' : 'authenticating';
    }

    if (update.connection === 'open') {
      status = 'connected';
      currentQR = null;
      lastError = null;
      reconnectAttempts = 0;
      console.log('[WA:Baileys] Conectado y listo para asistentes');
    }

    if (update.connection === 'close') {
      const code = update.lastDisconnect?.error?.output?.statusCode;
      const resetSession = shouldClearSession(code);
      const reconnectable = shouldReconnect(code) || resetSession;
      currentQR = null;
      socket = null;
      console.log('[WA:Baileys] Desconectado:', code || update.lastDisconnect?.error?.message || 'sin código');

      if (suppressReconnect) {
        status = 'disconnected';
        lastError = null;
        reconnectAttempts = 0;
        return;
      }

      if (resetSession) {
        try {
          await clearAuthState(`codigo ${code}`);
        } catch (err) {
          console.warn('[WA:Baileys] No se pudo limpiar la sesión local:', err);
        }
      }

      if (reconnectable && reconnectAttempts < 5) {
        reconnectAttempts += 1;
        scheduleRestart(resetSession ? 'credenciales anteriores inválidas' : `codigo ${code}`);
        return;
      }

      status = 'disconnected';
      lastError = resetSession
        ? 'Sesión cerrada. Presiona Regenerar QR para vincular WhatsApp de nuevo.'
        : 'WhatsApp se desconectó. Presiona vincular para reintentar.';
    }
  });

  nextSocket.ev.on('messages.upsert', async ({ messages, type }: any) => {
    if (type !== 'notify') return;
    for (const msg of messages || []) {
      if (!msg?.message || msg.key?.fromMe) continue;
      const body = extractBody(msg);
      if (!body) continue;
      const remoteJid = msg.key.remoteJid || '';
      const entry: WaMessage = {
        id: msg.key.id || `${remoteJid}-${Date.now()}`,
        from: remoteJid,
        fromName: msg.pushName || remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', ''),
        body,
        timestamp: normalizeTimestamp(msg.messageTimestamp),
        isGroup: remoteJid.endsWith('@g.us'),
        channel: 'whatsapp',
        direction: 'incoming',
      };
      pushMessage(entry);
      if (messageHandler) {
        try {
          await messageHandler(entry);
        } catch (err) {
          console.warn('[WA:Baileys] Error en asistente WhatsApp:', err);
        }
      }
    }
  });
}

export async function initWhatsApp(): Promise<void> {
  suppressReconnect = false;
  if (socket && (status === 'connected' || status === 'qr' || status === 'authenticating')) {
    return initPromise || Promise.resolve();
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await closeCurrentSocket();
    status = 'authenticating';
    currentQR = null;
    lastError = null;
    await startBaileysSocket();
  })().catch((err: Error) => {
    status = 'disconnected';
    currentQR = null;
    lastError = err?.message || 'No se pudo iniciar WhatsApp con Baileys.';
    console.error('[WA:Baileys] Error inicializando:', err);
  }).finally(() => {
    initPromise = null;
  });

  return initPromise;
}

export async function sendWhatsAppMessage(phone: string, message: string) {
  if (!socket || status !== 'connected') {
    throw new Error('WhatsApp no está conectado. Conecta primero escaneando el QR.');
  }
  const jid = normalizePhoneOrJid(phone);
  const body = String(message || '').trim();
  const result = await socket.sendMessage(jid, { text: body });
  pushMessage({
    id: result?.key?.id || `sent-${jid}-${Date.now()}`,
    from: 'crm',
    fromName: 'Heavenly Dreams CRM',
    to: jid,
    body,
    timestamp: Date.now(),
    isGroup: jid.endsWith('@g.us'),
    channel: 'whatsapp',
    direction: 'outgoing',
  });
  return { ok: true, id: result?.key?.id };
}

export async function logoutWhatsApp() {
  suppressReconnect = true;
  if (socket) {
    try {
      await socket.logout();
    } catch {
      // The session may already be invalid. We still reset local runtime state.
    }
  }
  await closeCurrentSocket();
  await clearAuthState('logout manual').catch(() => {});
  currentQR = null;
  status = 'disconnected';
  lastError = null;
  reconnectAttempts = 0;
}
