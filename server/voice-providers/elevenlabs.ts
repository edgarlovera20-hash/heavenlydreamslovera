import { inferProposedResult } from './scripts';
import type { ValidationCallPayload, ValidationSyncResult, VoiceProviderAdapter } from './types';
import { getSecretValue } from '../secret-vault';

const API_BASE = 'https://api.elevenlabs.io/v1';

function env(name: string) {
  return getSecretValue(name);
}

async function elevenFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': env('ELEVENLABS_API_KEY'),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.detail?.message || data?.message || `ElevenLabs ${res.status}`);
  return data;
}

function transcriptText(transcript: any) {
  if (!Array.isArray(transcript)) return '';
  return transcript.map((item: any) => `${item.role || 'unknown'}: ${item.message || ''}`).join('\n');
}

export const elevenLabsProvider: VoiceProviderAdapter = {
  id: 'elevenlabs',
  label: 'ElevenLabs Agents',
  isConfigured() {
    return this.missingConfig().length === 0;
  },
  missingConfig() {
    return ['ELEVENLABS_API_KEY', 'ELEVENLABS_AGENT_ID', 'ELEVENLABS_AGENT_PHONE_NUMBER_ID']
      .filter((name) => !env(name));
  },
  getCapabilities() {
    return {
      naturalConversation: true,
      transcript: true,
      recording: true,
      analysis: true,
      retry: true,
      realtime: true,
    };
  },
  async startValidationCall(payload: ValidationCallPayload) {
    const data = await elevenFetch('/convai/twilio/outbound-call', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: env('ELEVENLABS_AGENT_ID'),
        agent_phone_number_id: env('ELEVENLABS_AGENT_PHONE_NUMBER_ID'),
        to_number: payload.toNumber,
        call_recording_enabled: true,
        conversation_initiation_client_data: {
          dynamic_variables: {
            ...payload.dynamicVariables,
            validation_script: payload.message,
            script_type: payload.scriptType,
          },
        },
      }),
    });
    return {
      provider: 'elevenlabs' as const,
      providerCallId: data.callSid || data.call_sid || data.conversation_id || null,
      callSid: data.callSid || data.call_sid || null,
      conversationId: data.conversation_id || null,
      status: data.success === false ? 'failed' : 'initiated',
      raw: data,
    };
  },
  async syncValidationResult(validationRequest: any): Promise<ValidationSyncResult> {
    const conversationId = validationRequest.conversation_id;
    if (!conversationId) {
      return {
        provider: 'elevenlabs',
        status: validationRequest.call_status || 'unknown',
        proposedResult: null,
        summary: null,
        transcript: null,
      };
    }
    const data = await elevenFetch(`/convai/conversations/${encodeURIComponent(conversationId)}`, { method: 'GET' });
    const text = transcriptText(data.transcript);
    const summary = data.analysis?.transcript_summary || data.analysis?.summary || text.slice(0, 1200) || null;
    return {
      provider: 'elevenlabs',
      status: data.status || 'processing',
      proposedResult: data.status === 'done' ? inferProposedResult(`${summary || ''}\n${text}`) : null,
      summary,
      transcript: data.transcript || null,
      raw: data,
    };
  },
};
