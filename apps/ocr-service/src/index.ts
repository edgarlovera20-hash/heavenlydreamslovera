import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { createOcrWorker } from './queues/ocr.worker.js';
import { runOcrPipeline } from './pipeline/ocr-pipeline.js';

const app = express();
app.use(express.json({ limit: '20mb' }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const PORT = process.env.OCR_SERVICE_PORT ?? 4002;

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Direct OCR endpoint (for sync requests)
app.post('/ocr', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await runOcrPipeline(req.file.buffer, req.body.documentType ?? 'GENERIC');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// OCR via URL
app.post('/ocr/url', async (req, res) => {
  try {
    const { url, documentType } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });

    const axios = (await import('axios')).default;
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    const result = await runOcrPipeline(buffer, documentType ?? 'GENERIC');
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start queue worker (async OCR jobs from BullMQ)
createOcrWorker();

app.listen(PORT, () => {
  console.log(`[OCR Service] running on port ${PORT}`);
});
