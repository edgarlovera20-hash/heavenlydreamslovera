import { randomUUID } from 'crypto';
import db, { AiJobs, AuditLog, AutomationRules, Metrics } from './db';
import { infraMode, queueJob } from './infra';
import { getReadinessGates } from './readiness';

type ProviderName = 'claude' | 'gemini' | 'openai';

const PROVIDERS: Array<{ name: ProviderName; configured: () => boolean; run: (prompt: string) => Promise<string> }> = [
  { name: 'claude', configured: () => !!process.env.ANTHROPIC_API_KEY, run: callClaude },
  { name: 'gemini', configured: () => !!process.env.GEMINI_API_KEY, run: callGemini },
  { name: 'openai', configured: () => !!process.env.OPENAI_API_KEY, run: callOpenAi },
];

async function callClaude(prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest',
      max_tokens: 800,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json() as any;
  return data?.content?.[0]?.text || '';
}

async function callGemini(prompt: string) {
  const key = process.env.GEMINI_API_KEY || '';
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json() as any;
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAi(prompt: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY || ''}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content || '';
}

export async function runAiWithFallback(prompt: string) {
  const errors: string[] = [];
  for (const provider of PROVIDERS) {
    if (!provider.configured()) {
      errors.push(`${provider.name}: no configurado`);
      continue;
    }
    try {
      const output = await provider.run(prompt);
      if (!output.trim()) throw new Error('respuesta vacía');
      return { provider: provider.name, output, errors };
    } catch (err: any) {
      errors.push(`${provider.name}: ${err.message}`);
    }
  }
  throw new Error(errors.join(' | ') || 'Sin proveedores IA configurados');
}

export async function classifyMorosityReply(text: string) {
  const prompt = `Clasifica esta respuesta de cliente moroso para Heavenly Dreams CRM.
Devuelve solo JSON con: categoria ("promesa_pago", "queja", "pago_realizado", "no_reconoce", "sin_respuesta", "otro"), prioridad ("baja","media","alta"), resumen, respuesta_sugerida.
Respuesta: ${text}`;
  const result = await runAiWithFallback(prompt);
  return { ...result, parsed: safeJson(result.output) };
}

function safeJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export function enqueueAiJob(type: string, payload: any, priority = 5) {
  const job = {
    id: randomUUID(),
    type,
    payload: JSON.stringify(payload || {}),
    status: 'queued',
    priority,
    attempts: 0,
    result: null,
    error: null,
  };
  AiJobs.create(job);
  recordMetric('ai.job.queued', 1, { type });
  queueJob('aiProcessing', type, { id: job.id, type, payload }).catch(() => {});
  return { ...job, payload };
}

export async function processNextAiJob() {
  const job = AiJobs.next() as any;
  if (!job) return null;
  AiJobs.update(job.id, { status: 'processing', attempts: (job.attempts || 0) + 1, error: null });
  try {
    const payload = JSON.parse(job.payload || '{}');
    const output = job.type === 'morosity.classify'
      ? await classifyMorosityReply(payload.text || '')
      : await runAiWithFallback(payload.prompt || JSON.stringify(payload));
    AiJobs.update(job.id, { status: 'done', result: JSON.stringify(output), error: null });
    recordMetric('ai.job.done', 1, { type: job.type });
    return { id: job.id, status: 'done', output };
  } catch (err: any) {
    AiJobs.update(job.id, { status: 'failed', error: err.message || String(err) });
    recordMetric('ai.job.failed', 1, { type: job.type });
    return { id: job.id, status: 'failed', error: err.message };
  }
}

export function recordEvent(event: string, payload: any = {}, actor: any = null) {
  const id = randomUUID();
  (db as any).prepare(`
    INSERT INTO system_events (id,event,payload,actor_id,created_at)
    VALUES (?,?,?,?,datetime('now'))
  `).run(id, event, JSON.stringify(payload), actor?.uid || actor?.sub || null);
  recordMetric(`event.${event}`, 1, {});
  queueJob('messages', event, { id, event, payload, actor }).catch(() => {});
  fireAutomationRules(event, payload, actor);
  return { id, event, payload };
}

export function recordMetric(name: string, value: number, tags: any = {}) {
  Metrics.insert({ id: randomUUID(), name, value, tags: JSON.stringify(tags || {}) });
}

export function fireAutomationRules(event: string, payload: any, actor: any) {
  const rules = AutomationRules.getEnabledByEvent(event) as any[];
  for (const rule of rules) {
    const actions = JSON.parse(rule.actions || '[]');
    AuditLog.insert({
      accion: 'AUTOMATION_TRIGGERED',
      entidad: 'automation_rules',
      entidad_id: rule.id,
      user_id: actor?.uid || actor?.sub || null,
      user_nombre: actor?.nombre || actor?.name || null,
      detalle: JSON.stringify({ event, actions, payload }).slice(0, 900),
    });
    recordMetric('automation.triggered', 1, { rule: rule.name, event });
  }
}

export function enterpriseHealth() {
  const ai = Object.fromEntries(PROVIDERS.map(p => [p.name, { configured: p.configured() }]));
  const infra = infraMode();
  const readiness = getReadinessGates();
  return {
    mode: process.env.NODE_ENV || 'development',
    database: infra.database,
    eventBus: infra.eventBus,
    queues: infra.queues,
    ai,
    readiness: {
      ok: readiness.filter(g => g.status === 'ok').length,
      warning: readiness.filter(g => g.status === 'warning').length,
      critical: readiness.filter(g => g.status === 'critical').length,
      total: readiness.length,
    },
  };
}
