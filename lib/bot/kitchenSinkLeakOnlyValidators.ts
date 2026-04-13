/**
 * Deterministic slot validators and lightweight NLU for kitchen-sink-leak-only voice.
 */

import { normalizeUtterance } from '@/lib/bot/kitchenSinkLeakOnlyMatchers';

export type ValidatorResult = { ok: true } | { ok: false; reason: string };

const NAME_FILLER_EXACT = new Set(
  [
    'yeah',
    'yea',
    'yep',
    'uh',
    'um',
    'hello',
    'hi',
    "that's me",
    'thats me',
    'here',
    'yes',
    'no',
    'ok',
    'okay',
    'sure',
    'thanks',
    'thank you',
  ].map((s) => normalizeUtterance(s))
);

/** US state / territory abbreviations we accept as 2-letter input. */
const US_STATE_ABBR = new Set([
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
]);

/** Lowercase full / common state name → 2-letter abbreviation */
const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  'district of columbia': 'DC',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};

const CALLBACK_WINDOW_TERMS =
  /\b(morning|afternoon|evening|tonight|today|tomorrow|a\.?m\.?|p\.?m\.?|noon|midnight)\b/i;

const STREETISH =
  /\b(street|st\b|avenue|ave\b|road|rd\b|drive|dr\b|lane|ln\b|court|ct\b|boulevard|blvd\b|way|place|pl\b|terrace|ter\b|circle|cir\b|parkway|pkwy|highway|hwy|route|rt\b|trail|trl\b|run|path|#\s*\d|\bapt\b|\bunit\b|\bsuite\b)\b/i;

/** Caller signals they were cut off or the address is incomplete (address-capture slots only). */
const ADDRESS_REPAIR_INTENT =
  /\b(you\s+don'?t\s+have\s+my\s+full\s+address|don'?t\s+have\s+my\s+full\s+address|not\s+the\s+full\s+address|that'?s\s+not\s+the\s+full\s+address|that\s+is\s+not\s+the\s+full\s+address|i\s+wasn'?t\s+finished|i\s+was\s+not\s+finished|let\s+me\s+finish|you\s+cut\s+me\s+off|hold\s+on|wait)\b/i;

export function matchAddressRepairIntent(raw: string): boolean {
  const n = normalizeUtterance(raw);
  if (!n) {
    return false;
  }
  return ADDRESS_REPAIR_INTENT.test(n);
}

/** True when caller is clearly correcting a previously confirmed slot (not stray ASR). */
export function utteranceSuggestsLockedSlotCorrection(raw: string): boolean {
  const n = normalizeUtterance(raw);
  if (!n) {
    return false;
  }
  if (matchAddressRepairIntent(raw)) {
    return true;
  }
  return /\b(
    wrong|incorrect|actually|instead|change|correct|fix|update|
    not\s+that|that'?s\s+wrong|that\s+is\s+wrong|different|replace|
    my\s+mistake|sorry\s*,\s*(it'?s|that'?s|the)\s+
  )\b/ix.test(n);
}

export type ParsedStreetCity = { ok: true; street: string; city: string } | { ok: false };

/**
 * Parse a single utterance that includes both street (with number) and city, e.g.
 * "123 Smith Street, Dover" or "123 Smith Street in Dover".
 * Not used for city+state combined (handled separately on the city step).
 */
export function tryParseStreetLineAndCity(raw: string): ParsedStreetCity {
  const t = raw.trim();
  if (!t) {
    return { ok: false };
  }

  const inSplit = t.match(/^(.+?)\s+in\s+(.+)$/i);
  if (inSplit) {
    const streetCandidate = inSplit[1]!.trim();
    const cityRaw = inSplit[2]!.trim();
    const sv = validateStreet(streetCandidate);
    const cv = validateCity(cityRaw);
    if (sv.ok && cv.ok) {
      const cityNorm = normalizeUtterance(cityRaw);
      return {
        ok: true,
        street: streetCandidate,
        city: titleCaseCityWords(cityNorm),
      };
    }
  }

  if (t.includes(',')) {
    const parts = t
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const cityRaw = parts[parts.length - 1]!;
      const streetCandidate = parts.slice(0, -1).join(', ').trim();
      const sv = validateStreet(streetCandidate);
      const cv = validateCity(cityRaw);
      if (sv.ok && cv.ok) {
        const cityNorm = normalizeUtterance(cityRaw);
        return {
          ok: true,
          street: streetCandidate,
          city: titleCaseCityWords(cityNorm),
        };
      }
    }
  }

  return { ok: false };
}

