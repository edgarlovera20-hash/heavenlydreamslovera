import express from 'express';
import compression from 'compression';
import { requestLogger } from './http';

function contentSecurityPolicy() {
  const isProd = process.env.NODE_ENV === 'production';
  const scriptSrc = isProd
    ? "script-src 'self' https://accounts.google.com https://apis.google.com"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com";
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss: ws:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "frame-src 'self' https://accounts.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.set('etag', false);
  app.disable('x-powered-by');
  app.use(compression({
    level: 6,
    threshold: 512,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.set('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self), payment=()');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.set('Content-Security-Policy', contentSecurityPolicy());
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
  });
  const defaultJsonLimit = process.env.API_JSON_LIMIT || '5mb';
  const largeJsonLimit = process.env.API_LARGE_JSON_LIMIT || '35mb';
  app.use(
    [
      '/api/ocr',
      '/api/document-files',
      '/api/email-sync',
      '/api/import',
      '/api/siac/import-file',
      '/api/morosidad/import-file',
    ],
    express.json({ limit: largeJsonLimit }),
  );
  app.use(express.json({ limit: defaultJsonLimit }));
  app.use(requestLogger);
  return app;
}
