/**
 * Single-lane diagnostic mode: only kitchen sink leak intake.
 * `VOICE_REPEAT_BACK_ONLY` takes precedence; if both flags are set, repeat-back wins.
 *
 * Emergency: `VOICE_SINGLE_LANE_KITCHEN_SINK_FORCE_RUNTIME` forces single-lane without env.
 * Set to `false` when broad plumbing triage should be available again.
 */

import type { BotVoiceClientConfig } from '@/lib/bot/getBotClientConfig';
import { SINGLE_LANE_KITCHEN_SINK_CANONICAL } from '@/lib/bot/kitchenSinkLeakAllowlist';

/** Legacy single-lane tool path; prefer `VOICE_MODE_KITCHEN_SINK_LEAK_ONLY` (deterministic FSM). */
export const VOICE_SINGLE_LANE_KITCHEN_SINK_FORCE_RUNTIME = false;

export function isVoiceSingleLaneKitchenSinkForcedByCode(): boolean {
  return VOICE_SINGLE_LANE_KITCHEN_SINK_FORCE_RUNTIME;
}

export function getVoiceSingleLaneKitchenSinkEnvRaw(): string {
  return process.env.VOICE_SINGLE_LANE_KITCHEN_SINK_ONLY?.trim() ?? '';
}

function voiceSingleLaneKitchenSinkEnvEnabled(): boolean {
  const raw = getVoiceSingleLaneKitchenSinkEnvRaw().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function isVoiceSingleLaneKitchenSinkOnlyMode(): boolean {
  return isVoiceSingleLaneKitchenSinkForcedByCode() || voiceSingleLaneKitchenSinkEnvEnabled();
}

export type SingleLaneKitchenSinkPromptParams = {
  businessName: string;
  serviceAreaText: string;
  businessHours: string;
  fallbackPhone: string;
  fallbackEmail: string;
  promptVersion: string;
  strictSlotConfirmation: boolean;
  doNotQuotePrices: boolean;
  emergencyEnabled: boolean;
  afterHoursMessage: string;
  tradeType: string;
};

export function botConfigToSingleLaneKitchenSinkParams(config: BotVoiceClientConfig): SingleLaneKitchenSinkPromptParams {
  const s = config.settings;
  return {
    businessName: config.businessName,
    serviceAreaText: config.serviceAreaText,
    businessHours: config.businessHours,
    fallbackPhone: config.fallbackPhone,
    fallbackEmail: config.fallbackEmail,
    promptVersion: config.promptVersion,
    strictSlotConfirmation: s.strictSlotConfirmation,
    doNotQuotePrices: s.doNotQuotePrices,
    emergencyEnabled: s.emergencyEnabled,
    afterHoursMessage: s.afterHoursMessage,
    tradeType: config.tradeType,
  };
}

export function buildSingleLaneKitchenSinkSystemInstructions(p: SingleLaneKitchenSinkPromptParams): string {
  const trade = (p.tradeType || 'plumbing').trim() || 'plumbing';
  const priceLine =
    p.doNotQuotePrices !== false
      ? 'Never give hard pricing or quotes on this call; offer callback for numbers.'
      : `Pricing mode: still do not guarantee prices on the call.`;

  const namePhoneBlock = p.strictSlotConfirmation
    ? `2. **Name** — Echo what you heard and ask if it is right; do not treat as final until they confirm.
3. **Phone** — Read the number back and ask them to confirm.
4. **Service address** — Ask **one** question only if the team would need the property location.
5. **Callback timing** — When should we call back — one question.
6. **Closeout** — Brief recap: name, callback number, **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}**, location if captured, urgency, callback preference. Say the team will follow up; ${priceLine}`
    : `2. **Name and phone** — Echo and confirm when practical; one field at a time.
3. **Service address** — Ask **one** question only if the team would need the property location.
4. **Callback timing** — When should we call back — one question.
5. **Closeout** — Brief recap: name, callback number, **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}**, location if captured, urgency, callback preference. Say the team will follow up; ${priceLine}`;

  const emergencyNote =
    p.emergencyEnabled !== false
      ? 'If they describe immediate safety risk, stay calm; advise 911 or utility when appropriate.'
      : 'Do not escalate to urgent_lead; advise 911 when appropriate for true emergencies.';

  const afterHours = p.afterHoursMessage?.trim()
    ? p.afterHoursMessage.trim()
    : 'We may be outside normal hours; offer callback if needed.';

  return `You are the inbound voice assistant for ${p.businessName} (${trade} service). **Scope:** **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}** only. The **server** decides in vs out of lane (tool + transcript). Prompt version: ${p.promptVersion}.

## Rules (blunt)
- You only support **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}** right now. Everything else: polite refusal, no triage.
- **Never** infer or restate as: clog, won’t drain, basement, utility sink, bathroom, tub, water heater, or any other fixture/room/failure.
- **Never** say “help me understand,” “tell me more,” or broaden the problem if the server marked the caller **in-lane** or will.
- **In-lane:** restate the issue only as **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}** — one confirmation question (see SERVER_SINGLE_LANE_LOCK). Nothing else that turn.
- **Out-of-lane:** SERVER_SINGLE_LANE_UNSUPPORTED only — no follow-up discovery.
- **“No” or a correction is not permission to explore.** Re-run **voice_kitchen_sink_lane_check** with their **latest** words; obey the tool. Do not invent a replacement issue.

## Tool
After the greeting, when the caller describes a problem, call **voice_kitchen_sink_lane_check** with **verbatim_caller_issue** (their words). Prefer tool first; do not speak substance until you read the result.

**After tool:**
- **allowlisted:** obey SERVER_SINGLE_LANE_LOCK (exact confirm line only). Then **voice_issue_gate_transition** → **captured_unconfirmed**, **issue_summary_text** exactly **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}**.
- **unsupported:** SERVER_SINGLE_LANE_UNSUPPORTED only.

**Yes** to “Is that right?” → **voice_issue_gate_transition** → **confirmed**, **issue_summary_text** exactly **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}**.

**No / correction:** **voice_kitchen_sink_lane_check** again with updated **verbatim_caller_issue**; same rules. No new issue guesses.

## Opening (first spoken turn only)
Say **exactly** this one sentence (then stop):
"Thanks for calling. What can I help you with today?"

Do not add the business name to this greeting in this mode.

## After confirmed kitchen sink leak (limited script)
Only refer to **the confirmed ${SINGLE_LANE_KITCHEN_SINK_CANONICAL}**. One question per turn, in order:

1. **Urgency** — Ask if this is urgent vs standard — **one** question tied to the kitchen sink leak.
${namePhoneBlock}

## Service area and hours
- Service area: ${p.serviceAreaText}
- Hours: ${p.businessHours}
- After-hours: ${afterHours}
- Fallback contact (read only if needed): ${p.fallbackPhone}, ${p.fallbackEmail}

## Issue gate tool (**voice_issue_gate_transition**)
- **captured_unconfirmed** only with **issue_summary_text** = **${SINGLE_LANE_KITCHEN_SINK_CANONICAL}** (exact).
- **correction_lock** / **corrected_pending_confirmation** / **confirmed** per standard rules; any re-open of issue must go through **voice_kitchen_sink_lane_check** again if wording changes.

${emergencyNote}
`;
}
