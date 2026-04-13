/**
 * Deterministic matchers for kitchen-sink-leak-only voice path.
 * Supported normalized issue: kitchen_sink_leak only.
 */

export const KITCHEN_SINK_LEAK_NORMALIZED = 'kitchen_sink_leak' as const;

/** @deprecated Narrow legacy values; prefer {@link BroadLeakLocation}. */
export type LeakLocationNormalized = 'faucet' | 'under_sink';

export type BroadLeakLocation =
  | 'under_sink'
  | 'faucet_area'
  | 'other_kitchen_sink_area'
  | 'unknown';

export type IssueMatchResult = {
  accepted: boolean;
  normalizedIssue: typeof KITCHEN_SINK_LEAK_NORMALIZED | null;
  rejectReason: string | null;
};

export type LeakUrgencyNormalized = 'active_now' | 'occasional' | 'unknown';

function hasKitchenAndSink(n: string): boolean {
  return /\bkitchen\b/.test(n) && /\bsink\b/.test(n);
}

/** Lowercase, strip punctuation to spaces, collapse whitespace. */
export function normalizeUtterance(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/['']/g, "'");
  s = s.replace(/[^\p{L}\p{N}\s']/gu, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Strong off-lane fixtures: reject even if the caller also mentions a kitchen sink (do not coerce into lane).
 * Do not use broad "clog" alone — it would reject valid kitchen-sink drain phrasing.
 */
const OFF_LANE_STRONG: { id: string; re: RegExp }[] = [
  { id: 'toilet', re: /\btoilet\b/ },
  {
    id: 'fixture_clog',
    re: /\b(toilet|bathtub|shower|bathroom)\b[\w\s']{0,80}\bclog(?:ged|s)?\b|\bclog(?:ged|s)?\b[\w\s']{0,80}\b(toilet|bathtub|shower|bathroom)\b/i,
  },
  { id: 'burst_pipe', re: /\bburst\s+pipe\b/ },
  { id: 'pipe_burst', re: /\bpipe\s+burst\b/ },
  { id: 'tub', re: /\btub\b|\bbathtub\b/ },
  { id: 'bathroom_sink', re: /\bbathroom\s+sink\b/ },
  { id: 'shower', re: /\bshower(?:head)?\b/ },
  { id: 'fridge', re: /\bfridge\b|\brefrigerator\b/ },
  { id: 'dishwasher', re: /\bdishwasher\b/ },
  { id: 'utility_sink', re: /\butility\s+sink\b/ },
  { id: 'basement_sink', re: /\bbasement\s+sink\b/ },
  { id: 'roof', re: /\broof\b/ },
  { id: 'siding', re: /\bsiding\b/ },
  { id: 'hvac', re: /\bhvac\b|\bair\s+conditioning\b|\bheating\b|\bfurnace\b/ },
  { id: 'electrical', re: /\belectrical\b|\boutlet\b|\bwiring\b/ },
];

/** Off-lane only when the utterance is not clearly scoped to a kitchen sink. */
const OFF_LANE_UNLESS_KITCHEN_SINK: { id: string; re: RegExp }[] = [
  { id: 'wont_drain', re: /\bwon'?t\s+drain\b/ },
  { id: 'not_draining', re: /\bnot\s+draining\b/ },
  { id: 'doesnt_drain', re: /\bdoesn'?t\s+drain\b/ },
  {
    id: 'generic_plumber',
    re: /\b(need|want|get|looking\s+for|call(?:ing)?)\s+(a\s+)?plumber\b|\bplumber\b.*\b(come|out|here|help)\b|\b(plumbing|plumber)\s+(service|company|help|emergency)\b/i,
  },
];

function offLaneHits(n: string): string[] {
  const hits: string[] = [];
  for (const { id, re } of OFF_LANE_STRONG) {
    re.lastIndex = 0;
    if (re.test(n)) {
      hits.push(id);
    }
  }
  if (!hasKitchenAndSink(n)) {
    for (const { id, re } of OFF_LANE_UNLESS_KITCHEN_SINK) {
      re.lastIndex = 0;
      if (re.test(n)) {
        hits.push(id);
      }
    }
  }
  return hits;
}

function hasLeakFamily(n: string): boolean {
  return /\b(leak|leaking|leaked|leaks)\b/.test(n);
}

/** Faucet + leak language (e.g. leaking faucet at kitchen sink). */
function hasFaucetLeak(n: string): boolean {
  if (!/\bfaucet\b/.test(n)) {
    return false;
  }
  return hasLeakFamily(n) || /\bdrip/.test(n);
}

/** Under sink + leak (kitchen may be implied only by "kitchen sink" elsewhere). */
function hasUnderSinkLeak(n: string): boolean {
  const underSink = /\b(under\s+(the\s+)?sink|beneath\s+(the\s+)?sink)\b/.test(n);
  if (!underSink) {
    return false;
  }
  return hasLeakFamily(n) || /\bdrip/.test(n);
}

/**
 * Supported iff: no off-lane hit, has kitchen+sink, and leak/faucet-leak/under-sink-leak pattern.
 * Strong fixture hits (toilet, bathroom sink, etc.) always reject. Broad "clog" without
 * fixture context is not used so kitchen-sink lines are not misclassified.
 */
export function matchKitchenSinkLeakIssue(raw: string): IssueMatchResult {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { accepted: false, normalizedIssue: null, rejectReason: 'empty' };
  }
  const hits = offLaneHits(n);
  if (hits.length > 0) {
    return {
      accepted: false,
      normalizedIssue: null,
      rejectReason: `off_lane:${hits.join(',')}`,
    };
  }
  if (!hasKitchenAndSink(n)) {
    return { accepted: false, normalizedIssue: null, rejectReason: 'missing_kitchen_or_sink' };
  }
  const ok = hasLeakFamily(n) || hasFaucetLeak(n) || hasUnderSinkLeak(n);
  if (!ok) {
    return { accepted: false, normalizedIssue: null, rejectReason: 'no_leak_signal' };
  }
  return { accepted: true, normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED, rejectReason: null };
}

function hasUncertaintyOnly(n: string): boolean {
  if (!hasUncertaintyPhrase(n)) {
    return false;
  }
  return !hasFaucetAreaSignals(n) && !hasUnderSinkBroadSignals(n) && !hasOtherSinkAreaSignals(n);
}

function hasUncertaintyPhrase(n: string): boolean {
  return /\b(don'?t know|do not know|not sure|unsure|no idea|hard to tell|can'?t tell|cannot tell|not certain)\b/.test(
    n
  );
}

/** Faucet side of binary intake: faucet, tap, spout, or handle. */
function hasFaucetAreaSignals(n: string): boolean {
  return /\b(faucet|spout|tap|handles?)\b/.test(n);
}

/**
 * Under-sink area without treating bare pipe/drain/valve as undersink unless paired with sink/cabinet/under language.
 */
function hasUnderSinkBroadSignals(n: string): boolean {
  const explicit =
    /\bunder\s+(the\s+)?sink\b/.test(n) ||
    /\bbeneath\s+(the\s+)?sink\b/.test(n) ||
    /\bbelow\s+(the\s+)?sink\b/.test(n) ||
    /\bunderneath\s+(the\s+)?sink\b/.test(n) ||
    /\bunder\s+(the\s+)?(sink\s+)?cabinet\b/.test(n) ||
    /\bin\s+(the\s+)?cabinet\s+under\s+(the\s+)?sink\b/.test(n) ||
    /\bunder\s+(the\s+)?(kitchen\s+)?cabinet\b/.test(n) ||
    /\bunder\s+the\s+cabinet\b/.test(n) ||
    /\bjust\s+under\s+(the\s+)?sink\b/.test(n) ||
    /\bsomewhere\s+under\s+(there|the\s+sink)\b/.test(n) ||
    /\b(bottom|base)\s+(of\s+)?(the\s+)?sink\b/.test(n) ||
    /\b(under|below|beneath)(\s+[\w']+){0,4}\s+sink\b/.test(n);
  const inCabinet = /\bin\s+the\s+cabinet\b/.test(n);
  const underThere = /\bunder\s+there\b/.test(n);
  return explicit || inCabinet || underThere;
}

function hasOtherSinkAreaSignals(n: string): boolean {
  return (
    /\b(around|near|by)\s+(the\s+)?sink\b/.test(n) ||
    /\bsink\s+area\b/.test(n) ||
    /\bkitchen\s+sink\s+area\b/.test(n) ||
    /\bsomewhere\s+(at|by|near)\s+(the\s+)?(kitchen\s+)?sink\b/.test(n)
  );
}

export type BroadLeakLocationMatch =
  | { kind: 'resolved'; location: BroadLeakLocation }
  | { kind: 'ambiguous' }
  | { kind: 'none' };

/**
 * Broad leak location for front-desk intake (no faucet/drain/pipe triage).
 * Uncertainty phrases → `unknown` unless a clear broad area is also present.
 */
export function matchBroadLeakLocation(raw: string): BroadLeakLocationMatch {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { kind: 'none' };
  }

  const f = hasFaucetAreaSignals(n);
  const u = hasUnderSinkBroadSignals(n);
  const o = hasOtherSinkAreaSignals(n);

  if (hasUncertaintyOnly(n)) {
    return { kind: 'resolved', location: 'unknown' };
  }

  if (f && u) {
    return { kind: 'ambiguous' };
  }
  if (f) {
    return { kind: 'resolved', location: 'faucet_area' };
  }
  if (u) {
    return { kind: 'resolved', location: 'under_sink' };
  }
  if (o) {
    return { kind: 'resolved', location: 'other_kitchen_sink_area' };
  }

  if (hasUncertaintyPhrase(n)) {
    return { kind: 'resolved', location: 'unknown' };
  }

  return { kind: 'none' };
}

export type LeakUrgencyMatch =
  | { kind: 'resolved'; urgency: LeakUrgencyNormalized }
  | { kind: 'none' };

/**
 * Active vs occasional water — intake only, not troubleshooting.
 */
export function matchLeakUrgency(raw: string): LeakUrgencyMatch {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { kind: 'none' };
  }

  if (
    /\b(don'?t know|do not know|not sure|unsure|no idea|hard to tell|can'?t tell|cannot tell)\b/.test(n)
  ) {
    return { kind: 'resolved', urgency: 'unknown' };
  }

  const active =
    /\b(right now|actively|active|still\s+leak|won'?t\s+stop|wont\s+stop|gushing|steady|constantly|continuous|all\s+the\s+time|keeps?\s+leak|ongoing|pouring)\b/.test(
      n
    ) ||
    n === 'yes' ||
    /\b(a lot of water|tons of water|everywhere)\b/.test(n);

  const occasional =
    /\b(sometimes|occasional|off\s+and\s+on|on\s+and\s+off|once\s+in\s+a\s+while|not\s+all\s+the\s+time|every\s+so\s+often|when\s+i\s+use|only\s+when)\b/.test(
      n
    ) ||
    n === 'no';

  if (active && occasional) {
    return { kind: 'none' };
  }
  if (active) {
    return { kind: 'resolved', urgency: 'active_now' };
  }
  if (occasional) {
    return { kind: 'resolved', urgency: 'occasional' };
  }

  return { kind: 'none' };
}

/** @deprecated Legacy faucet vs under_sink only; use {@link matchBroadLeakLocation}. */
export type LeakLocationMatch =
  | { kind: 'resolved'; location: LeakLocationNormalized }
  | { kind: 'ambiguous' }
  | { kind: 'none' };

/**
 * @deprecated Use {@link matchBroadLeakLocation}. Maps broad categories to legacy binary where possible.
 */
export function matchLeakLocationDetailed(raw: string): LeakLocationMatch {
  const m = matchBroadLeakLocation(raw);
  if (m.kind === 'ambiguous') {
    return { kind: 'ambiguous' };
  }
  if (m.kind === 'none') {
    return { kind: 'none' };
  }
  if (m.location === 'faucet_area') {
    return { kind: 'resolved', location: 'faucet' };
  }
  if (m.location === 'under_sink') {
    return { kind: 'resolved', location: 'under_sink' };
  }
  return { kind: 'none' };
}

/** @deprecated Prefer {@link matchBroadLeakLocation}. */
export function matchLeakLocation(raw: string): LeakLocationNormalized | null {
  const m = matchLeakLocationDetailed(raw);
  return m.kind === 'resolved' ? m.location : null;
}

// --- Two-step forced-choice triage (kitchen sink leak-only) ---

export type KitchenSinkLeakPrimary = 'faucet' | 'below_sink';
export type KitchenSinkLeakSecondary = 'faucet_self' | 'pipe' | 'drain';

export type KitchenSinkTriageInferResult = {
  primary: KitchenSinkLeakPrimary | null;
  secondary: KitchenSinkLeakSecondary | null;
};

function hasDrainCue(n: string): boolean {
  return /\b(drain|p\s*[-]?\s*trap|trap|disposal(\s+drain)?)\b/.test(n);
}

function hasPipeCue(n: string): boolean {
  return /\b(pipes?|supply\s+lines?|water\s+lines?|valve|valves|shutoff|shut\s*[-]?\s*offs?)\b/.test(n);
}

function hasFaucetTopCue(n: string): boolean {
  return (
    hasFaucetAreaSignals(n) ||
    /\b(edges?|up\s+top|top\s+of\s+the\s+sink|around\s+the\s+top)\b/.test(n)
  );
}

/**
 * Best-effort triage from a full caller utterance (use entire transcript; do not trim to first word).
 * Returns null slots when not inferable without a forced-choice question.
 */
export function inferKitchenSinkLeakTriage(raw: string): KitchenSinkTriageInferResult {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { primary: null, secondary: null };
  }

  const below = hasUnderSinkBroadSignals(n);
  const fTop = hasFaucetTopCue(n);
  const d = hasDrainCue(n);
  const p = hasPipeCue(n);
  const leakFam = hasLeakFamily(n);

  // Kitchen sink leak + pipe cue without explicit faucet/drain/undersink phrasing → treat as pipes below sink.
  if (hasKitchenAndSink(n) && leakFam && p && !d && !below && !fTop) {
    return { primary: 'below_sink', secondary: 'pipe' };
  }

  // Prefer explicit pipe vs drain under the sink when only one family is present (avoid mis-reading pipes as drain).
  if (below && p && !d) {
    return { primary: 'below_sink', secondary: 'pipe' };
  }
  if (below && d && !p) {
    return { primary: 'below_sink', secondary: 'drain' };
  }
  if (below && d && p) {
    return { primary: 'below_sink', secondary: null };
  }

  if (fTop && below) {
    return { primary: null, secondary: null };
  }

  if (below) {
    return { primary: 'below_sink', secondary: null };
  }

  if (fTop) {
    if (d && !p) {
      return { primary: 'faucet', secondary: 'drain' };
    }
    if (p && !d) {
      return { primary: 'faucet', secondary: 'faucet_self' };
    }
    if (d && p) {
      return { primary: 'faucet', secondary: null };
    }
    return { primary: 'faucet', secondary: null };
  }

  return { primary: null, secondary: null };
}

export type PrimaryChoiceMatch = 'faucet' | 'below_sink' | 'ambiguous' | 'none';

/** Single-turn answer to "faucet or below sink?" */
export function matchPrimaryLeakChoice(raw: string): PrimaryChoiceMatch {
  const n = normalizeUtterance(raw);
  if (!n) {
    return 'none';
  }
  if (hasUncertaintyPhrase(n) && !hasUnderSinkBroadSignals(n) && !hasFaucetTopCue(n)) {
    return 'none';
  }
  const below = hasUnderSinkBroadSignals(n);
  const fTop = hasFaucetTopCue(n);
  if (below && fTop) {
    return 'ambiguous';
  }
  if (below) {
    return 'below_sink';
  }
  if (fTop) {
    return 'faucet';
  }
  return 'none';
}

export type SecondaryChoiceMatch =
  | KitchenSinkLeakSecondary
  | 'ambiguous'
  | 'none';

/** Single-turn answer to secondary forced-choice (depends on primary path). */
export function matchSecondaryLeakChoice(
  raw: string,
  primary: KitchenSinkLeakPrimary
): SecondaryChoiceMatch {
  const n = normalizeUtterance(raw);
  if (!n) {
    return 'none';
  }
  if (hasUncertaintyPhrase(n) && !hasDrainCue(n) && !hasPipeCue(n) && !hasFaucetTopCue(n)) {
    return 'none';
  }

  const d = hasDrainCue(n);
  const p = hasPipeCue(n);
  const f = hasFaucetTopCue(n);

  if (primary === 'faucet') {
    if (d && (p || f)) {
      return 'ambiguous';
    }
    if (d) {
      return 'drain';
    }
    if (p || f) {
      return 'faucet_self';
    }
    return 'none';
  }

  if (d && p) {
    return 'ambiguous';
  }
  if (d) {
    return 'drain';
  }
  if (p) {
    return 'pipe';
  }
  return 'none';
}

const LEAK_LOCATION_CORRECTION_PREFIX =
  /^(no|nope|nah|wrong|incorrect|actually|wait)\b[,.\s]+|^(that'?s\s+wrong|that\s+is\s+wrong|not\s+right|not\s+correct)\b[,.\s]+|^(not\s+the\s+faucet|not\s+at\s+the\s+faucet|not\s+from\s+the\s+faucet)\b[,.\s]+/i;

/** Strip leading negation/correction cues so "no, below the sink at the pipes" can be re-parsed. */
export function stripLeakLocationCorrectionPrefix(raw: string): { remainder: string; hadCorrection: boolean } {
  let t = raw.trim();
  if (!t) {
    return { remainder: '', hadCorrection: false };
  }
  let hadCorrection = false;
  for (let i = 0; i < 3; i++) {
    const m = t.match(LEAK_LOCATION_CORRECTION_PREFIX);
    if (!m) {
      break;
    }
    t = t.slice(m[0].length).trim();
    hadCorrection = true;
  }
  return { remainder: t, hadCorrection };
}

function hasLeakLocationCueSignal(n: string): boolean {
  return (
    hasUnderSinkBroadSignals(n) ||
    hasFaucetTopCue(n) ||
    hasDrainCue(n) ||
    hasPipeCue(n)
  );
}

export type HardLeakLocationOverride =
  | { ok: true; primary: KitchenSinkLeakPrimary; secondary: KitchenSinkLeakSecondary }
  | { ok: true; primary: KitchenSinkLeakPrimary; secondary: null }
  | { ok: false };

/**
 * Hard override: caller negated then corrected. Parses **remainder** only into primary/secondary.
 * Returns `secondary: null` when primary is clear but pipe/drain choice still needed.
 */
export function parseHardLeakLocationOverrideFromUtterance(raw: string): HardLeakLocationOverride {
  const { remainder, hadCorrection } = stripLeakLocationCorrectionPrefix(raw);
  if (!hadCorrection) {
    return { ok: false };
  }
  const n = normalizeUtterance(remainder);
  if (!n || !hasLeakLocationCueSignal(n)) {
    return { ok: false };
  }

  const tri = inferKitchenSinkLeakTriage(remainder);
  if (tri.primary && tri.secondary) {
    return { ok: true, primary: tri.primary, secondary: tri.secondary };
  }
  if (tri.primary) {
    const sec = matchSecondaryLeakChoice(remainder, tri.primary);
    if (sec === 'pipe' || sec === 'drain' || sec === 'faucet_self') {
      return { ok: true, primary: tri.primary, secondary: sec };
    }
    if (sec === 'ambiguous') {
      return { ok: false };
    }
    return { ok: true, primary: tri.primary, secondary: null };
  }

  const prim = matchPrimaryLeakChoice(remainder);
  if (prim !== 'faucet' && prim !== 'below_sink') {
    return { ok: false };
  }
  const sec = matchSecondaryLeakChoice(remainder, prim);
  if (sec === 'pipe' || sec === 'drain' || sec === 'faucet_self') {
    return { ok: true, primary: prim, secondary: sec };
  }
  if (sec === 'ambiguous') {
    return { ok: false };
  }
  return { ok: true, primary: prim, secondary: null };
}
