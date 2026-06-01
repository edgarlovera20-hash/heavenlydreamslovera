import type { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { createTwilioCall, getTwilioWebhookToken, twilioConfigured } from '../twilio';
import { getSecretValue } from '../secret-vault';
import type { ValidationCallPayload, ValidationSyncResult, VoiceProviderAdapter } from './types';

const STREAM_PATH = '/api/voice-providers/openai-realtime/stream';

function env(name: string) {
  return getSecretValue(name);
}

function publicBaseUrl() {
  return (getSecretValue('TWILIO_WEBHOOK_BASE_URL') || process.env.APP_URL || '').replace(/\/$/, '');
}

function websocketUrlFor(validationId: string, message: string) {
  const base = publicBaseUrl();
  if (!base) throw new Error('TWILIO_WEBHOOK_BASE_URL o APP_URL requerido para OpenAI Realtime');
  const wsBase = base.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
  const url = new URL(`${wsBase}${STREAM_PATH}`);
  url.searchParams.set('validationId', validationId);
  url.searchParams.set('message', message.slice(0, 1400));
  const token = getTwilioWebhookToken();
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

export function buildOpenAIRealtimeTwiML(validationId: string, message: string) {
  const wsUrl = websocketUrlFor(validationId, message);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl.replace(/&/g, '&amp;')}">
      <Parameter name="validationId" value="${String(validationId).replace(/"/g, '')}" />
    </Stream>
  </Connect>
</Response>`;
}

export function attachOpenAIRealtimeStream(server: Server) {
  const wss = new WebSocketServer({ server, path: STREAM_PATH });
  wss.on('connection', (twilioWs, req) => {
    const requestUrl = new URL(req.url || STREAM_PATH, `http://${req.headers.host || 'localhost'}`);
    const expectedToken = getTwilioWebhookToken();
    const providedToken = requestUrl.searchParams.get('token') || '';
    if ((expectedToken && providedToken !== expectedToken) || (process.env.NODE_ENV === 'production' && !expectedToken)) {
      twilioWs.close(1008, 'Unauthorized');
      return;
    }
    const instructions = requestUrl.searchParams.get('message') || 'Realiza la validacion del cliente de acuerdo al script capturado.';
    const openai = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(env('OPENAI_REALTIME_MODEL') || 'gpt-realtime')}`, {
      headers: { Authorization: `Bearer ${env('OPENAI_API_KEY')}` },
    });
    let streamSid = '';

    const closeBoth = () => {
      try { if (openai.readyState === WebSocket.OPEN) openai.close(); } catch {}
      try { if (twilioWs.readyState === WebSocket.OPEN) twilioWs.close(); } catch {}
    };

    openai.on('open', () => {
      openai.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions,
          voice: env('OPENAI_REALTIME_VOICE') || 'coral',
          audio: {
            input: { format: { type: 'audio/pcmu' }, turn_detection: { type: 'server_vad' } },
            output: { format: { type: 'audio/pcmu' } },
          },
        },
      }));
      openai.send(JSON.stringify({ type: 'response.create' }));
    });

    twilioWs.on('message', (chunk) => {
      const msg = JSON.parse(chunk.toString());
      if (msg.event === 'start') streamSid = msg.start?.streamSid || '';
      if (msg.event === 'media' && openai.readyState === WebSocket.OPEN) {
        openai.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: msg.media.payload }));
      }
      if (msg.event === 'stop') closeBoth();
    });

    openai.on('message', (chunk) => {
      const event = JSON.parse(chunk.toString());
      const audio = event.delta || event.audio || event.output_audio;
      if ((event.type === 'response.audio.delta' || event.type === 'response.output_audio.delta') && audio && streamSid && twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audio } }));
      }
    });

    twilioWs.on('close', closeBoth);
    twilioWs.on('error', closeBoth);
    openai.on('close', closeBoth);
    openai.on('error', closeBoth);
  });
}

export const openAIRealtimeProvider: VoiceProviderAdapter = {
  id: 'openai-realtime',
  label: 'OpenAI Realtime',
  isConfigured() {
    return this.missingConfig().length === 0;
  },
  missingConfig() {
    const missing = ['OPENAI_API_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']
      .filter((name) => !getSecretValue(name));
    if (!publicBaseUrl()) missing.push('TWILIO_WEBHOOK_BASE_URL');
    return missing;
  },
  getCapabilities() {
    return {
      naturalConversation: true,
      transcript: true,
      recording: false,
      analysis: true,
      retry: true,
      realtime: true,
    };
  },
  async startValidationCall(payload: ValidationCallPayload) {
    if (!twilioConfigured()) throw new Error('Twilio no configurado');
    const data = await createTwilioCall(payload.toNumber, payload.message, {
      url: `${publicBaseUrl()}/api/voice-providers/openai-realtime/twiml?validationId=${encodeURIComponent(payload.validationId)}&message=${encodeURIComponent(payload.message)}`,
    });
    return {
      provider: 'openai-realtime' as const,
      providerCallId: data.sid || null,
      callSid: data.sid || null,
      conversationId: payload.validationId,
      status: data.status || 'queued',
      raw: data,
    };
  },
  async syncValidationResult(validationRequest: any): Promise<ValidationSyncResult> {
    return {
      provider: 'openai-realtime',
      status: validationRequest.call_status || 'in-progress',
      proposedResult: null,
      summary: 'OpenAI Realtime procesa la conversacion en vivo. La propuesta automatica requiere transcript persistido en una version posterior.',
      transcript: validationRequest.transcript_json ? JSON.parse(validationRequest.transcript_json) : null,
    };
  },
};
