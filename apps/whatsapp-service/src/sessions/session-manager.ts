import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { toDataURL } from 'qrcode';
import axios from 'axios';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSIONS_DIR = join(__dirname, '../../sessions');
mkdirSync(SESSIONS_DIR, { recursive: true });

export type SessionStatus = 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'DISCONNECTED';

interface Session {
  socket: WASocket;
  status: SessionStatus;
  companyId: string;
  qr?: string;
}

export function createSessionManager(apiUrl: string) {
  const sessions = new Map<string, Session>();

  async function notifyApi(sessionId: string, event: string, data: Record<string, unknown>) {
    try {
      await axios.post(`${apiUrl}/api/v1/whatsapp/internal/event`, { sessionId, event, data });
    } catch { /* non-blocking */ }
  }

  async function startSession(sessionId: string, companyId: string) {
    if (sessions.has(sessionId)) return;

    const authDir = join(SESSIONS_DIR, sessionId);
    mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      browser: ['Heavenly Dreams', 'Chrome', '1.0'],
    });

    const session: Session = { socket: sock, status: 'CONNECTING', companyId };
    sessions.set(sessionId, session);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        const qrDataUrl = await toDataURL(qr);
        session.status = 'QR_READY';
        session.qr = qrDataUrl;
        await notifyApi(sessionId, 'qr-update', { qr: qrDataUrl, status: 'QR_READY' });
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        session.status = 'DISCONNECTED';
        await notifyApi(sessionId, 'session-status', { status: 'DISCONNECTED' });

        if (reason !== DisconnectReason.loggedOut) {
          // Auto-reconnect after 5s
          setTimeout(() => startSession(sessionId, companyId), 5000);
        } else {
          sessions.delete(sessionId);
        }
      }

      if (connection === 'open') {
        session.status = 'CONNECTED';
        session.qr = undefined;
        await notifyApi(sessionId, 'session-status', {
          status: 'CONNECTED',
          phoneNumber: sock.user?.id?.split(':')[0],
        });
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      for (const msg of messages) {
        if (!msg.key.fromMe) {
          await notifyApi(sessionId, 'new-message', {
            from: msg.key.remoteJid,
            message: msg.message?.conversation ?? msg.message?.extendedTextMessage?.text ?? '',
            messageId: msg.key.id,
            timestamp: msg.messageTimestamp,
          });
        }
      }
    });
  }

  async function sendMessage(sessionId: string, to: string, message: string) {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'CONNECTED') throw new Error('Session not connected');

    const jid = to.includes('@') ? to : `${to.replace(/\D/g, '')}@s.whatsapp.net`;
    await session.socket.sendMessage(jid, { text: message });
  }

  async function disconnectSession(sessionId: string) {
    const session = sessions.get(sessionId);
    if (!session) return;
    await session.socket.logout();
    sessions.delete(sessionId);
  }

  function getStatus(sessionId: string): SessionStatus {
    return sessions.get(sessionId)?.status ?? 'DISCONNECTED';
  }

  function count() {
    return sessions.size;
  }

  return { startSession, sendMessage, disconnectSession, getStatus, count };
}

export type SessionManager = ReturnType<typeof createSessionManager>;
