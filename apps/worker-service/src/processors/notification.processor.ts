import Bull from 'bull';
import axios from 'axios';

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

export function createNotificationWorker(apiUrl: string) {
  const queue = new Bull('notifications', { redis: redisConfig });

  queue.process(async (job) => {
    const { userId, companyId, title, message, type } = job.data;

    await axios.post(`${apiUrl}/api/v1/notifications/send`, {
      userId, companyId, title, message, type,
    }, {
      headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? 'internal' },
    });
  });

  queue.on('failed', (job, err) => console.error(`[NotificationWorker] failed ${job.id}:`, err.message));
  console.log('[NotificationWorker] listening: notifications');
}
