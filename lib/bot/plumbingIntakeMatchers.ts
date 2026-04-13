/**
 * First-pass plumbing issue router for voice intake (shared address/callback path).
 * Kitchen-sink leak keeps detailed triage via {@link matchKitchenSinkLeakIssue}.
 */

import {
  KITCHEN_SINK_LEAK_NORMALIZED,
  matchKitchenSinkLeakIssue,
  normalizeUtterance,
} from '@/lib/bot/kitchenSinkLeakOnlyMatchers';

export const TOILET_ISSUE = 'toilet_issue' as const;
export const DRAIN_CLOG_ISSUE = 'drain_clog' as const;
export const FAUCET_ISSUE = 'faucet_issue' as const;
export const WATER_HEATER_LEAK_ISSUE = 'water_heater_leak' as const;
export const WATER_HEATER_SERVICE_ISSUE = 'water_heater_service' as const;
export const GARBAGE_DISPOSAL_ISSUE = 'garbage_disposal_issue' as const;
export const SEWER_DRAIN_LINE_ISSUE = 'sewer_drain_line_issue' as const;
export const EMERGENCY_PLUMBING_ISSUE = 'emergency_plumbing' as const;

export type PlumbingIntakeIssue =
  | typeof KITCHEN_SINK_LEAK_NORMALIZED
  | typeof TOILET_ISSUE
  | typeof DRAIN_CLOG_ISSUE
  | typeof FAUCET_ISSUE
  | typeof WATER_HEATER_LEAK_ISSUE
  | typeof WATER_HEATER_SERVICE_ISSUE
  | typeof GARBAGE_DISPOSAL_ISSUE
  | typeof SEWER_DRAIN_LINE_ISSUE
  | typeof EMERGENCY_PLUMBING_ISSUE;

export const SUPPORTED_PLUMBING_INTAKE_ISSUES: ReadonlySet<string> = new Set([
  KITCHEN_SINK_LEAK_NORMALIZED,
  TOILET_ISSUE,
  DRAIN_CLOG_ISSUE,
  FAUCET_ISSUE,
  WATER_HEATER_LEAK_ISSUE,
  WATER_HEATER_SERVICE_ISSUE,
  GARBAGE_DISPOSAL_ISSUE,
  SEWER_DRAIN_LINE_ISSUE,
  EMERGENCY_PLUMBING_ISSUE,
]);

const OFF_LANE_STRONG = [
  /\b(electric|electrical|wiring|outlet|hvac|furnace|air\s*conditioning|roof|siding|pest)\b/i,
  /\b(appliance\s+repair)\b(?![\s\S]{0,40}\b(plumb|leak|water|drain|pipe|sink|toilet)\b)/i,
];

function offLane(n: string): boolean {
  return OFF_LANE_STRONG.some((re) => {
    re.lastIndex = 0;
    return re.test(n);
  });
}

function hasEmergencyCue(n: string): boolean {
  return /\b(emergency|burst|flooding|gushing|won'?t\s+stop|basement\s+filling)\b/.test(n);
}

/**
 * Classify a plumbing-related issue after kitchen-sink-specific matcher misses.
 * Returns null when unclear (caller should be re-prompted).
 */
export function classifyNonKitchenPlumbingIssue(raw: string): PlumbingIntakeIssue | 'off_lane' | null {
  const n = normalizeUtterance(raw);
  if (!n) {
    return null;
  }
  if (offLane(n)) {
    return 'off_lane';
  }

  if (/\bwater\s*heater\b/.test(n) && /\b(leak|leaking|drip|puddle)\b/.test(n)) {
    return WATER_HEATER_LEAK_ISSUE;
  }
  if (/\bwater\s*heater\b/.test(n) && /\b(repair|replace|replacement|install|new|broken|no\s+hot|not\s+heating)\b/.test(n)) {
    return WATER_HEATER_SERVICE_ISSUE;
  }
  if (/\bwater\s*heater\b/.test(n)) {
    return WATER_HEATER_SERVICE_ISSUE;
  }

  if (/\b(garbage\s*disposal|disposal)\b/.test(n)) {
    return GARBAGE_DISPOSAL_ISSUE;
  }

  if (/\b(sewer|main\s*line|septic)\b/.test(n)) {
    return SEWER_DRAIN_LINE_ISSUE;
  }

  if (/\b(toilet|commode)\b/.test(n)) {
    return TOILET_ISSUE;
  }

  if (/\b(kitchen\s+)?sink\b/.test(n) && /\b(faucet|tap|handle|drip)\b/.test(n) && !/\bleak\b/.test(n)) {
    return FAUCET_ISSUE;
  }
  if (/\b(faucet|tap)\b/.test(n) && /\b(leak|drip|broken)\b/.test(n)) {
    return FAUCET_ISSUE;
  }

  if (/\bclog(?:ged|s)?\b|\b(backed\s+up|backing\s+up|won'?t\s+drain|slow\s+drain)\b/.test(n)) {
    return DRAIN_CLOG_ISSUE;
  }

  if (hasEmergencyCue(n) && /\b(plumb|pipe|water|leak|drain|flood|sink|toilet|basement)\b/.test(n)) {
    return EMERGENCY_PLUMBING_ISSUE;
  }

  return null;
}

export type PlumbingIssueCaptureResult =
  | { accepted: true; issue: PlumbingIntakeIssue }
  | { accepted: false; rejectReason: string | null };

/**
 * Kitchen sink leak uses existing lane checks; other supported plumbing issues route to shared intake.
 */
export function matchPlumbingIntakeIssue(raw: string): PlumbingIssueCaptureResult {
  const ks = matchKitchenSinkLeakIssue(raw);
  if (ks.accepted && ks.normalizedIssue) {
    return { accepted: true, issue: KITCHEN_SINK_LEAK_NORMALIZED };
  }
  if (ks.rejectReason?.startsWith('off_lane')) {
    return { accepted: false, rejectReason: ks.rejectReason };
  }

  const other = classifyNonKitchenPlumbingIssue(raw);
  if (other === 'off_lane') {
    return { accepted: false, rejectReason: 'off_lane' };
  }
  if (other) {
    return { accepted: true, issue: other };
  }
  return { accepted: false, rejectReason: 'unclear' };
}

export function plumbingIssueAckLine(issue: PlumbingIntakeIssue): string {
  switch (issue) {
    case KITCHEN_SINK_LEAK_NORMALIZED:
      return "Got it. What's your name?";
    case TOILET_ISSUE:
      return "Got it — toilet issue. What's your name?";
    case DRAIN_CLOG_ISSUE:
      return "Got it — drain clog. What's your name?";
    case FAUCET_ISSUE:
      return "Got it — faucet issue. What's your name?";
    case WATER_HEATER_LEAK_ISSUE:
      return "Got it — water heater leak. What's your name?";
    case WATER_HEATER_SERVICE_ISSUE:
      return "Got it — water heater service. What's your name?";
    case GARBAGE_DISPOSAL_ISSUE:
      return "Got it — garbage disposal. What's your name?";
    case SEWER_DRAIN_LINE_ISSUE:
      return "Got it — sewer or main drain line. What's your name?";
    case EMERGENCY_PLUMBING_ISSUE:
      return "Got it — we'll treat this as urgent plumbing. What's your name?";
    default:
      return "Got it. What's your name?";
  }
}
