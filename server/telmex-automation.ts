import { randomUUID } from 'crypto';
import { TelmexAutomationJobs } from './db';
import { queueJob } from './infra';
import { recordEvent, recordMetric } from './enterprise';

export type TelmexAutomationAction = 'login' | 'coverage' | 'create-order' | 'send-otp' | 'confirm-otp';

const allowedActions = new Set<TelmexAutomationAction>([
  'login',
  'coverage',
  'create-order',
  'send-otp',
  'confirm-otp',
]);

const stepByAction: Record<TelmexAutomationAction, string> = {
  login: 'Login en portal',
  coverage: 'Validacion de cobertura',
  'create-order': 'Contratacion automatica',
  'send-otp': 'Envio de OTP',
  'confirm-otp': 'Confirmacion de OTP',
};

function parseJsonField(value: any, fallback: any) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

export function normalizeTelmexJob(row: any) {
  if (!row) return null;
  return {
    ...row,
    payload: parseJsonField(row.payload, {}),
    result: parseJsonField(row.result, null),
    evidence: parseJsonField(row.evidence, []),
  };
}

export function listTelmexJobs(limit = 200) {
  return (TelmexAutomationJobs.getAll(limit) as any[]).map(normalizeTelmexJob);
}

export function getTelmexJob(id: string) {
  return normalizeTelmexJob(TelmexAutomationJobs.getById(id));
}

export async function createTelmexAutomationJob(action: string, payload: any = {}, actor: any = null) {
  if (!allowedActions.has(action as TelmexAutomationAction)) {
    throw new Error('accion Telmex no soportada');
  }

  const typedAction = action as TelmexAutomationAction;
  const id = randomUUID();
  const job = {
    id,
    action: typedAction,
    status: 'queued',
    current_step: stepByAction[typedAction],
    progress: 5,
    sale_id: payload.saleId || payload.sale_id || null,
    captura_id: payload.capturaId || payload.captura_id || null,
    user_id: actor?.uid || actor?.sub || payload.userId || null,
    folio: payload.folio || null,
    payload: JSON.stringify(payload || {}),
    result: null,
    error: null,
    evidence: JSON.stringify([]),
    attempts: 0,
  };

  TelmexAutomationJobs.create(job);
  recordMetric('telmex.automation.queued', 1, { action: typedAction });
  recordEvent('telmex.automation.queued', { id, action: typedAction, saleId: job.sale_id, folio: job.folio }, actor);

  const queued = await queueJob('telmexAutomation', typedAction, { id, action: typedAction, payload }).catch(() => null);
  if (!queued) {
    TelmexAutomationJobs.update(id, {
      current_step: 'Pendiente de worker Telmex local o Redis/BullMQ',
      result: JSON.stringify({
        queuedLocally: true,
        requiresWorker: true,
        message: 'Trabajo guardado. Configura REDIS_URL y levanta el worker Playwright para procesarlo.',
      }),
    });
  }

  return getTelmexJob(id);
}

export function updateTelmexAutomationJob(id: string, patch: any, actor: any = null) {
  const existing = TelmexAutomationJobs.getById(id) as any;
  if (!existing) return null;

  const update: Record<string, any> = {};
  for (const key of ['status', 'current_step', 'progress', 'sale_id', 'captura_id', 'user_id', 'folio', 'attempts']) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) update[key] = patch[key];
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'payload')) update.payload = JSON.stringify(patch.payload || {});
  if (Object.prototype.hasOwnProperty.call(patch, 'result')) update.result = JSON.stringify(patch.result || null);
  if (Object.prototype.hasOwnProperty.call(patch, 'evidence')) update.evidence = JSON.stringify(patch.evidence || []);
  if (Object.prototype.hasOwnProperty.call(patch, 'error')) update.error = patch.error || null;

  TelmexAutomationJobs.update(id, update);
  recordEvent('telmex.automation.updated', { id, status: update.status, step: update.current_step }, actor);
  return getTelmexJob(id);
}
