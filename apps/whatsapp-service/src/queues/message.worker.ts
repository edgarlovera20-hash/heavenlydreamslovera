import Bull from 'bull';
import type { SessionManager } from '../sessions/session-manager.js';

export function createMessageWorker(sessionManager: SessionManager) {
  const queue = new Bull('message-sending', {
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    },
  });

  queue.process(async (job) => {
    const { sessionId, to, message, channel } = job.data;
    if (channel === 'telegram') return; // handled by telegram-service

    await sessionManager.sendMessage(sessionId, to, message);
    console.log(`[MessageWorker] sent to ${to} via session ${sessionId}`);
  });

  queue.on('failed', (job, err) => {
    console.error(`[MessageWorker] job ${job.id} failed:`, err.message);
  });

  console.log('[MessageWorker] listening on queue: message-sending');
}
