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
import {
  classifyKitchenSinkLeakLane,
  normalizeKitchenSinkLaneText,
  SINGLE_LANE_KITCHEN_SINK_CANONICAL,
} from '@/lib/bot/kitchenSinkLeakAllowlist';
import { openAiAudioDeltaToTwilioMulawBase64 } from '@/lib/bot/openaiDeltaToTwilioMulaw';
import { resolveOpenAIRealtimeInputTranscriptionModel } from '@/lib/bot/openaiRealtimeSession';
import { completeTwilioCall } from '@/lib/bot/twilioCompleteCall';
import {
  getVoiceRepeatBackOnlyEnvRaw,
  isVoiceRepeatBackOnlyMode,
} from '@/lib/bot/voiceRepeatBackMode';
import {
  buildVoiceKitchenSinkLaneCheckTool,
  VOICE_KITCHEN_SINK_LANE_CHECK_TOOL_NAME,
} from '@/lib/bot/voiceKitchenSinkLaneTool';
import {
  getVoiceSingleLaneKitchenSinkEnvRaw,
  isVoiceSingleLaneKitchenSinkForcedByCode,
  isVoiceSingleLaneKitchenSinkOnlyMode,
} from '@/lib/bot/voiceSingleLaneKitchenSinkMode';
import { attachKitchenSinkLeakOnlyMediaBridge } from '@/lib/bot/kitchenSinkLeakOnlyBridge';
import { isVoiceKitchenSinkLeakOnlyMode } from '@/lib/bot/kitchenSinkLeakOnlyVoiceMode';
import {
  buildVoiceIssueGateTool,
  extractFunctionCallsFromResponsePayload,
  isVoiceIssueGateStatus,
  mergeVoiceInstructionsWithGate,
  type VoiceIssueGateStatus,
  VOICE_ISSUE_GATE_TOOL_NAME,
} from '@/lib/bot/voiceIssueGate';
import {
  parseBridgeStartParams,
  type TwilioBridgeStartParams,
} from '@/lib/bot/twilioBridgeStartParams';

export { parseBridgeStartParams, type TwilioBridgeStartParams };

/** Path Twilio `TWILIO_VOICE_MEDIA_STREAM_URL` should use (no query string). */
export const TWILIO_MEDIA_STREAM_WS_PATH = '/api/twilio/voice/media-stream';

const MAX_PENDING_MULAW_CHUNKS = 512;

const SINGLE_LANE_SERVER_LOCK_ALLOWLIST =
  '\n\n## SERVER_SINGLE_LANE_LOCK (authoritative — wins on conflict)\n' +
  `The server normalized this caller to **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}** only. Forbidden in speech or **issue_summary_text**: any other room, floor, fixture, or plumbing type (basement, bathroom, tub, water heater, generic drain story, etc.).\n` +
  'Your **next** spoken output must be **only** this exact sentence: "Just to confirm, you have a kitchen sink leak. Is that right?"\n' +
  'Do **not** say "Understood". Do **not** ask broader discovery ("help me understand", "tell me more about the problem"). Do **not** invent or relocate the issue.\n' +
  `When you call **voice_issue_gate_transition** with **captured_unconfirmed**, set **issue_summary_text** to exactly: ${SINGLE_LANE_KITCHEN_SINK_CANONICAL}\n`;

const SINGLE_LANE_SERVER_LOCK_UNSUPPORTED =
  '\n\n## SERVER_SINGLE_LANE_UNSUPPORTED (authoritative)\n' +
  'The server marked this caller **out of lane**. Say **only**: "I\'m sorry, I can only help with kitchen sink leaks right now." No follow-up questions and no general plumbing triage.\n';

/**
 * After the first **speech-latched** caller frame (server-side energy gate) following an assistant turn, capture audio for this many ms,
 * then attempt `input_audio_buffer.commit` + `response.create` when pre-commit guards pass.
 * Env `TWILIO_BRIDGE_MANUAL_TURN_SILENCE_MS` is legacy naming — value is **fixed window ms**, not silence gap.
 * `0` disables the fixed-window manual turn path. Default 1500ms.
 */
function resolveManualTurnWindowMs(): number {
  const raw = process.env.TWILIO_BRIDGE_MANUAL_TURN_SILENCE_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 1500;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 1500;
  }
  return Math.floor(n);
}

/**
 * First / second wait (ms) before confirmation reprompt / silent give-up.
 * Env `TWILIO_BRIDGE_CONFIRMATION_WAIT_MS`; unset defaults to 5500.
 */
function resolveConfirmationWaitMs(): number {
  const raw = process.env.TWILIO_BRIDGE_CONFIRMATION_WAIT_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 5500;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 5500;
  }
  return Math.floor(n);
}

const CONFIRMATION_GATE_REPROMPT_INSTRUCTIONS =
  'Say exactly one short sentence: "I just need a quick yes or no." Then stop. Do not add anything else.';

function isIssueConfirmationAskGateStatus(status: VoiceIssueGateStatus): boolean {
  return status === 'captured_unconfirmed' || status === 'corrected_pending_confirmation';
}

/** Min caller chunks since last commit / `response.done` before manual commit. `0` disables chunk gate. Default 10. */
function resolveManualFallbackMinChunks(): number {
  const raw = process.env.TWILIO_BRIDGE_MANUAL_FALLBACK_MIN_CHUNKS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 10;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 10;
  }
  return Math.floor(n);
}

/** Min estimated caller audio (ms) before commit. `0` disables ms floor. Default 150. */
function resolveManualCommitMinAudioMs(): number {
  const raw = process.env.TWILIO_BRIDGE_MANUAL_COMMIT_MIN_AUDIO_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 150;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 150;
  }
  return Math.floor(n);
}

/** Assumed ms of audio per inbound Twilio μ-law frame (diagnostic estimate). Default 20. */
function resolveMsPerInboundChunk(): number {
  const raw = process.env.TWILIO_BRIDGE_MS_PER_INBOUND_CHUNK?.trim();
  if (raw === undefined || raw === '') {
    return 20;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return 20;
  }
  return Math.floor(n);
}

/** Max ms since last append for commit freshness; `0` disables check. Default 2000. */
function resolveMaxMsSinceAppendForCommit(): number {
  const raw = process.env.TWILIO_BRIDGE_MAX_MS_SINCE_APPEND?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 2000;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 2000;
  }
  return Math.floor(n);
}

/** Ignore inbound toward OpenAI for this many ms after `response.done` (echo tail / playback). `0` disables. Default 200 (PSTN: minimal tail). */
function resolvePostAssistantIgnoreMs(): number {
  const raw = process.env.TWILIO_BRIDGE_POST_ASSISTANT_IGNORE_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 200;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 200;
  }
  return Math.floor(n);
}

/** Min estimated caller ms before arming fixed capture window. `0` disables. Default 80. */
function resolveWindowArmMinMs(): number {
  const raw = process.env.TWILIO_BRIDGE_WINDOW_ARM_MIN_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 80;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 80;
  }
  return Math.floor(n);
}

/** Min caller chunks before arming fixed window. `0` disables. Default 4. */
function resolveWindowArmMinChunks(): number {
  const raw = process.env.TWILIO_BRIDGE_WINDOW_ARM_MIN_CHUNKS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 4;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 4;
  }
  return Math.floor(n);
}

/**
 * Mean absolute linear sample (0–32767) above which a μ-law frame counts as **high** energy (strong voiced).
 * `0` disables server-side energy gate (speech detection always true — not recommended).
 *
 * Twilio PSTN μ-law often lands meanAbs in roughly **5–120** for real speech in logs; defaults must sit in that band.
 */
function resolveSpeechMeanAbsThreshold(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_MEAN_ABS_THRESHOLD?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 45;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 45;
  }
  return Math.floor(n);
}

/** Derive soft threshold from hard when env unset — always strictly below hard. */
function defaultSpeechSoftMeanAbsFromHard(hard: number): number {
  if (hard <= 1) {
    return 0;
  }
  const fromRatio = Math.floor(hard * 0.22);
  const floored = Math.max(4, fromRatio);
  return Math.min(floored, hard - 1);
}

/**
 * Softer μ-law mean-abs floor: between soft and hard adds partial credit to the integrator (weak PSTN bursts).
 * Env unset → scaled from hard (no fixed floor at 85 — that was blinding the integrator to real calls).
 */
function resolveSpeechSoftMeanAbsThreshold(hard: number): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_SOFT_MEAN_ABS_THRESHOLD?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return defaultSpeechSoftMeanAbsFromHard(hard);
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return defaultSpeechSoftMeanAbsFromHard(hard);
  }
  return Math.floor(n);
}

/** Fraction of frame ms added to speech integrator when meanAbs is in [soft, hard). Default 0.52. */
function resolveSpeechIntegratorSoftWeight(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_SOFT_WEIGHT?.trim();
  if (raw === undefined || raw === '') {
    return 0.52;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return 0.52;
  }
  return n;
}

/** When meanAbs is below soft, leak integrator by msPer * factor. Default 1.35. */
function resolveSpeechIntegratorLeakFactor(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_INTEGRATOR_LEAK?.trim();
  if (raw === undefined || raw === '') {
    return 1.35;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 1.35;
  }
  return n;
}

/**
 * Latch `callerSpeechDetected` when integrator reaches this many ms (soft + hard credit).
 * Use env `TWILIO_BRIDGE_SPEECH_LATCH_INTEGRATOR_MS`; `0` falls back to high-only streak via resolveSpeechMinHighEnergyMs.
 */
function resolveSpeechLatchIntegratorMs(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_LATCH_INTEGRATOR_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 55;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 55;
  }
  return Math.floor(n);
}

/** Min consecutive **high-only** ms (debug + fallback latch if integrator mode off). Default 48. */
function resolveSpeechMinHighEnergyMs(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_MIN_HIGH_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 48;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 48;
  }
  return Math.floor(n);
}

/**
 * Promote speech if inbound keeps arriving post-tail with weak energy and integrator shows some activity.
 * `0` disables. Default 14 seen frames.
 */
function resolveSpeechPersistentSeenFrames(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_PERSISTENT_SEEN_FRAMES?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 14;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 14;
  }
  return Math.floor(n);
}

function resolveSpeechPersistentMinAudioMs(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_PERSISTENT_MIN_AUDIO_MS?.trim();
  if (raw === undefined || raw === '') {
    return 260;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 260;
  }
  return Math.floor(n);
}

