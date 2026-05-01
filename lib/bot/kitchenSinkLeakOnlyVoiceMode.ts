/**
 * Hard test path: deterministic kitchen-sink-leak intake only.
 * When active (default), replaces full plumbing and legacy single-lane env tools in voice wiring.
 * `VOICE_REPEAT_BACK_ONLY` still wins for diagnostics.
 *
 * Disable broad plumbing voice: set `VOICE_MODE_KITCHEN_SINK_LEAK_ONLY=false` in env, or flip default below.
 */

export const VOICE_MODE_KITCHEN_SINK_LEAK_ONLY_DEFAULT = true;

export type KitchenSinkLeakOnlyActiveTestMode =
  | 'kitchen_sink_leak_only'
  | 'plumbing_intake'
  | 'painting_intake';

export function getVoiceModeKitchenSinkLeakOnlyEnvRaw(): string {
  return process.env.VOICE_MODE_KITCHEN_SINK_LEAK_ONLY?.trim() ?? '';
}

function envEnablesKitchenSinkLeakOnly(): boolean {
  const raw = getVoiceModeKitchenSinkLeakOnlyEnvRaw().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

function envDisablesKitchenSinkLeakOnly(): boolean {
  const raw = getVoiceModeKitchenSinkLeakOnlyEnvRaw().toLowerCase();
  return raw === '0' || raw === 'false' || raw === 'no';
}

/**
 * Env `VOICE_MODE_KITCHEN_SINK_LEAK_ONLY` overrides default when set.
 * If unset, `VOICE_MODE_KITCHEN_SINK_LEAK_ONLY_DEFAULT` applies.
 */
export function isVoiceKitchenSinkLeakOnlyMode(): boolean {
  const raw = getVoiceModeKitchenSinkLeakOnlyEnvRaw();
  if (raw.length > 0) {
    if (envDisablesKitchenSinkLeakOnly()) {
      return false;
    }
    if (envEnablesKitchenSinkLeakOnly()) {
      return true;
    }
  }
  return VOICE_MODE_KITCHEN_SINK_LEAK_ONLY_DEFAULT;
}

export function getKitchenSinkLeakOnlyActiveTestMode(): KitchenSinkLeakOnlyActiveTestMode {
  const raw = process.env.VOICE_KITCHEN_SINK_TEST_MODE?.trim().toLowerCase() ?? '';
  if (raw === 'painting_intake' || raw === 'paint_intake' || raw === 'painting') {
    return 'painting_intake';
  }
  if (raw === 'kitchen_sink_leak_only' || raw === 'kitchen_sink') {
    return 'kitchen_sink_leak_only';
  }
  return 'plumbing_intake';
}
