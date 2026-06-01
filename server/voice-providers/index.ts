import { randomUUID } from 'crypto';
import { elevenLabsProvider } from './elevenlabs';
import { openAIRealtimeProvider } from './openai-realtime';
import { getSecretValue } from '../secret-vault';
import { buildDynamicVariables, buildValidationMessage, detectScriptType } from './scripts';
import { twilioBasicProvider } from './twilio-basic';
import type {
  ValidationCallPayload,
  ValidationCallStartResult,
  VoiceProviderAdapter,
  VoiceProviderId,
  VoiceProviderStatus,
} from './types';

export { attachOpenAIRealtimeStream, buildOpenAIRealtimeTwiML } from './openai-realtime';
export type { VoiceProviderId } from './types';

const providers: Record<VoiceProviderId, VoiceProviderAdapter> = {
  elevenlabs: elevenLabsProvider,
  'openai-realtime': openAIRealtimeProvider,
  'twilio-basic': twilioBasicProvider,
};

export function listVoiceProviderStatus(): VoiceProviderStatus[] {
  return Object.values(providers).map((provider) => ({
    id: provider.id,
    label: provider.label,
    configured: provider.isConfigured(),
    capabilities: provider.getCapabilities(),
    missing: provider.missingConfig(),
  }));
}

export function getDefaultVoiceProvider(): VoiceProviderId {
  const configured = String(getSecretValue('VOICE_PROVIDER_DEFAULT', process.env.VOICE_PROVIDER_DEFAULT || 'elevenlabs')) as VoiceProviderId;
  return providers[configured] ? configured : 'elevenlabs';
}

export function getVoiceFallbacks(): VoiceProviderId[] {
  return String(getSecretValue('VOICE_PROVIDER_FALLBACKS', process.env.VOICE_PROVIDER_FALLBACKS || 'twilio-basic'))
    .split(',')
    .map((item) => item.trim() as VoiceProviderId)
    .filter((item) => Boolean(providers[item]));
}

export function getVoiceProvider(id?: string | null) {
  const providerId = (id || getDefaultVoiceProvider()) as VoiceProviderId;
  return providers[providerId] || providers[getDefaultVoiceProvider()];
}

export function buildValidationCallPayload(validation: any, sale: any): ValidationCallPayload {
  const saleSnapshot = {
    ...(sale || {}),
    metadata: parseMetadata(sale?.metadata),
    validation_id: validation.id,
  };
  const dynamicVariables = buildDynamicVariables(saleSnapshot);
  const scriptType = (validation.script_type || detectScriptType(saleSnapshot)) as any;
  const toNumber = normalizeE164(validation.client_phone || sale?.telefono || dynamicVariables.phone);
  return {
    validationId: validation.id,
    saleId: validation.sale_id || sale?.id || null,
    toNumber,
    scriptType,
    dynamicVariables,
    saleSnapshot,
    message: buildValidationMessage(scriptType, dynamicVariables),
  };
}

export async function startValidationCallWithProvider(validation: any, sale: any, providerId?: string | null, fallbackIds: VoiceProviderId[] = []) {
  const ordered = providerId
    ? [providerId as VoiceProviderId, ...fallbackIds].filter((value, index, list) => list.indexOf(value) === index)
    : [getDefaultVoiceProvider(), ...getVoiceFallbacks()].filter((value, index, list) => list.indexOf(value) === index);
  const payload = buildValidationCallPayload(validation, sale);
  const errors: string[] = [];

  for (const id of ordered) {
    const provider = getVoiceProvider(id);
    if (!provider.isConfigured()) {
      errors.push(`${provider.label}: faltan ${provider.missingConfig().join(', ')}`);
      continue;
    }
    try {
      return { result: await provider.startValidationCall(payload), payload };
    } catch (err: any) {
      errors.push(`${provider.label}: ${err?.message || String(err)}`);
    }
  }

  throw new Error(errors.join(' | ') || 'No hay proveedor de voz disponible');
}

export async function syncValidationWithProvider(validation: any) {
  const provider = getVoiceProvider(validation.provider);
  return provider.syncValidationResult(validation);
}

export function normalizeProviderStartResult(result: ValidationCallStartResult, attempts: number, payload: ValidationCallPayload) {
  return {
    provider: result.provider,
    provider_call_id: result.providerCallId || result.callSid || result.conversationId || randomUUID(),
    conversation_id: result.conversationId || null,
    call_sid: result.callSid || null,
    call_status: result.status || 'initiated',
    status: 'EN_LLAMADA',
    attempts,
    script_type: payload.scriptType,
    provider_payload_json: JSON.stringify({ request: payload, response: result.raw || null }),
    sale_snapshot_json: JSON.stringify(payload.saleSnapshot || {}),
    last_error: null,
  };
}

function parseMetadata(value: any) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function normalizeE164(value: any) {
  const raw = String(value || '').trim();
  if (raw.startsWith('+')) return raw;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+52${digits}`;
  if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}
