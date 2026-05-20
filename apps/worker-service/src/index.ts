import 'dotenv/config';
import { createFraudWorker } from './processors/fraud.processor.js';
import { createNotificationWorker } from './processors/notification.processor.js';
import { createAutomationWorker } from './processors/automation.processor.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';

console.log('[WorkerService] Starting all workers...');

createFraudWorker(API_URL);
createNotificationWorker(API_URL);
createAutomationWorker(API_URL);

console.log('[WorkerService] All workers running.');
