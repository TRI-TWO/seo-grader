/**
 * Realtime tool: server-authoritative kitchen sink single-lane check.
 */

export const VOICE_KITCHEN_SINK_LANE_CHECK_TOOL_NAME = 'voice_kitchen_sink_lane_check';

export type KitchenSinkLaneModelPreliminary = 'allowlisted_guess' | 'unsupported_guess' | 'unclear';

export function buildVoiceKitchenSinkLaneCheckTool(): Record<string, unknown> {
  return {
    type: 'function',
    name: VOICE_KITCHEN_SINK_LANE_CHECK_TOOL_NAME,
    description:
      'Required on the first turn where the caller describes a problem (after greeting). Call before speaking about their issue. ' +
      'Pass verbatim_caller_issue as close as possible to their words (no category labels). ' +
      'Server returns server_lane, canonical_issue_text (kitchen sink leak if allowlisted), or single_lane_unsupported_reason. ' +
      'Do not paraphrase into another room or fixture — obey the tool output and SERVER_* instructions. ' +
      'model_preliminary is diagnostic only.',
    parameters: {
      type: 'object',
      properties: {
        verbatim_caller_issue: {
          type: 'string',
          description: "What the caller said about the problem, as verbatim as possible.",
        },
        model_preliminary: {
          type: 'string',
          enum: ['allowlisted_guess', 'unsupported_guess', 'unclear'],
          description: 'Your guess for logging only — server does not use this for gating.',
        },
      },
      required: ['verbatim_caller_issue'],
    },
  };
}