/**
 * Collapse stuttered short replies: "dover dover dover" → "dover", "a pipe a pipe" → "pipe".
 */
export function collapseRepeatedUtterance(raw: string): string {
  const t = raw.trim();
  if (!t) {
    return t;
  }
  const n = normalizeUtterance(t);
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return t;
  }
  const skip = new Set(['a', 'an', 'the']);
  const filtered = tokens.filter((w) => !skip.has(w));
  if (filtered.length === 0) {
    return t;
  }
  const out: string[] = [];
  for (const w of filtered) {
    if (out.length > 0 && out[out.length - 1] === w) {
      continue;
    }
    out.push(w);
  }
  return out.join(' ').trim() || t;
}

const STREET_ABBREV: Array<{ re: RegExp; full: string }> = [
  { re: /\bblvd\b\.?/gi, full: 'Boulevard' },
  { re: /\bpkwy\b\.?/gi, full: 'Parkway' },
  { re: /\bave\b\.?/gi, full: 'Avenue' },
  { re: /\bdr\b\.?/gi, full: 'Drive' },
  { re: /\brd\b\.?/gi, full: 'Road' },
  { re: /\bln\b\.?/gi, full: 'Lane' },
  { re: /\bct\b\.?/gi, full: 'Court' },
  { re: /\bst\b\.?/gi, full: 'Street' },
];

/**
 * Expand common spoken abbreviations so "123 main st" → "123 main Street" before validation / progress checks.
 */
export function normalizeStreetAbbreviations(raw: string): string {
  let t = raw.trim();
  if (!t) {
    return t;
  }
  for (const { re, full } of STREET_ABBREV) {
    const lower = full.toLowerCase();
    t = t.replace(re, lower);
  }
  return t.replace(/\s+/g, ' ').trim();
}

/** Title-case alphabetic tokens; leave leading numeric token (building number) as-is. */
export function titleCaseStreetWordsForSpeech(raw: string): string {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (/^\d/.test(p)) {
      out.push(p);
      continue;
    }
    if (!/\p{L}/u.test(p)) {
      out.push(p);
      continue;
    }
    out.push(p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  }
  return out.join(' ');
}

/**
 * For street-only capture, avoid advancing on fragments like "123 Smith" with no road-type cue,
 * so we do not commit the turn mid-utterance as often.
 */
export function streetLineLooksCompleteEnoughForProgress(raw: string): boolean {
  const t = raw.trim();
  if (!t) {
    return false;
  }
  const expanded = normalizeStreetAbbreviations(t);
  const n = normalizeUtterance(expanded);
  if (STREETISH.test(n)) {
    return true;
  }
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3 && /[\d\p{Nd}]/u.test(t) && /\p{L}/u.test(t)) {
    return true;
  }
  // "123 main st" → 2 tokens after expand often becomes 3; also allow number + street name (>=3 letters)
  if (
    tokens.length === 2 &&
    /[\d\p{Nd}]/u.test(tokens[0]!) &&
    /^[\p{L}]+$/u.test(tokens[1]!) &&
    tokens[1]!.length >= 3
  ) {
    return true;
  }
  // e.g. "123 Broadway" — no separate road-type token; require a longer name token to reduce false positives on "123 Smith".
  if (
    tokens.length === 2 &&
    /[\d\p{Nd}]/u.test(tokens[0]!) &&
    /^[\p{L}]+$/u.test(tokens[1]!) &&
    tokens[1]!.length >= 8
  ) {
    return true;
  }
  return false;
}

export function validateName(raw: string): ValidatorResult {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { ok: false, reason: 'empty' };
  }
  if (NAME_FILLER_EXACT.has(n)) {
    return { ok: false, reason: 'filler' };
  }
  const letters = (n.match(/\p{L}/gu) ?? []).length;
  if (letters < 2) {
    return { ok: false, reason: 'too_short' };
  }
  return { ok: true };
}

