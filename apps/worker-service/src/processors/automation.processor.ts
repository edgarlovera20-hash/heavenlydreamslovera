import Bull from 'bull';
import axios from 'axios';

const redisConfig = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD,
};

export function createAutomationWorker(apiUrl: string) {
  const queue = new Bull('automation', { redis: redisConfig });

  queue.process(async (job) => {
    const { flowId, targetId, targetType, steps } = job.data;
    console.log(`[AutomationWorker] Running flow ${flowId} for ${targetType} ${targetId}`);

    for (const step of steps) {
      try {
        switch (step.type) {
          case 'SEND_WHATSAPP':
            await axios.post(`${apiUrl}/api/v1/whatsapp/messages/send`, {
              sessionId: step.sessionId,
              to: step.to,
              message: step.message,
            }, { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? 'internal' } });
            break;

          case 'CREATE_TASK':
            await axios.post(`${apiUrl}/api/v1/tasks`, {
              title: step.title,
              description: step.description,
              assigneeId: step.assigneeId,
              companyId: step.companyId,
            }, { headers: { 'x-internal-key': process.env.INTERNAL_API_KEY ?? 'internal' } });
            break;

          case 'WAIT':
            await new Promise((r) => setTimeout(r, (step.seconds ?? 1) * 1000));
            break;
        }
      } catch (err: any) {
        console.error(`[AutomationWorker] step ${step.type} failed:`, err.message);
      }
    }
  });

  queue.on('failed', (job, err) => console.error(`[AutomationWorker] failed ${job.id}:`, err.message));
  console.log('[AutomationWorker] listening: automation');
}
