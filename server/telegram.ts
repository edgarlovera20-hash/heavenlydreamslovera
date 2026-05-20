export interface TgMessage {
  id: string;
  from: string;
  fromName: string;
  body: string;
  timestamp: number;
  chatId: number;
  isGroup: boolean;
  channel: 'telegram';
}

type Status = 'disconnected' | 'polling' | 'error';

let botToken: string | null = null;
let status: Status = 'disconnected';
let lastError: string | null = null;
let pollingAbort: AbortController | null = null;
let lastUpdateId = 0;

const messageBuffer: TgMessage[] = [];
const MAX_MESSAGES = 200;

// Callback invocado por server.ts para cada mensaje entrante
let onMessageCallback: ((msg: TgMessage) => void) | null = null;

export function setTelegramMessageHandler(fn: (msg: TgMessage) => void) {
  onMessageCallback = fn;
}

export function getTelegramStatus() {
  return { status, error: lastError, botToken: botToken ? '***' : null };
}

export function getTelegramMessages(limit = 100): TgMessage[] {
  return messageBuffer.slice(-limit);
}

async function tgApi(token: string, method: string, body?: Record<string, unknown>) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<any>;
}

function extractName(from: any): string {
  if (!from) return 'Desconocido';
  const parts = [from.first_name, from.last_name].filter(Boolean);
  return parts.length ? parts.join(' ') : from.username || String(from.id);
}

async function pollLoop(token: string, abort: AbortController) {
  while (!abort.signal.aborted) {
    try {
      const data = await tgApi(token, 'getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 25,
        allowed_updates: ['message'],
      });

      if (!data.ok) {
        lastError = data.description || 'Error de API';
        status = 'error';
        await sleep(5000);
        continue;
      }

      for (const update of data.result ?? []) {
        lastUpdateId = update.update_id;
        const msg = update.message;
        if (!msg?.text) continue;

        const entry: TgMessage = {
          id: String(update.update_id),
          from: String(msg.from?.id ?? msg.chat.id),
          fromName: extractName(msg.from),
          body: msg.text,
          timestamp: msg.date * 1000,
          chatId: msg.chat.id,
          isGroup: msg.chat.type !== 'private',
          channel: 'telegram',
        };

        messageBuffer.push(entry);
        if (messageBuffer.length > MAX_MESSAGES) messageBuffer.shift();

        if (onMessageCallback) onMessageCallback(entry);
      }
    } catch (err: any) {
      if (abort.signal.aborted) break;
      lastError = err.message;
      await sleep(5000);
    }
  }
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

export async function initTelegram(token: string): Promise<{ ok: boolean; botName?: string; error?: string }> {
  if (!token) return { ok: false, error: 'Token vacío' };

  // Verificar token
  const me = await tgApi(token, 'getMe').catch(() => null);
  if (!me?.ok) return { ok: false, error: me?.description || 'Token inválido' };

  // Detener polling anterior si existe
  stopTelegram();

  botToken = token;
  status = 'polling';
  lastError = null;
  lastUpdateId = 0;

  pollingAbort = new AbortController();
  pollLoop(token, pollingAbort).catch(err => {
    lastError = err.message;
    status = 'error';
  });

  console.log(`[TG] ✅ Conectado como @${me.result.username}`);
  return { ok: true, botName: me.result.username };
}

export function stopTelegram() {
  pollingAbort?.abort();
  pollingAbort = null;
  botToken = null;
  status = 'disconnected';
  lastError = null;
}

export async function sendTelegramMessage(chatId: number | string, text: string) {
  if (!botToken || status !== 'polling') throw new Error('Telegram no está conectado');
  const r = await tgApi(botToken, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
  if (!r.ok) throw new Error(r.description || 'Error enviando mensaje');
  return { ok: true, messageId: r.result?.message_id };
}
