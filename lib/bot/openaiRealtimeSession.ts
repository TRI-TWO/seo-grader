/**
 * Server-side OpenAI Realtime session creation (ephemeral client credentials).
 * @see https://platform.openai.com/docs/api-reference/realtime-sessions
 *
 * Ops note — two tracks: (A) conversation / turn-taking (bridge, speech gate, etc.);
 * (B) session HTTP init reliability (this module). Upstream 5xx/HTML responses here block
 * all voice tests until retries/logging stabilize the init path.
 */

const DEFAULT_REALTIME_SESSIONS_URL = 'https://api.openai.com/v1/realtime/sessions';

/** Pinned default; keep in sync with WebSocket `model` query when using ephemeral tokens. */
export const OPENAI_REALTIME_DEFAULT_MODEL = 'gpt-realtime';

const SESSION_BODY_PREVIEW_CHARS = 1000;
const SESSION_CREATE_FETCH_TIMEOUT_MS = 45_000;
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [400, 1000] as const;

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
  /** Merged into structured logs (no secrets). */
  logContext?: Record<string, unknown>;
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

/** Resolved POST target (no auth). Override with OPENAI_REALTIME_SESSIONS_URL for proxies. */
export function resolveRealtimeSessionsPostUrl(): string {
  const raw = process.env.OPENAI_REALTIME_SESSIONS_URL?.trim();
  return raw || DEFAULT_REALTIME_SESSIONS_URL;
}

/** Safe diagnostics: origin, path, full URL without query (no secrets). */
export function getRealtimeSessionCreateUrlDiagnostics(): {
  origin: string;
  pathname: string;
  postUrlWithoutQuery: string;
} {
  const u = new URL(resolveRealtimeSessionsPostUrl());
  return {
    origin: u.origin,
    pathname: u.pathname,
    postUrlWithoutQuery: `${u.origin}${u.pathname}`,
  };
}

function responseHeadersForLog(res: Response): Record<string, string> {
  try {
    return Object.fromEntries(res.headers.entries());
  } catch {
    return {};
  }
}

function bodyPreview(raw: string): string {
  if (!raw) {
    return '';
  }
  return raw.length <= SESSION_BODY_PREVIEW_CHARS
    ? raw
    : `${raw.slice(0, SESSION_BODY_PREVIEW_CHARS)}…(truncated,len=${raw.length})`;
}

/** Thrown when POST /v1/realtime/sessions fails; callers can branch Twilio copy / HTTP status. */
export class OpenAIRealtimeSessionCreateError extends Error {
  readonly kind: 'http' | 'non_json' | 'timeout' | 'network' | 'upstream';

  readonly status?: number;

  readonly isSessionInitFailure = true as const;

  constructor(
    message: string,
    kind: OpenAIRealtimeSessionCreateError['kind'],
    status?: number
  ) {
    super(message);
    this.name = 'OpenAIRealtimeSessionCreateError';
    this.kind = kind;
    this.status = status;
  }
}

export function isOpenAIRealtimeSessionCreateError(
  e: unknown
): e is OpenAIRealtimeSessionCreateError {
  return e instanceof OpenAIRealtimeSessionCreateError;
}

export async function createOpenAIRealtimeVoiceSession(
  params: CreateRealtimeVoiceSessionParams
): Promise<OpenAIRealtimeSessionPayload> {
  const model = resolveOpenAIRealtimeModel(params.model);
  const voice =
    params.voice?.trim() || process.env.OPENAI_REALTIME_VOICE?.trim() || 'alloy';
  const modalities = params.modalities ?? (['text', 'audio'] as const);
  const url = resolveRealtimeSessionsPostUrl();
  const { origin, pathname, postUrlWithoutQuery } = getRealtimeSessionCreateUrlDiagnostics();

  const bodyJson = JSON.stringify({
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
  });

  console.info('realtime_session_create_started', {
    ...params.logContext,
    origin,
    pathname,
    postUrlWithoutQuery,
    model,
    method: 'POST',
  });

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1];
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), SESSION_CREATE_FETCH_TIMEOUT_MS);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${getOpenAIApiKey()}`,
            'Content-Type': 'application/json',
          },
          body: bodyJson,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      const rawText = await res.text();
      const headersOut = responseHeadersForLog(res);

      let parsedBody: unknown;
      if (rawText.trim()) {
        try {
          parsedBody = JSON.parse(rawText) as unknown;
        } catch {
          console.error('realtime_session_create_non_json', {
            ...params.logContext,
            attempt,
            status: res.status,
            headers: headersOut,
            bodyPreview: bodyPreview(rawText),
            postUrlWithoutQuery,
          });
          throw new OpenAIRealtimeSessionCreateError(
            `OpenAI Realtime session response was not valid JSON (HTTP ${res.status})`,
            'non_json',
            res.status
          );
        }
      } else {
        parsedBody = {};
      }

      if (!res.ok) {
        const errObj = parsedBody as { error?: { message?: string; type?: string } };
        const apiMsg = errObj?.error?.message || '';

        if (RETRYABLE_HTTP_STATUSES.has(res.status) && attempt < RETRY_DELAYS_MS.length) {
          console.warn('realtime_session_create_http_error', {
            ...params.logContext,
            attempt,
            willRetry: true,
            status: res.status,
            headers: headersOut,
            bodyPreview: bodyPreview(rawText),
            postUrlWithoutQuery,
            apiMessage: apiMsg || undefined,
          });
          continue;
        }

        const exhaustedRetryable =
          RETRYABLE_HTTP_STATUSES.has(res.status) && attempt >= RETRY_DELAYS_MS.length;
        console.error('realtime_session_create_http_error', {
          ...params.logContext,
          attempt,
          willRetry: false,
          exhaustedRetries: exhaustedRetryable || undefined,
          status: res.status,
          headers: headersOut,
          bodyPreview: bodyPreview(rawText),
          postUrlWithoutQuery,
          apiMessage: apiMsg || undefined,
        });
        throw new OpenAIRealtimeSessionCreateError(
          apiMsg || `OpenAI Realtime session failed: HTTP ${res.status}`,
          'http',
          res.status
        );
      }

      return parsedBody as OpenAIRealtimeSessionPayload;
    } catch (e: unknown) {
      if (e instanceof OpenAIRealtimeSessionCreateError) {
        throw e;
      }

      const aborted =
        e instanceof Error &&
        (e.name === 'AbortError' || e.message.toLowerCase().includes('abort'));
      if (aborted) {
        console.error('realtime_session_create_timeout', {
          ...params.logContext,
          attempt,
          postUrlWithoutQuery,
          timeoutMs: SESSION_CREATE_FETCH_TIMEOUT_MS,
        });
        throw new OpenAIRealtimeSessionCreateError(
          `OpenAI Realtime session request timed out after ${SESSION_CREATE_FETCH_TIMEOUT_MS}ms`,
          'timeout'
        );
      }

      const msg = e instanceof Error ? e.message : 'Unknown fetch error';
      console.error('realtime_session_create_http_error', {
        ...params.logContext,
        attempt,
        kind: 'network',
        message: msg,
        postUrlWithoutQuery,
      });
      throw new OpenAIRealtimeSessionCreateError(
        `OpenAI Realtime session request failed: ${msg}`,
        'network'
      );
    }
  }

  throw new OpenAIRealtimeSessionCreateError(
    'OpenAI Realtime session create ended without response',
    'upstream'
  );
}
