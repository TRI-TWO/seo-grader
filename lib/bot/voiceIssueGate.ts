/**
 * Thin server-side issue gate for Realtime voice: tool + instruction appendix.
 * States: unknown → captured_unconfirmed | correction_lock → corrected_pending_confirmation → confirmed.
 */

export type VoiceIssueGateStatus =
  | 'unknown'
  | 'correction_lock'
  | 'captured_unconfirmed'
  | 'corrected_pending_confirmation'
  | 'confirmed';

export const VOICE_ISSUE_GATE_TOOL_NAME = 'voice_issue_gate_transition';

export function isVoiceIssueGateStatus(s: string): s is VoiceIssueGateStatus {
  return (
    s === 'unknown' ||
    s === 'correction_lock' ||
    s === 'captured_unconfirmed' ||
    s === 'corrected_pending_confirmation' ||
    s === 'confirmed'
  );
}

/** OpenAI Realtime session tool definition (function). */
export function buildVoiceIssueGateTool(): Record<string, unknown> {
  return {
    type: 'function',
    name: VOICE_ISSUE_GATE_TOOL_NAME,
    description:
      'Required when the issue gate changes. captured_unconfirmed: after restate + one confirm question. correction_lock: caller rejected summary without full redescription that turn — apologize, ask issue again in their words only; do not guess. corrected_pending_confirmation: they gave correction; restate ONLY their words + one confirm. confirmed: clear yes. unknown: reset if needed. issue_summary_text when you have a candidate line.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: [
            'unknown',
            'correction_lock',
            'captured_unconfirmed',
            'corrected_pending_confirmation',
            'confirmed',
          ],
        },
        issue_summary_text: {
          type: 'string',
          description: 'Latest one-line summary using caller wording where possible.',
        },
      },
      required: ['status'],
    },
  };
}

/** Authoritative block appended to base voice instructions. */
export function buildVoiceIssueGateServerAppendix(status: VoiceIssueGateStatus): string {
  const header = '\n\n## SERVER_ORCHESTRATION (authoritative — wins on conflict)\n';
  if (status === 'confirmed') {
    return (
      header +
      'Issue gate: **confirmed**. Proceed with main flow: urgency tied to confirmed issue, then contact, address if needed, timing, closeout.\n'
    );
  }
  if (status === 'correction_lock') {
    return (
      header +
      '**CORRECTION LOCK** — issue confirmation was **rejected**. Prior interpreted issue, location, and fixture guesses are **stale — discard them**. Do NOT freehand a replacement issue (no new room/appliance/fixture unless the caller literally said it this turn).\n' +
      'Allowed: **one or two short sentences** total — brief apology (prefer "Sorry about that"), then ask them to **describe the issue again in their own words**, **or** if they already gave a full correction in **this** utterance, repeat back **only** their words + one "Did I get that right?"\n' +
      'Forbidden: urgency, contact, address, timing, budget, estimates, closeout, scope jumps, or any second question in the same turn.\n' +
      '**End the turn completely** after that single question or invitation — no trailing sentences. Wait for caller audio before any next step.\n'
    );
  }
  if (status === 'unknown') {
    return (
      header +
      'Issue gate: **unknown** — no issue has been captured or confirmed on this call yet.\n' +
      'Until the caller **clearly describes** a concrete service problem **in their own words**, you may **only**: the opening greeting and/or a short reprompt (e.g. how you can help). **Forbidden**: “Understood — …” with a specific issue, naming fixtures or rooms they did not say, or calling **voice_issue_gate_transition** with **captured_unconfirmed** (or any non-unknown status) until they have actually stated what is wrong.\n' +
      'Do not treat silence or minimal audio as a described issue; wait for substantive caller content.\n'
    );
  }
  return (
    header +
    `Issue gate status: **${status}**.\n` +
    'Until **confirmed**: no urgency, service street address, contact, phone, timing/start date, estimates, project acceptance, or closeout.\n' +
    'Treat issue capture and triage as **separate** — no mixing urgency or contact with an unconfirmed issue.\n' +
    'Do not **guess** a replacement after rejection; use **correction_lock** until fresh words, then one literal or contrastive restate + one confirm only.\n' +
    'After **any** confirmation question, **stop speaking** — one or two sentences max. Never combine issue confirmation with the next intake question. Progress only after caller response (or one silence reprompt if the product allows).\n'
  );
}

export function mergeVoiceInstructionsWithGate(
  baseInstructions: string,
  status: VoiceIssueGateStatus
): string {
  return baseInstructions + buildVoiceIssueGateServerAppendix(status);
}

export type ParsedFunctionCall = {
  name: string;
  call_id: string;
  arguments: string;
};

export function extractFunctionCallsFromResponsePayload(
  response: Record<string, unknown> | undefined
): ParsedFunctionCall[] {
  if (!response || typeof response !== 'object') {
    return [];
  }
  const output = response.output;
  if (!Array.isArray(output)) {
    return [];
  }
  const out: ParsedFunctionCall[] = [];
  for (const item of output as Record<string, unknown>[]) {
    if (
      item.type === 'function_call' &&
      typeof item.name === 'string' &&
      typeof item.call_id === 'string' &&
      typeof item.arguments === 'string'
    ) {
      out.push({ name: item.name, call_id: item.call_id, arguments: item.arguments });
    }
  }
  return out;
}
