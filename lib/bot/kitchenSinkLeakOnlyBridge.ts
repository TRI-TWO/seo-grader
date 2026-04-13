/**
 * Twilio ↔ OpenAI Realtime bridge for {@link isVoiceKitchenSinkLeakOnlyMode} only.
 * No tools; deterministic FSM + scripted lines. See kitchenSinkLeakOnlyStateMachine.
 */

import type { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { createOpenAIRealtimeSocket } from '@/lib/bot/createOpenAIRealtimeSocket';
import { getBotClientConfig } from '@/lib/bot/getBotClientConfig';
import {
  ASR_EMPTY_TRANSCRIPT_SIGNAL,
  createInitialFsmContext,
  greetingLine,
  isAddressPipelineStateForEmptyTranscript,
  isKitchenSinkAddressCapturePipelineState,
  transitionKitchenSinkLeakOnly,
  type KitchenSinkLeakOnlyFsmState,
  type KitchenSinkSlotRetryKey,
} from '@/lib/bot/kitchenSinkLeakOnlyStateMachine';
import type { CallbackWindow } from '@/lib/bot/kitchenSinkLeakOnlyValidators';
import { getKitchenSinkLeakOnlyActiveTestMode } from '@/lib/bot/kitchenSinkLeakOnlyVoiceMode';
import { persistKitchenSinkLeakOnlyOutcome } from '@/lib/bot/kitchenSinkLeakOnlyPersistence';
import {
  openAiAudioDeltaToTwilioMulawBase64,
  twilioMulaw8kBase64ToOpenAiRealtimePcm24MonoBase64,
} from '@/lib/bot/openaiDeltaToTwilioMulaw';
import {
  resolveOpenAIRealtimeInputTranscriptionModel,
  resolveOpenAIRealtimeModel,
} from '@/lib/bot/openaiRealtimeSession';
import { completeTwilioCall } from '@/lib/bot/twilioCompleteCall';
import { prisma } from '@/lib/prisma';
import { parseBridgeStartParams, type TwilioBridgeStartParams } from '@/lib/bot/twilioBridgeStartParams';

const MAX_PENDING_MULAW = 256;
const MANUAL_COMMIT_MS = 1800;
/** Longer end-of-turn window only while collecting street/city/state/zip (narrow patch). */
const MANUAL_COMMIT_MS_ADDRESS_CAPTURE = 2800;
const POST_ASSISTANT_TAIL_MS = 400;
/** Require ~200ms of appended μ-law @ 8kHz before commit (API minimum in plan: 100ms). */
const MIN_CALLER_AUDIO_MS_FOR_COMMIT = 200;
/** If a commit carried at least this much audio and ASR returns empty, treat as miss (address slots). */
const MEANINGFUL_COMMIT_MS_FOR_EMPTY_TRANSCRIPT = 450;

type TwilioWireEvent = {
  event?: string;
  start?: {
    streamSid?: string;
    customParameters?: Record<string, string>;
  };
  media?: { payload?: string };
  streamSid?: string;
};

const SLAVE_INSTRUCTIONS =
  'You are a phone voice system. You speak ONLY the exact user-facing sentence provided ' +
  'in the latest session instructions block under SAY_THIS (one sentence). ' +
  'Do not add words, do not ask extra questions, do not improvise, do not add a second sentence. ' +
  'Keep it brief and natural prosody. ' +
  'Policy: premium front-desk intake only — do not troubleshoot plumbing, diagnose causes, or walk the caller through repairs. ' +
  'Do not ask open-ended discovery questions (for example: more information, what they noticed, or when water appears). ' +
  'Do not ask diagnostic timing questions such as whether the leak happens when the faucet is on or off. ' +
  'Follow only the single SAY_THIS sentence; one short forced-choice or slot question at a time. ' +
  'If the caller is unsure, accept it and continue. ' +
  'Never suggest you will figure it out together with the caller. ' +
  'CRITICAL: Finishing issue triage does NOT finish the call. After triage you must still collect name, street, city, state, ZIP, callback phone confirmation, and callback time — one slot at a time. ' +
  'Until SAY_THIS is the final recap sentence that includes the caller name and address summary, you must NOT say the call is complete, booked, scheduled, ' +
  'or that you will get something scheduled or taken care of. ' +
  'If SAY_THIS asks for a name or address, you are still in intake — never add scheduling or wrap-up language.';

function sendTwilioMedia(twilioWs: WebSocket, streamSid: string, payloadB64: string, markSeq: { n: number }) {
  if (twilioWs.readyState !== WebSocket.OPEN) {
    return;
  }
  twilioWs.send(JSON.stringify({ event: 'media', streamSid, media: { payload: payloadB64 } }));
  twilioWs.send(
    JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name: `ks_${markSeq.n++}` },
    })
  );
}

