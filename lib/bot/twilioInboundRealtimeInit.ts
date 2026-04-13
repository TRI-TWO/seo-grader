import { initBotRealtimeVoiceSession, type BotRealtimeVoiceSessionInitResult } from '@/lib/bot/initBotRealtimeVoiceSession';
import { isOpenAIRealtimeSessionCreateError } from '@/lib/bot/openaiRealtimeSession';

/** Structured audit payload stored on `timeline_events.payload.realtime_session` (no secrets). */
export type TwilioInboundRealtimeSessionLog =
  | {
      ok: true;
      bot_client_id: string;
      prompt_version: string;
      trade_type: string;
      openai_session_id: string | null;
      /** Whether TWILIO_VOICE_MEDIA_STREAM_URL was set (TwiML may connect a Stream). */
      stream_url_configured: boolean;
    }
  | {
      ok: false;
      bot_client_id?: string;
      error: string;
      /** OpenAI POST /realtime/sessions failed (after retries); use dedicated Twilio copy. */
      session_init_failed?: true;
      session_init_kind?: string;
    }
  | {
      ok: false;
      skipped: true;
      reason: string;
    };

export function getTwilioVoiceBotClientIdFromEnv(): string | null {
  const raw = process.env.TWILIO_VOICE_BOT_CLIENT_ID?.trim();
  return raw || null;
}

export function getTwilioVoiceMediaStreamUrlFromEnv(): string | null {
  const raw = process.env.TWILIO_VOICE_MEDIA_STREAM_URL?.trim();
  return raw || null;
}

/**
 * Creates a Realtime session for the configured plumbing bot client, or returns a skip/error descriptor.
 */
export async function runTwilioInboundRealtimeInit(botClientId: string | null): Promise<{
  log: TwilioInboundRealtimeSessionLog;
  init?: BotRealtimeVoiceSessionInitResult;
}> {
  if (!botClientId) {
    return {
      log: { ok: false, skipped: true, reason: 'TWILIO_VOICE_BOT_CLIENT_ID is not set' },
    };
  }

  try {
    const init = await initBotRealtimeVoiceSession(botClientId);
    const streamUrl = getTwilioVoiceMediaStreamUrlFromEnv();
    return {
      init,
      log: {
        ok: true,
        bot_client_id: init.botClientId,
        prompt_version: init.promptVersion,
        trade_type: init.tradeType,
        openai_session_id: init.session.id ?? null,
        stream_url_configured: !!streamUrl,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const sessionInit = isOpenAIRealtimeSessionCreateError(err);
    return {
      log: {
        ok: false,
        bot_client_id: botClientId,
        error: message,
        ...(sessionInit
          ? { session_init_failed: true as const, session_init_kind: err.kind }
          : {}),
      },
    };
  }
}
