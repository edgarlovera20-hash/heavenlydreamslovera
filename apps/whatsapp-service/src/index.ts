import 'dotenv/config';
import express from 'express';
import { createSessionManager } from './sessions/session-manager.js';
import { createMessageWorker } from './queues/message.worker.js';
import { createCampaignWorker } from './queues/campaign.worker.js';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.WA_SERVICE_PORT ?? 4001;
const API_URL = process.env.API_URL ?? 'http://localhost:3000';

const sessionManager = createSessionManager(API_URL);

// Internal health + webhook endpoints consumed by apps/api
app.get('/health', (_req, res) => res.json({ status: 'ok', sessions: sessionManager.count() }));

app.post('/sessions/:id/start', async (req, res) => {
  const { id } = req.params;
  const { companyId } = req.body;
  try {
    await sessionManager.startSession(id, companyId);
    res.json({ message: 'Session starting' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/sessions/:id/disconnect', async (req, res) => {
  const { id } = req.params;
  try {
    await sessionManager.disconnectSession(id);
    res.json({ message: 'Disconnected' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sessions/:id/status', (req, res) => {
  const status = sessionManager.getStatus(req.params.id);
  res.json({ status });
});

// Start BullMQ workers
createMessageWorker(sessionManager);
createCampaignWorker(sessionManager);

app.listen(PORT, () => {
  console.log(`[WhatsApp Service] running on port ${PORT}`);
});
