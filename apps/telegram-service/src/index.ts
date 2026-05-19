import 'dotenv/config';
import express from 'express';
import TelegramBot from 'node-telegram-bot-api';
import Bull from 'bull';
import axios from 'axios';

const app = express();
app.use(express.json());

const PORT = process.env.TG_SERVICE_PORT ?? 4004;
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

// Active bots map: sessionId -> bot instance
const bots = new Map<string, TelegramBot>();

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

// BullMQ worker: listen to message-sending queue for telegram channel
const messageQueue = new Bull('message-sending', { redis: redisConfig });
messageQueue.process(async (job) => {
  const { sessionId, chatId, message, channel } = job.data;
  if (channel !== 'telegram') return;

  const bot = bots.get(sessionId);
  if (!bot) throw new Error(`Telegram session ${sessionId} not active`);
  await bot.sendMessage(chatId, message);
});

// Internal API endpoints
app.get('/health', (_req, res) => res.json({ status: 'ok', bots: bots.size }));

app.post('/sessions/:id/start', async (req, res) => {
  const { id } = req.params;
  const { token, companyId } = req.body;

  if (bots.has(id)) return res.json({ message: 'Already running' });

  try {
    const bot = new TelegramBot(token, { polling: true });
    bots.set(id, bot);

    bot.on('message', async (msg) => {
      await axios.post(`${API_URL}/api/v1/flow-engine/message`, {
        conversationId: null,
        channel: 'TELEGRAM',
        externalId: String(msg.chat.id),
        sessionId: id,
        message: msg.text ?? '',
        companyId,
      }).catch(() => {});
    });

    bot.on('polling_error', (err) => console.error(`[TG:${id}]`, err.message));

    res.json({ message: 'Bot started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/stop', (req, res) => {
  const bot = bots.get(req.params.id);
  if (bot) { bot.stopPolling(); bots.delete(req.params.id); }
  res.json({ message: 'Stopped' });
});

app.listen(PORT, () => console.log(`[Telegram Service] running on port ${PORT}`));
