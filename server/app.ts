import express from 'express';
import { requestLogger } from './http';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.set('etag', false);
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
  app.use(express.json({ limit: process.env.API_JSON_LIMIT || '350mb' }));
  app.use(requestLogger);
  return app;
}
