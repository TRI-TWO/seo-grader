import { getBotClientConfig } from '@/lib/bot/getBotClientConfig';
import { buildVoiceSystemPromptFromBotConfig } from '@/lib/bot/buildVoiceSystemPrompt';

export type BotVoicePromptInspectResult = {
  botClientId: string;
  businessName: string;
  tradeType: string;
  promptVersion: string;
  prompt: string;
};

/**
 * Loads bot client config and builds the final OpenAI Realtime `instructions` string (no API calls).
 */
export async function buildVoicePromptInspectResult(
  botClientId: string
): Promise<BotVoicePromptInspectResult> {
  const trimmedId = botClientId.trim();
  if (!trimmedId) {
    throw new Error('botClientId is required');
  }

  const config = await getBotClientConfig(trimmedId);
  const prompt = buildVoiceSystemPromptFromBotConfig(config);

  return {
    botClientId: trimmedId,
    businessName: config.businessName,
    tradeType: config.tradeType,
    promptVersion: config.promptVersion,
    prompt,
  };
}
