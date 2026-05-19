import Bull from 'bull';
import axios from 'axios';

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:4003';

export function createAiWorker(_apiUrl: string) {
  const queue = new Bull('ai-processing', { redis: redisConfig });

  queue.process(async (job) => {
    const { type, data } = job.data;

    switch (type) {
      case 'GENERATE_EMBEDDINGS': {
        // Future: generate embeddings for knowledge base entries
        console.log(`[AIWorker] Generate embeddings for ${data.entryId}`);
        break;
      }
      case 'FRAUD_ANALYSIS': {
        const result = await axios.post(`${AI_SERVICE_URL}/fraud-analysis`, data);
        return result.data;
      }
      case 'OCR_CLEANUP': {
        const result = await axios.post(`${AI_SERVICE_URL}/ocr-cleanup`, data);
        return result.data;
      }
    }
  });

  queue.on('failed', (job, err) => console.error(`[AIWorker] failed ${job.id}:`, err.message));
  console.log('[AIWorker] listening: ai-processing');
}
