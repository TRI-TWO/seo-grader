import WebSocket from 'ws';
import { getOpenAIApiKey, resolveOpenAIRealtimeModel } from '@/lib/bot/openaiRealtimeSession';

export type CreateOpenAIRealtimeSocketOptions = {
  /** Overrides `OPENAI_REALTIME_MODEL` / default (e.g. `gpt-realtime`). */
  model?: string;
  /** Attach verbose `console` handlers for connection lifecycle and `msg.type`. */
  debug?: boolean;
  /**
   * Set true (or env `OPENAI_REALTIME_OPENAI_BETA_HEADER=true`) to send `OpenAI-Beta: realtime=v1`.
   * Default is Bearer-only, matching the stock Realtime WebSocket handshake.
   */
  openaiBetaRealtimeHeader?: boolean;
};

function shouldSendOpenAIBetaHeader(options?: CreateOpenAIRealtimeSocketOptions): boolean {
  if (options?.openaiBetaRealtimeHeader === true) {
    return true;
  }
  if (options?.openaiBetaRealtimeHeader === false) {
    return false;
  }
  return String(process.env.OPENAI_REALTIME_OPENAI_BETA_HEADER || '').toLowerCase() === 'true';
}

/**
 * Node `ws` client to OpenAI Realtime (`Authorization: Bearer OPENAI_API_KEY`).
 * Callers attach their own `message` / `open` handlers unless `debug` is true.
 */
export function createOpenAIRealtimeSocket(options?: CreateOpenAIRealtimeSocketOptions): WebSocket {
  const model = resolveOpenAIRealtimeModel(options?.model);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getOpenAIApiKey()}`,
  };
  if (shouldSendOpenAIBetaHeader(options)) {
    headers['OpenAI-Beta'] = 'realtime=v1';
  }

  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
    headers,
  });

  if (options?.debug) {
    ws.on('open', () => {
      console.log('[openai-realtime] connected');
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string };
        console.log('[openai-realtime] event:', msg.type);
      } catch {
        console.log('[openai-realtime] non-json message');
      }
    });

    ws.on('error', (err) => {
      console.error('[openai-realtime] error', err);
    });

    ws.on('close', (code, reason) => {
      console.log('[openai-realtime] closed', code, reason.toString());
    });
  }

  return ws;
}
