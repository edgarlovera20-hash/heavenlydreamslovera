import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import pino from 'pino';

export const logger = pino({
  name: 'heavenly-dreams-api',
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'body.password',
      'body.token',
      'body.refreshToken',
      'body.contentBase64',
    ],
    remove: true,
  },
});

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createHttpError(status: number, message: string, code?: string, details?: unknown) {
  return new HttpError(status, message, code, details);
}

export function wrap(fn: (req: Request, res: Response, next?: NextFunction) => unknown | Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err: any) {
      const status = Number(err?.status || err?.statusCode || 500);
      const code = err?.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
      const requestId = (req as any).requestId;
      if (status >= 500) {
        logger.error({ err, requestId, path: req.path, method: req.method, auth: (req as any).auth?.sub }, 'API request failed');
      } else {
        logger.warn({ err, requestId, path: req.path, method: req.method }, 'API request rejected');
      }
      res.status(status).json({
        error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : (err?.message || 'Error interno del servidor'),
        code,
        requestId,
        ...(err?.details ? { details: err.details } : {}),
      });
    }
  };
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const path = req.originalUrl || req.url;
  if (
    req.method === 'GET' &&
    (path.startsWith('/assets/') ||
      path.startsWith('/favicon') ||
      path.startsWith('/manifest') ||
      path.endsWith('.png') ||
      path.endsWith('.webp') ||
      path.endsWith('.ico') ||
      path.endsWith('.map'))
  ) {
    next();
    return;
  }

  const start = Date.now();
  const requestId = String(req.headers['x-request-id'] || randomUUID());
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]({
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
      durationMs,
      userId: (req as any).auth?.sub || null,
    }, 'HTTP request completed');
  });
  next();
}

export function parseLimit(value: unknown, fallback = 200, max = 1000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function parseOffset(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

export function queryString(value: unknown) {
  return String(value || '').trim();
}

export function hasPagingQuery(query: Record<string, unknown>) {
  return Object.prototype.hasOwnProperty.call(query, 'limit')
    || Object.prototype.hasOwnProperty.call(query, 'offset')
    || Object.prototype.hasOwnProperty.call(query, 'updatedSince')
    || Object.prototype.hasOwnProperty.call(query, 'q');
}
