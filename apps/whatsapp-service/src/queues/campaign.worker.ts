import Bull from 'bull';
import type { SessionManager } from '../sessions/session-manager.js';

export function createCampaignWorker(sessionManager: SessionManager) {
  const queue = new Bull('campaigns', {
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    },
  });

  queue.process(async (job) => {
    const { sessionId, targets, message, delayMs = 1500 } = job.data;

    let sent = 0;
    let failed = 0;

    for (const target of targets) {
      try {
        await sessionManager.sendMessage(sessionId, target, message);
        sent++;
        await new Promise((r) => setTimeout(r, delayMs)); // rate limiting
      } catch {
        failed++;
      }

      await job.progress(Math.round(((sent + failed) / targets.length) * 100));
    }

    return { sent, failed, total: targets.length };
  });

  queue.on('failed', (job, err) => {
    console.error(`[CampaignWorker] job ${job.id} failed:`, err.message);
  });

  console.log('[CampaignWorker] listening on queue: campaigns');
}
