export type VoiceProviderId = 'elevenlabs' | 'openai-realtime' | 'twilio-basic';

export type ValidationScriptType = 'portabilidad' | 'linea_nueva';

export type ProposedValidationResult = 'validada' | 'rechazada' | 'requiere_revision' | null;

export interface VoiceProviderCapabilities {
  naturalConversation: boolean;
  transcript: boolean;
  recording: boolean;
  analysis: boolean;
  retry: boolean;
  realtime: boolean;
}

export interface ValidationCallPayload {
  validationId: string;
  saleId?: string | null;
  toNumber: string;
  scriptType: ValidationScriptType;
  message: string;
  dynamicVariables: Record<string, string | number | boolean | null>;
  saleSnapshot: Record<string, any>;
}

export interface ValidationCallStartResult {
  provider: VoiceProviderId;
  providerCallId?: string | null;
  callSid?: string | null;
  conversationId?: string | null;
  status: string;
  raw?: any;
}

export interface ValidationSyncResult {
  provider: VoiceProviderId;
  status: string;
  proposedResult: ProposedValidationResult;
  summary?: string | null;
  transcript?: any;
  raw?: any;
}

export interface VoiceProviderStatus {
  id: VoiceProviderId;
  label: string;
  configured: boolean;
  capabilities: VoiceProviderCapabilities;
  missing: string[];
}

export interface VoiceProviderAdapter {
  id: VoiceProviderId;
  label: string;
  isConfigured(): boolean;
  missingConfig(): string[];
  getCapabilities(): VoiceProviderCapabilities;
  startValidationCall(payload: ValidationCallPayload): Promise<ValidationCallStartResult>;
  syncValidationResult(validationRequest: any): Promise<ValidationSyncResult>;
}
