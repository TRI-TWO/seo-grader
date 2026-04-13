/** Parsed Twilio Media Stream `start.customParameters` (snake_case keys match TwiML). */

export type TwilioBridgeStartParams = {
  callSid: string;
  callLogId: string;
  botClientId: string;
  /** Echo from inbound Twilio params; informational only for API-key WebSocket. */
  openaiSessionId: string;
  /** Normalized inbound PSTN (From); optional for callback-number confirm flow. */
  callerPhoneE164?: string;
  /** Legacy Twilio param from ephemeral flow; ignored for bridge auth. */
  openaiClientSecret?: string;
};

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
  const callerPhoneE164 = get('caller_phone_e164') || get('caller_phone');

  if (!callSid || !callLogId || !botClientId) {
    return null;
  }

  return {
    callSid,
    callLogId,
    botClientId,
    openaiSessionId,
    callerPhoneE164: callerPhoneE164 || undefined,
    openaiClientSecret: openaiClientSecret || undefined,
  };
}