/**
 * Strip common spoken wrappers so "My name is Matt" validates as "Matt".
 */
export function extractCallerNameForIntake(raw: string): string {
  let t = raw.trim();
  if (!t) {
    return t;
  }
  const patterns = [
    /^my\s+name\s+is\s+/i,
    /^this\s+is\s+/i,
    /^i\s*'?\s*m\s+/i,
    /^it\s*'?\s*s\s+/i,
    /^calling\s+from\s+/i,
    /^you\s+can\s+call\s+me\s+/i,
    /^call\s+me\s+/i,
  ];
  for (const p of patterns) {
    t = t.replace(p, '').trim();
  }
  return t.trim();
}

export function validateStreet(raw: string): ValidatorResult {
  const t = raw.trim();
  if (!t) {
    return { ok: false, reason: 'empty' };
  }
  const hasDigit = /[\d\p{Nd}]/u.test(t);
  if (hasDigit && !/\p{L}/u.test(t)) {
    return { ok: false, reason: 'digits_only' };
  }
  if (!hasDigit) {
    return { ok: false, reason: 'no_digits' };
  }
  if (!/\p{L}/u.test(t)) {
    return { ok: false, reason: 'no_letters' };
  }
  return { ok: true };
}

export function looksLikeZip(raw: string): boolean {
  const n = normalizeUtterance(raw);
  return /\b\d{5}\b/.test(n) || /^\d{5}$/.test(n.replace(/\s/g, ''));
}

export function looksLikeStateAbbr(raw: string): boolean {
  const t = raw.trim();
  return /^[a-z]{2}$/i.test(t) && US_STATE_ABBR.has(t.toUpperCase());
}

/** True when the normalized phrase is exactly a U.S. state or D C name in {@link STATE_NAME_TO_ABBR}. */
export function isDictionaryUsStateName(normalized: string): boolean {
  return Boolean(STATE_NAME_TO_ABBR[normalized]);
}

/**
 * City segment when we already matched a trailing state in the same utterance.
 * Allows city names that equal a state phrase (e.g. "New York, NY") — {@link validateCity} would reject those alone.
 */
export function validateCityPortionInCityStatePair(raw: string): ValidatorResult {
  const t = raw.trim();
  if (!t) {
    return { ok: false, reason: 'empty' };
  }
  const n = normalizeUtterance(t);
  if (/^\d{5}$/.test(n.replace(/\s/g, ''))) {
    return { ok: false, reason: 'looks_like_zip' };
  }
  if (/^morning$|^afternoon$|^evening$/.test(n)) {
    return { ok: false, reason: 'looks_like_callback' };
  }
  if (!/\p{L}/u.test(t)) {
    return { ok: false, reason: 'no_letters' };
  }
  if (/^[a-z]{2}$/i.test(n) && US_STATE_ABBR.has(n.toUpperCase())) {
    return { ok: false, reason: 'looks_like_state' };
  }
  return { ok: true };
}

