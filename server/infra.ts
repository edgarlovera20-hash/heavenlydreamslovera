let redisClient: any = null;
let queues: Record<string, any> | null = null;

export async function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;
  const { default: IORedis } = await import('ioredis');
  redisClient = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
  return redisClient;
}

export async function getQueues() {
  if (!process.env.REDIS_URL) return null;
  if (queues) return queues;
  const { Queue } = await import('bullmq');
  const connection = await getRedisClient();
  queues = {
    aiProcessing: new Queue('ai-processing', { connection }),
    messages: new Queue('messages', { connection }),
    notifications: new Queue('notifications', { connection }),
    reports: new Queue('reports', { connection }),
    telmexAutomation: new Queue('telmex-automation', { connection }),
  };
  return queues;
}

export async function queueJob(queueName: 'aiProcessing' | 'messages' | 'notifications' | 'reports' | 'telmexAutomation', name: string, payload: any) {
  const activeQueues = await getQueues();
  if (!activeQueues) return null;
  return activeQueues[queueName].add(name, payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  });
}

export async function postgresAvailable() {
  if (!process.env.DATABASE_URL) return false;
  try {
    const pg = await import('pg');
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query('select 1');
    await client.end();
    return true;
  } catch {
    return false;
  }
}

export async function redisAvailable() {
  if (!process.env.REDIS_URL) return false;
  try {
    const client = await getRedisClient();
    if (!client) return false;
    const pong = await client.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

export async function checkInfraConnections() {
  const [postgres, redis] = await Promise.all([
    postgresAvailable(),
    redisAvailable(),
  ]);
  const activeQueues = redis ? await getQueues().catch(() => null) : null;
  return {
    postgres,
    redis,
    bullmq: Boolean(activeQueues),
  };
}

export function infraMode() {
  return {
    database: process.env.DATABASE_URL ? 'postgres' : 'sqlite',
    eventBus: process.env.REDIS_URL ? 'redis' : 'local-events',
    queues: process.env.REDIS_URL ? 'bullmq' : 'sqlite-queue',
  };
}