function wrapLineForSession(sayThis: string): string {
  return `${SLAVE_INSTRUCTIONS}\n\nSAY_THIS:\n${sayThis}`;
}

function extractRejectedParam(
  message: string,
  err: Record<string, unknown> | undefined
): string | undefined {
  const quoted = message.match(/Unknown parameter:\s*'([^']+)'/i);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const backtick = message.match(/Unknown parameter:\s*`([^`]+)`/i);
  if (backtick?.[1]) {
    return backtick[1];
  }
  if (err && typeof err.param === 'string') {
    return err.param;
  }
  return undefined;
}

/** Twilio streams μ-law @ 8 kHz (one byte per sample). */
function mulawBase64DurationMs(b64: string): number {
  try {
    const buf = Buffer.from(b64, 'base64');
    return Math.round((buf.length / 8000) * 1000);
  } catch {
    return 0;
  }
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

/** Nested `session.audio` format objects from server session payloads (created / updated). */
function summarizeSessionAudioFormats(sess: Record<string, unknown> | undefined): {
  audioInputFormat: unknown;
  audioOutputFormat: unknown;
  legacyInputAudioFormat: unknown;
  legacyOutputAudioFormat: unknown;
} {
  const legacyInputAudioFormat = sess?.input_audio_format;
  const legacyOutputAudioFormat = sess?.output_audio_format;
  const audio = sess?.audio;
  if (!audio || typeof audio !== 'object') {
    return {
      audioInputFormat: undefined,
      audioOutputFormat: undefined,
      legacyInputAudioFormat,
      legacyOutputAudioFormat,
    };
  }
  const a = audio as Record<string, unknown>;
  const inputObj = a.input && typeof a.input === 'object' ? (a.input as Record<string, unknown>) : null;
  const outputObj =
    a.output && typeof a.output === 'object' ? (a.output as Record<string, unknown>) : null;
  return {
    audioInputFormat: inputObj?.format,
    audioOutputFormat: outputObj?.format,
    legacyInputAudioFormat,
    legacyOutputAudioFormat,
  };
}

/** `session.audio.input.turn_detection` from server session payloads (e.g. server_vad vs null). */
function extractSessionAudioInputTurnDetection(sess: Record<string, unknown> | undefined): unknown {
  const audio = sess?.audio;
  if (!audio || typeof audio !== 'object') {
    return undefined;
  }
  const input = (audio as Record<string, unknown>).input;
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  return (input as Record<string, unknown>).turn_detection;
}

/**
 * Entry point from {@link attachTwilioMediaBridge} when kitchen-sink-leak-only mode is active.
 */
export function attachKitchenSinkLeakOnlyMediaBridge(twilioWs: WebSocket, req: IncomingMessage): void {
  const remote = req.socket.remoteAddress ?? 'unknown';
  const activeTestMode = getKitchenSinkLeakOnlyActiveTestMode();

  let bridgeParams: TwilioBridgeStartParams | null = null;
  let streamSid: string | null = null;
  let openaiWs: WebSocket | null = null;
  const markSeq = { n: 0 };
  let closed = false;
  let sessionReady = false;
  let sessionUpdateSent = false;
  let initialGreetingSent = false;
  let assistantResponseOpen = false;
  const pendingMulaw: string[] = [];

  let fsmState: KitchenSinkLeakOnlyFsmState = createInitialFsmContext().state;
  let collected = createInitialFsmContext().collected;
  let leakLocationReprompts = 0;
  let secondaryLeakReprompts = 0;
  let pendingCallbackNormalized: CallbackWindow | null = null;
  let slotRetryCounts: Partial<Record<KitchenSinkSlotRetryKey, number>> = {};
  let companyName = '';

  let waitingForUserTranscript = false;
  let manualWindowTimer: ReturnType<typeof setTimeout> | null = null;
  let manualTurnOpen = false;
  let ignoreInboundUntil = 0;
  let commitInFlight = false;
  /** True after at least one successful `input_audio_buffer.append` since this listen window opened. */
  let callerAudioAppendedSinceLastCommit = false;
  /** Approximate ms of caller μ-law appended in the current listen window (committed on successful commit / reset on arm / silence reprompt). */
  let bufferedCallerMs = 0;
  /** Snapshot of {@link bufferedCallerMs} at last `input_audio_buffer.commit` (for empty-transcript handling). */
  let bufferedMsAtLastCommit = 0;
  /** Session update sender (set when OpenAI socket is ready). Used for silence reprompt. */
  let sendKitchenSinkSessionUpdateRef: ((oaSock: WebSocket, sayThisLine: string) => void) | null = null;
  /** Last SAY_THIS line spoken (for repeating the same question on silence). */
  let lastAssistantPromptLineForReprompt = '';
  let debugFirstAppendLogged = false;
  let sessionCreatedSeen = false;
  let audioDeltasThisResponse = 0;
  let debugAwaitFirstTwilioAfterThisCommit = false;

  const callerUtterances: string[] = [];
  let pendingCallOutcome:
    | 'qualified_kitchen_sink_leak'
    | 'qualified_plumbing_intake'
    | 'unsupported_issue'
    | 'leak_location_unclear'
    | null =
    null;
  let pendingEndReason: string | null = null;

  const logBase = () => ({
    callSid: bridgeParams?.callSid,
    callLogId: bridgeParams?.callLogId,
    botClientId: bridgeParams?.botClientId,
    streamSid,
    remote,
    activeTestMode,
  });

  function logTransition(extra: Record<string, unknown>) {
    console.info('VOICE_KITCHEN_SINK_ONLY', {
      ...logBase(),
      currentState: fsmState,
      normalizedIssue: collected.normalizedIssue,
      leakPrimary: collected.leakPrimary,
      leakSecondary: collected.leakSecondary,
      collectedName: collected.callerName,
      collectedAddress: collected.serviceAddress,
      collectedCallbackTime: collected.callbackTimePreference,
      ...extra,
    });
  }

  function teardown(reason: string) {
    if (closed) {
      return;
    }
    closed = true;
    if (manualWindowTimer) {
      clearTimeout(manualWindowTimer);
      manualWindowTimer = null;
    }
    console.info('Twilio↔OpenAI kitchen-sink-only bridge disconnect', { ...logBase(), reason });
    try {
      openaiWs?.close();
    } catch {
      // ignore
    }
    try {
      twilioWs.close();
    } catch {
      // ignore
    }
  }

  function sendResponseCreate(oa: WebSocket, reason: string) {
    const willNoOp = oa.readyState !== WebSocket.OPEN || assistantResponseOpen;
    if (willNoOp) {
      return;
    }
    oa.send(JSON.stringify({ type: 'response.create', response: {} }));
    assistantResponseOpen = true;
    console.info('OPENAI kitchen_sink_only response.create', { ...logBase(), reason });
  }

  function clearManualWindow() {
    if (manualWindowTimer) {
      clearTimeout(manualWindowTimer);
      manualWindowTimer = null;
    }
    manualTurnOpen = false;
  }

  function tryCommit(oa: WebSocket, reason: string) {
    if (!manualTurnOpen || assistantResponseOpen || commitInFlight || closed) {
      return;
    }
    if (!callerAudioAppendedSinceLastCommit || bufferedCallerMs < MIN_CALLER_AUDIO_MS_FOR_COMMIT) {
      return;
    }
    bufferedMsAtLastCommit = bufferedCallerMs;
    commitInFlight = true;
    oa.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    waitingForUserTranscript = true;
    debugAwaitFirstTwilioAfterThisCommit = true;
    clearManualWindow();
    console.info('OPENAI kitchen_sink_only input_audio_buffer.commit', {
      ...logBase(),
      reason,
      bufferedCallerMs,
      callerAudioAppendedSinceLastCommit,
    });
  }

  function triggerSilenceReprompt(oa: WebSocket) {
    if (closed || assistantResponseOpen || !sendKitchenSinkSessionUpdateRef) {
      return;
    }
    clearManualWindow();
    const line = lastAssistantPromptLineForReprompt.trim();
    if (!line) {
      console.warn('OPENAI kitchen_sink_only silence_reprompt skipped_no_line', logBase());
      armListeningWindow(oa);
      return;
    }
    console.info('OPENAI kitchen_sink_only silence_reprompt', {
      ...logBase(),
      bufferedCallerMs,
      callerAudioAppendedSinceLastCommit,
      fsmState,
    });
    console.info('OPENAI kitchen_sink_only input_audio_buffer.clear', {
      ...logBase(),
      reason: 'silence_reprompt',
      bufferedCallerMs,
      callerAudioAppendedSinceLastCommit,
      fsmState,
    });
    oa.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    callerAudioAppendedSinceLastCommit = false;
    bufferedCallerMs = 0;
    bufferedMsAtLastCommit = 0;
    commitInFlight = false;
    sendKitchenSinkSessionUpdateRef(oa, line);
    sendResponseCreate(oa, 'kitchen_sink_only_silence_reprompt');
  }

  function armListeningWindow(oa: WebSocket) {
    console.info('OPENAI kitchen_sink_only listening_window_open', {
      ...logBase(),
      priorBufferedCallerMs: bufferedCallerMs,
      priorCallerAudioAppendedSinceLastCommit: callerAudioAppendedSinceLastCommit,
    });
    clearManualWindow();
    manualTurnOpen = true;
    callerAudioAppendedSinceLastCommit = false;
    bufferedCallerMs = 0;
    bufferedMsAtLastCommit = 0;
    commitInFlight = false;
    const commitDelayMs =
      isKitchenSinkAddressCapturePipelineState(fsmState) || fsmState === 'address_confirm'
        ? MANUAL_COMMIT_MS_ADDRESS_CAPTURE
        : MANUAL_COMMIT_MS;
    manualWindowTimer = setTimeout(() => {
      manualWindowTimer = null;
      if (!manualTurnOpen || closed) {
        return;
      }
      if (callerAudioAppendedSinceLastCommit && bufferedCallerMs >= MIN_CALLER_AUDIO_MS_FOR_COMMIT) {
        tryCommit(oa, 'manual_timer');
      } else {
        triggerSilenceReprompt(oa);
      }
    }, commitDelayMs);
  }

  function appendAudio(oa: WebSocket, payloadB64: string) {
    if (closed) {
      return;
    }
    if (oa.readyState !== WebSocket.OPEN) {
      return;
    }
    if (!payloadB64) {
      return;
    }
    if (Date.now() < ignoreInboundUntil) {
      return;
    }
    if (assistantResponseOpen) {
      return;
    }
    if (!manualTurnOpen) {
      return;
    }

    const chunkMs = mulawBase64DurationMs(payloadB64);
    if (chunkMs <= 0) {
      return;
    }

    const pcmAppendB64 = twilioMulaw8kBase64ToOpenAiRealtimePcm24MonoBase64(payloadB64);
    if (!pcmAppendB64) {
      return;
    }

    console.info('OPENAI kitchen_sink_only append_send_attempt', {
      ...logBase(),
      chunkMs,
      b64Len: payloadB64.length,
      pcmAppendB64Len: pcmAppendB64.length,
      manualTurnOpen,
      assistantResponseOpen,
      closed,
      readyState: oa.readyState,
    });

    oa.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: pcmAppendB64 }));

    console.info('OPENAI kitchen_sink_only append_send_complete', {
      ...logBase(),
      chunkMs,
      b64Len: payloadB64.length,
      pcmAppendB64Len: pcmAppendB64.length,
    });

    bufferedCallerMs += chunkMs;
    callerAudioAppendedSinceLastCommit = true;
    if (!debugFirstAppendLogged) {
      debugFirstAppendLogged = true;
    }
  }

  function afterAssistantDone(oa: WebSocket) {
    assistantResponseOpen = false;
    commitInFlight = false;
    ignoreInboundUntil = Date.now() + POST_ASSISTANT_TAIL_MS;
    console.info('OPENAI kitchen_sink_only input_audio_buffer.clear', {
      ...logBase(),
      reason: 'after_assistant_done',
      bufferedCallerMs,
      callerAudioAppendedSinceLastCommit,
    });
    oa.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));

    const listenStates: KitchenSinkLeakOnlyFsmState[] = [
      'issue_capture',
      'kitchen_sink_confirm',
      'leak_location_primary_capture',
      'leak_location_secondary_capture',
      'collect_name',
      'collect_street_address',
      'collect_city',
      'collect_state',
      'collect_zip',
      'address_city_deferred_sms',
      'address_confirm',
      'callback_number_confirm',
      'callback_number_collect',
      'collect_callback_time',
      'callback_confirm',
    ];
    if (listenStates.includes(fsmState)) {
      armListeningWindow(oa);
    }
  }

  async function finalizeHangup() {
    const sid = bridgeParams?.callSid;
    const callLogId = bridgeParams?.callLogId;
    const callOutcomeFinal = pendingCallOutcome ?? 'unsupported_issue';

    if (!callLogId) {
      if (sid) {
        void completeTwilioCall(sid, logBase()).finally(() => teardown('hangup_no_persist'));
      } else {
        teardown('hangup_no_sid');
      }
      return;
    }

    let leadId: string | null = null;
    try {
      const rows = await prisma.$queryRaw<Array<{ lead_id: string | null }>>`
        SELECT lead_id FROM public.call_logs WHERE id = ${callLogId}::uuid LIMIT 1
      `;
      leadId = rows[0]?.lead_id ?? null;
    } catch (e) {
      console.warn('VOICE_KITCHEN_SINK_ONLY lead lookup failed', { callLogId, e });
    }

    await persistKitchenSinkLeakOnlyOutcome({
      callLogId,
      leadId,
      activeTestMode,
      callOutcome: callOutcomeFinal,
      endReason: pendingEndReason,
      collected,
      transcriptSummary: callerUtterances.join(' | '),
    });

    if (sid) {
      void completeTwilioCall(sid, logBase()).finally(() => teardown('kitchen_sink_only_complete'));
    } else {
      teardown('kitchen_sink_only_complete_no_sid');
    }
  }

  function flushPending(oa: WebSocket) {
    while (sessionReady && oa.readyState === WebSocket.OPEN && pendingMulaw.length > 0) {
      const p = pendingMulaw.shift()!;
      appendAudio(oa, p);
    }
  }

  twilioWs.on('message', (raw) => {
    try {
      const text = typeof raw === 'string' ? raw : raw.toString('utf8');
      const msg = JSON.parse(text) as TwilioWireEvent;
      const event = msg.event;

      if (event === 'connected') {
        console.info('Twilio media stream connected (kitchen-sink-only)', { remote });
        return;
      }

      if (event === 'start') {
        const sid = msg.start?.streamSid ?? msg.streamSid;
        const parsed = parseBridgeStartParams(msg.start?.customParameters);
        if (!sid || !parsed) {
          console.error('kitchen-sink-only invalid start', { remote });
          teardown('invalid_start');
          return;
        }
        streamSid = sid;
        bridgeParams = parsed;
        collected = createInitialFsmContext({
          inboundCallerPhoneE164: parsed.callerPhoneE164 ?? null,
        }).collected;

        console.info('Twilio↔OpenAI bridge connect (kitchen-sink-only)', {
          ...logBase(),
          voiceModeKitchenSinkLeakOnly: true,
        });

        void (async () => {
          try {
            const config = await getBotClientConfig(parsed.botClientId);
            companyName = config.businessName.trim() || 'us';
            const greet = greetingLine(companyName);
            fsmState = 'greeting';
            lastAssistantPromptLineForReprompt = greet;

            sessionCreatedSeen = false;
            let sessionUpdateKeysLastSent: string[] = [];

            /**
             * Kitchen-sink `session.update`: PCM @ 24k + **turn_detection: null** so the server does not use
             * server_vad auto-commit (Realtime docs: manual `input_audio_buffer.commit` is for VAD-off push-to-talk).
             * Twilio μ-law is transcoded to PCM in {@link appendAudio}.
             */
            function sendKitchenSinkSessionUpdate(oaSock: WebSocket, sayThisLine: string) {
              const wsModel = resolveOpenAIRealtimeModel();
              const inputTranscriptionModel = resolveOpenAIRealtimeInputTranscriptionModel();
              const session = {
                type: 'realtime' as const,
                model: wsModel,
                instructions: wrapLineForSession(sayThisLine),
                tool_choice: 'none' as const,
                audio: {
                  input: {
                    format: { type: 'audio/pcm' as const, rate: 24000 as const },
                    turn_detection: null,
                    transcription: { model: inputTranscriptionModel },
                  },
                  output: {
                    format: { type: 'audio/pcm' as const, rate: 24000 as const },
                  },
                },
              };
              const sessionObjectKeys = Object.keys(session).sort();
              sessionUpdateKeysLastSent = sessionObjectKeys.slice();
              console.info('OPENAI kitchen_sink_only session_update_keys', {
                activeTestMode,
                sessionObjectKeys,
                eventType: 'session.update',
                instructionsLength: session.instructions.length,
                inputTranscriptionModel,
              });
              lastAssistantPromptLineForReprompt = sayThisLine;
              oaSock.send(JSON.stringify({ type: 'session.update', session }));
            }

            sendKitchenSinkSessionUpdateRef = sendKitchenSinkSessionUpdate;

            const oa = createOpenAIRealtimeSocket({ debug: false });
            openaiWs = oa;

            oa.on('error', (err) => {
              console.error('OPENAI kitchen_sink_only openai_error', {
                activeTestMode,
                sessionCreatedSeen,
                sessionUpdateKeysLastSent,
                error:
                  err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
                rejectedParam: undefined,
              });
            });

            oa.on('open', () => {
              const wsModel = resolveOpenAIRealtimeModel();
              console.info('OPENAI kitchen_sink_only realtime_ws_open', {
                ...logBase(),
                wsModel,
                twilioInboundCodec: 'g711_ulaw_base64',
                realtimeAppendCodec: 'pcm16le_24k_mono_base64',
              });
              sessionUpdateSent = true;
              sendKitchenSinkSessionUpdate(oa, greet);
              setTimeout(() => {
                if (!closed && !sessionReady && oa.readyState === WebSocket.OPEN) {
                  console.warn('kitchen-sink-only session.updated missing; continuing', logBase());
                  sessionReady = true;
                  flushPending(oa);
                  if (!initialGreetingSent) {
                    initialGreetingSent = true;
                    sendResponseCreate(oa, 'initial_greeting');
                  }
                }
              }, 2500);
            });

            oa.on('message', (data) => {
              try {
                const strData = typeof data === 'string' ? data : data.toString('utf8');
                const j = JSON.parse(strData) as Record<string, unknown>;

                if (j.type === 'session.created') {
                  sessionCreatedSeen = true;
                  const sess = j.session as Record<string, unknown> | undefined;
                  const fmt = summarizeSessionAudioFormats(sess);
                  console.info('OPENAI kitchen_sink_only session_created', {
                    ...logBase(),
                    wsModel: resolveOpenAIRealtimeModel(),
                    sessionModel: sess?.model,
                    sessionTopLevelKeys: sess ? Object.keys(sess).sort() : [],
                    ...fmt,
                    audioTree: sess?.audio,
                  });
                  return;
                }

                if (j.type === 'session.updated') {
                  if (sessionUpdateSent && !sessionReady) {
                    const sess = j.session as { instructions?: string } | undefined;
                    if (typeof sess?.instructions === 'string' && sess.instructions.length > 0) {
                      sessionReady = true;
                      flushPending(oa);
                      if (!initialGreetingSent) {
                        initialGreetingSent = true;
                        sendResponseCreate(oa, 'initial_greeting');
                      }
                    }
                    return;
                  }
                }

                if (j.type === 'conversation.item.input_audio_transcription.failed') {
                  return;
                }

                if (j.type === 'conversation.item.input_audio_transcription.completed') {
                  const tr = typeof j.transcript === 'string' ? j.transcript : '';
                  if (!waitingForUserTranscript || !tr.trim()) {
                    console.info('OPENAI kitchen_sink_only input_audio_transcription.completed', {
                      ...logBase(),
                      fsmState,
                      transcriptLen: tr.length,
                      skipped: true,
                      skipReason: !waitingForUserTranscript ? 'not_waiting' : 'empty_transcript',
                    });
                    if (waitingForUserTranscript && !tr.trim()) {
                      waitingForUserTranscript = false;
                      commitInFlight = false;
                      const meaningfulAudio =
                        bufferedMsAtLastCommit >= MEANINGFUL_COMMIT_MS_FOR_EMPTY_TRANSCRIPT;
                      const snap = bufferedMsAtLastCommit;
                      bufferedMsAtLastCommit = 0;
                      if (
                        meaningfulAudio &&
                        isAddressPipelineStateForEmptyTranscript(fsmState) &&
                        sendKitchenSinkSessionUpdateRef &&
                        !assistantResponseOpen
                      ) {
                        const res = transitionKitchenSinkLeakOnly({
                          state: fsmState,
                          utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
                          collected,
                          leakLocationReprompts,
                          secondaryLeakReprompts,
                          companyName,
                          pendingCallbackNormalized,
                          slotRetryCounts,
                        });
                        fsmState = res.nextState;
                        collected = res.collected;
                        leakLocationReprompts = res.leakLocationReprompts;
                        secondaryLeakReprompts = res.secondaryLeakReprompts;
                        pendingCallbackNormalized = res.pendingCallbackNormalized;
                        slotRetryCounts = res.slotRetryCounts;
                        if (res.callOutcome) {
                          pendingCallOutcome = res.callOutcome;
                          pendingEndReason = res.endReason ?? null;
                        }
                        const line = res.assistantLine;
                        lastAssistantPromptLineForReprompt = line;
                        console.info('OPENAI kitchen_sink_only empty_transcript_address_miss', {
                          ...logBase(),
                          fsmState,
                          bufferedMsAtCommit: snap,
                          nextStateAfterEmpty: res.nextState,
                        });
                        sendKitchenSinkSessionUpdateRef(oa, line);
                        sendResponseCreate(oa, 'kitchen_sink_empty_transcript_address');
                        return;
                      }
                      armListeningWindow(oa);
                    }
                    return;
                  }
                  console.info('OPENAI kitchen_sink_only input_audio_transcription.completed', {
                    ...logBase(),
                    fsmState,
                    transcriptLen: tr.length,
                    skipped: false,
                  });
                  waitingForUserTranscript = false;
                  commitInFlight = false;
                  bufferedMsAtLastCommit = 0;
                  callerUtterances.push(tr.trim());

                  const prev = fsmState;
                  const fsmListening: KitchenSinkLeakOnlyFsmState[] = [
                    'issue_capture',
                    'kitchen_sink_confirm',
                    'leak_location_primary_capture',
                    'leak_location_secondary_capture',
                    'collect_name',
                    'collect_street_address',
                    'collect_city',
                    'collect_state',
                    'collect_zip',
                    'address_city_deferred_sms',
                    'address_confirm',
                    'callback_number_confirm',
                    'callback_number_collect',
                    'collect_callback_time',
                    'callback_confirm',
                  ];
                  if (fsmListening.includes(fsmState)) {
                    const res = transitionKitchenSinkLeakOnly({
                      state: fsmState,
                      utterance: tr,
                      collected,
                      leakLocationReprompts,
                      secondaryLeakReprompts,
                      companyName,
                      pendingCallbackNormalized,
                      slotRetryCounts,
                    });
                    fsmState = res.nextState;
                    collected = res.collected;
                    leakLocationReprompts = res.leakLocationReprompts;
                    secondaryLeakReprompts = res.secondaryLeakReprompts;
                    pendingCallbackNormalized = res.pendingCallbackNormalized;
                    slotRetryCounts = res.slotRetryCounts;
                    if (res.callOutcome) {
                      pendingCallOutcome = res.callOutcome;
                      pendingEndReason = res.endReason ?? null;
                    }
                    const tl = res.transitionLog;
                    console.info('VOICE_KITCHEN_SINK_FSM_TRANSITION', {
                      ...logBase(),
                      fromState: tl?.fromState ?? prev,
                      toState: tl?.toState ?? fsmState,
                      rawTranscript: tr,
                      normalizedValueWritten: tl?.normalizedValueWritten ?? null,
                      validationOk: tl?.validationOk ?? null,
                      rejectionReason: tl?.rejectionReason ?? null,
                      slotRetryCounts: res.slotRetryCounts,
                    });
                    const rawTranscriptStates: KitchenSinkLeakOnlyFsmState[] = [
                      'kitchen_sink_confirm',
                      'leak_location_primary_capture',
                      'leak_location_secondary_capture',
                      'collect_street_address',
                      'collect_city',
                      'address_city_deferred_sms',
                      'collect_state',
                      'collect_zip',
                      'callback_number_collect',
                      'collect_callback_time',
                    ];
                    if (rawTranscriptStates.includes(prev)) {
                      console.info('VOICE_KITCHEN_SINK_RAW_TRANSCRIPT', {
                        ...logBase(),
                        phase: prev,
                        rawTranscript: tr,
                      });
                    }
                    logTransition({
                      nextState: fsmState,
                      fromState: prev,
                      issueMatchResult: res.issueMatchResult,
                      endReason: res.endReason,
                      utterancePreview: tr.length > 160 ? `${tr.slice(0, 160)}…` : tr,
                      transitionLog: tl,
                    });
                    // #region agent log
                    fetch('http://127.0.0.1:7349/ingest/72a03d4c-76ce-4f7e-8f4f-fe3158b2a070', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Debug-Session-Id': 'be3567',
                      },
                      body: JSON.stringify({
                        sessionId: 'be3567',
                        runId: 'kitchen_sink_fsm',
                        hypothesisId:
                          prev === 'kitchen_sink_confirm' ||
                          prev === 'leak_location_primary_capture' ||
                          prev === 'leak_location_secondary_capture'
                            ? 'H_leak'
                            : 'H_addr_cb',
                        location: 'kitchenSinkLeakOnlyBridge.ts:fsm',
                        message: 'transition',
                        data: {
                          fromState: prev,
                          toState: fsmState,
                          validationOk: tl?.validationOk ?? null,
                          rejectionReason: tl?.rejectionReason ?? null,
                          ...(prev === 'kitchen_sink_confirm' ||
                          prev === 'leak_location_primary_capture' ||
                          prev === 'leak_location_secondary_capture'
                            ? {
                                transcriptPreview:
                                  tr.length > 96 ? `${tr.slice(0, 96)}…` : tr,
                              }
                            : {}),
                        },
                        timestamp: Date.now(),
                      }),
                    }).catch(() => {});
                    // #endregion agent log
                    sendKitchenSinkSessionUpdate(oa, res.assistantLine);
                    sendResponseCreate(oa, 'kitchen_sink_only_user_turn');
                    return;
                  }

                  return;
                }

                if (j.type === 'response.done') {
                  assistantResponseOpen = false;

                  if (fsmState === 'greeting') {
                    fsmState = 'issue_capture';
                    logTransition({ nextState: fsmState, event: 'greeting_done' });
                    afterAssistantDone(oa);
                    console.info('OPENAI kitchen_sink_only response.done', {
                      ...logBase(),
                      fsmState,
                    });
                    return;
                  }

                  const terminal =
                    fsmState === 'unsupported_end' ||
                    fsmState === 'leak_location_unclear_end' ||
                    fsmState === 'close';

                  if (terminal) {
                    console.info('OPENAI kitchen_sink_only response.done terminal', {
                      ...logBase(),
                      fsmState,
                      pendingCallOutcome,
                    });
                    void finalizeHangup();
                    return;
                  }

                  afterAssistantDone(oa);
                  console.info('OPENAI kitchen_sink_only response.done', { ...logBase(), fsmState });
                  return;
                }

                if (j.type === 'response.created') {
                  commitInFlight = false;
                  audioDeltasThisResponse = 0;
                  return;
                }

                if (j.type === 'input_audio_buffer.committed') {
                  commitInFlight = false;
                  console.info('OPENAI kitchen_sink_only input_audio_buffer.committed_ack', {
                    ...logBase(),
                    fsmState,
                    waitingForUserTranscript,
                  });
                  return;
                }

                const delta = extractAudioDelta(j);
                if (delta && streamSid && twilioWs.readyState === WebSocket.OPEN) {
                  audioDeltasThisResponse += 1;
                  const mulaw = openAiAudioDeltaToTwilioMulawBase64(delta);
                  if (mulaw) {
                    if (debugAwaitFirstTwilioAfterThisCommit) {
                      debugAwaitFirstTwilioAfterThisCommit = false;
                    }
                    sendTwilioMedia(twilioWs, streamSid, mulaw, markSeq);
                  }
                  return;
                }

                if (j.type === 'error') {
                  const err = j.error as Record<string, unknown> | undefined;
                  const msg = typeof err?.message === 'string' ? err.message : '';
                  console.error('OPENAI kitchen_sink_only openai_error', {
                    activeTestMode,
                    sessionCreatedSeen,
                    sessionUpdateKeysLastSent,
                    error:
                      err != null
                        ? {
                            type: err.type,
                            code: err.code,
                            message: err.message,
                          }
                        : j.error,
                    rejectedParam: extractRejectedParam(msg, err),
                  });
                  console.error('OpenAI kitchen-sink-only error', { ...logBase(), error: j.error ?? j });
                  teardown('openai_error');
                }
              } catch (e) {
                console.error('OpenAI kitchen-sink-only parse error', { ...logBase(), e });
              }
            });

            oa.on('close', () => teardown('openai_close'));
          } catch (e) {
            console.error('kitchen-sink-only init error', { remote, e });
            teardown('init_error');
          }
        })();
        return;
      }

      if (event === 'media' && msg.media?.payload && streamSid === msg.streamSid) {
        if (!openaiWs || openaiWs.readyState !== WebSocket.OPEN) {
          if (pendingMulaw.length < MAX_PENDING_MULAW) {
            pendingMulaw.push(msg.media.payload);
          }
          return;
        }
        if (!sessionReady) {
          if (pendingMulaw.length < MAX_PENDING_MULAW) {
            pendingMulaw.push(msg.media.payload);
          }
          return;
        }
        appendAudio(openaiWs, msg.media.payload);
        return;
      }

      if (event === 'stop') {
        teardown('twilio_stop');
      }
    } catch (e) {
      console.error('Twilio kitchen-sink-only message error', { remote, e });
    }
  });

  twilioWs.on('close', () => teardown('twilio_close'));
}
