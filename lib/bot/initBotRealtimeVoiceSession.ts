import { getBotClientConfig } from '@/lib/bot/getBotClientConfig';
import { buildVoiceSystemPromptFromBotConfig } from '@/lib/bot/buildVoiceSystemPrompt';
import {
  createOpenAIRealtimeVoiceSession,
  type OpenAIRealtimeSessionPayload,
} from '@/lib/bot/openaiRealtimeSession';

export type BotRealtimeVoiceSessionInitResult = {
  botClientId: string;
  businessName: string;
  promptVersion: string;
  tradeType: string;
  session: OpenAIRealtimeSessionPayload;
};

/**
 * Loads bot config, builds voice instructions, and creates an OpenAI Realtime session (ephemeral credentials).
 * Shared by `/api/bot/voice/realtime-session` and Twilio inbound voice.
 */
export async function initBotRealtimeVoiceSession(
  botClientId: string
): Promise<BotRealtimeVoiceSessionInitResult> {
  const trimmed = botClientId.trim();
  if (!trimmed) {
    throw new Error('botClientId is required');
  }

  const botConfig = await getBotClientConfig(trimmed);
  const instructions = buildVoiceSystemPromptFromBotConfig(botConfig);
  const session = await createOpenAIRealtimeVoiceSession({ instructions });

  return {
    botClientId: trimmed,
    businessName: botConfig.businessName,
    promptVersion: botConfig.promptVersion,
    tradeType: botConfig.tradeType,
    session,
  };
}
