import { getSecretValue } from './secret-vault';

const OPENAI_TRANSCRIPTION_URL = 'https://api.openai.com/v1/audio/transcriptions';

function transcriptionEnabled() {
  return Boolean(getSecretValue('OPENAI_API_KEY'));
}

function extensionForAudio(mimeType: string) {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg') || mime.includes('opus')) return 'ogg';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('3gpp')) return '3gp';
  if (mime.includes('amr')) return 'amr';
  return 'ogg';
}

export async function transcribeAudioBuffer(input: {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
}) {
  if (!transcriptionEnabled()) {
    return {
      status: 'skipped',
      reason: 'OPENAI_API_KEY no configurada para transcribir audio.',
    };
  }

  const fileName = input.fileName || `audio.${extensionForAudio(input.mimeType)}`;
  const startedAt = Date.now();
  const form = new FormData();
  const model = getSecretValue('OPENAI_AUDIO_TRANSCRIPTION_MODEL', process.env.OPENAI_AUDIO_TRANSCRIPTION_MODEL || 'gpt-4o-mini-transcribe');
  form.set('model', model);
  form.set('language', getSecretValue('OPENAI_AUDIO_TRANSCRIPTION_LANGUAGE', process.env.OPENAI_AUDIO_TRANSCRIPTION_LANGUAGE || 'es'));
  form.set('response_format', 'json');
  form.set('file', new File([input.buffer], fileName, { type: input.mimeType || 'audio/ogg' }));

  const res = await fetch(OPENAI_TRANSCRIPTION_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretValue('OPENAI_API_KEY')}`,
    },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      status: 'failed',
      provider: 'openai',
      model,
      error: data?.error?.message || `OpenAI transcription HTTP ${res.status}`,
      durationMs: Date.now() - startedAt,
    };
  }

  return {
    status: 'completed',
    provider: 'openai',
    model,
    text: String(data?.text || '').trim(),
    durationMs: Date.now() - startedAt,
  };
}