function titleCaseCityWords(normalizedPhrase: string): string {
  return normalizedPhrase
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

export type ParsedCityState =
  | { ok: true; city: string; stateAbbr: string }
  | { ok: false };

/** City should not look like a US state abbr, bare zip, pure state dictionary name, or pure callback vocabulary. */
export function validateCity(raw: string): ValidatorResult {
  const t = raw.trim();
  if (!t) {
    return { ok: false, reason: 'empty' };
  }
  const n = normalizeUtterance(t);
  if (isDictionaryUsStateName(n)) {
    return { ok: false, reason: 'looks_like_state_name' };
  }
  if (/^\d{5}$/.test(n.replace(/\s/g, ''))) {
    return { ok: false, reason: 'looks_like_zip' };
  }
  if (/^[a-z]{2}$/i.test(t.trim()) && US_STATE_ABBR.has(t.trim().toUpperCase())) {
    return { ok: false, reason: 'looks_like_state' };
  }
  if (/^morning$|^afternoon$|^evening$/.test(n)) {
    return { ok: false, reason: 'looks_like_callback' };
  }
  if (!/\p{L}/u.test(t)) {
    return { ok: false, reason: 'no_letters' };
  }
  return { ok: true };
}

export function validateState(raw: string): ValidatorResult & { normalized?: string } {
  const t = raw.trim();
  if (!t) {
    return { ok: false, reason: 'empty' };
  }
  let n = normalizeUtterance(t.replace(/\./g, ' ')).replace(/\s+/g, ' ').trim();

  const spelled = n.match(/^([a-z])\s+([a-z])$/i);
  if (spelled) {
    const ab = (spelled[1] + spelled[2]).toUpperCase();
    if (US_STATE_ABBR.has(ab)) {
      return { ok: true, normalized: ab };
    }
  }

  const compact = n.replace(/\s/g, '');
  if (compact.length === 2 && US_STATE_ABBR.has(compact.toUpperCase())) {
    return { ok: true, normalized: compact.toUpperCase() };
  }

  const up = t.toUpperCase().replace(/\./g, '').trim();
  if (/^[A-Z]{2}$/.test(up) && US_STATE_ABBR.has(up)) {
    return { ok: true, normalized: up };
  }

  const abbr = STATE_NAME_TO_ABBR[n];
  if (abbr) {
    return { ok: true, normalized: abbr };
  }
  return { ok: false, reason: 'unknown_state' };
}

/**
 * Parse "City, State", "City State", "City, ST", or "City ST" into city + normalized state abbr.
 * Returns ok:false for state-only utterances (e.g. "Delaware" alone) so the city step can reject.
 */
export function tryParseCityStateCombined(raw: string): ParsedCityState {
  const t = raw.trim();
  if (!t) {
    return { ok: false };
  }

  const n = normalizeUtterance(t);
  const tokens = n.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { ok: false };
  }

  if (tokens.length === 1) {
    const only = validateState(t);
    if (only.ok && only.normalized) {
      return { ok: false };
    }
    return { ok: false };
  }

  if (t.includes(',')) {
    const parts = t
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      const statePart = parts[parts.length - 1]!;
      const cityPart = parts.slice(0, -1).join(', ').trim();
      const sv = validateState(statePart);
      const cv = validateCityPortionInCityStatePair(cityPart);
      if (sv.ok && sv.normalized && cv.ok) {
        const cityNorm = normalizeUtterance(cityPart);
        return { ok: true, city: titleCaseCityWords(cityNorm), stateAbbr: sv.normalized };
      }
    }
  }

  const lastTok = tokens[tokens.length - 1]!;
  if (/^[a-z]{2}$/i.test(lastTok) && US_STATE_ABBR.has(lastTok.toUpperCase())) {
    const cityNorm = tokens.slice(0, -1).join(' ');
    const cv = validateCityPortionInCityStatePair(cityNorm);
    if (cv.ok) {
      return { ok: true, city: titleCaseCityWords(cityNorm), stateAbbr: lastTok.toUpperCase() };
    }
  }

  const stateEntries = Object.entries(STATE_NAME_TO_ABBR).sort((a, b) => b[0].length - a[0].length);
  for (const [stateName, abbr] of stateEntries) {
    if (n === stateName) {
      return { ok: false };
    }
    if (n.endsWith(' ' + stateName)) {
      const cityNorm = n.slice(0, -(stateName.length + 1)).trim();
      if (!cityNorm) {
        return { ok: false };
      }
      const cv = validateCityPortionInCityStatePair(cityNorm);
      if (cv.ok) {
        return { ok: true, city: titleCaseCityWords(cityNorm), stateAbbr: abbr };
      }
    }
  }

  return { ok: false };
}

/** Trailing ZIP slice after stripping a valid 5-digit ZIP from the end of an utterance (ASR may space digits). */
export type TrailingZipSlice = { remainder: string; zipDigits: string };

export function extractTrailingZipFromUtterance(raw: string): TrailingZipSlice | null {
  const t = raw.trim();
  if (!t) {
    return null;
  }
  const re = /(\d(?:[\s.\-]*\d){4})\s*$/;
  const m = t.match(re);
  if (!m || m.index === undefined) {
    return null;
  }
  const z = validateZip(m[1]!);
  if (!z.ok || !z.digits) {
    return null;
  }
  const remainder = t.slice(0, m.index).replace(/[\s,;]+$/g, '').trim();
  if (!remainder) {
    return null;
  }
  return { remainder, zipDigits: z.digits };
}

