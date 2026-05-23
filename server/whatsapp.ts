// @ts-ignore - whatsapp-web.js no incluye tipos oficiales completos
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import path from 'node:path';

type Status = 'disconnected' | 'qr' | 'authenticating' | 'connected';

export interface WaMessage {
  id: string;
  from: string;
  fromName: string;
  body: string;
  timestamp: number;
  isGroup: boolean;
  channel: 'whatsapp';
}

let client: any = null;
let initPromise: Promise<void> | null = null;
let currentQR: string | null = null;
let status: Status = 'disconnected';
let lastError: string | null = null;
const messageBuffer: WaMessage[] = [];
const MAX_MESSAGES = 200;
const AUTH_DATA_PATH = path.resolve(process.cwd(), '.wwebjs_auth');
const PRIMARY_CLIENT_ID = process.env.WHATSAPP_CLIENT_ID || 'heavenly-dreams-main';

export function getRecentMessages(limit = 50): WaMessage[] {
  return messageBuffer.slice(-limit);
}

export function getWhatsAppStatus() {
  return { status, error: lastError };
}

export function getWhatsAppQR() {
  return currentQR;
}

function isBrowserProfileLockError(err: any) {
  const message = String(err?.message || err || '');
  return /browser is already running|userDataDir|profile.*in use|process singleton/i.test(message);
}

function friendlyError(err: any) {
  const message = String(err?.message || err || 'No se pudo iniciar WhatsApp.');
  if (isBrowserProfileLockError(message)) {
    return 'La sesión de navegador de WhatsApp quedó bloqueada por un proceso anterior. Se intentó abrir una sesión limpia; vuelve a presionar Vincular WhatsApp.';
  }
  return message;
}

async function destroyCurrentClient() {
  if (!client) return;
  const previous = client;
  client = null;
  try {
    await previous.destroy();
  } catch {
    // El proceso puede haber muerto antes; no bloquea el reinicio.
  }
}

function attachClientEvents(nextClient: any) {
  nextClient.on('qr', async (qr: string) => {
    try {
      currentQR = await qrcode.toDataURL(qr);
      status = 'qr';
      lastError = null;
      console.log('[WA] QR generado, escanea con tu teléfono');
    } catch (err) {
      console.error('[WA] Error generando QR:', err);
    }
  });

  nextClient.on('authenticated', () => {
    status = 'authenticating';
    currentQR = null;
    lastError = null;
    console.log('[WA] Autenticado, esperando conexión final…');
  });

  nextClient.on('ready', () => {
    status = 'connected';
    currentQR = null;
    lastError = null;
    console.log('[WA] ✅ Conectado y listo para enviar mensajes');
  });

  nextClient.on('message', async (msg: any) => {
    try {
      const contact = await msg.getContact();
      const entry: WaMessage = {
        id: msg.id?._serialized || String(Date.now()),
        from: msg.from,
        fromName: contact.pushname || contact.name || msg.from.replace('@c.us', ''),
        body: msg.body,
        timestamp: msg.timestamp * 1000,
        isGroup: msg.from?.includes('@g.us') || false,
        channel: 'whatsapp',
      };
      messageBuffer.push(entry);
      if (messageBuffer.length > MAX_MESSAGES) messageBuffer.shift();
    } catch { /* ignorar errores de contacto */ }
  });

  nextClient.on('disconnected', (reason: string) => {
    status = 'disconnected';
    currentQR = null;
    lastError = `Desconectado: ${reason}`;
    console.log('[WA] Desconectado:', reason);
  });

  nextClient.on('auth_failure', (msg: string) => {
    status = 'disconnected';
    currentQR = null;
    lastError = `Fallo de autenticación: ${msg}`;
    console.error('[WA] Fallo de auth:', msg);
  });
}

async function startClient(clientId: string) {
  const nextClient = new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: AUTH_DATA_PATH,
    }),
    webVersion: '2.3000.1015901307',
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.1015901307.html',
    },
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    },
  });

  client = nextClient;
  attachClientEvents(nextClient);
  await nextClient.initialize();
}

async function initializeWhatsAppClient() {
  if (client && (status === 'connected' || status === 'qr' || status === 'authenticating')) {
    return;
  }
  await destroyCurrentClient();
  lastError = null;
  status = 'disconnected';
  currentQR = null;

  try {
    await startClient(PRIMARY_CLIENT_ID);
  } catch (err) {
    await destroyCurrentClient();
    if (!isBrowserProfileLockError(err)) throw err;
    const recoveryClientId = `${PRIMARY_CLIENT_ID}-recovery-${Date.now()}`;
    console.warn('[WA] Perfil de navegador bloqueado, reintentando con sesión limpia:', recoveryClientId);
    await startClient(recoveryClientId);
  }
}

export async function initWhatsApp(): Promise<void> {
  if (client && (status === 'connected' || status === 'qr' || status === 'authenticating')) {
    return initPromise || Promise.resolve();
  }
  if (initPromise) return initPromise;

  initPromise = initializeWhatsAppClient().catch((err: Error) => {
    lastError = friendlyError(err);
    status = 'disconnected';
    currentQR = null;
    console.error('[WA] Error inicializando:', err);
  }).finally(() => {
    initPromise = null;
  });
  return initPromise;
}

export async function sendWhatsAppMessage(phone: string, message: string) {
  if (!client || status !== 'connected') {
    throw new Error('WhatsApp no está conectado. Conecta primero escaneando el QR.');
  }
  const cleaned = phone.replace(/\D/g, '');
  const chatId = cleaned.includes('@') ? cleaned : `${cleaned}@c.us`;
  const result = await client.sendMessage(chatId, message);
  return { ok: true, id: result.id?._serialized };
}

export async function logoutWhatsApp() {
  if (!client) {
    currentQR = null;
    status = 'disconnected';
    lastError = null;
    return;
  }
  try {
    await client.logout();
  } catch {
    // ignorar
  }
  await destroyCurrentClient();
  currentQR = null;
  status = 'disconnected';
  lastError = null;
}
