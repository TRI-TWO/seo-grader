/**
 * Twilio Media Streams (bidirectional) ↔ OpenAI Realtime WebSocket bridge (v1 plumbing).
 * Realtime WebSocket uses Authorization: Bearer OPENAI_API_KEY (not ephemeral tokens).
 * Used by the custom Node server WebSocket upgrade path — not compatible with Vercel serverless.
 */

import type { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { buildVoiceSystemPromptFromBotConfig } from '@/lib/bot/buildVoiceSystemPrompt';
import { createOpenAIRealtimeSocket } from '@/lib/bot/createOpenAIRealtimeSocket';
import { getBotClientConfig } from '@/lib/bot/getBotClientConfig';
import { resolveOpenAIRealtimeInputTranscriptionModel } from '@/lib/bot/openaiRealtimeSession';

/** Path Twilio `TWILIO_VOICE_MEDIA_STREAM_URL` should use (no query string). */
export const TWILIO_MEDIA_STREAM_WS_PATH = '/api/twilio/voice/media-stream';

const MAX_PENDING_MULAW_CHUNKS = 512;

export type TwilioBridgeStartParams = {
  callSid: string;
  callLogId: string;
  botClientId: string;
  /** Echo from inbound Twilio params; informational only for API-key WebSocket. */
  openaiSessionId: string;
  /** Legacy Twilio param from ephemeral flow; ignored for bridge auth. */
  openaiClientSecret?: string;
};

/** Parsed customParameters from Twilio `start` (snake_case keys match TwiML). */
export function parseBridgeStartParams(
  customParameters: Record<string, string> | undefined
): TwilioBridgeStartParams | null {
  if (!customParameters || typeof customParameters !== 'object') {
    return null;
  }
  const get = (key: string) => String(customParameters[key] ?? '').trim();

  const callSid = get('call_sid');
  const callLogId = get('call_log_id');
  const botClientId = get('bot_client_id');
  const openaiSessionId = get('openai_session_id');
  const openaiClientSecret = get('openai_client_secret');

  if (!callSid || !callLogId || !botClientId) {
    return null;
  }

  return {
    callSid,
    callLogId,
    botClientId,
    openaiSessionId,
    openaiClientSecret: openaiClientSecret || undefined,
  };
}

type TwilioWireEvent = {
  event?: string;
  start?: {
    streamSid?: string;
    callSid?: string;
    customParameters?: Record<string, string>;
    mediaFormat?: { encoding?: string; sampleRate?: number; channels?: number };
  };
  media?: {
    track?: string;
    payload?: string;
  };
  streamSid?: string;
};

function sendTwilioMedia(twilioWs: WebSocket, streamSid: string, payloadB64: string, markSeq: { n: number }) {
  if (twilioWs.readyState !== WebSocket.OPEN) {
    return;
  }
  twilioWs.send(
    JSON.stringify({
      event: 'media',
      streamSid,
      media: { payload: payloadB64 },
    })
  );
  const name = `oa_${markSeq.n++}`;
  twilioWs.send(
    JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name },
    })
  );
}

function requestInitialAssistantResponse(openaiWs: WebSocket) {
  if (openaiWs.readyState !== WebSocket.OPEN) {
    return;
  }
  openaiWs.send(
    JSON.stringify({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
      },
    })
  );
}

function appendTwilioMulawToOpenAI(openaiWs: WebSocket, base64Mulaw: string) {
  if (openaiWs.readyState !== WebSocket.OPEN) {
    return;
  }
  openaiWs.send(
    JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Mulaw,
    })
  );
}

function extractAudioDelta(msg: Record<string, unknown>): string | null {
  const type = msg.type;
  if (
    (type === 'response.audio.delta' || type === 'response.output_audio.delta') &&
    typeof msg.delta === 'string'
  ) {
    return msg.delta;
  }
  return null;
}

function sendRealtimeSessionUpdate(oa: WebSocket, instructions: string, voice: string) {
  oa.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions,
        voice,
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: resolveOpenAIRealtimeInputTranscriptionModel(),
        },
      },
    })
  );
}

/**
 * Handles one Twilio Media Stream WebSocket after upgrade.
 */