export type ParsedCityStateZip =
  | { ok: true; city: string; stateAbbr: string; zipDigits: string | null }
  | { ok: false };

/**
 * Like {@link tryParseCityStateCombined}, plus optional trailing U.S. ZIP in the same utterance
 * (e.g. "Dover, Delaware, 19901", "Dover DE 19901", "Dover Delaware 1 9 9 0 1").
 */
export function tryParseCityStateZipCombined(raw: string): ParsedCityStateZip {
  const zPart = extractTrailingZipFromUtterance(raw);
  const core = zPart?.remainder ?? raw.trim();
  if (!core) {
    return { ok: false };
  }
  const cs = tryParseCityStateCombined(core);
  if (!cs.ok) {
    return { ok: false };
  }
  return {
    ok: true,
    city: cs.city,
    stateAbbr: cs.stateAbbr,
    zipDigits: zPart?.zipDigits ?? null,
  };
}

/** Normalize spoken or Twilio inbound NANP to `+1XXXXXXXXXX`, or null if not 10 US digits. */
export function normalizeNanpPhoneToE164(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    const c = d.slice(1);
    return c.length === 10 ? `+1${c}` : null;
  }
  if (d.length === 10) {
    return `+1${d}`;
  }
  return null;
}

export function validateStoredCallbackPhoneE164(e164: string): ValidatorResult {
  const n = normalizeNanpPhoneToE164(e164);
  if (!n) {
    return { ok: false, reason: 'invalid_nanp' };
  }
  return { ok: true };
}

export function validateSpokenNanpPhone(raw: string): { ok: true; e164: string } | { ok: false; reason: string } {
  const n = normalizeNanpPhoneToE164(raw);
  if (!n) {
    return { ok: false, reason: 'need_ten_digits' };
  }
  return { ok: true, e164: n };
}

/** Compact NANP for scripted readback / SAY_THIS (not spelled-out digits). */
export function formatNanpE164ForAssistantSpeech(e164: string): string {
  const d = e164.replace(/\D/g, '');
  const core = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : '';
  if (core.length !== 10) {
    return e164.trim();
  }
  return `(${core.slice(0, 3)}) ${core.slice(3, 6)}-${core.slice(6)}`;
}

export function validateZip(raw: string): ValidatorResult & { digits?: string } {
  const n = normalizeUtterance(raw);
  const digits = n.replace(/\D/g, '');
  if (digits.length === 5) {
    return { ok: true, digits };
  }
  if (digits.length < 5) {
    return { ok: false, reason: 'need_five_digits' };
  }
  return { ok: false, reason: 'too_many_digits' };
}

/** 1–4 digits from a failed ZIP attempt, for narrow reprompts (e.g. "I caught 1 9 9 0"). */
export function extractPartialZipDigits(raw: string): string | null {
  const digits = normalizeUtterance(raw).replace(/\D/g, '');
  if (digits.length >= 1 && digits.length <= 4) {
    return digits;
  }
  if (digits.length === 5) {
    return null;
  }
  if (digits.length > 5) {
    return digits.slice(0, 4);
  }
  return null;
}

export function formatDigitsForSpeechAck(digits: string): string {
  return digits.split('').join(' ');
}

/**
 * US NANP digit string when utterance has some digits but not a full 10-digit number.
 * Returns null if empty or already a valid E.164 parse.
 */
export function extractPartialNanpDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, '');
  if (d.length >= 11 && d.startsWith('1')) {
    const c = d.slice(1, 11);
    return c.length === 10 ? null : c.slice(0, Math.min(9, c.length));
  }
  if (d.length === 10) {
    return null;
  }
  if (d.length >= 5 && d.length <= 9) {
    return d;
  }
  if (d.length >= 1 && d.length <= 4) {
    return d;
  }
  return null;
}

export type CallbackWindow = 'morning' | 'afternoon' | 'evening';

