/**
 * Deterministic allowlist for single-lane kitchen sink leak voice mode.
 * Canonical issue text for all in-lane matches (model must not invent variants).
 */

export const SINGLE_LANE_KITCHEN_SINK_CANONICAL = 'kitchen sink leak';

/** Strong off-lane signals (word-aware); if any match, lane is unsupported. */
const OFF_LANE_PATTERNS: { id: string; re: RegExp }[] = [
  { id: 'water_heater', re: /\bwater\s*heater\b/ },
  { id: 'toilet', re: /\btoilet\b/ },
  { id: 'tub', re: /\btub\b/ },
  { id: 'bathtub', re: /\bbathtub\b/ },
  { id: 'overflowing', re: /\boverflowing\b/ },
  { id: 'bathroom_sink', re: /\bbathroom\s+sink\b/ },
  { id: 'bathroom_leak', re: /\bbathroom\s+leak\b/ },
  { id: 'attic', re: /\battic\b/ },
  { id: 'basement', re: /\bbasement\b/ },
  { id: 'pipe_burst', re: /\bpipe\s+burst\b/ },
  { id: 'burst_pipe', re: /\bburst\s+pipe\b/ },
  { id: 'flooding', re: /\bflooding\b/ },
  { id: 'flood', re: /\bflood(?:ed|ing)?\b/ },
  { id: 'puddle', re: /\bpuddle\b/ },
  { id: 'sewer', re: /\bsewer\b/ },
  { id: 'clog', re: /\bclog(?:ged)?\b/ },
  { id: 'drain_clog', re: /\bdrain\s+clog\b/ },
  { id: 'utility_sink', re: /\butility\s+sink\b/ },
  { id: 'wont_drain', re: /\bwon'?t\s+drain\b/ },
  { id: 'doesnt_drain', re: /\bdoesn'?t\s+drain\b/ },
  { id: 'not_draining', re: /\bnot\s+draining\b/ },
];

/** Substrings after normalization (explicit supported phrasing). */
const ALLOWED_PHRASES: { id: string; phrase: string }[] = [
  { id: 'kitchen_sink_leak', phrase: 'kitchen sink leak' },
  { id: 'leak_at_my_kitchen_sink', phrase: 'leak at my kitchen sink' },
  { id: 'my_kitchen_sink_is_leaking', phrase: 'my kitchen sink is leaking' },
  { id: 'kitchen_sink_leaking', phrase: 'kitchen sink leaking' },
  { id: 'leak_under_my_kitchen_sink', phrase: 'leak under my kitchen sink' },
  { id: 'leaking_valve_under_my_kitchen_sink', phrase: 'leaking valve under my kitchen sink' },
  { id: 'leaking_valve_under_kitchen_sink', phrase: 'leaking valve under kitchen sink' },
  { id: 'valve_leak_under_kitchen_sink', phrase: 'valve leak under kitchen sink' },
  { id: 'leak_at_kitchen_sink', phrase: 'leak at kitchen sink' },
  { id: 'under_sink_leak_in_kitchen', phrase: 'under sink leak in kitchen' },
  { id: 'under_sink_leak_kitchen', phrase: 'under sink leak kitchen' },
  { id: 'kitchen_sink_valve_leak', phrase: 'kitchen sink valve leak' },
];

/**
 * Strips leading negation / boilerplate so corrections like "No, leaking valve under..."
 * classify as the lane, not bare "no".
 * Does not strip a standalone "no" (no trailing content).
 */
export function prepareTextForSingleLaneDeterministicMatch(raw: string): string {
  let s = raw.trim();
  if (!s) {
    return s;
  }
  const leadingNeg = /^(no+|nope|incorrect|wrong|not really)\s*[,!.]?\s+/i;
  let guard = 0;
  while (guard < 8 && leadingNeg.test(s)) {
    const next = s.replace(leadingNeg, '').trim();
    if (next === s || next.length === 0) {
      break;
    }
    s = next;
    guard += 1;
  }
  return s;
}

export function normalizeKitchenSinkLaneText(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/['']/g, "'");
  s = s.replace(/[^\p{L}\p{N}\s']/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function findOffLaneKeywordHits(normalized: string): string[] {
  const hits: string[] = [];
  for (const { id, re } of OFF_LANE_PATTERNS) {
    re.lastIndex = 0;
    if (re.test(normalized)) {
      hits.push(id);
    }
  }
  return hits;
}

/**
 * Kitchen + sink + leak/drip family (includes valve-under-kitchen-sink when leaking/dripping is stated).
 */
export function matchesKitchenSinkLeakFamily(normalized: string): boolean {
  const hasKitchen = /\bkitchen\b/.test(normalized);
  const hasSink = /\bsink\b/.test(normalized);
  if (!hasKitchen || !hasSink) {
    return false;
  }
  const hasLeak = /\b(leak|leaking|leaked|leaks)\b/.test(normalized);
  const hasDrip = /\b(drip|dripping|dripped)\b/.test(normalized);
  return hasLeak || hasDrip;
}

export type KitchenSinkLaneClassification = {
  lane: 'allowlisted' | 'unsupported';
  matchedPatternId?: string;
  /** Always `SINGLE_LANE_KITCHEN_SINK_CANONICAL` when allowlisted. */
  canonicalIssue: string | null;
  offLaneHits: string[];
  /** True if an allowlist phrase matched but off-lane terms were also present (safety / model error). */
  mappingBug: boolean;
  unsupportedReason?: string;
};

/**
 * Classifies caller issue text. Off-lane keywords take precedence over allowlist / family match.
 */
export function classifyKitchenSinkLeakLane(raw: string): KitchenSinkLaneClassification {
  const prepared = prepareTextForSingleLaneDeterministicMatch(raw);
  const normalized = normalizeKitchenSinkLaneText(prepared);
  if (!normalized) {
    return {
      lane: 'unsupported',
      canonicalIssue: null,
      offLaneHits: [],
      mappingBug: false,
      unsupportedReason: 'empty_input',
    };
  }

  const offLaneHits = findOffLaneKeywordHits(normalized);
  let matchedPatternId: string | undefined;
  for (const { id, phrase } of ALLOWED_PHRASES) {
    if (normalized.includes(phrase)) {
      matchedPatternId = id;
      break;
    }
  }

  const familyMatch = !matchedPatternId && matchesKitchenSinkLeakFamily(normalized);
  if (familyMatch) {
    matchedPatternId = 'kitchen_sink_leak_family_composite';
  }

  const mappingBug = matchedPatternId !== undefined && offLaneHits.length > 0;
  if (offLaneHits.length > 0) {
    return {
      lane: 'unsupported',
      matchedPatternId,
      canonicalIssue: null,
      offLaneHits,
      mappingBug,
      unsupportedReason: `off_lane_keyword:${offLaneHits.join(',')}`,
    };
  }

  if (matchedPatternId) {
    return {
      lane: 'allowlisted',
      matchedPatternId,
      canonicalIssue: SINGLE_LANE_KITCHEN_SINK_CANONICAL,
      offLaneHits: [],
      mappingBug: false,
    };
  }

  return {
    lane: 'unsupported',
    canonicalIssue: null,
    offLaneHits: [],
    mappingBug: false,
    unsupportedReason: 'no_kitchen_sink_leak_pattern',
  };
}
