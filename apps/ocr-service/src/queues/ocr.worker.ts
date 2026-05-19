import Bull from 'bull';
import axios from 'axios';
import { runOcrPipeline } from '../pipeline/ocr-pipeline.js';

export function createOcrWorker() {
  const queue = new Bull('ocr-processing', {
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD,
    },
  });

  queue.process(async (job) => {
    const { documentUrl, documentType, saleId, companyId } = job.data;
    console.log(`[OCRWorker] processing ${documentType} for sale ${saleId}`);

    const response = await axios.get(documentUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);

    const result = await runOcrPipeline(buffer, documentType);

    // Report result back to API
    const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
    await axios.post(`${apiUrl}/api/v1/ocr/result`, {
      saleId,
      companyId,
      ocrData: result.structured,
      confidence: result.confidence,
      fraudRisk: result.fraudRisk,
      provider: result.provider,
    });

    return result;
  });

  queue.on('failed', (job, err) => {
    console.error(`[OCRWorker] job ${job.id} failed:`, err.message);
  });

  console.log('[OCRWorker] listening on queue: ocr-processing');
}
