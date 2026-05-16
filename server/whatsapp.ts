// @ts-ignore - whatsapp-web.js no incluye tipos oficiales completos
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';

type Status = 'disconnected' | 'qr' | 'authenticating' | 'connected';

let client: any = null;
let currentQR: string | null = null;
let status: Status = 'disconnected';
let lastError: string | null = null;

export function getWhatsAppStatus() {
  return { status, error: lastError };
}

export function getWhatsAppQR() {
  return currentQR;
}

export async function initWhatsApp(): Promise<void> {
  if (client && (status === 'connected' || status === 'qr' || status === 'authenticating')) {
    return;
  }
  lastError = null;
  status = 'disconnected';
  currentQR = null;

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
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

  client.on('qr', async (qr: string) => {
    try {
      currentQR = await qrcode.toDataURL(qr);
      status = 'qr';
      console.log('[WA] QR generado, escanea con tu teléfono');
    } catch (err) {
      console.error('[WA] Error generando QR:', err);
    }
  });

  client.on('authenticated', () => {
    status = 'authenticating';
    currentQR = null;
    console.log('[WA] Autenticado, esperando conexión final…');
  });

  client.on('ready', () => {
    status = 'connected';
    currentQR = null;
    console.log('[WA] ✅ Conectado y listo para enviar mensajes');
  });

  client.on('disconnected', (reason: string) => {
    status = 'disconnected';
    currentQR = null;
    lastError = `Desconectado: ${reason}`;
    console.log('[WA] Desconectado:', reason);
  });

  client.on('auth_failure', (msg: string) => {
    status = 'disconnected';
    lastError = `Fallo de autenticación: ${msg}`;
    console.error('[WA] Fallo de auth:', msg);
  });

  client.initialize().catch((err: Error) => {
    lastError = err.message;
    status = 'disconnected';
    console.error('[WA] Error inicializando:', err);
  });
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
  if (!client) return;
  try {
    await client.logout();
  } catch {
    // ignorar
  }
  await client.destroy();
  client = null;
  currentQR = null;
  status = 'disconnected';
}