function resolveSpeechPersistentMinIntegratorMs(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_PERSISTENT_MIN_INTEGRATOR_MS?.trim();
  if (raw === undefined || raw === '') {
    return 6;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 6;
  }
  return Math.floor(n);
}

/**
 * If inbound audio after tail exceeds this duration (ms) and frame count, latch speech even when integrator is 0.
 * Covers paths where meanAbs stays below soft but caller is clearly talking. `0` disables bypass. Default 480.
 */
function resolveSpeechPersistentBypassMinAudioMs(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_PERSISTENT_BYPASS_MIN_AUDIO_MS?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 480;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 480;
  }
  return Math.floor(n);
}

/** Min seen frames paired with bypass min audio ms. Default 24. `0` disables bypass path. */
function resolveSpeechPersistentBypassMinFrames(): number {
  const raw = process.env.TWILIO_BRIDGE_SPEECH_PERSISTENT_BYPASS_MIN_FRAMES?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 24;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 24;
  }
  return Math.floor(n);
}

/** Mean-abs floor counting as “voiced” for first-post-greeting strict persistent rules. Default 10. */
function resolveFirstTurnVoicedMeanAbsFloor(): number {
  const raw = process.env.TWILIO_BRIDGE_FIRST_TURN_VOICED_MEAN_ABS?.trim();
  if (raw === undefined || raw === '') {
    return 10;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 10;
  }
  return Math.floor(n);
}

/** Min frames at or above voiced floor before persistent integrator latch in strict phase. `0` disables. Default 10. */
function resolveFirstTurnMinVoicedFrames(): number {
  const raw = process.env.TWILIO_BRIDGE_FIRST_TURN_MIN_VOICED_FRAMES?.trim();
  if (raw === '0') {
    return 0;
  }
  if (raw === undefined || raw === '') {
    return 10;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 10;
  }
  return Math.floor(n);
}

/** Rolling window size (frames) for silent-turn veto stats. Default 25. */
function resolveSilentVetoRollingFrames(): number {
  const raw = process.env.TWILIO_BRIDGE_SILENT_VETO_ROLLING_FRAMES?.trim();
  if (raw === undefined || raw === '') {
    return 25;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) {
    return 25;
  }
  return Math.floor(n);
}

/** Veto commit if rolling mean is below this (and other veto rules). Default 3. */
function resolveSilentVetoMaxRollingMeanAbs(): number {
  const raw = process.env.TWILIO_BRIDGE_SILENT_VETO_MAX_ROLLING_MEAN_ABS?.trim();
  if (raw === undefined || raw === '') {
    return 3;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 3;
  }
  return n;
}

/** Veto commit if rolling max is below or equal to this threshold — set just above noise. Default 8. */
function resolveSilentVetoMaxRollingPeakAbs(): number {
  const raw = process.env.TWILIO_BRIDGE_SILENT_VETO_MAX_ROLLING_PEAK_ABS?.trim();
  if (raw === undefined || raw === '') {
    return 8;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 8;
  }
  return n;
}

/** Integrator above this blocks silent veto. Default 0.5. */
function resolveSilentVetoIntegratorEpsilon(): number {
  const raw = process.env.TWILIO_BRIDGE_SILENT_VETO_INTEGRATOR_EPSILON?.trim();
  if (raw === undefined || raw === '') {
    return 0.5;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return 0.5;
  }
  return n;
}

/** ITU-T G.711 μ-law byte to 16-bit linear PCM. */
function mulawByteToLinear(u: number): number {
  const b = (~u) & 0xff;
  const sign = b & 0x80;
  const exponent = (b >> 4) & 0x07;
  const mantissa = b & 0x0f;
  let sample = ((mantissa << 1) + 33) << exponent;
  sample -= 33;
  if (sign) {
    sample = -sample;
  }
  return Math.max(-32768, Math.min(32767, sample));
}

/** Mean absolute amplitude of base64 μ-law payload; empty/invalid → null. */
function mulawBase64MeanAbs(base64Mulaw: string): number | null {
  let buf: Buffer;
  try {
    buf = Buffer.from(base64Mulaw, 'base64');
  } catch {
    return null;
  }
  if (!buf.length) {
    return null;
  }
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    sum += Math.abs(mulawByteToLinear(buf[i]));
  }
  return sum / buf.length;
}

function isCommitEmptyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const o = error as Record<string, unknown>;
  const code = typeof o.code === 'string' ? o.code : '';
  const msg = typeof o.message === 'string' ? o.message : '';
  const type = typeof o.type === 'string' ? o.type : '';
  return (
    code === 'input_audio_buffer_commit_empty' ||
    type === 'input_audio_buffer_commit_empty' ||
    msg.includes('commit_empty') ||
    msg.includes('input_audio_buffer_commit_empty')
  );
}

/** Duplicate response / lifecycle races — log and continue (do not teardown the call). */
function isNonFatalConversationStateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const o = error as Record<string, unknown>;
  const code = typeof o.code === 'string' ? o.code : '';
  const msg = typeof o.message === 'string' ? o.message : '';
  const type = typeof o.type === 'string' ? o.type : '';
  return (
    code === 'conversation_already_has_active_response' ||
    type === 'conversation_already_has_active_response' ||
    msg.includes('conversation_already_has_active_response') ||
    msg.includes('already has an active response')
  );
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

function isAllowedRepeatBackResponseCreateReason(reason: string): boolean {
  return (
    reason === 'initial_greeting' ||
    reason === 'fixed_window_fallback' ||
    reason.startsWith('repeat_back_')
  );
}

