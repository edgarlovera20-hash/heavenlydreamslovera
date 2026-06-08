/**
 * Sentry error monitoring initialisation.
 * Set SENTRY_DSN env var to enable; leave unset to run without Sentry.
 */

import * as Sentry from '@sentry/node';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.info('[Sentry] SENTRY_DSN not set — error monitoring disabled.');
    return;
  }
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV || 'development',
  });
  console.info('[Sentry] Initialised.');
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, context ? { extra: context } : undefined);
  }
}

export { Sentry };