export function attachTwilioMediaBridge(twilioWs: WebSocket, req: IncomingMessage): void {
  const remote = req.socket.remoteAddress ?? 'unknown';
  let bridgeParams: TwilioBridgeStartParams | null = null;
  let streamSid: string | null = null;
  let openaiWs: WebSocket | null = null;
  const markSeq = { n: 0 };
  let initialResponseSent = false;
  let closed = false;

  const pendingMulaw: string[] = [];
  let sessionUpdateSent = false;
  let sessionReady = false;

  function maybeSendInitialResponse(oa: WebSocket) {
    if (initialResponseSent || oa.readyState !== WebSocket.OPEN) {
      return;
    }
    initialResponseSent = true;
    requestInitialAssistantResponse(oa);
  }

  function flushPendingAudio(oa: WebSocket) {
    while (sessionReady && oa.readyState === WebSocket.OPEN && pendingMulaw.length > 0) {
      appendTwilioMulawToOpenAI(oa, pendingMulaw.shift()!);
    }
  }

  function enqueueOrAppendMulaw(oa: WebSocket | null, payload: string) {
    if (!oa || oa.readyState !== WebSocket.OPEN) {
      if (pendingMulaw.length < MAX_PENDING_MULAW_CHUNKS) {
        pendingMulaw.push(payload);
      }
      return;
    }
    if (!sessionReady) {
      if (pendingMulaw.length < MAX_PENDING_MULAW_CHUNKS) {
        pendingMulaw.push(payload);
      }
      return;
    }
    appendTwilioMulawToOpenAI(oa, payload);
  }

  const logBase = () => ({
    callSid: bridgeParams?.callSid,
    callLogId: bridgeParams?.callLogId,
    botClientId: bridgeParams?.botClientId,
    openaiSessionId: bridgeParams?.openaiSessionId,
    streamSid,
    remote,
  });

  function teardown(reason: string, err?: unknown) {
    if (closed) {
      return;
    }
    closed = true;

    console.info('Twilio↔OpenAI bridge disconnect', { ...logBase(), reason, err });

    try {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.close();
      }
    } catch {
      // ignore
    }
    try {
      if (twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.close();
      }
    } catch {
      // ignore
    }
  }

  twilioWs.on('message', (raw) => {
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const msg = JSON.parse(text) as TwilioWireEvent;
      const event = msg.event;

      if (event === 'connected') {
        console.info('Twilio media stream connected', { remote });
        return;
      }

      if (event === 'start') {
        const sid = msg.start?.streamSid ?? msg.streamSid;
        const custom = msg.start?.customParameters;
        const parsed = parseBridgeStartParams(custom);

        if (!sid || !parsed) {
          console.error('Twilio media stream start missing streamSid or parameters', {
            remote,
            hasStreamSid: !!sid,
            customKeys: custom ? Object.keys(custom) : [],
          });
          teardown('invalid_start');
          return;
        }

        streamSid = sid;
        bridgeParams = parsed;

        console.info('Twilio↔OpenAI bridge connect', {
          ...logBase(),
          mediaFormat: msg.start?.mediaFormat,
        });

        void (async () => {
          try {
            const config = await getBotClientConfig(parsed.botClientId);
            const instructions = buildVoiceSystemPromptFromBotConfig(config);
            const voice = process.env.OPENAI_REALTIME_VOICE?.trim() || 'alloy';

            const oa = createOpenAIRealtimeSocket({ debug: true });
            openaiWs = oa;

            oa.on('open', () => {
              sessionUpdateSent = true;
              sendRealtimeSessionUpdate(oa, instructions, voice);
              console.info('OpenAI Realtime websocket open (API key)', { ...logBase() });
              setTimeout(() => {
                if (!closed && !sessionReady && oa.readyState === WebSocket.OPEN) {
                  console.warn('OpenAI session.updated missing instructions; continuing (fallback)', logBase());
                  sessionReady = true;
                  flushPendingAudio(oa);
                  maybeSendInitialResponse(oa);
                }
              }, 2500);
            });

            oa.on('message', (data) => {
              try {
                const str = typeof data === 'string' ? data : data.toString('utf8');
                const j = JSON.parse(str) as Record<string, unknown>;

                if (j.type === 'session.updated' && sessionUpdateSent && !sessionReady) {
                  const sess = j.session as { instructions?: string } | undefined;
                  if (typeof sess?.instructions === 'string' && sess.instructions.length > 0) {
                    sessionReady = true;
                    flushPendingAudio(oa);
                    maybeSendInitialResponse(oa);
                  }
                  return;
                }

                const delta = extractAudioDelta(j);
                if (delta && streamSid) {
                  sendTwilioMedia(twilioWs, streamSid, delta, markSeq);
                  return;
                }

                if (j.type === 'error') {
                  console.error('OpenAI Realtime error event', { ...logBase(), error: j.error ?? j });
                  teardown('openai_error', j);
                }
              } catch (e) {
                console.error('OpenAI message parse error', { ...logBase(), error: e });
              }
            });

            oa.on('close', (code, buf) => {
              console.info('OpenAI Realtime websocket closed', {
                ...logBase(),
                code,
                reason: buf?.toString?.('utf8'),
              });
              teardown('openai_close');
            });

            oa.on('error', (err) => {
              console.error('OpenAI Realtime websocket error', { ...logBase(), err });
              teardown('openai_ws_error', err);
            });
          } catch (e) {
            console.error('Twilio↔OpenAI bridge setup failed', { ...logBase(), error: e });
            teardown('bridge_setup_error', e);
          }
        })();

        return;
      }

      if (event === 'media' && msg.media?.track === 'inbound' && msg.media.payload) {
        enqueueOrAppendMulaw(openaiWs, msg.media.payload);
        if (sessionReady && openaiWs) {
          flushPendingAudio(openaiWs);
        }
        return;
      }

      if (event === 'stop') {
        teardown('twilio_stop');
        return;
      }
    } catch (e) {
      console.error('Twilio message handling error', { remote, error: e });
      teardown('twilio_parse_error', e);
    }
  });

  twilioWs.on('close', () => {
    teardown('twilio_close');
  });

  twilioWs.on('error', (err) => {
    console.error('Twilio media websocket error', { remote, err });
    teardown('twilio_ws_error', err);
  });
}