export function validateCallbackWindow(
  raw: string
): { ok: true; normalized: CallbackWindow } | { ok: false; reason: string } {
  const n = normalizeUtterance(raw);
  if (!n) {
    return { ok: false, reason: 'empty' };
  }
  const maybeState = validateState(raw.trim());
  if (maybeState.ok && !CALLBACK_WINDOW_TERMS.test(n) && !/\d/.test(n)) {
    return { ok: false, reason: 'looks_like_place_state' };
  }
  if (
    /\b(morning|mornings|early|a\.?\s*m\.?|before noon|breakfast)\b/.test(n) &&
    !/\b(afternoon|evening|night|p\.?\s*m\.?)\b/.test(n)
  ) {
    return { ok: true, normalized: 'morning' };
  }
  if (/\b(afternoon|midday|lunch|noon)\b/.test(n) && !/\b(morning|evening)\b/.test(n)) {
    return { ok: true, normalized: 'afternoon' };
  }
  if (/\b(evening|evenings|tonight|late|sunset|p\.?\s*m\.?|after work|dinner)\b/.test(n)) {
    return { ok: true, normalized: 'evening' };
  }
  if (n === 'morning' || n === 'afternoon' || n === 'evening') {
    return { ok: true, normalized: n as CallbackWindow };
  }
  return { ok: false, reason: 'not_a_time_window' };
}

/**
 * Caller is asking for a callback but has not yet given a time window (morning/afternoon/evening).
 * Used to re-prompt with the callback question without burning retry budget.
 */
export function matchCallbackRequestIntent(raw: string): boolean {
  if (validateCallbackWindow(raw).ok) {
    return false;
  }
  const n = normalizeUtterance(raw);
  if (!n) {
    return false;
  }
  return (
    /\b(call\s*back|call\s+me\s+back|phone\s*back|ring\s+me\s+back)\b/.test(n) &&
    /\b(can|could|may|would|want|need|like|please|get|have|schedule|set\s+up)\b/.test(n)
  );
}

export function looksLikeCallbackWindowLanguage(raw: string): boolean {
  return validateCallbackWindow(raw).ok;
}

export function displayCallbackWindow(w: CallbackWindow): string {
  if (w === 'morning') {
    return 'the morning';
  }
  if (w === 'afternoon') {
    return 'the afternoon';
  }
  return 'the evening';
}

export function looksLikeCityOrAddressFragment(raw: string): boolean {
  const n = normalizeUtterance(raw);
  if (STREETISH.test(n)) {
    return true;
  }
  if (/\b\d{1,4}\s+[a-z]/i.test(raw) && /\b(st|street|ave|rd|dr|lane)\b/i.test(n)) {
    return true;
  }
  if (/po box|p\.?\s*o\.?\s*box/i.test(raw)) {
    return true;
  }
  return false;
}

export function matchYes(raw: string): boolean {
  const n = normalizeUtterance(raw);
  if (!n) {
    return false;
  }
  if (/^(yes|yeah|yep|yup|correct|right|sure|ok|okay)$/i.test(n)) {
    return true;
  }
  return /\b(that'?s\s+right|that is right|sounds\s+right|you\s+got\s+it)\b/i.test(n);
}

/**
 * True when the caller affirms the address (including "yes" followed by another clause).
 * Avoids an extra confirm_unclear turn for lines like "yes I'd like a callback".
 */
export function matchAddressConfirmAffirmative(raw: string): boolean {
  if (matchYes(raw)) {
    return true;
  }
  const n = normalizeUtterance(raw);
  if (!n) {
    return false;
  }
  return /^(yes|yeah|yep|yup|correct|right|sure|ok|okay)\b/.test(n);
}

export function matchNo(raw: string): boolean {
  const n = normalizeUtterance(raw);
  if (!n) {
    return false;
  }
  if (/^(no|nope|nah|incorrect|wrong)$/i.test(n)) {
    return true;
  }
  return /\b(that'?s\s+wrong|that is wrong|not\s+correct|not\s+right)\b/i.test(n);
}

/** True when caller declines the one-shot optional technician note (or empty utterance). */
export function matchOptionalDetailDecline(raw: string): boolean {
  const t = raw.trim();
  if (!t) {
    return true;
  }
  if (matchNo(raw)) {
    return true;
  }
  const n = normalizeUtterance(raw);
  if (
    /^(no|nope|nah)(\s+thanks?|\s+thank\s+you)?$/i.test(n) ||
    /\b(that'?s\s+it|that is it|nothing\s+else|not\s+really|all\s+set|we'?re\s+good|i'?m\s+good)\b/i.test(
      n
    )
  ) {
    return true;
  }
  return false;
}
