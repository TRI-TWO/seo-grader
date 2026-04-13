import { buildPlumbingInboundSystemPrompt } from '@/lib/bot/prompts/plumbingInboundSystemPrompt';
import { toPlumbingInboundPromptConfig, type BotVoiceClientConfig } from '@/lib/bot/getBotClientConfig';
import {
  buildRepeatBackOnlySystemInstructions,
  isVoiceRepeatBackOnlyMode,
} from '@/lib/bot/voiceRepeatBackMode';
import {
  botConfigToSingleLaneKitchenSinkParams,
  buildSingleLaneKitchenSinkSystemInstructions,
  isVoiceSingleLaneKitchenSinkOnlyMode,
} from '@/lib/bot/voiceSingleLaneKitchenSinkMode';
import { isVoiceKitchenSinkLeakOnlyMode } from '@/lib/bot/kitchenSinkLeakOnlyVoiceMode';

const KITCHEN_SINK_ONLY_HTTP_SESSION_STUB =
  'Voice mode: kitchen sink leak only. A Twilio WebSocket bridge drives the call with single-sentence SAY_THIS lines. ' +
  'Do not improvise. Issue triage is not lead completion: never promise scheduling, booking, or that intake is finished until the server sends the final recap line. ' +
  'This stub satisfies HTTP session create; live media sessions must use bridge session updates only.';

/**
 * Builds the OpenAI Realtime `instructions` string for a bot client row.
 * Uses the V1 inbound intake prompt, parameterized by {@link BotVoiceClientConfig.tradeType}.
 * When `VOICE_REPEAT_BACK_ONLY=true`, returns a minimal repeat-back diagnostic prompt instead.
 * When `VOICE_MODE_KITCHEN_SINK_LEAK_ONLY` is active (and repeat-back is off), returns a minimal stub.
 * When `VOICE_SINGLE_LANE_KITCHEN_SINK_ONLY=true` (and repeat-back is off), returns single-lane kitchen sink instructions.
 */
export function buildVoiceSystemPromptFromBotConfig(config: BotVoiceClientConfig): string {
  if (isVoiceRepeatBackOnlyMode()) {
    return buildRepeatBackOnlySystemInstructions();
  }
  if (isVoiceKitchenSinkLeakOnlyMode()) {
    return KITCHEN_SINK_ONLY_HTTP_SESSION_STUB;
  }
  if (isVoiceSingleLaneKitchenSinkOnlyMode()) {
    return buildSingleLaneKitchenSinkSystemInstructions(botConfigToSingleLaneKitchenSinkParams(config));
  }
  return buildPlumbingInboundSystemPrompt(toPlumbingInboundPromptConfig(config));
}
