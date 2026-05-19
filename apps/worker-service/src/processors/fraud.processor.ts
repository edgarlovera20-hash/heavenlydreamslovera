import Bull from 'bull';
import axios from 'axios';

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

export function createFraudWorker(apiUrl: string) {
  const queue = new Bull('fraud-analysis', { redis: redisConfig });

  queue.process(async (job) => {
    const { saleId, companyId } = job.data;
    console.log(`[FraudWorker] Analyzing sale ${saleId}`);

    await axios.post(`${apiUrl}/api/v1/fraud/analyze/${saleId}`, {}, {
      headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? 'internal' },
    });
  });

  queue.on('failed', (job, err) => console.error(`[FraudWorker] failed ${job.id}:`, err.message));
  console.log('[FraudWorker] listening: fraud-analysis');
}
