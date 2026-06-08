/**
 * Shared ioredis client.
 * Connects to REDIS_URL (default redis://localhost:6379).
 * Gracefully handles connection errors — the app continues without Redis.
 */

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const MAX_RETRIES = 10;

let _connected = false;

export const redisClient = new Redis(REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times >= MAX_RETRIES) {
      console.error(`[Redis] Max reconnect attempts (${MAX_RETRIES}) reached. Giving up.`);
      return null; // stop retrying
    }
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
});

redisClient.on('connect', () => {
  _connected = true;
  console.info('[Redis] Connected');
});

redisClient.on('ready', () => {
  _connected = true;
});

redisClient.on('error', (err) => {
  _connected = false;
  console.error('[Redis] Error:', err.message);
});

redisClient.on('close', () => {
  _connected = false;
});

// Initiate connection (non-blocking — errors are handled above)
redisClient.connect().catch(() => {
  _connected = false;
});

export function isRedisConnected(): boolean {
  return _connected && redisClient.status === 'ready';
}
