import express from 'express';
import { requestLogger } from './http';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '20mb' }));
  app.use(requestLogger);
  return app;
}