function sendRealtimeSessionUpdate(
  oa: WebSocket,
  instructions: string,
  tools?: Record<string, unknown>[],
  opts?: { toolChoiceNone?: boolean }
) {
  /** session.update: instructions plus optional function tools (issue gate). */
  let effectiveTools = tools;
  if (opts?.toolChoiceNone && tools && tools.length > 0) {
    console.error('OPENAI repeat_back_bug_session_update_tools_with_tool_choice_none', {
      toolCount: tools.length,
    });
    effectiveTools = undefined;
  }
  const session: Record<string, unknown> = {
    type: 'realtime',
    instructions,
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw',
    input_audio_transcription: {
      model: resolveOpenAIRealtimeInputTranscriptionModel(),
    },
  };
  if (effectiveTools && effectiveTools.length > 0) {
    session.tools = effectiveTools;
    session.tool_choice = 'auto';
  } else if (opts?.toolChoiceNone) {
    session.tool_choice = 'none';
  }
  oa.send(
    JSON.stringify({
      type: 'session.update',
      session,
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

/** Best-effort assistant text from Realtime `response.done` payload (for diagnostics). */
function extractAssistantOutputTextFromResponse(response: Record<string, unknown> | undefined): string {
  if (!response || typeof response !== 'object') {
    return '';
  }
  const output = response.output;
  if (!Array.isArray(output)) {
    return '';
  }
  const parts: string[] = [];
  for (const item of output as Record<string, unknown>[]) {
    if (typeof item.text === 'string') {
      parts.push(item.text);
    }
    const content = item.content;
    if (Array.isArray(content)) {
      for (const block of content as Record<string, unknown>[]) {
        if (typeof block.text === 'string') {
          parts.push(block.text);
        }
      }
    }
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Handles one Twilio Media Stream WebSocket after upgrade.
 */
export function attachTwilioMediaBridge(twilioWs: WebSocket, req: IncomingMessage): void {
  const voiceRepeatBackOnly = isVoiceRepeatBackOnlyMode();
  if (isVoiceKitchenSinkLeakOnlyMode() && !voiceRepeatBackOnly) {
    console.info('VOICE_KITCHEN_SINK_ONLY_BRIDGE_ACTIVE', {
      LEGACY_PLUMBING_BRIDGE_BYPASSED: true,
      remote: req.socket.remoteAddress ?? 'unknown',
    });
    attachKitchenSinkLeakOnlyMediaBridge(twilioWs, req);
    return;
  }
  const voiceSingleLaneKitchenSinkOnly =
    isVoiceSingleLaneKitchenSinkOnlyMode() && !voiceRepeatBackOnly;
  const activeVoiceMode: 'repeat_back_only' | 'single_lane_kitchen_sink' | 'full_plumbing' =
    voiceRepeatBackOnly
      ? 'repeat_back_only'
      : voiceSingleLaneKitchenSinkOnly
        ? 'single_lane_kitchen_sink'
        : 'full_plumbing';
  const remote = req.socket.remoteAddress ?? 'unknown';

  const rawSingleLaneEnv = getVoiceSingleLaneKitchenSinkEnvRaw();
  if (
    rawSingleLaneEnv.length > 0 &&
    !isVoiceSingleLaneKitchenSinkOnlyMode() &&
    !voiceRepeatBackOnly
  ) {
    console.warn('OPENAI voice_single_lane_env_unrecognized', {
      rawSingleLaneEnv,
      hint: 'VOICE_SINGLE_LANE_KITCHEN_SINK_ONLY must be true, 1, or yes (lowercase)',
    });
  }
  let bridgeParams: TwilioBridgeStartParams | null = null;
  let streamSid: string | null = null;
  let openaiWs: WebSocket | null = null;
  const markSeq = { n: 0 };
  let initialResponseSent = false;
  let closed = false;
  let twilioInboundFrames = 0;
  let responseCreateSeq = 0;
  let manualTurnWindowTimer: ReturnType<typeof setTimeout> | null = null;
  let manualTurnWindowOpen = false;
  let manualTurnWindowStartedAt: number | null = null;
  let assistantResponseOpen = false;
  let callerChunksSinceLastAssistantDone = 0;
  let callerAudioSeenSinceLastAssistantDone = 0;
  let callerSpeechDetectedSinceLastAssistantDone = false;
  /** Leaky integrator (soft + high energy) toward speech latch; see updateCallerSpeechGateOnAllowedFrame. */
  let speechIntegratorAccumMs = 0;
  let speechHighEnergyAccumMs = 0;
  let loggedSpeechDetectedThisTurn = false;
  /** Last frame meanAbs for diagnostics. */
  let lastFrameMeanAbs: number | null = null;
  let speechDetectedReason: 'integrator' | 'high_streak' | 'persistent_inbound' | 'energy_disabled' | null = null;
  /** True if latched via integrator or high_streak (energy path) — exempt from silent-turn veto. */
  let speechLatchedViaEnergy = false;
  /** True if last persistent latch used long-audio bypass (integrator was 0). */
  let speechLatchedViaLongAudioBypass = false;
  /** After first assistant response.done without tool follow-up; until first manual commit passes veto. */
  let awaitingFirstProvenCallerEnergy = false;
  /** Set once — first idle response.done arms strict first-caller phase. */
  let completedFirstAssistantIdleResponseDone = false;
  /** Frames in current post-assistant segment with meanAbs >= first-turn voiced floor. */
  let framesVoicedAboveFloor = 0;
  /** Recent meanAbs samples for silent-turn veto (same length cap as env rolling frames). */
  const meanAbsRingMax = 64;
  let meanAbsRing: number[] = [];
  let lastSpeechEnergyDebugAt = 0;

  let callerAudioAppendedSinceLastCommit = false;
  let callerChunksSinceLastCommit = 0;
  let estimatedCallerAudioMsSinceLastCommit = 0;
  let lastAppendAt: number | null = null;
  let lastCommitAt: number | null = null;
  let lastResponseCreateAt: number | null = null;
  let commitInFlight = false;
  let emptyCommitErrorCount = 0;

  let ignoreInboundAudioUntil = 0;
  let suppressedWhileAssistantFrames = 0;
  let suppressedPostTailFrames = 0;
  let lastPostTailSuppressLogAt = 0;
  let lastAssistantSuppressLogAt = 0;
  let loggedAppendAllowedThisCallerTurn = false;
  let lastWindowArmSkipLogAt = 0;
  let lastProgressLogTier = 0;

  const pendingMulaw: string[] = [];
  let sessionUpdateSent = false;
  let sessionReady = false;
  let baseVoiceInstructions = '';
  let issueGateStatus: VoiceIssueGateStatus = 'unknown';
  const realtimeVoiceSessionTools = () =>
    voiceSingleLaneKitchenSinkOnly
      ? [buildVoiceIssueGateTool(), buildVoiceKitchenSinkLaneCheckTool()]
      : [buildVoiceIssueGateTool()];
  let repeatBackRepromptsSent = 0;
  /** Set when `input_audio_buffer.committed` received this cycle (repeat-back logging). */
  let repeatBackUserAudioCommittedThisCycle = false;
  /** After unsupported lane_check + follow-up: hang up once the next assistant response completes. */
  let singleLaneUnsupportedAwaitingSpeechDone = false;

  /** Bridge-owned floor control after issue confirm question (captured_unconfirmed / corrected_pending_confirmation). */
  let awaitingIssueConfirmationReply = false;
  let issueConfirmationAskedAt: number | null = null;
  let callerCommitAfterIssueConfirmation = false;
  /** 0 = no reprompt yet; 1 = one reprompt sent; 2 = silent wait (no more reprompts). */
  let issueConfirmationRepromptPhase = 0;
  let issueConfirmationWaitTimer: ReturnType<typeof setTimeout> | null = null;

  /** Latest completed input ASR (Realtime `conversation.item.input_audio_transcription.completed`). */
  let lastCompletedCallerTranscript = '';
  let lastCompletedCallerTranscriptAt: number | null = null;
  /** Server event `input_audio_buffer.committed` timestamp (caller turn ack). */
  let lastCallerTurnInputCommittedAt: number | null = null;

  const logBase = () => ({
    callSid: bridgeParams?.callSid,
    callLogId: bridgeParams?.callLogId,
    botClientId: bridgeParams?.botClientId,
    openaiSessionId: bridgeParams?.openaiSessionId,
    streamSid,
    remote,
  });

  function bufferStateSummary() {
    const now = Date.now();
    const hardThr = resolveSpeechMeanAbsThreshold();
    const ignoreInboundAudioRemainingMs =
      ignoreInboundAudioUntil > 0 && now < ignoreInboundAudioUntil
        ? ignoreInboundAudioUntil - now
        : 0;
    return {
      assistantResponseOpen,
      commitInFlight,
      callerChunksSinceLastCommit,
      estimatedCallerAudioMsSinceLastCommit,
      manualTurnWindowOpen,
      msSinceLastAppend: lastAppendAt != null ? now - lastAppendAt : null,
      callerAudioAppendedSinceLastCommit,
      emptyCommitErrorCount,
      manualTurnWindowStartedAt,
      callerChunksSinceLastAssistantDone,
      callerAudioSeenSinceLastAssistantDone,
      callerSpeechDetectedSinceLastAssistantDone,
      speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
      speechHighEnergyAccumMs,
      speechMeanAbsThreshold: hardThr,
      speechSoftMeanAbsThreshold: hardThr > 0 ? resolveSpeechSoftMeanAbsThreshold(hardThr) : 0,
      speechLatchIntegratorMs: resolveSpeechLatchIntegratorMs(),
      lastFrameMeanAbs: lastFrameMeanAbs != null ? Math.round(lastFrameMeanAbs * 10) / 10 : null,
      speechDetectedReason,
      speechLatchedViaEnergy,
      speechLatchedViaLongAudioBypass,
      awaitingFirstProvenCallerEnergy,
      framesVoicedAboveFloor,
      meanAbsRingLen: meanAbsRing.length,
      ignoreInboundAudioUntil,
      ignoreInboundAudioRemainingMs,
      suppressedWhileAssistantFrames,
      suppressedPostTailFrames,
      issueGateStatus,
      voiceRepeatBackOnly,
      repeatBackRepromptsSent,
      repeatBackUserAudioCommittedThisCycle,
      voiceSingleLaneKitchenSinkOnly,
      voiceSingleLaneKitchenSinkForcedByCode: isVoiceSingleLaneKitchenSinkForcedByCode(),
      activeVoiceMode,
      singleLaneUnsupportedAwaitingSpeechDone,
      awaitingIssueConfirmationReply,
      issueConfirmationAskedAt,
      callerCommitAfterIssueConfirmation,
      issueConfirmationRepromptPhase,
    };
  }

  function logWithBuffer(event: string, extra?: Record<string, unknown>) {
    console.info(event, { ...logBase(), ...bufferStateSummary(), ...extra });
  }

  function clearIssueConfirmationWaitTimerOnly(): void {
    if (issueConfirmationWaitTimer) {
      clearTimeout(issueConfirmationWaitTimer);
      issueConfirmationWaitTimer = null;
    }
  }

  function clearIssueConfirmationGate(): void {
    clearIssueConfirmationWaitTimerOnly();
    awaitingIssueConfirmationReply = false;
    issueConfirmationAskedAt = null;
    callerCommitAfterIssueConfirmation = false;
    issueConfirmationRepromptPhase = 0;
  }

  function scheduleIssueConfirmationWaitTimer(oa: WebSocket, delayMs: number): void {
    if (issueConfirmationWaitTimer) {
      clearTimeout(issueConfirmationWaitTimer);
      issueConfirmationWaitTimer = null;
    }
    if (delayMs <= 0 || closed) {
      return;
    }
    issueConfirmationWaitTimer = setTimeout(() => {
      issueConfirmationWaitTimer = null;
      if (closed || oa.readyState !== WebSocket.OPEN || !awaitingIssueConfirmationReply) {
        return;
      }
      if (assistantResponseOpen) {
        scheduleIssueConfirmationWaitTimer(oa, 400);
        return;
      }
      if (issueConfirmationRepromptPhase === 0) {
        issueConfirmationRepromptPhase = 1;
        logWithBuffer('OPENAI confirmation_gate_reprompt_sent', {
          issueGateStatus,
          issueConfirmationAskedAt,
        });
        sendResponseCreate(oa, 'confirmation_gate_reprompt', {
          instructions: CONFIRMATION_GATE_REPROMPT_INSTRUCTIONS,
        });
        scheduleIssueConfirmationWaitTimer(oa, resolveConfirmationWaitMs());
        return;
      }
      if (issueConfirmationRepromptPhase === 1) {
        issueConfirmationRepromptPhase = 2;
        logWithBuffer('OPENAI confirmation_gate_no_response_staying_silent', {
          issueGateStatus,
          issueConfirmationAskedAt,
        });
      }
    }, delayMs);
  }

  function armIssueConfirmationGate(oa: WebSocket): void {
    if (voiceRepeatBackOnly || closed) {
      return;
    }
    clearIssueConfirmationGate();
    awaitingIssueConfirmationReply = true;
    issueConfirmationAskedAt = Date.now();
    callerCommitAfterIssueConfirmation = false;
    issueConfirmationRepromptPhase = 0;
    logWithBuffer('OPENAI confirmation_gate_armed', {
      issueGateStatus,
      issueConfirmationAskedAt,
    });
    scheduleIssueConfirmationWaitTimer(oa, resolveConfirmationWaitMs());
  }

  /** Issue gate status must not change in repeat-back mode; logs bug if called while active. */
  function assignIssueGateStatusFromTool(next: VoiceIssueGateStatus): boolean {
    if (voiceRepeatBackOnly) {
      console.error('OPENAI repeat_back_bug_issue_gate_mutation', {
        ...logBase(),
        attemptedStatus: next,
        currentIssueGateStatus: issueGateStatus,
      });
      return false;
    }
    issueGateStatus = next;
    if (next === 'confirmed' || next === 'correction_lock' || next === 'unknown') {
      clearIssueConfirmationGate();
    }
    return true;
  }

  function resetCommitCountersAfterAssistantDone() {
    callerChunksSinceLastCommit = 0;
    estimatedCallerAudioMsSinceLastCommit = 0;
    callerAudioAppendedSinceLastCommit = false;
    lastAppendAt = null;
    lastProgressLogTier = 0;
    loggedAppendAllowedThisCallerTurn = false;
    suppressedPostTailFrames = 0;
    lastPostTailSuppressLogAt = 0;
    callerAudioSeenSinceLastAssistantDone = 0;
    callerSpeechDetectedSinceLastAssistantDone = false;
    speechIntegratorAccumMs = 0;
    speechHighEnergyAccumMs = 0;
    loggedSpeechDetectedThisTurn = false;
    lastFrameMeanAbs = null;
    speechDetectedReason = null;
    speechLatchedViaEnergy = false;
    speechLatchedViaLongAudioBypass = false;
    framesVoicedAboveFloor = 0;
    meanAbsRing = [];
    lastSpeechEnergyDebugAt = 0;
  }

  function pushMeanAbsRingSample(v: number): void {
    meanAbsRing.push(v);
    const cap = Math.min(resolveSilentVetoRollingFrames(), meanAbsRingMax);
    while (meanAbsRing.length > cap) {
      meanAbsRing.shift();
    }
  }

  function getRollingMeanAndMaxAbs(): { mean: number; max: number; count: number } {
    if (meanAbsRing.length === 0) {
      return { mean: 0, max: 0, count: 0 };
    }
    let sum = 0;
    let max = 0;
    for (const x of meanAbsRing) {
      sum += x;
      if (x > max) {
        max = x;
      }
    }
    return { mean: sum / meanAbsRing.length, max, count: meanAbsRing.length };
  }

  function shouldSilentTurnVeto(): boolean {
    if (speechLatchedViaEnergy) {
      return false;
    }
    if (speechIntegratorAccumMs > resolveSilentVetoIntegratorEpsilon()) {
      return false;
    }
    const { mean, max, count } = getRollingMeanAndMaxAbs();
    if (count < 1) {
      return false;
    }
    return mean < resolveSilentVetoMaxRollingMeanAbs() && max <= resolveSilentVetoMaxRollingPeakAbs();
  }

  function resetSpeechLatchAfterSilentVeto(): void {
    callerSpeechDetectedSinceLastAssistantDone = false;
    speechDetectedReason = null;
    speechLatchedViaEnergy = false;
    speechLatchedViaLongAudioBypass = false;
    loggedSpeechDetectedThisTurn = false;
    speechIntegratorAccumMs = 0;
    speechHighEnergyAccumMs = 0;
    framesVoicedAboveFloor = 0;
    meanAbsRing = [];
    lastFrameMeanAbs = null;
  }

  function getInboundSuppressReason(): 'assistant' | 'post_tail' | null {
    if (assistantResponseOpen) {
      return 'assistant';
    }
    const now = Date.now();
    if (ignoreInboundAudioUntil > 0 && now < ignoreInboundAudioUntil) {
      return 'post_tail';
    }
    return null;
  }

  function maybeLogWindowArmSkipped(reason: string, detail?: Record<string, unknown>) {
    const t = Date.now();
    if (t - lastWindowArmSkipLogAt < 800) {
      return;
    }
    lastWindowArmSkipLogAt = t;
    logWithBuffer('OPENAI manual_turn_window_arm_skipped', { reason, ...detail });
  }

  /**
   * Promote speech when narrowband audio stays arriving after tail but never crosses integrator latch.
   * Long-audio bypass is disabled while `awaitingFirstProvenCallerEnergy` (first post-greeting caller phase).
   */
  function tryPromotePersistentInboundSpeech(): void {
    if (awaitingIssueConfirmationReply) {
      return;
    }
    if (callerSpeechDetectedSinceLastAssistantDone) {
      return;
    }
    const hardThr = resolveSpeechMeanAbsThreshold();
    if (hardThr <= 0) {
      return;
    }
    const seenNeed = resolveSpeechPersistentSeenFrames();
    if (seenNeed <= 0) {
      return;
    }
    if (callerAudioSeenSinceLastAssistantDone < seenNeed) {
      return;
    }
    if (estimatedCallerAudioMsSinceLastCommit < resolveSpeechPersistentMinAudioMs()) {
      return;
    }
    const strict = awaitingFirstProvenCallerEnergy;
    const bypassMs = resolveSpeechPersistentBypassMinAudioMs();
    const bypassFrames = resolveSpeechPersistentBypassMinFrames();
    const longAudioBypass =
      !strict &&
      bypassMs > 0 &&
      bypassFrames > 0 &&
      estimatedCallerAudioMsSinceLastCommit >= bypassMs &&
      callerAudioSeenSinceLastAssistantDone >= bypassFrames;

    const minInt = resolveSpeechPersistentMinIntegratorMs();
    const integratorOk = speechIntegratorAccumMs >= minInt;
    const minVoiced = resolveFirstTurnMinVoicedFrames();
    const voicedOkForStrict = !strict || minVoiced <= 0 || framesVoicedAboveFloor >= minVoiced;

    if (longAudioBypass) {
      callerSpeechDetectedSinceLastAssistantDone = true;
      speechDetectedReason = 'persistent_inbound';
      speechLatchedViaLongAudioBypass = true;
      if (!loggedSpeechDetectedThisTurn) {
        loggedSpeechDetectedThisTurn = true;
        logWithBuffer('OPENAI caller_speech_detected', {
          latchKind: 'persistent_inbound_long_audio_bypass',
          speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
          callerAudioSeenSinceLastAssistantDone,
          estimatedCallerAudioMsSinceLastCommit,
          longAudioBypass: true,
          awaitingFirstProvenCallerEnergy: strict,
        });
      }
      return;
    }

    if (integratorOk && voicedOkForStrict) {
      callerSpeechDetectedSinceLastAssistantDone = true;
      speechDetectedReason = 'persistent_inbound';
      speechLatchedViaLongAudioBypass = false;
      if (!loggedSpeechDetectedThisTurn) {
        loggedSpeechDetectedThisTurn = true;
        logWithBuffer('OPENAI caller_speech_detected', {
          latchKind: 'persistent_inbound',
          speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
          callerAudioSeenSinceLastAssistantDone,
          estimatedCallerAudioMsSinceLastCommit,
          longAudioBypass: false,
          framesVoicedAboveFloor,
          awaitingFirstProvenCallerEnergy: strict,
        });
      }
    }
  }

  /** After post-assistant suppression passes: leaky integrator + high streak + optional persistent promote. */
  function updateCallerSpeechGateOnAllowedFrame(base64Mulaw: string) {
    callerAudioSeenSinceLastAssistantDone += 1;
    const hardThr = resolveSpeechMeanAbsThreshold();
    const msPer = resolveMsPerInboundChunk();
    if (hardThr <= 0) {
      if (!callerSpeechDetectedSinceLastAssistantDone) {
        callerSpeechDetectedSinceLastAssistantDone = true;
        speechDetectedReason = 'energy_disabled';
        speechLatchedViaEnergy = true;
        if (!loggedSpeechDetectedThisTurn) {
          loggedSpeechDetectedThisTurn = true;
          logWithBuffer('OPENAI caller_speech_detected', { latchKind: 'energy_disabled' });
        }
      }
      return;
    }
    const softThr = resolveSpeechSoftMeanAbsThreshold(hardThr);
    const meanAbs = mulawBase64MeanAbs(base64Mulaw);
    if (meanAbs == null) {
      speechIntegratorAccumMs = 0;
      speechHighEnergyAccumMs = 0;
      return;
    }
    lastFrameMeanAbs = meanAbs;
    pushMeanAbsRingSample(meanAbs);
    if (meanAbs >= resolveFirstTurnVoicedMeanAbsFloor()) {
      framesVoicedAboveFloor += 1;
    }
    const softWeight = resolveSpeechIntegratorSoftWeight();
    const leak = resolveSpeechIntegratorLeakFactor();
    const latchInt = resolveSpeechLatchIntegratorMs();

    if (meanAbs >= hardThr) {
      speechIntegratorAccumMs += msPer;
      speechHighEnergyAccumMs += msPer;
    } else if (softThr > 0 && meanAbs >= softThr) {
      speechIntegratorAccumMs += msPer * softWeight;
      speechHighEnergyAccumMs = 0;
    } else {
      speechIntegratorAccumMs = Math.max(0, speechIntegratorAccumMs - msPer * leak);
      speechHighEnergyAccumMs = 0;
    }

    const now = Date.now();
    if (
      now - lastSpeechEnergyDebugAt >= 420 &&
      !callerSpeechDetectedSinceLastAssistantDone &&
      callerAudioSeenSinceLastAssistantDone > 0
    ) {
      lastSpeechEnergyDebugAt = now;
      logWithBuffer('OPENAI speech_energy_frame', {
        meanAbs: Math.round(meanAbs * 10) / 10,
        hardThr,
        softThr,
        speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
        speechHighEnergyAccumMs,
        latchIntegratorMs: latchInt,
        callerAudioSeenSinceLastAssistantDone,
        belowSoft: softThr > 0 && meanAbs < softThr,
      });
    }

    if (!callerSpeechDetectedSinceLastAssistantDone) {
      let latched = false;
      let latchKind: 'integrator' | 'high_streak' | undefined;
      if (latchInt > 0 && speechIntegratorAccumMs >= latchInt) {
        latched = true;
        latchKind = 'integrator';
      } else if (latchInt <= 0) {
        const minHighMsRaw = resolveSpeechMinHighEnergyMs();
        const minHighMs = minHighMsRaw > 0 ? minHighMsRaw : msPer;
        if (speechHighEnergyAccumMs >= minHighMs) {
          latched = true;
          latchKind = 'high_streak';
        }
      }
      if (latched) {
        callerSpeechDetectedSinceLastAssistantDone = true;
        speechDetectedReason = latchKind === 'high_streak' ? 'high_streak' : 'integrator';
        speechLatchedViaEnergy = true;
        speechLatchedViaLongAudioBypass = false;
        if (!loggedSpeechDetectedThisTurn) {
          loggedSpeechDetectedThisTurn = true;
          logWithBuffer('OPENAI caller_speech_detected', {
            latchKind,
            meanAbs: Math.round(meanAbs * 10) / 10,
            hardThr,
            softThr,
            speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
            speechHighEnergyAccumMs,
          });
        }
      }
    }

    tryPromotePersistentInboundSpeech();
  }

  function tryAppendInboundMulaw(oa: WebSocket, base64Mulaw: string) {
    const suppress = getInboundSuppressReason();
    if (suppress === 'assistant') {
      suppressedWhileAssistantFrames += 1;
      const now = Date.now();
      if (
        suppressedWhileAssistantFrames === 1 ||
        suppressedWhileAssistantFrames % 50 === 0 ||
        now - lastAssistantSuppressLogAt >= 1000
      ) {
        lastAssistantSuppressLogAt = now;
        console.info('OPENAI append_suppressed_assistant_open', {
          ...logBase(),
          twilioInboundFrames,
          suppressedWhileAssistantFrames,
          assistantResponseOpen,
        });
      }
      return;
    }
    if (suppress === 'post_tail') {
      suppressedPostTailFrames += 1;
      const now = Date.now();
      if (now - lastPostTailSuppressLogAt >= 500 || lastPostTailSuppressLogAt === 0) {
        lastPostTailSuppressLogAt = now;
        console.info('OPENAI append_suppressed_post_assistant_tail', {
          ...logBase(),
          ...bufferStateSummary(),
        });
      }
      return;
    }

    if (!loggedAppendAllowedThisCallerTurn) {
      loggedAppendAllowedThisCallerTurn = true;
      logWithBuffer('OPENAI append_allowed_user_turn');
    }
    updateCallerSpeechGateOnAllowedFrame(base64Mulaw);
    appendTwilioMulawToOpenAI(oa, base64Mulaw);
  }

  function clearManualWindowState() {
    if (manualTurnWindowTimer) {
      clearTimeout(manualTurnWindowTimer);
      manualTurnWindowTimer = null;
    }
    manualTurnWindowOpen = false;
    manualTurnWindowStartedAt = null;
  }

  function evaluatePrecommitGuard(): { ok: true; snapshot: Record<string, unknown> } | { ok: false; reason: string; snapshot: Record<string, unknown> } {
    const minChunks = resolveManualFallbackMinChunks();
    const minAudioMs = resolveManualCommitMinAudioMs();
    const maxStale = resolveMaxMsSinceAppendForCommit();
    const now = Date.now();
    const msSinceAppend = lastAppendAt != null ? now - lastAppendAt : null;

    const snapshot: Record<string, unknown> = {
      assistantResponseOpen,
      commitInFlight,
      manualTurnWindowOpen,
      callerAudioAppendedSinceLastCommit,
      callerChunksSinceLastCommit,
      callerAudioSeenSinceLastAssistantDone,
      callerSpeechDetectedSinceLastAssistantDone,
      speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
      speechDetectedReason,
      speechLatchedViaEnergy,
      speechLatchedViaLongAudioBypass,
      minChunksRequired: minChunks,
      estimatedCallerAudioMsSinceLastCommit,
      minAudioMsRequired: minAudioMs,
      msSinceLastAppend: msSinceAppend,
      maxMsSinceAppendAllowed: maxStale,
    };

    if (assistantResponseOpen) {
      return { ok: false, reason: 'commit_skipped_assistant_open', snapshot };
    }
    if (commitInFlight) {
      return { ok: false, reason: 'commit_skipped_commit_in_flight', snapshot };
    }
    if (!manualTurnWindowOpen) {
      return { ok: false, reason: 'commit_skipped_no_manual_window', snapshot };
    }
    if (resolveSpeechMeanAbsThreshold() > 0 && !callerSpeechDetectedSinceLastAssistantDone) {
      return { ok: false, reason: 'commit_skipped_no_speech_detected', snapshot };
    }
    if (!callerAudioAppendedSinceLastCommit) {
      return { ok: false, reason: 'commit_skipped_no_audio', snapshot };
    }
    if (minChunks > 0 && callerChunksSinceLastCommit < minChunks) {
      return { ok: false, reason: 'commit_skipped_too_small', snapshot };
    }
    if (minAudioMs > 0 && estimatedCallerAudioMsSinceLastCommit < minAudioMs) {
      return { ok: false, reason: 'commit_skipped_too_small', snapshot };
    }
    if (maxStale > 0 && (lastAppendAt == null || msSinceAppend == null || msSinceAppend > maxStale)) {
      return { ok: false, reason: 'commit_skipped_stale_append', snapshot };
    }

    return { ok: true, snapshot };
  }

  function appendTwilioMulawToOpenAI(oa: WebSocket, base64Mulaw: string) {
    if (oa.readyState !== WebSocket.OPEN) {
      return;
    }
    oa.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Mulaw,
      })
    );
    const msPer = resolveMsPerInboundChunk();
    callerChunksSinceLastAssistantDone += 1;
    callerChunksSinceLastCommit += 1;
    estimatedCallerAudioMsSinceLastCommit += msPer;
    callerAudioAppendedSinceLastCommit = true;
    lastAppendAt = Date.now();

    console.info('OPENAI input_audio_buffer.append sent', {
      ...logBase(),
      b64chars: base64Mulaw.length,
      ...bufferStateSummary(),
    });

    if (manualTurnWindowOpen) {
      const tiers = [100, 200, 500] as const;
      for (const t of tiers) {
        if (estimatedCallerAudioMsSinceLastCommit >= t && lastProgressLogTier < t) {
          lastProgressLogTier = t;
          logWithBuffer('OPENAI caller_audio_appended', { progressTierMs: t });
        }
      }
    }
  }

  function sendInputAudioBufferCommit(oa: WebSocket) {
    if (oa.readyState !== WebSocket.OPEN) {
      return;
    }
    if (assistantResponseOpen) {
      logWithBuffer('OPENAI input_audio_buffer.commit_suppressed_active_assistant');
      return;
    }
    commitInFlight = true;
    oa.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
    lastCommitAt = Date.now();
    logWithBuffer('OPENAI input_audio_buffer.commit sent');
  }

  function sendResponseCreate(
    oa: WebSocket,
    reason: string,
    opts?: { instructions?: string }
  ) {
    if (oa.readyState !== WebSocket.OPEN) {
      return;
    }
    if (voiceRepeatBackOnly && !isAllowedRepeatBackResponseCreateReason(reason)) {
      console.error('OPENAI repeat_back_bug_disallowed_response_create', {
        ...logBase(),
        reason,
      });
      return;
    }
    if (awaitingIssueConfirmationReply) {
      const allowedWhileConfirmationWait =
        reason === 'confirmation_gate_reprompt' ||
        reason === 'voice_issue_gate_tool_followup' ||
        reason === 'voice_kitchen_sink_lane_followup' ||
        reason === 'single_lane_transcript_deterministic_followup';
      if (!allowedWhileConfirmationWait) {
        logWithBuffer('OPENAI confirmation_gate_blocked_response_create', { reason });
        return;
      }
    }
    if (assistantResponseOpen) {
      logWithBuffer('OPENAI response.create_suppressed_active_assistant', { reason });
      return;
    }
    const responseBody: Record<string, unknown> = {};
    if (opts?.instructions?.trim()) {
      responseBody.instructions = opts.instructions.trim();
    }
    oa.send(
      JSON.stringify({
        type: 'response.create',
        response: responseBody,
      })
    );
    assistantResponseOpen = true;
    lastResponseCreateAt = Date.now();
    responseCreateSeq += 1;
    console.info(`OPENAI response.create sent #${responseCreateSeq} (${reason})`, {
      ...logBase(),
      ...bufferStateSummary(),
    });
  }

  function singleLaneTranscriptPhaseAllowsDeterministicLock(status: VoiceIssueGateStatus): boolean {
    if (status === 'confirmed') {
      return false;
    }
    if (status === 'unknown') {
      return true;
    }
    return (
      status === 'captured_unconfirmed' ||
      status === 'corrected_pending_confirmation' ||
      status === 'correction_lock'
    );
  }

  function handleSingleLaneInputTranscriptionCompleted(oa: WebSocket, transcript: string): void {
    if (!voiceSingleLaneKitchenSinkOnly || closed || oa.readyState !== WebSocket.OPEN) {
      return;
    }
    const trimmed = transcript.trim();
    if (!trimmed) {
      return;
    }
    lastCompletedCallerTranscript = trimmed;
    lastCompletedCallerTranscriptAt = Date.now();

    if (!singleLaneTranscriptPhaseAllowsDeterministicLock(issueGateStatus)) {
      return;
    }

    const classification = classifyKitchenSinkLeakLane(trimmed);
    const normalized = normalizeKitchenSinkLaneText(trimmed);

    const singleLaneCorrectionRetry =
      classification.lane === 'allowlisted' &&
      (issueGateStatus === 'captured_unconfirmed' ||
        issueGateStatus === 'corrected_pending_confirmation' ||
        issueGateStatus === 'correction_lock');

    logWithBuffer('OPENAI single_lane_deterministic_transcript_classify', {
      activeVoiceMode,
      classificationSource: 'input_audio_transcription',
      singleLaneKitchenSinkIntentMatched: classification.lane === 'allowlisted',
      normalizedSingleLaneIssue: classification.canonicalIssue,
      singleLaneUnsupportedReason: classification.unsupportedReason ?? null,
      transcriptPreview: trimmed.length > 220 ? `${trimmed.slice(0, 220)}…` : trimmed,
      normalized_issue: normalized,
      issueGateStatus,
      server_lane: classification.lane,
      matched_pattern_id: classification.matchedPatternId ?? null,
      off_lane_hits: classification.offLaneHits,
      singleLaneCorrectionRetry,
    });

    if (singleLaneCorrectionRetry) {
      logWithBuffer('OPENAI single_lane_correction_retry', {
        issueGateStatus,
        normalizedSingleLaneIssue: classification.canonicalIssue,
      });
    }

    const rejectedUnsupported = classification.lane === 'unsupported';
    if (rejectedUnsupported) {
      singleLaneUnsupportedAwaitingSpeechDone = true;
      sendRealtimeSessionUpdate(
        oa,
        mergeVoiceInstructionsWithGate(
          baseVoiceInstructions + SINGLE_LANE_SERVER_LOCK_UNSUPPORTED,
          issueGateStatus
        ),
        realtimeVoiceSessionTools()
      );
    } else {
      singleLaneUnsupportedAwaitingSpeechDone = false;
      sendRealtimeSessionUpdate(
        oa,
        mergeVoiceInstructionsWithGate(
          baseVoiceInstructions + SINGLE_LANE_SERVER_LOCK_ALLOWLIST,
          issueGateStatus
        ),
        realtimeVoiceSessionTools()
      );
    }

    if (!assistantResponseOpen) {
      sendResponseCreate(oa, 'single_lane_transcript_deterministic_followup');
    } else {
      logWithBuffer('OPENAI single_lane_transcript_lock_session_only_active_assistant', {
        issueGateStatus,
      });
    }
  }

  function sendInputAudioBufferClear(oa: WebSocket) {
    if (oa.readyState !== WebSocket.OPEN) {
      return;
    }
    oa.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
    logWithBuffer('OPENAI input_audio_buffer.clear sent');
  }

  const REPEAT_BACK_REPROMPT_CAP = 5;

  function maybeSendRepeatBackReprompt(oa: WebSocket, reason: string): void {
    if (!voiceRepeatBackOnly || oa.readyState !== WebSocket.OPEN || closed) {
      return;
    }
    if (assistantResponseOpen) {
      return;
    }
    if (repeatBackRepromptsSent >= REPEAT_BACK_REPROMPT_CAP) {
      logWithBuffer('OPENAI repeat_back_reprompt_cap_reached', { reason, repeatBackRepromptsSent });
      return;
    }
    repeatBackRepromptsSent += 1;
    sendResponseCreate(oa, reason);
  }

  function tryManualWindowCommit(oa: WebSocket) {
    const guard = evaluatePrecommitGuard();
    logWithBuffer('OPENAI manual_turn_precommit_check', {
      precommitOk: guard.ok,
      ...(guard.ok ? guard.snapshot : { ...guard.snapshot, skipReason: guard.reason }),
    });

    if (!guard.ok) {
      console.info(`OPENAI ${guard.reason}`, { ...logBase(), ...guard.snapshot });
      manualTurnWindowOpen = false;
      manualTurnWindowStartedAt = null;
      return;
    }

    logWithBuffer('OPENAI manual_turn_window_committing', {
      reason: 'fixed_window_fallback',
      ...guard.snapshot,
    });

    if (assistantResponseOpen) {
      logWithBuffer('OPENAI manual_turn_commit_aborted_assistant_became_active');
      manualTurnWindowOpen = false;
      manualTurnWindowStartedAt = null;
      return;
    }

    if (awaitingIssueConfirmationReply) {
      if (speechLatchedViaLongAudioBypass) {
        logWithBuffer('OPENAI confirmation_gate_blocked_auto_advance', {
          reason: 'awaiting_confirmation_long_audio_bypass',
          speechDetectedReason,
        });
        resetSpeechLatchAfterSilentVeto();
        clearManualWindowState();
        return;
      }
      if (callerSpeechDetectedSinceLastAssistantDone && !speechLatchedViaEnergy) {
        logWithBuffer('OPENAI confirmation_gate_blocked_auto_advance', {
          reason: 'awaiting_confirmation_no_energy_latch',
          speechDetectedReason,
          speechLatchedViaLongAudioBypass,
        });
        resetSpeechLatchAfterSilentVeto();
        clearManualWindowState();
        return;
      }
    }

    if (
      voiceRepeatBackOnly &&
      callerSpeechDetectedSinceLastAssistantDone &&
      !speechLatchedViaEnergy
    ) {
      logWithBuffer('OPENAI repeat_back_commit_blocked_no_energy_latch', {
        speechDetectedReason,
        speechLatchedViaLongAudioBypass,
        speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
      });
      resetSpeechLatchAfterSilentVeto();
      clearManualWindowState();
      sendInputAudioBufferClear(oa);
      maybeSendRepeatBackReprompt(oa, 'repeat_back_no_energy_latch_reprompt');
      return;
    }

    if (shouldSilentTurnVeto()) {
      const roll = getRollingMeanAndMaxAbs();
      logWithBuffer('OPENAI manual_turn_commit_veto_silent_turn', {
        rollingMeanAbs: Math.round(roll.mean * 100) / 100,
        rollingMaxAbs: Math.round(roll.max * 100) / 100,
        rollingSampleCount: roll.count,
        speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
        speechDetectedReason,
        speechLatchedViaEnergy,
        speechLatchedViaLongAudioBypass,
        awaitingFirstProvenCallerEnergy,
        issueGateStatus,
        silentVetoMaxMean: resolveSilentVetoMaxRollingMeanAbs(),
        silentVetoMaxPeak: resolveSilentVetoMaxRollingPeakAbs(),
        voiceRepeatBackOnly,
      });
      resetSpeechLatchAfterSilentVeto();
      clearManualWindowState();
      if (voiceRepeatBackOnly) {
        sendInputAudioBufferClear(oa);
        maybeSendRepeatBackReprompt(oa, 'repeat_back_silent_veto_reprompt');
      }
      return;
    }

    sendInputAudioBufferCommit(oa);
    awaitingFirstProvenCallerEnergy = false;
    sendResponseCreate(oa, 'fixed_window_fallback');
    manualTurnWindowOpen = false;
    manualTurnWindowStartedAt = null;
  }

  function scheduleManualTurnFallback(oa: WebSocket | null) {
    const windowMs = resolveManualTurnWindowMs();
    if (!oa || oa.readyState !== WebSocket.OPEN || closed || windowMs <= 0) {
      return;
    }
    if (!sessionReady || !initialResponseSent) {
      return;
    }
    if (assistantResponseOpen) {
      return;
    }
    const now = Date.now();
    if (ignoreInboundAudioUntil > 0 && now < ignoreInboundAudioUntil) {
      maybeLogWindowArmSkipped('post_assistant_tail_active');
      return;
    }
    const armMs = resolveWindowArmMinMs();
    const armChunks = resolveWindowArmMinChunks();
    if (armMs > 0 && estimatedCallerAudioMsSinceLastCommit < armMs) {
      maybeLogWindowArmSkipped('insufficient_audio_ms_for_arm');
      return;
    }
    if (armChunks > 0 && callerChunksSinceLastCommit < armChunks) {
      maybeLogWindowArmSkipped('insufficient_chunks_for_arm');
      return;
    }
    if (resolveSpeechMeanAbsThreshold() > 0 && !callerSpeechDetectedSinceLastAssistantDone) {
      tryPromotePersistentInboundSpeech();
    }
    if (resolveSpeechMeanAbsThreshold() > 0 && !callerSpeechDetectedSinceLastAssistantDone) {
      const hardThr = resolveSpeechMeanAbsThreshold();
      maybeLogWindowArmSkipped('manual_window_blocked_caller_speech_not_latched', {
        why_callerSpeech_false: 'integrator_below_latch_and_persistent_rules_failed',
        speechIntegratorAccumMs: Math.round(speechIntegratorAccumMs * 10) / 10,
        speechHighEnergyAccumMs,
        speechLatchIntegratorMs: resolveSpeechLatchIntegratorMs(),
        lastFrameMeanAbs: lastFrameMeanAbs != null ? Math.round(lastFrameMeanAbs * 10) / 10 : null,
        hardThr,
        softThr: resolveSpeechSoftMeanAbsThreshold(hardThr),
        callerAudioSeenSinceLastAssistantDone,
        estimatedCallerAudioMsSinceLastCommit: estimatedCallerAudioMsSinceLastCommit,
        persistentRules: {
          seenNeed: resolveSpeechPersistentSeenFrames(),
          minAudioMs: resolveSpeechPersistentMinAudioMs(),
          minIntegrator: resolveSpeechPersistentMinIntegratorMs(),
          bypassMinAudioMs: resolveSpeechPersistentBypassMinAudioMs(),
          bypassMinFrames: resolveSpeechPersistentBypassMinFrames(),
        },
      });
      return;
    }
    if (manualTurnWindowOpen || manualTurnWindowTimer) {
      return;
    }

    manualTurnWindowOpen = true;
    manualTurnWindowStartedAt = Date.now();
    logWithBuffer('OPENAI manual_turn_window_started', { windowMs });

    manualTurnWindowTimer = setTimeout(() => {
      manualTurnWindowTimer = null;

      if (closed) {
        manualTurnWindowOpen = false;
        manualTurnWindowStartedAt = null;
        return;
      }
      if (!openaiWs || openaiWs !== oa || oa.readyState !== WebSocket.OPEN) {
        manualTurnWindowOpen = false;
        manualTurnWindowStartedAt = null;
        return;
      }

      logWithBuffer('OPENAI manual_turn_window_expired', { windowMs });

      if (assistantResponseOpen) {
        manualTurnWindowOpen = false;
        manualTurnWindowStartedAt = null;
        logWithBuffer('OPENAI manual_turn_window_skipped_assistant_open');
        return;
      }

      const minChunks = resolveManualFallbackMinChunks();
      if (minChunks > 0 && callerChunksSinceLastAssistantDone < minChunks) {
        manualTurnWindowOpen = false;
        manualTurnWindowStartedAt = null;
        logWithBuffer('OPENAI manual_turn_window_skipped_min_chunks', {
          callerChunksSinceLastAssistantDone,
          minChunks,
        });
        return;
      }

      tryManualWindowCommit(oa);
    }, windowMs);
  }

  function maybeSendInitialResponse(oa: WebSocket) {
    if (initialResponseSent || oa.readyState !== WebSocket.OPEN) {
      return;
    }
    initialResponseSent = true;
    sendResponseCreate(oa, 'initial_greeting');
  }

  function flushPendingAudio(oa: WebSocket) {
    while (sessionReady && oa.readyState === WebSocket.OPEN && pendingMulaw.length > 0) {
      tryAppendInboundMulaw(oa, pendingMulaw.shift()!);
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
    tryAppendInboundMulaw(oa, payload);
  }

  function teardown(reason: string, err?: unknown) {
    if (closed) {
      return;
    }
    closed = true;

    clearIssueConfirmationGate();
    clearManualWindowState();

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

        if (isVoiceRepeatBackOnlyMode() && isVoiceSingleLaneKitchenSinkOnlyMode()) {
          console.warn('OPENAI voice_mode_env_conflict_repeat_back_wins', {
            ...logBase(),
            voiceRepeatBackOnlyEnvRaw: getVoiceRepeatBackOnlyEnvRaw(),
            voiceSingleLaneKitchenSinkEnvRaw: getVoiceSingleLaneKitchenSinkEnvRaw(),
          });
        }

        console.info('Twilio↔OpenAI bridge connect', {
          ...logBase(),
          mediaFormat: msg.start?.mediaFormat,
          activeVoiceMode,
          voiceRepeatBackOnly,
          voiceRepeatBackOnlyEnvRaw: getVoiceRepeatBackOnlyEnvRaw(),
          voiceSingleLaneKitchenSinkOnly,
          voiceSingleLaneKitchenSinkForcedByCode: isVoiceSingleLaneKitchenSinkForcedByCode(),
          voiceSingleLaneKitchenSinkEnvRaw: getVoiceSingleLaneKitchenSinkEnvRaw(),
        });

        void (async () => {
          try {
            const config = await getBotClientConfig(parsed.botClientId);
            const instructions = buildVoiceSystemPromptFromBotConfig(config);
            baseVoiceInstructions = instructions;

            const oa = createOpenAIRealtimeSocket({ debug: true });
            openaiWs = oa;

            oa.on('open', () => {
              sessionUpdateSent = true;
              issueGateStatus = 'unknown';
              if (voiceRepeatBackOnly) {
                console.info('OPENAI voice_repeat_back_mode_session', {
                  ...logBase(),
                  voiceRepeatBackOnly: true,
                  voiceRepeatBackOnlyEnvRaw: getVoiceRepeatBackOnlyEnvRaw(),
                  isVoiceRepeatBackOnlyMode: isVoiceRepeatBackOnlyMode(),
                });
                sendRealtimeSessionUpdate(oa, baseVoiceInstructions, undefined, { toolChoiceNone: true });
              } else if (voiceSingleLaneKitchenSinkOnly) {
                console.info('OPENAI voice_single_lane_kitchen_sink_session', {
                  ...logBase(),
                  activeVoiceMode: 'single_lane_kitchen_sink',
                  voiceSingleLaneKitchenSinkOnly: true,
                  voiceSingleLaneKitchenSinkEnvRaw: getVoiceSingleLaneKitchenSinkEnvRaw(),
                  isVoiceSingleLaneKitchenSinkOnlyMode: isVoiceSingleLaneKitchenSinkOnlyMode(),
                });
                sendRealtimeSessionUpdate(
                  oa,
                  mergeVoiceInstructionsWithGate(baseVoiceInstructions, issueGateStatus),
                  realtimeVoiceSessionTools()
                );
              } else {
                sendRealtimeSessionUpdate(
                  oa,
                  mergeVoiceInstructionsWithGate(baseVoiceInstructions, issueGateStatus),
                  realtimeVoiceSessionTools()
                );
              }
              console.info('OpenAI Realtime websocket open (API key)', {
                ...logBase(),
                activeVoiceMode,
                voiceRepeatBackOnly,
                voiceSingleLaneKitchenSinkOnly,
                voiceSingleLaneKitchenSinkForcedByCode: isVoiceSingleLaneKitchenSinkForcedByCode(),
              });
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

                if (j.type === 'conversation.item.input_audio_transcription.completed') {
                  const tr = typeof j.transcript === 'string' ? j.transcript : '';
                  handleSingleLaneInputTranscriptionCompleted(oa, tr);
                  return;
                }

                if (j.type === 'input_audio_buffer.speech_started') {
                  console.info('OPENAI input_audio_buffer.speech_started received', logBase());
                  return;
                }
                if (j.type === 'input_audio_buffer.speech_stopped') {
                  console.info('OPENAI input_audio_buffer.speech_stopped received', logBase());
                  return;
                }
                if (j.type === 'input_audio_buffer.committed') {
                  if (voiceRepeatBackOnly) {
                    repeatBackUserAudioCommittedThisCycle = true;
                  }
                  if (awaitingIssueConfirmationReply) {
                    clearIssueConfirmationWaitTimerOnly();
                    const askedAt = issueConfirmationAskedAt;
                    callerCommitAfterIssueConfirmation = true;
                    awaitingIssueConfirmationReply = false;
                    logWithBuffer('OPENAI confirmation_gate_caller_commit', {
                      issueGateStatus,
                      msSinceConfirmationAsked:
                        askedAt != null ? Date.now() - askedAt : null,
                    });
                  }
                  lastCallerTurnInputCommittedAt = Date.now();
                  console.info('OPENAI input_audio_buffer.committed received', {
                    ...logBase(),
                    ...bufferStateSummary(),
                  });
                  return;
                }

                if (j.type === 'response.created') {
                  commitInFlight = false;
                  console.info('OPENAI response.created received', {
                    ...logBase(),
                    ...bufferStateSummary(),
                    response: j.response,
                  });
                  return;
                }
                if (j.type === 'response.done') {
                  const respObj = j.response as Record<string, unknown> | undefined;
                  /** Completed assistant response — clear before optional chained follow-up. */
                  assistantResponseOpen = false;

                  if (voiceRepeatBackOnly) {
                    const rbCalls = extractFunctionCallsFromResponsePayload(respObj);
                    if (rbCalls.length > 0) {
                      const hasIssueGate = rbCalls.some((c) => c.name === VOICE_ISSUE_GATE_TOOL_NAME);
                      console.error('OPENAI repeat_back_bug_tool_call_attempt', {
                        ...logBase(),
                        functionNames: rbCalls.map((c) => c.name),
                        callIds: rbCalls.map((c) => c.call_id),
                        argumentsPreview: rbCalls.map((c) => c.arguments.slice(0, 200)),
                        voiceIssueGateTransitionAttempt: hasIssueGate,
                      });
                      if (hasIssueGate) {
                        console.error('OPENAI repeat_back_bug_voice_issue_gate_in_response_done', {
                          ...logBase(),
                        });
                      }
                    }
                  }

                  let repeatBackPreResetRoll: { mean: number; max: number; count: number } | null = null;
                  let repeatBackPreResetIntegrator = 0;
                  let repeatBackPreResetSpeechEnergy = false;
                  let repeatBackPreResetReason = speechDetectedReason;
                  let repeatBackPreResetBypass = speechLatchedViaLongAudioBypass;
                  const repeatBackCommittedFlag = repeatBackUserAudioCommittedThisCycle;
                  if (voiceRepeatBackOnly) {
                    repeatBackPreResetRoll = getRollingMeanAndMaxAbs();
                    repeatBackPreResetIntegrator = speechIntegratorAccumMs;
                    repeatBackPreResetSpeechEnergy = speechLatchedViaEnergy;
                  }

                  let issueGateFollowUpCreateSent = false;
                  if (!voiceRepeatBackOnly && oa.readyState === WebSocket.OPEN) {
                    const callsThisResponse = extractFunctionCallsFromResponsePayload(respObj);

                    if (voiceSingleLaneKitchenSinkOnly) {
                      for (const c of callsThisResponse) {
                        if (issueGateFollowUpCreateSent) {
                          break;
                        }
                        if (c.name !== VOICE_KITCHEN_SINK_LANE_CHECK_TOOL_NAME) {
                          continue;
                        }
                        try {
                          const args = JSON.parse(c.arguments) as {
                            verbatim_caller_issue?: string;
                            model_preliminary?: string;
                          };
                          const verbatim =
                            typeof args.verbatim_caller_issue === 'string' ? args.verbatim_caller_issue : '';
                          const preliminary = args.model_preliminary;
                          const transcriptTrim = lastCompletedCallerTranscript.trim();
                          const preferTranscript =
                            transcriptTrim.length > 0 &&
                            lastCompletedCallerTranscriptAt != null &&
                            (lastCallerTurnInputCommittedAt == null ||
                              lastCompletedCallerTranscriptAt >= lastCallerTurnInputCommittedAt - 4000);
                          const textForClassify = preferTranscript ? lastCompletedCallerTranscript : verbatim;
                          const classificationSource = preferTranscript ? 'transcript' : 'tool_verbatim';
                          const normalizedTool = normalizeKitchenSinkLaneText(verbatim);
                          const normalized = normalizeKitchenSinkLaneText(textForClassify);
                          const classification = classifyKitchenSinkLeakLane(textForClassify);

                          if (
                            preferTranscript &&
                            verbatim.trim().length > 0 &&
                            normalizedTool !== normalized
                          ) {
                            console.warn('OPENAI single_lane_transcript_tool_verbatim_divergence', {
                              ...logBase(),
                              verbatim_caller_issue: verbatim,
                              transcriptPreview:
                                lastCompletedCallerTranscript.length > 220
                                  ? `${lastCompletedCallerTranscript.slice(0, 220)}…`
                                  : lastCompletedCallerTranscript,
                              normalized_tool: normalizedTool,
                              normalized_chosen: normalized,
                            });
                          }

                          let classificationMismatchBug = false;
                          if (preliminary === 'allowlisted_guess' && classification.lane === 'unsupported') {
                            classificationMismatchBug = true;
                          }
                          if (preliminary === 'unsupported_guess' && classification.lane === 'allowlisted') {
                            classificationMismatchBug = true;
                          }
                          if (classificationMismatchBug) {
                            console.error('OPENAI single_lane_bug_classification_mismatch', {
                              ...logBase(),
                              model_preliminary: preliminary ?? null,
                              server_lane: classification.lane,
                              verbatim_caller_issue: verbatim,
                            });
                          }
                          if (classification.mappingBug) {
                            console.error('OPENAI single_lane_bug_mapping_allowlist_with_off_lane', {
                              ...logBase(),
                              verbatim_caller_issue: verbatim,
                              text_used_for_classification: textForClassify,
                              classification_source: classificationSource,
                              normalized_issue: normalized,
                              matched_pattern_id: classification.matchedPatternId ?? null,
                              off_lane_hits: classification.offLaneHits,
                            });
                          }

                          const rejectedUnsupported = classification.lane === 'unsupported';

                          console.info('OPENAI voice_kitchen_sink_lane_check', {
                            ...logBase(),
                            activeVoiceMode,
                            classification_source: classificationSource,
                            singleLaneKitchenSinkIntentMatched: classification.lane === 'allowlisted',
                            normalizedSingleLaneIssue: classification.canonicalIssue,
                            singleLaneUnsupportedReason: classification.unsupportedReason ?? null,
                            verbatim_caller_issue: verbatim,
                            text_used_for_classification: textForClassify,
                            normalized_issue: normalized,
                            server_lane: classification.lane,
                            matched_pattern_id: classification.matchedPatternId ?? null,
                            off_lane_hits: classification.offLaneHits,
                            model_preliminary: preliminary ?? null,
                            rejected_unsupported: rejectedUnsupported,
                            classification_mismatch_bug: classificationMismatchBug,
                            mapping_bug: classification.mappingBug,
                          });

                          const outputPayload = {
                            ok: true,
                            server_lane: classification.lane,
                            matched_pattern_id: classification.matchedPatternId ?? null,
                            canonical_issue_text: classification.canonicalIssue,
                            say_rejection_and_end: rejectedUnsupported,
                            normalized_issue: normalized,
                            rejected_unsupported: rejectedUnsupported,
                            single_lane_unsupported_reason: classification.unsupportedReason ?? null,
                          };

                          oa.send(
                            JSON.stringify({
                              type: 'conversation.item.create',
                              item: {
                                type: 'function_call_output',
                                call_id: c.call_id,
                                output: JSON.stringify(outputPayload),
                              },
                            })
                          );

                          if (rejectedUnsupported) {
                            singleLaneUnsupportedAwaitingSpeechDone = true;
                            sendRealtimeSessionUpdate(
                              oa,
                              mergeVoiceInstructionsWithGate(
                                baseVoiceInstructions + SINGLE_LANE_SERVER_LOCK_UNSUPPORTED,
                                issueGateStatus
                              ),
                              realtimeVoiceSessionTools()
                            );
                          } else {
                            singleLaneUnsupportedAwaitingSpeechDone = false;
                            sendRealtimeSessionUpdate(
                              oa,
                              mergeVoiceInstructionsWithGate(
                                baseVoiceInstructions + SINGLE_LANE_SERVER_LOCK_ALLOWLIST,
                                issueGateStatus
                              ),
                              realtimeVoiceSessionTools()
                            );
                          }

                          sendResponseCreate(oa, 'voice_kitchen_sink_lane_followup');
                          issueGateFollowUpCreateSent = true;
                        } catch (err) {
                          console.warn('OPENAI voice_kitchen_sink_lane_check_parse_error', {
                            ...logBase(),
                            err,
                            argsPreview: c.arguments.slice(0, 500),
                          });
                        }
                      }
                    }

                    if (!issueGateFollowUpCreateSent) {
                      for (const c of callsThisResponse) {
                        if (issueGateFollowUpCreateSent) {
                          break;
                        }
                        if (c.name !== VOICE_ISSUE_GATE_TOOL_NAME) {
                          continue;
                        }
                        try {
                          const args = JSON.parse(c.arguments) as {
                            status?: string;
                            issue_summary_text?: string;
                          };
                          if (args.status && isVoiceIssueGateStatus(args.status)) {
                            const previousIssueGateStatus = issueGateStatus;
                            const firstIssueCapture =
                              previousIssueGateStatus === 'unknown' &&
                              args.status === 'captured_unconfirmed';
                            if (!assignIssueGateStatusFromTool(args.status)) {
                              continue;
                            }
                            sendRealtimeSessionUpdate(
                              oa,
                              mergeVoiceInstructionsWithGate(baseVoiceInstructions, issueGateStatus),
                              realtimeVoiceSessionTools()
                            );
                            console.info('OPENAI voice_issue_gate_transition', {
                              ...logBase(),
                              previousIssueGateStatus,
                              issueGateStatus,
                              firstIssueCapture,
                              issue_summary_text: args.issue_summary_text,
                              issue_capture_source_note:
                                'Server has no ASR; treat issue_summary_text as model claim — for first capture, expect literal caller tokens only (see prompt).',
                              first_issue_capture_expect_literal: firstIssueCapture,
                            });
                            oa.send(
                              JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                  type: 'function_call_output',
                                  call_id: c.call_id,
                                  output: JSON.stringify({
                                    ok: true,
                                    recorded_status: issueGateStatus,
                                  }),
                                },
                              })
                            );
                            sendResponseCreate(oa, 'voice_issue_gate_tool_followup');
                            issueGateFollowUpCreateSent = true;
                            if (isIssueConfirmationAskGateStatus(issueGateStatus)) {
                              armIssueConfirmationGate(oa);
                            }
                          }
                        } catch (err) {
                          console.warn('OPENAI voice_issue_gate_parse_error', {
                            ...logBase(),
                            err,
                            argsPreview: c.arguments.slice(0, 500),
                          });
                        }
                      }
                    }
                  }

                  clearManualWindowState();
                  commitInFlight = false;

                  if (!issueGateFollowUpCreateSent) {
                    if (!completedFirstAssistantIdleResponseDone) {
                      completedFirstAssistantIdleResponseDone = true;
                      awaitingFirstProvenCallerEnergy = true;
                    }
                    callerChunksSinceLastAssistantDone = 0;
                    resetCommitCountersAfterAssistantDone();
                    const tailMs = resolvePostAssistantIgnoreMs();
                    ignoreInboundAudioUntil = tailMs > 0 ? Date.now() + tailMs : 0;
                    suppressedWhileAssistantFrames = 0;
                    logWithBuffer('OPENAI assistant_done_ready_for_caller');
                  } else {
                    logWithBuffer('OPENAI assistant_done_issue_gate_followup_pending', {
                      issueGateStatus,
                    });
                  }

                  console.info('OPENAI response.done received', {
                    ...logBase(),
                    ...bufferStateSummary(),
                    response: j.response,
                    issueGateFollowUpCreateSent,
                  });

                  if (voiceSingleLaneKitchenSinkOnly && singleLaneUnsupportedAwaitingSpeechDone) {
                    const callsForHangup = extractFunctionCallsFromResponsePayload(respObj);
                    const laneInThisResponse = callsForHangup.some(
                      (c) => c.name === VOICE_KITCHEN_SINK_LANE_CHECK_TOOL_NAME
                    );
                    if (!laneInThisResponse) {
                      singleLaneUnsupportedAwaitingSpeechDone = false;
                      const assistantTextForHangup = extractAssistantOutputTextFromResponse(respObj);
                      const lower = assistantTextForHangup.toLowerCase();
                      if (
                        lower.includes('kitchen sink') &&
                        (/\bright\b/.test(lower) ||
                          lower.includes('confirm') ||
                          lower.includes('is that'))
                      ) {
                        console.error('OPENAI single_lane_bug_post_reject_kitchen_sink_narrative', {
                          ...logBase(),
                          assistantOutputText: assistantTextForHangup,
                        });
                      }
                      const sid = bridgeParams?.callSid;
                      if (sid) {
                        void completeTwilioCall(sid, logBase()).finally(() => {
                          teardown('single_lane_unsupported');
                        });
                      } else {
                        teardown('single_lane_unsupported_no_call_sid');
                      }
                    }
                  }

                  if (voiceSingleLaneKitchenSinkOnly) {
                    const assistantOut = extractAssistantOutputTextFromResponse(respObj);
                    if (assistantOut) {
                      const canonRe =
                        /just\s+to\s+confirm,?\s+you\s+have\s+a\s+kitchen\s+sink\s+leak\.?\s+is\s+that\s+right\??/i;
                      if (canonRe.test(assistantOut)) {
                        logWithBuffer('OPENAI single_lane_canonical_confirmation_sent', {
                          issueGateStatus,
                          singleLaneCanonicalConfirmationSent: true,
                        });
                      }
                    }
                  }

                  if (voiceRepeatBackOnly) {
                    if (issueGateStatus !== 'unknown') {
                      console.error('OPENAI repeat_back_bug_issue_gate_status_not_unknown', {
                        ...logBase(),
                        issueGateStatus,
                      });
                    }
                    const assistantText = extractAssistantOutputTextFromResponse(respObj);
                    logWithBuffer('OPENAI repeat_back_assistant_turn', {
                      issueGateStatus,
                      assistantOutputText: assistantText,
                      userAudioCommittedThisCycle: repeatBackCommittedFlag,
                      speechLatchedViaEnergy: repeatBackPreResetSpeechEnergy,
                      speechLatchedViaLongAudioBypass: repeatBackPreResetBypass,
                      speechDetectedReason: repeatBackPreResetReason,
                      speechIntegratorAccumMsPreReset: Math.round(repeatBackPreResetIntegrator * 10) / 10,
                      rollingMeanAbs:
                        repeatBackPreResetRoll != null
                          ? Math.round(repeatBackPreResetRoll.mean * 100) / 100
                          : null,
                      rollingMaxAbs:
                        repeatBackPreResetRoll != null
                          ? Math.round(repeatBackPreResetRoll.max * 100) / 100
                          : null,
                      rollingSampleCount: repeatBackPreResetRoll?.count ?? 0,
                    });
                    repeatBackUserAudioCommittedThisCycle = false;
                  }
                  return;
                }

                const delta = extractAudioDelta(j);
                if (delta && streamSid) {
                  const mulawB64 = openAiAudioDeltaToTwilioMulawBase64(delta);
                  if (mulawB64) {
                    sendTwilioMedia(twilioWs, streamSid, mulawB64, markSeq);
                  }
                  return;
                }

                if (j.type === 'error') {
                  const errPayload = j.error;
                  if (isNonFatalConversationStateError(errPayload) || isNonFatalConversationStateError(j)) {
                    logWithBuffer('OPENAI error_nonfatal_conversation_state', { error: errPayload });
                    return;
                  }
                  if (isCommitEmptyError(errPayload) || isCommitEmptyError(j)) {
                    emptyCommitErrorCount += 1;
                    commitInFlight = false;
                    clearManualWindowState();
                    callerChunksSinceLastCommit = 0;
                    estimatedCallerAudioMsSinceLastCommit = 0;
                    callerAudioAppendedSinceLastCommit = false;
                    lastAppendAt = null;
                    lastProgressLogTier = 0;
                    loggedAppendAllowedThisCallerTurn = false;
                    callerAudioSeenSinceLastAssistantDone = 0;
                    callerSpeechDetectedSinceLastAssistantDone = false;
                    speechIntegratorAccumMs = 0;
                    speechHighEnergyAccumMs = 0;
                    loggedSpeechDetectedThisTurn = false;
                    lastFrameMeanAbs = null;
                    speechDetectedReason = null;
                    speechLatchedViaEnergy = false;
                    speechLatchedViaLongAudioBypass = false;
                    framesVoicedAboveFloor = 0;
                    meanAbsRing = [];
                    lastSpeechEnergyDebugAt = 0;

                    console.warn('OPENAI error input_audio_buffer_commit_empty', {
                      ...logBase(),
                      ...bufferStateSummary(),
                      error: errPayload,
                    });
                    logWithBuffer('OPENAI teardown_suppressed_empty_commit');
                    return;
                  }
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
        twilioInboundFrames += 1;
        console.info(`TWILIO inbound media frame #${twilioInboundFrames}`, logBase());
        enqueueOrAppendMulaw(openaiWs, msg.media.payload);
        if (sessionReady && openaiWs) {
          flushPendingAudio(openaiWs);
          scheduleManualTurnFallback(openaiWs);
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
