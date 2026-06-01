import { createTwilioCall, twilioConfigured } from '../twilio';
import { getSecretValue } from '../secret-vault';
import type { ValidationCallPayload, ValidationSyncResult, VoiceProviderAdapter } from './types';

export const twilioBasicProvider: VoiceProviderAdapter = {
  id: 'twilio-basic',
  label: 'Twilio Basic',
  isConfigured() {
    return twilioConfigured();
  },
  missingConfig() {
    return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']
      .filter((name) => !getSecretValue(name));
  },
  getCapabilities() {
    return {
      naturalConversation: false,
      transcript: false,
      recording: false,
      analysis: false,
      retry: true,
      realtime: false,
    };
  },
  async startValidationCall(payload: ValidationCallPayload) {
    const data = await createTwilioCall(payload.toNumber, payload.message);
    return {
      provider: 'twilio-basic' as const,
      providerCallId: data.sid || null,
      callSid: data.sid || null,
      conversationId: null,
      status: data.status || 'queued',
      raw: data,
    };
  },
  async syncValidationResult(validationRequest: any): Promise<ValidationSyncResult> {
    return {
      provider: 'twilio-basic',
      status: validationRequest.call_status || 'queued',
      proposedResult: null,
      summary: 'Twilio Basic solo reproduce el script por voz. Requiere revision humana.',
      transcript: null,
    };
  },
};
