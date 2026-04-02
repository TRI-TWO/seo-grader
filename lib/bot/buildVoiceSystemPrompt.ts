import { buildPlumbingInboundSystemPrompt } from '@/lib/bot/prompts/plumbingInboundSystemPrompt';
import { toPlumbingInboundPromptConfig, type BotVoiceClientConfig } from '@/lib/bot/getBotClientConfig';

/**
 * Builds the OpenAI Realtime `instructions` string for a bot client row.
 * Uses the V1 inbound intake prompt, parameterized by {@link BotVoiceClientConfig.tradeType}.
 */
export function buildVoiceSystemPromptFromBotConfig(config: BotVoiceClientConfig): string {
  return buildPlumbingInboundSystemPrompt(toPlumbingInboundPromptConfig(config));
}
