/**
 * Server-side OpenAI Realtime session creation (ephemeral client credentials).
 * @see https://platform.openai.com/docs/api-reference/realtime-sessions
 */

const REALTIME_SESSIONS_URL = 'https://api.openai.com/v1/realtime/sessions';

/** Pinned default; keep in sync with WebSocket `model` query when using ephemeral tokens. */
export const OPENAI_REALTIME_DEFAULT_MODEL = 'gpt-realtime';

export function resolveOpenAIRealtimeModel(explicit?: string): string {
  return explicit?.trim() || process.env.OPENAI_REALTIME_MODEL?.trim() || OPENAI_REALTIME_DEFAULT_MODEL;
}

/** Input audio transcription model for Realtime `session` / `session.update`. */
export function resolveOpenAIRealtimeInputTranscriptionModel(): string {
  const fromEnv = process.env.OPENAI_REALTIME_INPUT_TRANSCRIPTION_MODEL?.trim();
  return fromEnv || 'gpt-4o-mini-transcribe';
}

export type CreateRealtimeVoiceSessionParams = {
  instructions: string;
  /** e.g. gpt-realtime */
  model?: string;
  voice?: string;
  modalities?: ('text' | 'audio')[];
};

export type OpenAIRealtimeClientSecret = {
  value?: string;
  expires_at?: number;
};

export type OpenAIRealtimeSessionPayload = {
  id?: string;
  object?: string;
  model?: string;
  client_secret?: OpenAIRealtimeClientSecret;
  [key: string]: unknown;
};

export function getOpenAIApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  return key.trim();
}

export async function createOpenAIRealtimeVoiceSession(
  params: CreateRealtimeVoiceSessionParams
): Promise<OpenAIRealtimeSessionPayload> {
  const model = resolveOpenAIRealtimeModel(params.model);
  const voice =
    params.voice?.trim() || process.env.OPENAI_REALTIME_VOICE?.trim() || 'alloy';
  const modalities = params.modalities ?? (['text', 'audio'] as const);

  const res = await fetch(REALTIME_SESSIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      modalities,
      instructions: params.instructions,
      /** Twilio Media Streams: raw μ-law 8 kHz mono (base64), matches `audio/x-mulaw` payloads. */
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      input_audio_transcription: {
        model: resolveOpenAIRealtimeInputTranscriptionModel(),
      },
    }),
  });

  const rawText = await res.text();
  let body: unknown;
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    throw new Error(`OpenAI Realtime session response was not JSON (${res.status}): ${rawText.slice(0, 200)}`);
  }

  if (!res.ok) {
    const err = body as { error?: { message?: string; type?: string } };
    const msg = err?.error?.message || `HTTP ${res.status}`;
    throw new Error(`OpenAI Realtime session failed: ${msg}`);
  }

  return body as OpenAIRealtimeSessionPayload;
}
