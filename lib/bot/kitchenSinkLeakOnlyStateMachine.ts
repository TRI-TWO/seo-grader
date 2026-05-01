import {
  KITCHEN_SINK_LEAK_NORMALIZED,
  inferKitchenSinkLeakTriage,
  matchPrimaryLeakChoice,
  matchSecondaryLeakChoice,
  parseHardLeakLocationOverrideFromUtterance,
  stripLeakLocationCorrectionPrefix,
  type KitchenSinkLeakPrimary,
  type KitchenSinkTriageInferResult,
} from '@/lib/bot/kitchenSinkLeakOnlyMatchers';
import {
  matchPlumbingIntakeIssue,
  plumbingIssueAckLine,
  SUPPORTED_PLUMBING_INTAKE_ISSUES,
  type PlumbingIntakeIssue,
} from '@/lib/bot/plumbingIntakeMatchers';
import {
  EXTERIOR_PAINT_ISSUE,
  GENERAL_PAINT_ISSUE,
  INTERIOR_PAINT_ISSUE,
  LIGHT_TRIM_ISSUE,
  matchPaintingIntakeIssue,
  paintingIssueAckLine,
  SUPPORTED_PAINTING_INTAKE_ISSUES,
  type PaintingIntakeIssue,
} from '@/lib/bot/paintingIntakeMatchers';
import type { KitchenSinkLeakOnlyActiveTestMode } from '@/lib/bot/kitchenSinkLeakOnlyVoiceMode';
import {
  collapseRepeatedUtterance,
  displayCallbackWindow,
  extractCallerNameForIntake,
  matchAddressConfirmAffirmative,
  matchAddressRepairIntent,
  matchAddressResetOnlyIntent,
  matchContinueAddressCaptureIntent,
  matchCallbackRequestIntent,
  matchNo,
  matchOptionalDetailDecline,
  matchThanks,
  isUnusableCallbackPhoneTranscript,
  matchYes,
  extractPartialNanpDigits,
  extractPartialZipDigits,
  formatDigitsForSpeechAck,
  formatNanpE164ForAssistantSpeech,
  normalizeNanpPhoneToE164,
  extractHouseNumberDigitsIfDigitsOnlyUtterance,
  normalizeStreetAbbreviations,
  streetLineLooksCompleteEnoughForProgress,
  titleCaseStreetWordsForSpeech,
  tryParseCityStateZipCombined,
  utteranceSuggestsLockedSlotCorrection,
  isUnusableIssueTranscript,
  matchCallbackNumberIncompleteObjection,
  validateCallbackWindow,
  validateCity,
  validateName,
  validateSpokenNanpPhone,
  validateState,
  validateStoredCallbackPhoneE164,
  tryParseStreetLineAndCity,
  validateStreet,
  validateZip,
  type CallbackWindow,
} from '@/lib/bot/kitchenSinkLeakOnlyValidators';

export type KitchenSinkLeakOnlyFsmState =
  | 'greeting'
  | 'issue_capture'
  | 'painting_scope_capture'
  | 'kitchen_sink_confirm'
  | 'leak_location_primary_capture'
  | 'leak_location_secondary_capture'
  | 'collect_name'
  | 'collect_street_address'
  | 'collect_unit'
  | 'collect_city'
  | 'collect_state'
  | 'collect_zip'
  | 'address_city_deferred_sms'
  | 'address_confirm'
  | 'callback_number_confirm'
  | 'callback_number_collect'
  | 'collect_callback_time'
  | 'callback_confirm'
  | 'close_wait'
  | 'close'
  | 'unsupported_end'
  | 'leak_location_unclear_end';

/** Primary leak area after triage (or unknown after max reprompts). */
export type KitchenSinkLeakPrimaryStored = 'faucet' | 'below_sink' | 'unknown';

/** Narrower cue bucket after triage (or unknown after max reprompts). */
export type KitchenSinkLeakSecondaryStored = 'faucet_self' | 'pipe' | 'drain' | 'unknown';

export type KitchenSinkCollected = {
  normalizedIssue: string | null;
  leakPrimary: KitchenSinkLeakPrimaryStored | null;
  leakSecondary: KitchenSinkLeakSecondaryStored | null;
  callerName: string | null;
  serviceAddress: string | null;
  streetAddress: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  /** Inbound PSTN from Twilio `From` (normalized +1… when possible); never used as final callback without confirm. */
  inboundCallerPhoneE164: string | null;
  /** Confirmed best callback number (E.164). */
  callbackPhoneNumber: string | null;
  callbackPhoneSource: 'inbound_confirmed' | 'spoken' | null;
  callbackTimePreference: string | null;
  /** When true, city/state/ZIP will be finished by SMS; voice intake continues with street + callback. */
  addressRemainderDeferredToSms: boolean;
  /** Last partial ZIP digits heard (1–4) for narrow reprompt. Cleared when ZIP validates. */
  zipPartialDigits: string | null;
  /** House number digits from a digits-only transcript; next turn may supply street name only. */
  streetNumberPending: string | null;
  /** Painting-specific follow-up stage before name capture (optional for backward compatibility). */
  paintingScopeStage?: 'need_interior_or_exterior' | 'need_interior_surface' | 'need_exterior_surface' | null;
  /** Painting-specific scope answer captured from follow-up prompts. */
  paintingSurfaceScope?: 'walls' | 'ceiling' | 'both' | 'siding' | 'fascia_trim' | 'exterior_other' | null;
  /** Partial NANP digits from a failed callback capture, for narrow reprompt. */
  callbackPhonePartialDigits: string | null;
  /** Optional: apartment / suite / unit number. */
  unitOrSuite: string | null;
  /** Once true, stray ASR must not overwrite the slot unless caller signals correction. */
  streetLocked: boolean;
  cityLocked: boolean;
  stateLocked: boolean;
  zipLocked: boolean;
  callbackLocked: boolean;
  /**
   * After caller rejects/disputes ANI callback confirm, allow explicit NANP collection.
   * When false and inbound is valid, `callback_number_collect` is not a legal entry except via this flag.
   */
  callbackInboundConfirmRejected: boolean;
};

export const REFUSAL_LINE =
  "I'm sorry — that's outside what we can take on this line. We'll have someone follow up. Goodbye.";

/** Bridge sends this literal when ASR returns empty after meaningful audio during address capture. */
export const ASR_EMPTY_TRANSCRIPT_SIGNAL = '__ASR_EMPTY__';

export const kitchenSinkScriptVersion = 'plumbing_intake_v1';

const VALID_PRIMARY: ReadonlySet<KitchenSinkLeakPrimaryStored> = new Set([
  'faucet',
  'below_sink',
  'unknown',
]);

const VALID_SECONDARY: ReadonlySet<KitchenSinkLeakSecondaryStored> = new Set([
  'faucet_self',
  'pipe',
  'drain',
  'unknown',
]);

export const UNCLEAR_LOCATION_CLOSE =
  "I'm sorry, I'm having trouble understanding. We'll have someone reach out. Goodbye.";

export function greetingLine(companyName: string): string {
  const co = companyName.trim() || 'us';
  return `Hi, thanks for calling ${co}. What problem can I help you with today?`;
}

/** First line after triage completes; not scheduling or call-complete language. */
export const POST_TRIAGE_HANDOFF_NAME_LINE = "Got it. What's your name?" as const;

const SCRIPT = {
  kitchenSinkConfirm: 'Just to confirm, this is your kitchen sink?',
  issueRepromptKitchenSink: 'What plumbing issue can we help with — for example a leak, clog, toilet, or water heater?',
  issueRepromptPlumbing: 'What plumbing issue can we help with today?',
  primaryLeak: 'Is it coming from the faucet or the pipes below the sink?',
  primaryLeakReprompt: 'Faucet or pipes below?',
  secondaryFaucetPath: 'Is it at the faucet, the handles, or the drain?',
  secondaryBelowPath: 'Is it the pipes under the sink, the drain, or something else right around the sink?',
  nameIntake: POST_TRIAGE_HANDOFF_NAME_LINE,
  name: "What's your name?",
  nameReprompt: "Sorry, I didn't catch that — what's your name?",
  street: "What's the street address?",
  streetPartial: "Sorry, I missed that. What's the street address?",
  streetHard: 'Please say the street address with house number first, then street name.',
  streetNameAfterHouseNumber: (digitsSpaced: string) =>
    `I heard house number ${digitsSpaced} — what's the street name?`,
  paintInteriorExteriorAsk: 'Is this interior or exterior painting?',
  paintInteriorExteriorReprompt: 'Please say interior or exterior.',
  paintInteriorSurfaceAsk: 'For interior painting, is this walls, ceiling, or both?',
  paintInteriorSurfaceReprompt: 'Please say walls, ceiling, or both.',
  paintExteriorSurfaceAsk: 'For exterior painting, is this siding, fascia or trim, or both?',
  paintExteriorSurfaceReprompt: 'Please say siding, fascia or trim, or both.',
  addressRepair: 'Sorry about that — go ahead with the street address.',
  addressMissedTranscriptStreet: "Sorry, I missed that. What's the street address?",
  addressMissedTranscriptCity:
    "Sorry, I missed that — what city is that address in?",
  addressMissedTranscriptState:
    "Sorry, I missed that — which U S state is that in?",
  addressMissedTranscriptZip:
    'Sorry, I missed that — what is the 5-digit zip code?',
  city: 'What city is that address in?',
  cityAfterPartialStreet: (street: string) =>
    `I caught ${street}. What city is that address in?`,
  cityReprompt: 'I need the city name. What city is the service address in?',
  cityAfterAddressConfirmNo: 'What city should we use for that street?',
  addressCityDeferredSms:
    "I'm having trouble with the city. We can text you shortly to finish the city and zip. Let's continue — please say okay, or go ahead.",
  addressVoiceCaptureDeferredSms:
    "I'm having trouble capturing that on the line. We can text you shortly to finish the address. Let's continue — please say okay, or go ahead.",
  state: 'What state is that in?',
  stateReprompt: 'Which U S state is that address in?',
  zip: 'What is the 5-digit zip code?',
  zipReprompt: 'What is the 5-digit zip code for that address?',
  zipAfterPartial: (partial: string) =>
    `I caught ${formatDigitsForSpeechAck(partial)}. What is the full five-digit ZIP code?`,
  addressConfirm: (addr: string) => `I have ${addr}. Is that address correct?`,
  unitAsk: 'Is there an apartment, suite, or unit number?',
  unitReprompt: "Sorry, I missed that — is there an apartment, suite, or unit number?",
  callbackNumberConfirm: (display: string) =>
    `I have your callback number as ${display}. Is that the best number to reach you? Say yes or no.`,
  callbackNumberConfirmUnclear: 'Please say yes or no — is that the best number to reach you?',
  callbackNumberAsk: "What's the best number to call or text you at?",
  callbackNumberAskReprompt:
    "Sorry, I didn't catch that — what's the best number, area code first?",
  callbackNumberAfterPartial: (partial: string) =>
    `I caught ${formatDigitsForSpeechAck(partial)}. What is the full ten-digit callback number?`,
  callbackNumberSoftReprompt: "No problem — what's the best number to reach you at?",
  /** After a valid street line, do not imply the street was incomplete (keeps copy narrow). */
  streetAcceptedToCity: 'Got it. What city is that in?',
  callback: 'What callback window works best for you: morning, afternoon, or evening?',
  callbackReprompt: 'What callback window works best for you: morning, afternoon, or evening?',
  callbackTimeNarrowReprompt: 'Sorry, I missed that — morning, afternoon, or evening?',
  callbackConfirm: (windowPhrase: string) =>
    `Just to confirm, ${windowPhrase} is your preferred callback window — is that right?`,
  confirmUnclearAddr: 'Is that address correct? Please say yes or no.',
  confirmUnclearCb: 'Is that the callback time you want? Please say yes or no.',
  contaminationZip: "Thanks — I'm still finishing the address. What is the 5-digit zip code?",
  closeSummary: (name: string, addr: string, windowPhrase: string, phoneDisplay: string | null) => {
    const reach = phoneDisplay ? ` We'll reach you at ${phoneDisplay}.` : '';
    return (
      `Thanks, ${name}. I have you at ${addr}. Best callback time is ${windowPhrase}.${reach} ` +
      `You'll receive a confirmation text shortly. We've received your request and our team will follow up.`
    );
  },
  closeSignoff:
    "Perfect, I've got everything I need. Someone from the team will follow up with you soon. Thanks for calling. Goodbye.",
  closeThanksReply: "You're welcome. Thanks for calling. Goodbye.",
  closeShortDeferred: (name: string, phoneDisplay: string | null, windowPhrase: string) => {
    const phone =
      phoneDisplay != null
        ? `We'll share ${windowPhrase} as your preferred callback window at ${phoneDisplay}.`
        : `We'll share ${windowPhrase} as your preferred callback window and confirm the best number separately.`;
    return `Perfect, ${name}. ${phone} We'll text you shortly to finish the address. Thanks for calling. Goodbye.`;
  },
  closeShortFull: (name: string, phoneDisplay: string | null, windowPhrase: string) => {
    const phone =
      phoneDisplay != null
        ? `We'll share ${windowPhrase} as your preferred callback window at ${phoneDisplay}.`
        : `We'll share ${windowPhrase} as your preferred callback window and confirm the best number separately.`;
    return `Perfect, ${name}. ${phone} Thanks for calling. Goodbye.`;
  },
} as const;

function issueRepromptLineForMode(mode: KitchenSinkLeakOnlyActiveTestMode): string {
  return mode === 'painting_intake'
    ? 'What paint or light-trim project can we help with today?'
    : SCRIPT.issueRepromptPlumbing;
}

function refusalLineForMode(mode: KitchenSinkLeakOnlyActiveTestMode): string {
  return mode === 'painting_intake'
    ? "I'm sorry — we're only able to assist with painting and light trim work on this line. We'll have someone follow up. Goodbye."
    : REFUSAL_LINE;
}

function supportsIssueForMode(mode: KitchenSinkLeakOnlyActiveTestMode, issue: string | null): boolean {
  if (!issue) {
    return false;
  }
  if (mode === 'painting_intake') {
    return SUPPORTED_PAINTING_INTAKE_ISSUES.has(issue);
  }
  return SUPPORTED_PLUMBING_INTAKE_ISSUES.has(issue);
}

function parsePaintingInteriorExterior(utterance: string): 'interior' | 'exterior' | null {
  const n = collapseRepeatedUtterance(utterance).toLowerCase();
  if (/\b(interior|inside|indoors?|living\s+room|bedroom|bathroom|kitchen|hallway|basement)\b/.test(n)) {
    return 'interior';
  }
  if (/\b(exterior|outside|outdoors?|siding|fascia|soffit|stucco|garage\s+door|fence)\b/.test(n)) {
    return 'exterior';
  }
  return null;
}

function parsePaintingInteriorSurface(utterance: string): 'walls' | 'ceiling' | 'both' | null {
  const n = collapseRepeatedUtterance(utterance).toLowerCase();
  const hasWalls = /\b(wall|walls)\b/.test(n);
  const hasCeiling = /\b(ceiling|ceilings)\b/.test(n);
  if (/\b(both|all|everything)\b/.test(n) || (hasWalls && hasCeiling)) {
    return 'both';
  }
  if (hasWalls) {
    return 'walls';
  }
  if (hasCeiling) {
    return 'ceiling';
  }
  return null;
}

function parsePaintingExteriorSurface(utterance: string): 'siding' | 'fascia_trim' | 'both' | 'exterior_other' | null {
  const n = collapseRepeatedUtterance(utterance).toLowerCase();
  const hasSiding = /\b(siding|stucco)\b/.test(n);
  const hasFasciaTrim = /\b(fascia|soffit|trim)\b/.test(n);
  if (/\b(both|all|everything)\b/.test(n) || (hasSiding && hasFasciaTrim)) {
    return 'both';
  }
  if (hasSiding) {
    return 'siding';
  }
  if (hasFasciaTrim) {
    return 'fascia_trim';
  }
  if (/\b(exterior|outside|outdoors?)\b/.test(n)) {
    return 'exterior_other';
  }
  return null;
}

function formatNanpE164ForAssistantSpeechHyphen(e164: string): string {
  const d = e164.replace(/\D/g, '');
  const core = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : '';
  if (core.length !== 10) {
    return formatNanpE164ForAssistantSpeech(e164);
  }
  return `${core.slice(0, 3)}-${core.slice(3, 6)}-${core.slice(6)}`;
}

function lockedSpokenCallbackPhoneDisplay(c: KitchenSinkCollected): string | null {
  const e164 = c.callbackPhoneNumber;
  if (!e164 || !validateStoredCallbackPhoneE164(e164).ok) {
    return null;
  }
  const src = c.callbackPhoneSource;
  const trusted = c.callbackLocked || src === 'inbound_confirmed' || src === 'spoken';
  if (!trusted) {
    return null;
  }
  return formatNanpE164ForAssistantSpeechHyphen(e164);
}

/**
 * True if a spoken line sounds like the call is booked / intake is finished before we have full lead data.
 * Used for tests and guardrails; the canonical fix is SAY_THIS-only session instructions in the bridge.
 */
export function lineContainsPrematureSchedulingPromise(line: string): boolean {
  const n = line.toLowerCase();
  const phrases = [
    'get that scheduled',
    'get that taken care',
    "we'll get that",
    'we will get that',
    "we'll have that scheduled",
    'we will have that scheduled',
    "you're all set",
    'you are all set',
    'all set on',
    'appointment is booked',
    'scheduled for you',
    "we've got that scheduled",
    'we have got that scheduled',
    'got that scheduled',
    'got you scheduled',
    'dispatch someone',
    'technician will be',
    'crew will be',
  ];
  return phrases.some((p) => n.includes(p));
}

/** @deprecated Prefer SCRIPT constants in this module. */
export const LINES = {
  name: SCRIPT.name,
  address: SCRIPT.street,
  callback: SCRIPT.callback,
  close: "Thank you. We'll share this with the team and have someone follow up.",
} as const;

export type KitchenSinkSlotRetryKey =
  | 'name'
  | 'painting_scope'
  | 'street'
  | 'city'
  | 'state'
  | 'zip'
  | 'callback'
  | 'callback_phone'
  | 'address_asr_empty'
  | 'issue';

export type FsmTransitionLog = {
  fromState: KitchenSinkLeakOnlyFsmState;
  toState: KitchenSinkLeakOnlyFsmState;
  rawTranscript: string;
  normalizedValueWritten: string | null;
  validationOk: boolean;
  rejectionReason: string | null;
};

export type TransitionResult = {
  nextState: KitchenSinkLeakOnlyFsmState;
  assistantLine: string;
  issueMatchResult: { accepted: boolean; rejectReason: string | null } | null;
  collected: KitchenSinkCollected;
  leakLocationReprompts: number;
  secondaryLeakReprompts: number;
  pendingCallbackNormalized: CallbackWindow | null;
  slotRetryCounts: Partial<Record<KitchenSinkSlotRetryKey, number>>;
  endReason: string | null;
  callOutcome:
    | 'qualified_kitchen_sink_leak'
    | 'qualified_plumbing_intake'
    | 'unsupported_issue'
    | 'leak_location_unclear'
    | null;
  awaitingUserAudioAfter: boolean;
  transitionLog: FsmTransitionLog | null;
};

function initialCollected(): KitchenSinkCollected {
  return {
    normalizedIssue: null,
    leakPrimary: null,
    leakSecondary: null,
    callerName: null,
    serviceAddress: null,
    streetAddress: null,
    city: null,
    state: null,
    zip: null,
    inboundCallerPhoneE164: null,
    callbackPhoneNumber: null,
    callbackPhoneSource: null,
    callbackTimePreference: null,
    addressRemainderDeferredToSms: false,
    zipPartialDigits: null,
    streetNumberPending: null,
    paintingScopeStage: null,
    paintingSurfaceScope: null,
    callbackPhonePartialDigits: null,
    unitOrSuite: null,
    streetLocked: false,
    cityLocked: false,
    stateLocked: false,
    zipLocked: false,
    callbackLocked: false,
    callbackInboundConfirmRejected: false,
  };
}

function isCallbackPhoneResolved(c: KitchenSinkCollected): boolean {
  return Boolean(c.callbackPhoneNumber && validateStoredCallbackPhoneE164(c.callbackPhoneNumber).ok);
}

function hasInboundPhoneForConfirm(c: KitchenSinkCollected): boolean {
  return Boolean(c.inboundCallerPhoneE164 && validateStoredCallbackPhoneE164(c.inboundCallerPhoneE164).ok);
}

function mergeTriageInfer(
  collected: KitchenSinkCollected,
  inf: KitchenSinkTriageInferResult
): KitchenSinkCollected {
  let next = { ...collected };
  if (inf.primary) {
    if (inf.primary !== collected.leakPrimary) {
      next = { ...next, leakPrimary: inf.primary, leakSecondary: null };
    } else {
      next = { ...next, leakPrimary: inf.primary };
    }
  }
  if (inf.secondary) {
    next = { ...next, leakSecondary: inf.secondary };
  }
  return next;
}

function secondaryPromptForPrimary(p: KitchenSinkLeakPrimary): string {
  return p === 'faucet' ? SCRIPT.secondaryFaucetPath : SCRIPT.secondaryBelowPath;
}

function leakLocationCorrectedAckLine(
  primary: KitchenSinkLeakPrimaryStored,
  secondary: KitchenSinkLeakSecondaryStored
): string {
  if (primary === 'below_sink' && secondary === 'pipe') {
    return "Got it — below the sink at the pipes. What's your name?";
  }
  if (primary === 'below_sink' && secondary === 'drain') {
    return "Got it — below the sink at the drain. What's your name?";
  }
  if (primary === 'faucet' && secondary === 'drain') {
    return "Got it — at the faucet at the drain. What's your name?";
  }
  if (primary === 'faucet' && secondary === 'faucet_self') {
    return "Got it — at the faucet itself. What's your name?";
  }
  return POST_TRIAGE_HANDOFF_NAME_LINE;
}

function leakLocationCorrectedThenSecondaryPrompt(primary: KitchenSinkLeakPrimary): string {
  const got = primary === 'below_sink' ? 'Got it — below the sink.' : 'Got it — at the faucet.';
  return `${got} ${secondaryPromptForPrimary(primary)}`;
}

export function formatFullAddress(c: KitchenSinkCollected): string {
  const { streetAddress, unitOrSuite, city, state, zip } = c;
  if (!streetAddress?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
    return '';
  }
  const unit = unitOrSuite?.trim();
  const streetLine = unit ? `${streetAddress.trim()} ${unit}` : streetAddress.trim();
  return `${streetLine}, ${city.trim()}, ${state.trim()} ${zip.trim()}`;
}

/** Recap line for close: full address, or street + SMS deferral note. */
export function formatAddressForCloseSummary(c: KitchenSinkCollected): string {
  if (c.addressRemainderDeferredToSms) {
    if (
      c.streetAddress?.trim() &&
      c.streetLocked &&
      validateStreet(c.streetAddress).ok
    ) {
      return `${c.streetAddress.trim()} — city and zip by text follow-up.`;
    }
    return 'your service address — details will be confirmed by text.';
  }
  if (
    !(c.streetLocked && c.cityLocked && c.stateLocked && c.zipLocked) ||
    !c.streetAddress?.trim() ||
    !validateStreet(c.streetAddress).ok ||
    !c.city?.trim() ||
    !validateCity(c.city).ok ||
    !c.state?.trim() ||
    !validateState(c.state).ok ||
    !c.zip?.trim() ||
    !validateZip(c.zip).ok
  ) {
    return 'your service address — details will be confirmed separately.';
  }
  return formatFullAddress(c);
}

/** Address confirm / recap speech: only when every slot is locked and validators pass (no fuzzy substitutes). */
export function formatLockedFullAddressForSpeech(c: KitchenSinkCollected): string {
  if (
    !(c.streetLocked && c.cityLocked && c.stateLocked && c.zipLocked) ||
    !c.streetAddress?.trim() ||
    !validateStreet(c.streetAddress).ok ||
    !c.city?.trim() ||
    !validateCity(c.city).ok ||
    !c.state?.trim() ||
    !validateState(c.state).ok ||
    !c.zip?.trim() ||
    !validateZip(c.zip).ok
  ) {
    return '';
  }
  return formatFullAddress(c);
}

function syncServiceAddress(collected: KitchenSinkCollected): KitchenSinkCollected {
  const line = formatFullAddress(collected);
  return line ? { ...collected, serviceAddress: line } : { ...collected };
}

export function allRequiredFieldsValid(
  c: KitchenSinkCollected,
  activeTestMode: KitchenSinkLeakOnlyActiveTestMode = 'plumbing_intake'
): boolean {
  if (!supportsIssueForMode(activeTestMode, c.normalizedIssue)) {
    return false;
  }
  if (c.normalizedIssue === KITCHEN_SINK_LEAK_NORMALIZED) {
    if (c.leakPrimary == null || !VALID_PRIMARY.has(c.leakPrimary)) {
      return false;
    }
    if (c.leakSecondary == null || !VALID_SECONDARY.has(c.leakSecondary)) {
      return false;
    }
  } else {
    if (c.leakPrimary == null || !VALID_PRIMARY.has(c.leakPrimary)) {
      return false;
    }
    if (c.leakSecondary == null || !VALID_SECONDARY.has(c.leakSecondary)) {
      return false;
    }
  }
  if (!c.callerName || !validateName(c.callerName).ok) {
    return false;
  }
  if (!c.addressRemainderDeferredToSms) {
    if (!plausibleStreetStored(c)) {
      return false;
    }
    if (!c.city || !validateCity(c.city).ok) {
      return false;
    }
    if (!c.state || !validateState(c.state).ok) {
      return false;
    }
    if (!c.zip || !validateZip(c.zip).ok) {
      return false;
    }
  }
  if (!isCallbackPhoneResolved(c)) {
    return false;
  }
  const cbw = validateCallbackWindow(c.callbackTimePreference ?? '');
  if (!cbw.ok) {
    return false;
  }
  return true;
}

function clearAddressSlots(collected: KitchenSinkCollected): KitchenSinkCollected {
  return {
    ...collected,
    streetAddress: null,
    city: null,
    state: null,
    zip: null,
    serviceAddress: null,
    addressRemainderDeferredToSms: false,
    zipPartialDigits: null,
    streetNumberPending: null,
    streetLocked: false,
    cityLocked: false,
    stateLocked: false,
    zipLocked: false,
  };
}

function routeToMissingSlotForClose(
  collected: KitchenSinkCollected,
  activeTestMode: KitchenSinkLeakOnlyActiveTestMode
): {
  state: KitchenSinkLeakOnlyFsmState;
  line: string;
  collectedPatch?: Partial<KitchenSinkCollected>;
} {
  if (!supportsIssueForMode(activeTestMode, collected.normalizedIssue)) {
    return { state: 'issue_capture', line: issueRepromptLineForMode(activeTestMode) };
  }
  if (collected.normalizedIssue === KITCHEN_SINK_LEAK_NORMALIZED) {
    if (collected.leakPrimary == null || !VALID_PRIMARY.has(collected.leakPrimary)) {
      return { state: 'kitchen_sink_confirm', line: SCRIPT.kitchenSinkConfirm };
    }
    if (collected.leakSecondary == null || !VALID_SECONDARY.has(collected.leakSecondary)) {
      if (collected.leakPrimary === 'faucet' || collected.leakPrimary === 'below_sink') {
        return {
          state: 'leak_location_secondary_capture',
          line: secondaryPromptForPrimary(collected.leakPrimary),
        };
      }
      if (collected.leakPrimary === 'unknown') {
        return {
          state: 'collect_name',
          line: SCRIPT.nameIntake,
          collectedPatch: { leakSecondary: 'unknown' },
        };
      }
      return { state: 'leak_location_primary_capture', line: SCRIPT.primaryLeak };
    }
  }
  if (collected.normalizedIssue !== KITCHEN_SINK_LEAK_NORMALIZED) {
    if (
      collected.leakPrimary == null ||
      !VALID_PRIMARY.has(collected.leakPrimary) ||
      collected.leakSecondary == null ||
      !VALID_SECONDARY.has(collected.leakSecondary)
    ) {
      return { state: 'issue_capture', line: issueRepromptLineForMode(activeTestMode) };
    }
  }
  if (!collected.callerName || !validateName(collected.callerName).ok) {
    return { state: 'collect_name', line: SCRIPT.nameReprompt };
  }
  if (!collected.addressRemainderDeferredToSms) {
    if (!plausibleStreetStored(collected)) {
      return { state: 'collect_street_address', line: SCRIPT.street };
    }
    if (!collected.city || !validateCity(collected.city).ok) {
      return { state: 'collect_city', line: SCRIPT.city };
    }
    if (!collected.state || !validateState(collected.state).ok) {
      return { state: 'collect_state', line: SCRIPT.state };
    }
    if (!collected.zip || !validateZip(collected.zip).ok) {
      return { state: 'collect_zip', line: SCRIPT.zip };
    }
  }
  if (!isCallbackPhoneResolved(collected)) {
    if (hasInboundPhoneForConfirm(collected)) {
      const disp = formatNanpE164ForAssistantSpeechHyphen(
        normalizeNanpPhoneToE164(collected.inboundCallerPhoneE164!)!
      );
      return { state: 'callback_number_confirm', line: SCRIPT.callbackNumberConfirm(disp) };
    }
    return { state: 'callback_number_collect', line: SCRIPT.callbackNumberAsk };
  }
  const cb = validateCallbackWindow(collected.callbackTimePreference ?? '');
  if (!collected.callbackTimePreference || !cb.ok) {
    return { state: 'collect_callback_time', line: SCRIPT.callback };
  }
  const cw = validateCallbackWindow(collected.callbackTimePreference);
  const wp = cw.ok ? displayCallbackWindow(cw.normalized) : collected.callbackTimePreference;
  console.warn('VOICE_FSM_ROUTE_MISSING_SLOT_FALLTHROUGH', {
    normalizedIssue: collected.normalizedIssue,
    activeTestMode,
    addressRemainderDeferredToSms: collected.addressRemainderDeferredToSms,
    callerName: collected.callerName,
    nameOk: collected.callerName ? validateName(collected.callerName).ok : false,
    plausibleStreet: plausibleStreetStored(collected),
    callbackPhoneResolved: isCallbackPhoneResolved(collected),
    callbackPref: collected.callbackTimePreference,
    leakPrimary: collected.leakPrimary,
    leakSecondary: collected.leakSecondary,
  });
  return { state: 'callback_confirm', line: SCRIPT.callbackConfirm(wp) };
}

function keepCallbackPreferenceWhenCloseBlockedRepair(rState: KitchenSinkLeakOnlyFsmState): boolean {
  return (
    rState === 'collect_callback_time' ||
    rState === 'callback_confirm' ||
    rState === 'callback_number_confirm' ||
    rState === 'callback_number_collect' ||
    rState === 'address_city_deferred_sms' ||
    rState === 'collect_name' ||
    rState === 'collect_street_address' ||
    rState === 'collect_unit' ||
    rState === 'collect_city' ||
    rState === 'collect_state' ||
    rState === 'collect_zip'
  );
}

function firstMissingAddressSlot(collected: KitchenSinkCollected): KitchenSinkLeakOnlyFsmState | null {
  if (!plausibleStreetStored(collected)) {
    return 'collect_street_address';
  }
  if (collected.addressRemainderDeferredToSms) {
    return null;
  }
  if (!collected.city || !validateCity(collected.city).ok) {
    return 'collect_city';
  }
  if (!collected.state || !validateState(collected.state).ok) {
    return 'collect_state';
  }
  if (!collected.zip || !validateZip(collected.zip).ok) {
    return 'collect_zip';
  }
  return null;
}

export function isKitchenSinkAddressCapturePipelineState(
  s: KitchenSinkLeakOnlyFsmState
): boolean {
  return (
    s === 'collect_street_address' ||
    s === 'collect_unit' ||
    s === 'collect_city' ||
    s === 'collect_state' ||
    s === 'collect_zip'
  );
}

/** Spoken line when ASR returns empty after substantial committed audio during address capture. */
export function assistantLineAfterMissedTranscriptDuringAddressCapture(
  s: KitchenSinkLeakOnlyFsmState,
  collected?: KitchenSinkCollected
): string {
  switch (s) {
    case 'collect_street_address':
      return SCRIPT.addressMissedTranscriptStreet;
    case 'collect_city':
      return SCRIPT.addressMissedTranscriptCity;
    case 'collect_state':
      return SCRIPT.addressMissedTranscriptState;
    case 'collect_zip':
      return SCRIPT.addressMissedTranscriptZip;
    case 'address_confirm':
      return SCRIPT.confirmUnclearAddr;
    default:
      return promptForAddressState(s, collected);
  }
}

/** Address steps where an empty ASR commit should advance deferral / reprompt logic (bridge). */
export function isAddressPipelineStateForEmptyTranscript(s: KitchenSinkLeakOnlyFsmState): boolean {
  return (
    isKitchenSinkAddressCapturePipelineState(s) ||
    s === 'address_confirm' ||
    s === 'address_city_deferred_sms'
  );
}

function promptForAddressState(s: KitchenSinkLeakOnlyFsmState, c?: KitchenSinkCollected): string {
  switch (s) {
    case 'collect_street_address':
      return SCRIPT.street;
    case 'collect_city':
      return SCRIPT.city;
    case 'collect_state':
      return SCRIPT.state;
    case 'collect_zip':
      if (c?.zipPartialDigits) {
        return SCRIPT.zipAfterPartial(c.zipPartialDigits);
      }
      return SCRIPT.zip;
    default:
      return SCRIPT.street;
  }
}

function formatCityCollected(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function plausibleStreetStored(c: KitchenSinkCollected): boolean {
  const s = c.streetAddress?.trim();
  if (!s) {
    return false;
  }
  const w = normalizeStreetAbbreviations(s);
  return validateStreet(w).ok && streetLineLooksCompleteEnoughForProgress(w);
}

function fullAddressValid(c: KitchenSinkCollected): boolean {
  return Boolean(formatFullAddress(c));
}

function addressAsrEmptyDeferThreshold(state: KitchenSinkLeakOnlyFsmState, c: KitchenSinkCollected): number {
  if (plausibleStreetStored(c) && (state === 'collect_city' || state === 'collect_state' || state === 'collect_zip')) {
    return 6;
  }
  if (state === 'collect_street_address') {
    return 6;
  }
  return 4;
}

/** Exported for bridge debug logs only (not used for control flow outside FSM). */
export function addressAsrEmptyDeferThresholdForDebug(
  state: KitchenSinkLeakOnlyFsmState,
  c: KitchenSinkCollected
): number {
  return addressAsrEmptyDeferThreshold(state, c);
}

const STREET_CAPTURE_NUMBER_WORDS = new Set([
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
  'hundred',
  'thousand',
  'oh',
  'o',
]);

type StreetCaptureTranscriptShapeLocal =
  | 'full_street_candidate'
  | 'partial_number_only'
  | 'missing_number'
  | 'empty'
  | 'short_garbage'
  | 'other_unusable';

function streetCaptureTranscriptShapeLocal(raw: string): StreetCaptureTranscriptShapeLocal {
  const t = raw.trim();
  if (!t) return 'empty';
  const cleaned = t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 'empty';
  if (tokens.length === 1 && tokens[0].length === 1) return 'short_garbage';
  if (tokens.length === 1 && tokens[0].length <= 2 && !/\d/.test(tokens[0])) return 'short_garbage';

  const hasNumber = tokens.some((tok) => /^\d+$/.test(tok) || STREET_CAPTURE_NUMBER_WORDS.has(tok));
  const hasStreetNameToken = tokens.some((tok) => /[a-z]/.test(tok) && !STREET_CAPTURE_NUMBER_WORDS.has(tok));
  if (hasNumber && hasStreetNameToken) return 'full_street_candidate';
  if (hasNumber && !hasStreetNameToken) return 'partial_number_only';
  if (!hasNumber && hasStreetNameToken) return 'missing_number';
  return 'other_unusable';
}

/** True when first token looks like the start of a house number (digits or spoken digit words). */
function utteranceLeadsWithStreetHouseToken(trim: string): boolean {
  const cleaned = trim
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const first = cleaned.split(/\s+/).filter(Boolean)[0];
  if (!first) return false;
  if (/^\d+$/.test(first)) return true;
  return STREET_CAPTURE_NUMBER_WORDS.has(first);
}

export function transitionKitchenSinkLeakOnly(params: {
  state: KitchenSinkLeakOnlyFsmState;
  utterance: string;
  collected: KitchenSinkCollected;
  leakLocationReprompts: number;
  secondaryLeakReprompts?: number;
  companyName: string;
  pendingCallbackNormalized: CallbackWindow | null;
  slotRetryCounts?: Partial<Record<KitchenSinkSlotRetryKey, number>>;
  activeTestMode?: KitchenSinkLeakOnlyActiveTestMode;
}): TransitionResult {
  const { state, utterance, companyName } = params;
  let collected = { ...params.collected };
  let leakLocationReprompts = params.leakLocationReprompts;
  let secondaryLeakReprompts = params.secondaryLeakReprompts ?? 0;
  let pendingCallbackNormalized = params.pendingCallbackNormalized;
  const activeTestMode = params.activeTestMode ?? 'plumbing_intake';
  const slotRetryCounts: Partial<Record<KitchenSinkSlotRetryKey, number>> = {
    ...(params.slotRetryCounts ?? {}),
  };
  let issueMatchResult: TransitionResult['issueMatchResult'] = null;
  let endReason: string | null = null;
  let callOutcome: TransitionResult['callOutcome'] = null;

  let trimUtterance = utterance.trim();

  function bump(k: KitchenSinkSlotRetryKey): void {
    slotRetryCounts[k] = (slotRetryCounts[k] ?? 0) + 1;
  }
  function reset(k: KitchenSinkSlotRetryKey): void {
    delete slotRetryCounts[k];
  }
  function snap(): Partial<Record<KitchenSinkSlotRetryKey, number>> {
    return { ...slotRetryCounts };
  }

  function fsmLog(
    fromState: KitchenSinkLeakOnlyFsmState,
    toState: KitchenSinkLeakOnlyFsmState,
    rawTranscript: string,
    normalizedValueWritten: string | null,
    validationOk: boolean,
    rejectionReason: string | null
  ): FsmTransitionLog {
    return {
      fromState,
      toState,
      rawTranscript,
      normalizedValueWritten,
      validationOk,
      rejectionReason,
    };
  }

  function br(
    partial: Omit<
      TransitionResult,
      | 'awaitingUserAudioAfter'
      | 'slotRetryCounts'
      | 'transitionLog'
      | 'leakLocationReprompts'
      | 'secondaryLeakReprompts'
    > & {
      awaitingUserAudioAfter?: boolean;
      leakLocationReprompts?: number;
      secondaryLeakReprompts?: number;
    },
    transitionLog: FsmTransitionLog | null = null
  ): TransitionResult {
    const listen =
      partial.nextState !== 'close' &&
      partial.nextState !== 'unsupported_end' &&
      partial.nextState !== 'leak_location_unclear_end';
    const tl =
      transitionLog ??
      fsmLog(state, partial.nextState, utterance, null, !partial.endReason, partial.endReason);
    return {
      ...partial,
      leakLocationReprompts: partial.leakLocationReprompts ?? leakLocationReprompts,
      secondaryLeakReprompts: partial.secondaryLeakReprompts ?? secondaryLeakReprompts,
      slotRetryCounts: snap(),
      transitionLog: tl,
      awaitingUserAudioAfter: partial.awaitingUserAudioAfter ?? listen,
    };
  }

  if (utterance === ASR_EMPTY_TRANSCRIPT_SIGNAL) {
    if (state === 'issue_capture') {
      bump('issue');
      return br(
        {
          nextState: 'issue_capture',
          assistantLine: issueRepromptLineForMode(activeTestMode),
          issueMatchResult: { accepted: false, rejectReason: 'asr_empty' },
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'issue_capture', utterance, null, false, 'issue_asr_empty')
      );
    }
    if (state === 'painting_scope_capture') {
      bump('painting_scope');
      const stage = collected.paintingScopeStage ?? 'need_interior_or_exterior';
      const line =
        stage === 'need_interior_surface'
          ? SCRIPT.paintInteriorSurfaceReprompt
          : stage === 'need_exterior_surface'
            ? SCRIPT.paintExteriorSurfaceReprompt
            : SCRIPT.paintInteriorExteriorReprompt;
      return br(
        {
          nextState: 'painting_scope_capture',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'painting_scope_capture', utterance, null, false, 'painting_scope_asr_empty')
      );
    }
    if (state === 'callback_number_confirm') {
      // Meaningful caller audio but STT returned empty; treat as "unclear" to keep the confirm loop moving.
      bump('callback_phone');
      const fails = slotRetryCounts.callback_phone ?? 0;
      // After repeated empty STT on a yes/no confirm, fall back to explicit number capture.
      if (fails >= 2) {
        if (collected.addressRemainderDeferredToSms) {
          return br(
            {
              nextState: 'callback_number_collect',
              assistantLine: SCRIPT.callbackNumberAsk,
              issueMatchResult: null,
              collected: { ...collected, callbackInboundConfirmRejected: true },
              leakLocationReprompts,
              secondaryLeakReprompts,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'callback_number_collect', utterance, null, false, 'callback_confirm_asr_empty_escalate_collect_deferred')
          );
        }
        if (hasInboundPhoneForConfirm(collected)) {
          return br(
            {
              nextState: 'callback_number_confirm',
              assistantLine: SCRIPT.callbackNumberConfirmUnclear,
              issueMatchResult: null,
              collected,
              leakLocationReprompts,
              secondaryLeakReprompts,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(
              state,
              'callback_number_confirm',
              utterance,
              null,
              false,
              'callback_confirm_asr_empty_keep_inbound_confirm'
            )
          );
        }
        return br(
          {
            nextState: 'callback_number_collect',
            assistantLine: SCRIPT.callbackNumberAsk,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'callback_number_collect', utterance, null, false, 'callback_confirm_asr_empty_escalate_collect')
        );
      }
      return br(
        {
          nextState: 'callback_number_confirm',
          assistantLine: SCRIPT.callbackNumberConfirmUnclear,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_confirm', utterance, null, false, 'callback_asr_empty_reprompt')
      );
    }
    if (state === 'callback_number_collect') {
      bump('callback_phone');
      return br(
        {
          nextState: 'callback_number_collect',
          assistantLine: SCRIPT.callbackNumberAskReprompt,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_collect', utterance, null, false, 'callback_phone_asr_empty')
      );
    }
    if (state === 'collect_callback_time') {
      bump('callback');
      return br(
        {
          nextState: 'collect_callback_time',
          assistantLine: SCRIPT.callbackReprompt,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_callback_time', utterance, null, false, 'callback_time_asr_empty')
      );
    }
    if (state === 'callback_confirm') {
      return br(
        {
          nextState: 'callback_confirm',
          assistantLine: SCRIPT.confirmUnclearCb,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_confirm', utterance, null, false, 'callback_confirm_asr_empty')
      );
    }
    if (state === 'close_wait') {
      // If caller is silent after the recap, proceed to deterministic signoff and hangup.
      return br(
        {
          nextState: 'close',
          assistantLine: SCRIPT.closeSignoff,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome:
            collected.normalizedIssue === KITCHEN_SINK_LEAK_NORMALIZED
              ? 'qualified_kitchen_sink_leak'
              : 'qualified_plumbing_intake',
          awaitingUserAudioAfter: false,
        },
        fsmLog(state, 'close', utterance, null, true, 'close_wait_asr_empty_autoclose')
      );
    }
    const asrAllowed: KitchenSinkLeakOnlyFsmState[] = [
      'collect_street_address',
      'collect_city',
      'collect_state',
      'collect_zip',
      'address_confirm',
    ];
    if (asrAllowed.includes(state)) {
      // If we already captured and locked a valid street, do not punish a choppy empty transcript
      // by looping street capture or deferring to SMS. Advance to city collection.
      if (
        state === 'collect_street_address' &&
        collected.streetLocked &&
        Boolean(collected.streetAddress?.trim()) &&
        validateStreet(collected.streetAddress ?? '').ok
      ) {
        reset('address_asr_empty');
        return br(
          {
            nextState: 'collect_city',
            assistantLine: SCRIPT.streetAcceptedToCity,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_city', utterance, collected.streetAddress, true, 'street_locked_asr_empty_advance_city')
        );
      }
      // If the full address is already valid, never defer "to finish the address by text".
      if (fullAddressValid(collected)) {
        return br(
          {
            nextState: 'address_confirm',
            assistantLine: SCRIPT.addressConfirm(formatFullAddress(collected)),
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'address_confirm', utterance, null, true, 'address_full_present_skip_sms_deferral')
        );
      }
      bump('address_asr_empty');
      const fails = slotRetryCounts.address_asr_empty ?? 0;
      const deferAt = addressAsrEmptyDeferThreshold(state, collected);
      if (fails >= deferAt) {
        reset('address_asr_empty');
        const streetOk =
          Boolean(collected.streetAddress?.trim()) && validateStreet(collected.streetAddress ?? '').ok;
        const deferLine = streetOk ? SCRIPT.addressCityDeferredSms : SCRIPT.addressVoiceCaptureDeferredSms;
        return br(
          {
            nextState: 'address_city_deferred_sms',
            assistantLine: deferLine,
            issueMatchResult: null,
            collected: {
              ...collected,
              streetNumberPending: null,
              addressRemainderDeferredToSms: true,
              city: null,
              state: null,
              zip: null,
              serviceAddress: null,
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'address_city_deferred_sms', utterance, null, false, 'address_asr_empty_defer')
        );
      }
      const line =
        state === 'collect_street_address'
          ? fails >= 2
            ? SCRIPT.streetHard
            : SCRIPT.addressMissedTranscriptStreet
          : state === 'address_confirm' && formatFullAddress(collected)
            ? SCRIPT.confirmUnclearAddr
            : assistantLineAfterMissedTranscriptDuringAddressCapture(state, collected);
      return br(
        {
          nextState: state,
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, state, utterance, null, false, 'address_asr_empty_reprompt')
      );
    }
    trimUtterance = '';
  }

  if (state === 'issue_capture') {
    const issueIn = trimUtterance ? collapseRepeatedUtterance(trimUtterance) : trimUtterance;
    if (isUnusableIssueTranscript(issueIn)) {
      bump('issue');
      return br(
        {
          nextState: 'issue_capture',
          assistantLine: issueRepromptLineForMode(activeTestMode),
          issueMatchResult: { accepted: false, rejectReason: 'unusable_transcript' },
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'issue_capture', utterance, null, false, 'issue_unusable_transcript')
      );
    }
    const m =
      activeTestMode === 'painting_intake'
        ? matchPaintingIntakeIssue(issueIn)
        : matchPlumbingIntakeIssue(issueIn);
    issueMatchResult = { accepted: m.accepted, rejectReason: m.accepted ? null : m.rejectReason };
    if (m.accepted) {
      const issue = m.issue;
      if (issue === KITCHEN_SINK_LEAK_NORMALIZED) {
        collected = { ...collected, normalizedIssue: issue };
        const inf = inferKitchenSinkLeakTriage(issueIn);
        collected = mergeTriageInfer(collected, inf);
        if (collected.leakPrimary != null && collected.leakSecondary != null) {
          return br(
            {
              nextState: 'collect_name',
              assistantLine: SCRIPT.nameIntake,
              issueMatchResult,
              collected,
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'collect_name', utterance, 'triage_full', true, null)
          );
        }
        if (collected.leakPrimary === 'faucet' && collected.leakSecondary == null) {
          return br(
            {
              nextState: 'collect_name',
              assistantLine: SCRIPT.nameIntake,
              issueMatchResult,
              collected: {
                ...collected,
                leakSecondary: 'faucet_self',
              },
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'collect_name', utterance, 'triage_faucet_only', true, null)
          );
        }
        if (collected.leakPrimary != null && collected.leakSecondary == null) {
          return br(
            {
              nextState: 'leak_location_secondary_capture',
              assistantLine: secondaryPromptForPrimary(collected.leakPrimary as KitchenSinkLeakPrimary),
              issueMatchResult,
              collected,
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'leak_location_secondary_capture', utterance, collected.leakPrimary, true, null)
          );
        }
        return br(
          {
            nextState: 'kitchen_sink_confirm',
            assistantLine: SCRIPT.kitchenSinkConfirm,
            issueMatchResult,
            collected,
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'kitchen_sink_confirm', utterance, null, true, null)
        );
      }
      collected = {
        ...collected,
        normalizedIssue: issue,
        leakPrimary: 'unknown',
        leakSecondary: 'unknown',
      };
      if (activeTestMode === 'painting_intake') {
        if (issue === LIGHT_TRIM_ISSUE) {
          return br(
            {
              nextState: 'collect_name',
              assistantLine: paintingIssueAckLine(issue),
              issueMatchResult,
              collected: { ...collected, paintingScopeStage: null },
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'collect_name', utterance, issue, true, 'painting_issue_routed_trim')
          );
        }
        if (issue === GENERAL_PAINT_ISSUE) {
          return br(
            {
              nextState: 'painting_scope_capture',
              assistantLine: SCRIPT.paintInteriorExteriorAsk,
              issueMatchResult,
              collected: { ...collected, paintingScopeStage: 'need_interior_or_exterior' },
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'painting_scope_capture', utterance, issue, true, 'painting_issue_needs_orientation')
          );
        }
        if (issue === INTERIOR_PAINT_ISSUE) {
          return br(
            {
              nextState: 'painting_scope_capture',
              assistantLine: SCRIPT.paintInteriorSurfaceAsk,
              issueMatchResult,
              collected: { ...collected, paintingScopeStage: 'need_interior_surface' },
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'painting_scope_capture', utterance, issue, true, 'painting_issue_interior_scope')
          );
        }
        if (issue === EXTERIOR_PAINT_ISSUE) {
          return br(
            {
              nextState: 'painting_scope_capture',
              assistantLine: SCRIPT.paintExteriorSurfaceAsk,
              issueMatchResult,
              collected: { ...collected, paintingScopeStage: 'need_exterior_surface' },
              leakLocationReprompts: 0,
              secondaryLeakReprompts: 0,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'painting_scope_capture', utterance, issue, true, 'painting_issue_exterior_scope')
          );
        }
      }
      const ack =
        activeTestMode === 'painting_intake'
          ? paintingIssueAckLine(issue as PaintingIntakeIssue)
          : plumbingIssueAckLine(issue as PlumbingIntakeIssue);
      const reason = activeTestMode === 'painting_intake' ? 'painting_issue_routed' : 'plumbing_issue_routed';
      return br(
        {
          nextState: 'collect_name',
          assistantLine: ack,
          issueMatchResult,
          collected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, issue, true, reason)
      );
    }
    if (m.rejectReason === 'off_lane' || m.rejectReason?.startsWith('off_lane')) {
      return br({
        nextState: 'unsupported_end',
        assistantLine: refusalLineForMode(activeTestMode),
        issueMatchResult,
        collected,
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized: null,
        endReason: m.rejectReason ?? 'unsupported',
        callOutcome: 'unsupported_issue',
        awaitingUserAudioAfter: false,
      });
    }
    return br({
      nextState: 'issue_capture',
      assistantLine: issueRepromptLineForMode(activeTestMode),
      issueMatchResult,
      collected,
      leakLocationReprompts,
      secondaryLeakReprompts,
      pendingCallbackNormalized: null,
      endReason: null,
      callOutcome: null,
      awaitingUserAudioAfter: true,
    });
  }

  if (state === 'painting_scope_capture') {
    if (activeTestMode !== 'painting_intake') {
      return br({
        nextState: 'collect_name',
        assistantLine: SCRIPT.nameIntake,
        issueMatchResult: null,
        collected: { ...collected, paintingScopeStage: null },
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      });
    }
    const stage = collected.paintingScopeStage ?? 'need_interior_or_exterior';
    if (!trimUtterance) {
      return br({
        nextState: 'painting_scope_capture',
        assistantLine:
          stage === 'need_interior_surface'
            ? SCRIPT.paintInteriorSurfaceReprompt
            : stage === 'need_exterior_surface'
              ? SCRIPT.paintExteriorSurfaceReprompt
              : SCRIPT.paintInteriorExteriorReprompt,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      });
    }
    if (stage === 'need_interior_or_exterior') {
      const orient = parsePaintingInteriorExterior(trimUtterance);
      if (orient === 'interior') {
        reset('painting_scope');
        return br(
          {
            nextState: 'painting_scope_capture',
            assistantLine: SCRIPT.paintInteriorSurfaceAsk,
            issueMatchResult: null,
            collected: {
              ...collected,
              normalizedIssue: INTERIOR_PAINT_ISSUE,
              paintingScopeStage: 'need_interior_surface',
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'painting_scope_capture', utterance, 'interior', true, 'painting_orientation_interior')
        );
      }
      if (orient === 'exterior') {
        reset('painting_scope');
        return br(
          {
            nextState: 'painting_scope_capture',
            assistantLine: SCRIPT.paintExteriorSurfaceAsk,
            issueMatchResult: null,
            collected: {
              ...collected,
              normalizedIssue: EXTERIOR_PAINT_ISSUE,
              paintingScopeStage: 'need_exterior_surface',
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'painting_scope_capture', utterance, 'exterior', true, 'painting_orientation_exterior')
        );
      }
    }
    if (stage === 'need_interior_surface') {
      const scope = parsePaintingInteriorSurface(trimUtterance);
      if (scope) {
        reset('painting_scope');
        return br(
          {
            nextState: 'collect_name',
            assistantLine: SCRIPT.nameIntake,
            issueMatchResult: null,
            collected: {
              ...collected,
              paintingScopeStage: null,
              paintingSurfaceScope: scope,
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, scope, true, 'painting_scope_interior')
        );
      }
    }
    if (stage === 'need_exterior_surface') {
      const scope = parsePaintingExteriorSurface(trimUtterance);
      if (scope) {
        reset('painting_scope');
        return br(
          {
            nextState: 'collect_name',
            assistantLine: SCRIPT.nameIntake,
            issueMatchResult: null,
            collected: {
              ...collected,
              paintingScopeStage: null,
              paintingSurfaceScope: scope,
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, scope, true, 'painting_scope_exterior')
        );
      }
    }
    bump('painting_scope');
    const attempts = slotRetryCounts.painting_scope ?? 0;
    if (attempts >= 2) {
      reset('painting_scope');
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: { ...collected, paintingScopeStage: null },
          leakLocationReprompts,
          secondaryLeakReprompts,
          pendingCallbackNormalized,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, null, false, 'painting_scope_max_reprompt_to_name')
      );
    }
    return br(
      {
        nextState: 'painting_scope_capture',
        assistantLine:
          stage === 'need_interior_surface'
            ? SCRIPT.paintInteriorSurfaceReprompt
            : stage === 'need_exterior_surface'
              ? SCRIPT.paintExteriorSurfaceReprompt
              : SCRIPT.paintInteriorExteriorReprompt,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'painting_scope_capture', utterance, null, false, 'painting_scope_reprompt')
    );
  }

  if (state === 'kitchen_sink_confirm') {
    if (!trimUtterance) {
      return br({
        nextState: 'kitchen_sink_confirm',
        assistantLine: SCRIPT.kitchenSinkConfirm,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      });
    }

    const locIn = collapseRepeatedUtterance(trimUtterance);

    const hardConfirm = parseHardLeakLocationOverrideFromUtterance(locIn);
    if (hardConfirm.ok) {
      const nextPrimary = hardConfirm.primary as KitchenSinkLeakPrimaryStored;
      let nextCollected: KitchenSinkCollected = {
        ...collected,
        leakPrimary: nextPrimary,
        leakSecondary: null,
      };
      if (hardConfirm.secondary) {
        const nextSec = hardConfirm.secondary as KitchenSinkLeakSecondaryStored;
        nextCollected = { ...nextCollected, leakSecondary: nextSec };
        return br(
          {
            nextState: 'collect_name',
            assistantLine: leakLocationCorrectedAckLine(nextPrimary, nextSec),
            issueMatchResult: null,
            collected: nextCollected,
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, `${nextPrimary}+${nextSec}`, true, 'leak_hard_override')
        );
      }
      return br(
        {
          nextState: 'leak_location_secondary_capture',
          assistantLine: leakLocationCorrectedThenSecondaryPrompt(hardConfirm.primary),
          issueMatchResult: null,
          collected: nextCollected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(
          state,
          'leak_location_secondary_capture',
          utterance,
          nextPrimary,
          true,
          'leak_hard_override_primary'
        )
      );
    }

    if (matchNo(trimUtterance)) {
      return br(
        {
          nextState: 'issue_capture',
          assistantLine: SCRIPT.issueRepromptKitchenSink,
          issueMatchResult: null,
          collected: {
            ...collected,
            normalizedIssue: null,
            leakPrimary: null,
            leakSecondary: null,
          },
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'issue_capture', utterance, null, false, 'kitchen_sink_confirm_no')
      );
    }

    const inf = inferKitchenSinkLeakTriage(locIn);
    const merged = mergeTriageInfer(collected, inf);

    if (merged.leakPrimary != null && merged.leakSecondary != null) {
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: merged,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, 'triage_full', true, null)
      );
    }
    if (merged.leakPrimary === 'faucet' && merged.leakSecondary == null) {
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: { ...merged, leakSecondary: 'faucet_self' },
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, 'faucet_self_default', true, null)
      );
    }
    if (merged.leakPrimary != null && merged.leakSecondary == null) {
      return br(
        {
          nextState: 'leak_location_secondary_capture',
          assistantLine: secondaryPromptForPrimary(merged.leakPrimary as KitchenSinkLeakPrimary),
          issueMatchResult: null,
          collected: merged,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'leak_location_secondary_capture', utterance, merged.leakPrimary, true, null)
      );
    }

    if (matchYes(trimUtterance)) {
      return br(
        {
          nextState: 'leak_location_primary_capture',
          assistantLine: SCRIPT.primaryLeak,
          issueMatchResult: null,
          collected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'leak_location_primary_capture', utterance, null, true, 'confirm_yes_only')
      );
    }

    return br(
      {
        nextState: 'leak_location_primary_capture',
        assistantLine: SCRIPT.primaryLeak,
        issueMatchResult: null,
        collected,
        leakLocationReprompts: 0,
        secondaryLeakReprompts: 0,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'leak_location_primary_capture', utterance, null, false, 'confirm_unclear')
    );
  }

  if (state === 'leak_location_primary_capture') {
    if (!trimUtterance) {
      return br({
        nextState: 'leak_location_primary_capture',
        assistantLine: SCRIPT.primaryLeak,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      });
    }

    const locIn = collapseRepeatedUtterance(trimUtterance);

    const hardPrimary = parseHardLeakLocationOverrideFromUtterance(locIn);
    if (hardPrimary.ok) {
      const nextPrimary = hardPrimary.primary as KitchenSinkLeakPrimaryStored;
      let nextCollected: KitchenSinkCollected = {
        ...collected,
        leakPrimary: nextPrimary,
        leakSecondary: null,
      };
      if (hardPrimary.secondary) {
        const nextSec = hardPrimary.secondary as KitchenSinkLeakSecondaryStored;
        nextCollected = { ...nextCollected, leakSecondary: nextSec };
        return br(
          {
            nextState: 'collect_name',
            assistantLine: leakLocationCorrectedAckLine(nextPrimary, nextSec),
            issueMatchResult: null,
            collected: nextCollected,
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, `${nextPrimary}+${nextSec}`, true, 'leak_hard_override')
        );
      }
      return br(
        {
          nextState: 'leak_location_secondary_capture',
          assistantLine: leakLocationCorrectedThenSecondaryPrompt(hardPrimary.primary),
          issueMatchResult: null,
          collected: nextCollected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(
          state,
          'leak_location_secondary_capture',
          utterance,
          nextPrimary,
          true,
          'leak_hard_override_primary'
        )
      );
    }

    const choice = matchPrimaryLeakChoice(locIn);
    if (choice === 'faucet' || choice === 'below_sink') {
      collected = { ...collected, leakPrimary: choice };
      const sec = matchSecondaryLeakChoice(locIn, choice);
      if (sec === 'drain' || sec === 'pipe' || sec === 'faucet_self') {
        return br(
          {
            nextState: 'collect_name',
            assistantLine: SCRIPT.nameIntake,
            issueMatchResult: null,
            collected: { ...collected, leakSecondary: sec },
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, `${choice}+${sec}`, true, null)
        );
      }
      if (choice === 'faucet') {
        return br(
          {
            nextState: 'collect_name',
            assistantLine: SCRIPT.nameIntake,
            issueMatchResult: null,
            collected: { ...collected, leakPrimary: 'faucet', leakSecondary: 'faucet_self' },
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, 'faucet+faucet_self_default', true, null)
        );
      }
      return br(
        {
          nextState: 'leak_location_secondary_capture',
          assistantLine: secondaryPromptForPrimary(choice),
          issueMatchResult: null,
          collected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'leak_location_secondary_capture', utterance, choice, true, null)
      );
    }

    if (choice === 'ambiguous') {
      if (leakLocationReprompts === 0) {
        return br(
          {
            nextState: 'leak_location_primary_capture',
            assistantLine: SCRIPT.primaryLeakReprompt,
            issueMatchResult: null,
            collected,
            leakLocationReprompts: 1,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'leak_location_primary_capture', utterance, null, false, 'primary_ambiguous')
        );
      }
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: { ...collected, leakPrimary: 'unknown', leakSecondary: 'unknown' },
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, 'primary_unknown', true, 'primary_ambiguous_second')
      );
    }

    if (leakLocationReprompts === 0) {
      return br(
        {
          nextState: 'leak_location_primary_capture',
          assistantLine: SCRIPT.primaryLeakReprompt,
          issueMatchResult: null,
          collected,
          leakLocationReprompts: 1,
          secondaryLeakReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'leak_location_primary_capture', utterance, null, false, 'primary_unrecognized')
      );
    }
    return br(
      {
        nextState: 'collect_name',
        assistantLine: SCRIPT.nameIntake,
        issueMatchResult: null,
        collected: { ...collected, leakPrimary: 'unknown', leakSecondary: 'unknown' },
        leakLocationReprompts: 0,
        secondaryLeakReprompts: 0,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_name', utterance, 'primary_unknown', true, 'primary_none_second')
    );
  }

  if (state === 'leak_location_secondary_capture') {
    const primary = collected.leakPrimary;
    const locIn = trimUtterance ? collapseRepeatedUtterance(trimUtterance) : trimUtterance;
    if (primary !== 'faucet' && primary !== 'below_sink') {
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: {
            ...collected,
            leakPrimary: collected.leakPrimary ?? 'unknown',
            leakSecondary: collected.leakSecondary ?? 'unknown',
          },
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, null, false, 'secondary_invalid_primary')
      );
    }

    if (!trimUtterance) {
      return br({
        nextState: 'leak_location_secondary_capture',
        assistantLine: secondaryPromptForPrimary(primary),
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        secondaryLeakReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      });
    }

    const hardSec = parseHardLeakLocationOverrideFromUtterance(locIn);
    if (hardSec.ok) {
      const nextPrimary = hardSec.primary as KitchenSinkLeakPrimaryStored;
      let nextCollected: KitchenSinkCollected = {
        ...collected,
        leakPrimary: nextPrimary,
        leakSecondary: null,
      };
      if (hardSec.secondary) {
        const nextS = hardSec.secondary as KitchenSinkLeakSecondaryStored;
        nextCollected = { ...nextCollected, leakSecondary: nextS };
        return br(
          {
            nextState: 'collect_name',
            assistantLine: leakLocationCorrectedAckLine(nextPrimary, nextS),
            issueMatchResult: null,
            collected: nextCollected,
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, `${nextPrimary}+${nextS}`, true, 'leak_hard_override')
        );
      }
      return br(
        {
          nextState: 'leak_location_secondary_capture',
          assistantLine: leakLocationCorrectedThenSecondaryPrompt(hardSec.primary),
          issueMatchResult: null,
          collected: nextCollected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(
          state,
          'leak_location_secondary_capture',
          utterance,
          nextPrimary,
          true,
          'leak_hard_override_primary'
        )
      );
    }

    const { remainder: secRemainder, hadCorrection: secHadCorrection } =
      stripLeakLocationCorrectionPrefix(locIn);
    if (
      secHadCorrection &&
      secRemainder.trim() &&
      (primary === 'faucet' || primary === 'below_sink')
    ) {
      const secOnly = matchSecondaryLeakChoice(secRemainder, primary as KitchenSinkLeakPrimary);
      if (secOnly === 'drain' || secOnly === 'pipe' || secOnly === 'faucet_self') {
        const secStored = secOnly as KitchenSinkLeakSecondaryStored;
        return br(
          {
            nextState: 'collect_name',
            assistantLine: leakLocationCorrectedAckLine(primary as KitchenSinkLeakPrimaryStored, secStored),
            issueMatchResult: null,
            collected: { ...collected, leakSecondary: secStored },
            leakLocationReprompts: 0,
            secondaryLeakReprompts: 0,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_name', utterance, secStored, true, 'leak_secondary_correction')
        );
      }
    }

    const sec = matchSecondaryLeakChoice(locIn, primary);
    if (sec === 'drain' || sec === 'pipe' || sec === 'faucet_self') {
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: { ...collected, leakSecondary: sec },
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, sec, true, null)
      );
    }

    if (sec === 'ambiguous') {
      if (secondaryLeakReprompts === 0) {
        return br(
          {
            nextState: 'leak_location_secondary_capture',
            assistantLine: secondaryPromptForPrimary(primary),
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            secondaryLeakReprompts: 1,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'leak_location_secondary_capture', utterance, null, false, 'secondary_ambiguous')
        );
      }
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameIntake,
          issueMatchResult: null,
          collected: { ...collected, leakSecondary: 'unknown' },
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, 'secondary_unknown', true, 'secondary_ambiguous_second')
      );
    }

    if (secondaryLeakReprompts === 0) {
      return br(
        {
          nextState: 'leak_location_secondary_capture',
          assistantLine: secondaryPromptForPrimary(primary),
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          secondaryLeakReprompts: 1,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'leak_location_secondary_capture', utterance, null, false, 'secondary_unrecognized')
      );
    }
    return br(
      {
        nextState: 'collect_name',
        assistantLine: SCRIPT.nameIntake,
        issueMatchResult: null,
        collected: { ...collected, leakSecondary: 'unknown' },
        leakLocationReprompts: 0,
        secondaryLeakReprompts: 0,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_name', utterance, 'secondary_unknown', true, 'secondary_none_second')
    );
  }

  if (state === 'collect_name') {
    const nameCandidate = extractCallerNameForIntake(trimUtterance);
    const v = validateName(nameCandidate);
    if (!v.ok) {
      bump('name');
      return br(
        {
          nextState: 'collect_name',
          assistantLine: SCRIPT.nameReprompt,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, null, false, v.reason)
      );
    }
    reset('name');
    collected = { ...collected, callerName: nameCandidate.trim() };
    return br(
      {
        nextState: 'collect_street_address',
        assistantLine: SCRIPT.street,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_street_address', utterance, nameCandidate.trim(), true, null)
    );
  }

  if (state === 'collect_street_address') {
    if (!trimUtterance) {
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: SCRIPT.street,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, false, 'street_empty_reprompt')
      );
    }
    let streetUtterance = trimUtterance;
    if (collected.streetNumberPending?.trim() && !matchAddressRepairIntent(trimUtterance)) {
      if (utteranceLeadsWithStreetHouseToken(streetUtterance)) {
        collected = { ...collected, streetNumberPending: null };
      } else if (streetCaptureTranscriptShapeLocal(streetUtterance) === 'missing_number') {
        streetUtterance = `${collected.streetNumberPending.trim()} ${streetUtterance.trim()}`;
        collected = { ...collected, streetNumberPending: null };
      }
    }

    const collapsed = streetUtterance.includes(',')
      ? streetUtterance
      : collapseRepeatedUtterance(streetUtterance);
    const working0 = normalizeStreetAbbreviations(collapsed);

    const DIGIT_WORD: Record<string, string> = {
      zero: '0',
      oh: '0',
      o: '0',
      one: '1',
      two: '2',
      three: '3',
      four: '4',
      five: '5',
      six: '6',
      seven: '7',
      eight: '8',
      nine: '9',
    };
    const maybeCompactLeadingAddressNumber = (s: string): string => {
      const cleaned = s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const toks = cleaned.split(' ').filter(Boolean);
      if (toks.length === 0) return s;
      // Compact a leading run of digit words and/or single digit tokens.
      let i = 0;
      let digits = '';
      while (i < toks.length) {
        const tok = toks[i]!;
        if (DIGIT_WORD[tok] != null) {
          digits += DIGIT_WORD[tok];
          i++;
          continue;
        }
        if (/^\d$/.test(tok)) {
          digits += tok;
          i++;
          continue;
        }
        break;
      }
      if (!digits || digits.length < 1) return s;
      if (digits.length > 6) {
        // Guard against accidentally compacting phone-like runs into a street number.
        return s;
      }
      // Ensure there's at least one street-name token after the compacted number.
      const restTokens = toks.slice(i);
      if (restTokens.length === 0) return s;
      const rest = restTokens.join(' ').trim();
      if (!rest || !/[a-z]/.test(rest)) return s;
      return `${digits} ${rest}`;
    };

    const maybeConvertLeadingNumberWordsToDigits = (s: string): string => {
      const compacted = maybeCompactLeadingAddressNumber(s);
      if (compacted !== s) {
        return compacted;
      }
      // Legacy fallback: handle plain number words only.
      const cleaned = s
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const toks = cleaned.split(' ').filter(Boolean);
      if (toks.length === 0) return s;
      let i = 0;
      let digits = '';
      while (i < toks.length && DIGIT_WORD[toks[i]] != null) {
        digits += DIGIT_WORD[toks[i]];
        i++;
      }
      if (!digits || digits.length < 1) return s;
      const rest = toks.slice(i).join(' ').trim();
      if (!rest) return s;
      return `${digits} ${rest}`;
    };

    const working = maybeConvertLeadingNumberWordsToDigits(working0);

    if (matchAddressRepairIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected: { ...collected, streetLocked: false, streetNumberPending: null },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, true, 'address_repair')
      );
    }

    if (
      (collected.streetLocked || plausibleStreetStored(collected)) &&
      collected.streetAddress?.trim() &&
      validateStreet(normalizeStreetAbbreviations(collected.streetAddress)).ok &&
      !utteranceSuggestsLockedSlotCorrection(trimUtterance) &&
      !matchAddressRepairIntent(trimUtterance)
    ) {
      const vCityEarly = validateCity(collapsed);
      const looksLikeAnotherStreet =
        validateStreet(normalizeStreetAbbreviations(collapsed)).ok &&
        streetLineLooksCompleteEnoughForProgress(normalizeStreetAbbreviations(collapsed));
      if (vCityEarly.ok && !looksLikeAnotherStreet) {
        reset('street');
        reset('address_asr_empty');
        collected = {
          ...collected,
          city: formatCityCollected(collapsed),
          cityLocked: true,
        };
        return br(
          {
            nextState: 'collect_state',
            assistantLine: SCRIPT.state,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_state', utterance, collapsed.trim(), true, 'street_locked_city_heard')
        );
      }
      reset('street');
      reset('address_asr_empty');
      return br(
        {
          nextState: 'collect_city',
          assistantLine: SCRIPT.streetAcceptedToCity,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_city', utterance, null, true, 'street_locked_skip_overwrite')
      );
    }

    const shape = streetCaptureTranscriptShapeLocal(working);

    if (shape === 'partial_number_only') {
      const digitRun = extractHouseNumberDigitsIfDigitsOnlyUtterance(working);
      if (digitRun) {
        reset('address_asr_empty');
        const spaced = formatDigitsForSpeechAck(digitRun);
        return br(
          {
            nextState: 'collect_street_address',
            assistantLine: SCRIPT.streetNameAfterHouseNumber(spaced),
            issueMatchResult: null,
            collected: {
              ...collected,
              streetNumberPending: digitRun,
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_street_address', utterance, digitRun, true, 'street_house_number_pending')
        );
      }
    }

    if (shape === 'partial_number_only' || shape === 'missing_number') {
      // Treat number-only transcripts as unusable STT (not a normal validation miss).
      bump('address_asr_empty');
      const fails = slotRetryCounts.address_asr_empty ?? 0;
      const deferAt = addressAsrEmptyDeferThreshold(state, collected);
      if (fails >= deferAt) {
        reset('address_asr_empty');
        return br(
          {
            nextState: 'address_city_deferred_sms',
            assistantLine: SCRIPT.addressVoiceCaptureDeferredSms,
            issueMatchResult: null,
            collected: {
              ...collected,
              streetNumberPending: null,
              addressRemainderDeferredToSms: true,
              city: null,
              state: null,
              zip: null,
              serviceAddress: null,
            },
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'address_city_deferred_sms', utterance, null, false, 'street_partial_number_only_defer')
        );
      }
      const line = fails >= 2 ? SCRIPT.streetHard : SCRIPT.addressMissedTranscriptStreet;
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(
          state,
          'collect_street_address',
          utterance,
          null,
          false,
          shape === 'missing_number' ? 'street_missing_number' : 'street_partial_number_only'
        )
      );
    }

    if (shape !== 'full_street_candidate') {
      bump('street');
      const fails = slotRetryCounts.street ?? 0;
      const line = fails >= 2 ? SCRIPT.streetHard : SCRIPT.streetPartial;
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, false, `street_shape_${shape}`)
      );
    }

    const v = validateStreet(working);
    if (!v.ok) {
      if (
        plausibleStreetStored(collected) &&
        !utteranceSuggestsLockedSlotCorrection(trimUtterance) &&
        !matchAddressRepairIntent(trimUtterance)
      ) {
        reset('street');
        reset('address_asr_empty');
        return br(
          {
            nextState: 'collect_city',
            assistantLine: SCRIPT.streetAcceptedToCity,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_city', utterance, null, true, 'street_skip_reprompt_plausible_stored')
        );
      }
      bump('street');
      const fails = slotRetryCounts.street ?? 0;
      const line = fails >= 2 ? SCRIPT.streetHard : SCRIPT.streetPartial;
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, false, v.reason)
      );
    }

    if (!streetLineLooksCompleteEnoughForProgress(working)) {
      if (
        plausibleStreetStored(collected) &&
        !utteranceSuggestsLockedSlotCorrection(trimUtterance) &&
        !matchAddressRepairIntent(trimUtterance)
      ) {
        reset('street');
        reset('address_asr_empty');
        return br(
          {
            nextState: 'collect_city',
            assistantLine: SCRIPT.streetAcceptedToCity,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_city', utterance, null, true, 'street_skip_shape_reprompt_plausible_stored')
        );
      }
      bump('street');
      const fails = slotRetryCounts.street ?? 0;
      const line = fails >= 2 ? SCRIPT.streetHard : SCRIPT.streetPartial;
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, false, 'street_incomplete_shape')
      );
    }

    reset('street');
    reset('address_asr_empty');
    const parsedCombo = tryParseStreetLineAndCity(working);
    const streetNormRaw =
      parsedCombo.ok && parsedCombo.street.trim() ? parsedCombo.street.trim() : working.trim();
    const streetDisplay = titleCaseStreetWordsForSpeech(normalizeStreetAbbreviations(streetNormRaw));
    collected = { ...collected, streetAddress: streetDisplay, streetLocked: true };
    return br(
      {
        nextState: 'collect_unit',
        assistantLine: SCRIPT.unitAsk,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_unit', utterance, streetDisplay, true, 'street_then_optional_unit')
    );
  }

  if (state === 'collect_unit') {
    // Non-blocking: if they don't give a unit (or say "no"), continue to city.
    if (!trimUtterance || matchNo(trimUtterance) || matchOptionalDetailDecline(trimUtterance)) {
      return br(
        {
          nextState: 'collect_city',
          assistantLine: SCRIPT.streetAcceptedToCity,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_city', utterance, null, false, 'unit_empty_skip')
      );
    }
    const unit = trimUtterance.trim();
    collected = { ...collected, unitOrSuite: unit };
    return br(
      {
        nextState: 'collect_city',
        assistantLine: SCRIPT.streetAcceptedToCity,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_city', utterance, unit, true, 'unit_saved_then_city')
    );
  }

  if (state === 'collect_city') {
    if (matchAddressRepairIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_city',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected: { ...collected, cityLocked: false },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_city', utterance, null, true, 'address_repair')
      );
    }

    const ut = collapseRepeatedUtterance(trimUtterance);
    if (matchAddressResetOnlyIntent(ut)) {
      collected = clearAddressSlots(collected);
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, true, 'address_reset_to_street')
      );
    }

    if (
      collected.cityLocked &&
      collected.city?.trim() &&
      validateCity(collected.city).ok &&
      !utteranceSuggestsLockedSlotCorrection(trimUtterance)
    ) {
      const vSame = validateCity(ut);
      if (vSame.ok) {
        const a = ut.trim().toLowerCase();
        const b = collected.city!.trim().toLowerCase();
        if (a === b) {
          reset('city');
          reset('address_asr_empty');
          return br(
            {
              nextState: 'collect_state',
              assistantLine: SCRIPT.state,
              issueMatchResult: null,
              collected,
              leakLocationReprompts,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'collect_state', utterance, collected.city, true, 'city_locked_repeat_ok')
          );
        }
        return br(
          {
            nextState: 'collect_city',
            assistantLine: SCRIPT.cityReprompt,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_city', utterance, null, true, 'city_locked_reprompt_different')
        );
      }
    }

    const allowCombined =
      !collected.cityLocked || utteranceSuggestsLockedSlotCorrection(trimUtterance);
    const combined = allowCombined ? tryParseCityStateZipCombined(ut) : { ok: false as const };
    if (combined.ok) {
      reset('city');
      reset('state');
      reset('zip');
      reset('address_asr_empty');
      const zipOk = Boolean(combined.zipDigits && validateZip(combined.zipDigits).ok);
      collected = {
        ...collected,
        city: combined.city,
        state: combined.stateAbbr,
        zip: combined.zipDigits ?? null,
        cityLocked: true,
        stateLocked: true,
        zipLocked: zipOk,
        zipPartialDigits: null,
      };
      collected = syncServiceAddress(collected);
      if (combined.zipDigits && validateZip(combined.zipDigits).ok) {
        const addr = formatFullAddress(collected);
        return br(
          {
            nextState: 'address_confirm',
            assistantLine: SCRIPT.addressConfirm(addr),
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(
            state,
            'address_confirm',
            utterance,
            `${combined.city}|${combined.stateAbbr}|${combined.zipDigits}`,
            true,
            'city_state_zip_combined'
          )
        );
      }
      return br(
        {
          nextState: 'collect_zip',
          assistantLine: SCRIPT.zip,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(
          state,
          'collect_zip',
          utterance,
          `${combined.city}|${combined.stateAbbr}`,
          true,
          'city_state_combined'
        )
      );
    }

    const v = validateCity(ut);
    if (!v.ok) {
      bump('city');
      const fails = slotRetryCounts.city ?? 0;
      const streetOk =
        Boolean(collected.streetAddress?.trim()) &&
        validateStreet(collected.streetAddress ?? '').ok;
      const cityDeferThreshold = plausibleStreetStored(collected) ? 4 : 2;
      if (fails >= cityDeferThreshold && streetOk) {
        return br(
          {
            nextState: 'address_city_deferred_sms',
            assistantLine: SCRIPT.addressCityDeferredSms,
            issueMatchResult: null,
            collected: {
              ...collected,
              streetNumberPending: null,
              addressRemainderDeferredToSms: true,
              city: null,
              state: null,
              zip: null,
              serviceAddress: null,
              cityLocked: false,
              stateLocked: false,
              zipLocked: false,
            },
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'address_city_deferred_sms', utterance, null, false, 'city_defer_sms')
        );
      }
      const line =
        fails === 1 && streetOk
          ? SCRIPT.cityAfterPartialStreet(collected.streetAddress!.trim())
          : fails >= 2
            ? SCRIPT.cityReprompt
            : SCRIPT.city;
      return br(
        {
          nextState: 'collect_city',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_city', utterance, null, false, v.reason)
      );
    }
    reset('city');
    reset('address_asr_empty');
    collected = { ...collected, city: formatCityCollected(ut), cityLocked: true };
    return br(
      {
        nextState: 'collect_state',
        assistantLine: SCRIPT.state,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_state', utterance, ut.trim(), true, null)
    );
  }

  if (state === 'collect_state') {
    if (matchAddressRepairIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_state',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected: { ...collected, stateLocked: false },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_state', utterance, null, true, 'address_repair')
      );
    }

    const ut = collapseRepeatedUtterance(trimUtterance);

    if (
      collected.stateLocked &&
      collected.state?.trim() &&
      validateState(collected.state).ok &&
      !utteranceSuggestsLockedSlotCorrection(trimUtterance)
    ) {
      const vProbe = validateState(ut);
      if (vProbe.ok && vProbe.normalized) {
        if (vProbe.normalized === collected.state) {
          reset('state');
          reset('address_asr_empty');
          collected = syncServiceAddress(collected);
          return br(
            {
              nextState: 'collect_zip',
              assistantLine: SCRIPT.zip,
              issueMatchResult: null,
              collected,
              leakLocationReprompts,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'collect_zip', utterance, collected.state!, true, 'state_locked_repeat_ok')
          );
        }
        return br(
          {
            nextState: 'collect_state',
            assistantLine: SCRIPT.stateReprompt,
            issueMatchResult: null,
            collected: syncServiceAddress(collected),
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_state', utterance, null, true, 'state_locked_reprompt_different')
        );
      }
    }

    const v = validateState(ut);
    if (!v.ok || !v.normalized) {
      bump('state');
      const fails = slotRetryCounts.state ?? 0;
      const line = fails >= 2 ? SCRIPT.stateReprompt : SCRIPT.state;
      return br(
        {
          nextState: 'collect_state',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_state', utterance, null, false, !v.ok ? v.reason : 'missing_normalized')
      );
    }
    reset('state');
    reset('address_asr_empty');
    collected = syncServiceAddress({ ...collected, state: v.normalized, stateLocked: true });
    return br(
      {
        nextState: 'collect_zip',
        assistantLine: SCRIPT.zip,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_zip', utterance, v.normalized, true, null)
    );
  }

  if (state === 'collect_zip') {
    if (matchAddressRepairIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_zip',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected: { ...collected, zipLocked: false, zipPartialDigits: null },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_zip', utterance, null, true, 'address_repair')
      );
    }

    if (
      collected.zip &&
      validateZip(collected.zip).ok &&
      collected.zipLocked &&
      !utteranceSuggestsLockedSlotCorrection(trimUtterance) &&
      !matchAddressRepairIntent(trimUtterance)
    ) {
      reset('zip');
      reset('address_asr_empty');
      collected = syncServiceAddress({
        ...collected,
        zipPartialDigits: null,
      });
      const addrDone = formatFullAddress(collected);
      if (addrDone) {
        return br(
          {
            nextState: 'address_confirm',
            assistantLine: SCRIPT.addressConfirm(addrDone),
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'address_confirm', utterance, collected.zip, true, 'zip_locked_skip_reprompt')
        );
      }
    }

    const ut = collapseRepeatedUtterance(trimUtterance);
    const digitRun = ut.replace(/\D/g, '');
    if (digitRun.length >= 5) {
      const zFast = validateZip(digitRun.slice(0, 5));
      if (zFast.ok && zFast.digits) {
        reset('zip');
        reset('address_asr_empty');
        collected = syncServiceAddress({
          ...collected,
          zip: zFast.digits,
          zipPartialDigits: null,
          zipLocked: true,
        });
        const addr = formatFullAddress(collected);
        return br(
          {
            nextState: 'address_confirm',
            assistantLine: SCRIPT.addressConfirm(addr),
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'address_confirm', utterance, zFast.digits, true, 'zip_five_digit_prefix')
        );
      }
    }

    const z = validateZip(ut);
    if (!z.ok || !z.digits) {
      if (
        collected.zipLocked &&
        collected.zip &&
        validateZip(collected.zip).ok &&
        !utteranceSuggestsLockedSlotCorrection(trimUtterance) &&
        !matchAddressRepairIntent(trimUtterance)
      ) {
        reset('zip');
        reset('address_asr_empty');
        collected = syncServiceAddress({ ...collected, zipPartialDigits: null });
        const addrSkip = formatFullAddress(collected);
        if (addrSkip) {
          return br(
            {
              nextState: 'address_confirm',
              assistantLine: SCRIPT.addressConfirm(addrSkip),
              issueMatchResult: null,
              collected,
              leakLocationReprompts,
              pendingCallbackNormalized: null,
              endReason: null,
              callOutcome: null,
              awaitingUserAudioAfter: true,
            },
            fsmLog(state, 'address_confirm', utterance, collected.zip, true, 'zip_locked_ignore_garbled_reprompt')
          );
        }
      }
      bump('zip');
      const partial = extractPartialZipDigits(ut);
      const nextPartial = partial ?? collected.zipPartialDigits ?? null;
      collected = { ...collected, zipPartialDigits: nextPartial };
      const fails = slotRetryCounts.zip ?? 0;
      const zipAlreadyComplete =
        collected.zipLocked && collected.zip && validateZip(collected.zip).ok;
      const line =
        nextPartial && fails >= 1 && !zipAlreadyComplete
          ? SCRIPT.zipAfterPartial(nextPartial)
          : fails >= 2
            ? SCRIPT.zipReprompt
            : SCRIPT.zip;
      return br(
        {
          nextState: 'collect_zip',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_zip', utterance, null, false, !z.ok ? z.reason : 'need_five_digits')
      );
    }
    reset('zip');
    reset('address_asr_empty');
    collected = syncServiceAddress({
      ...collected,
      zip: z.digits,
      zipPartialDigits: null,
      zipLocked: true,
    });
    const addr = formatFullAddress(collected);
    return br(
      {
        nextState: 'address_confirm',
        assistantLine: SCRIPT.addressConfirm(addr),
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'address_confirm', utterance, z.digits, true, null)
    );
  }

  if (state === 'address_city_deferred_sms') {
    if (matchAddressRepairIntent(trimUtterance) || matchContinueAddressCaptureIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected: {
            ...collected,
            addressRemainderDeferredToSms: false,
            city: null,
            state: null,
            zip: null,
            serviceAddress: null,
            cityLocked: false,
            stateLocked: false,
            zipLocked: false,
          },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, true, 'address_sms_defer_resume_voice')
      );
    }
    // After address deferral, ask directly for callback digits (avoid ANI yes/no loops that feel pushy).
    return br(
      {
        nextState: 'callback_number_collect',
        assistantLine: SCRIPT.callbackNumberAsk,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'callback_number_collect', utterance, null, true, 'address_sms_defer_to_callback')
    );
  }

  if (state === 'address_confirm') {
    const addr = formatLockedFullAddressForSpeech(collected);
    if (!addr) {
      const miss = firstMissingAddressSlot(collected) ?? 'collect_street_address';
      return br(
        {
          nextState: miss,
          assistantLine: promptForAddressState(miss, collected),
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, miss, utterance, null, false, 'address_incomplete')
      );
    }
    if (matchAddressRepairIntent(trimUtterance)) {
      collected = clearAddressSlots(collected);
      return br(
        {
          nextState: 'collect_street_address',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_street_address', utterance, null, true, 'address_confirm_repair')
      );
    }
    if (matchAddressConfirmAffirmative(trimUtterance)) {
      if (hasInboundPhoneForConfirm(collected)) {
        const disp = formatNanpE164ForAssistantSpeechHyphen(
          normalizeNanpPhoneToE164(collected.inboundCallerPhoneE164!)!
        );
        return br(
          {
            nextState: 'callback_number_confirm',
            assistantLine: SCRIPT.callbackNumberConfirm(disp),
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'callback_number_confirm', utterance, addr, true, 'address_confirm_yes')
        );
      }
      return br(
        {
          nextState: 'callback_number_collect',
          assistantLine: SCRIPT.callbackNumberAsk,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_collect', utterance, addr, true, 'address_confirm_yes')
      );
    }
    if (matchNo(trimUtterance)) {
      collected = {
        ...collected,
        city: null,
        state: null,
        zip: null,
        serviceAddress: null,
        zipPartialDigits: null,
        cityLocked: false,
        stateLocked: false,
        zipLocked: false,
      };
      return br(
        {
          nextState: 'collect_city',
          assistantLine: SCRIPT.cityAfterAddressConfirmNo,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_city', utterance, null, true, 'address_confirm_no_narrow_city')
      );
    }
    return br(
      {
        nextState: 'address_confirm',
        assistantLine: SCRIPT.confirmUnclearAddr,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'address_confirm', utterance, null, false, 'confirm_unclear')
    );
  }

  if (state === 'callback_number_confirm') {
    const hasPendingSpokenCallback =
      collected.callbackPhoneSource === 'spoken' &&
      Boolean(collected.callbackPhoneNumber) &&
      !collected.callbackLocked;

    if (matchCallbackNumberIncompleteObjection(trimUtterance) || /\b(that'?s\s+not\s+my\s+number|not\s+my\s+number|wrong\s+number)\b/i.test(trimUtterance)) {
      reset('callback_phone');
      collected = {
        ...collected,
        callbackPhonePartialDigits: null,
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackLocked: false,
        callbackInboundConfirmRejected: true,
      };
      return br(
        {
          nextState: 'callback_number_collect',
          assistantLine: SCRIPT.callbackNumberAsk,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_collect', utterance, null, true, 'callback_number_disputed')
      );
    }
    if (/\b(what'?s\s+my\s+number|what\s+is\s+my\s+number)\b/i.test(trimUtterance)) {
      const disp = hasPendingSpokenCallback
        ? formatNanpE164ForAssistantSpeechHyphen(collected.callbackPhoneNumber!)
        : hasInboundPhoneForConfirm(collected)
          ? formatNanpE164ForAssistantSpeechHyphen(normalizeNanpPhoneToE164(collected.inboundCallerPhoneE164!)!)
          : '';
      return br(
        {
          nextState: 'callback_number_confirm',
          assistantLine: disp ? SCRIPT.callbackNumberConfirm(disp) : SCRIPT.callbackNumberAsk,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_confirm', utterance, null, true, 'callback_number_readback_requested')
      );
    }
    if (matchYes(trimUtterance)) {
      if (hasPendingSpokenCallback) {
        reset('callback_phone');
        collected = {
          ...collected,
          callbackLocked: true,
          callbackInboundConfirmRejected: true,
          callbackPhoneSource: 'spoken',
        };
        return br(
          {
            nextState: 'collect_callback_time',
            assistantLine: SCRIPT.callback,
            issueMatchResult: null,
            collected,
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'collect_callback_time', utterance, collected.callbackPhoneNumber, true, 'callback_number_spoken_yes')
        );
      }
      const inbound = collected.inboundCallerPhoneE164;
      const normalized = inbound ? normalizeNanpPhoneToE164(inbound) : null;
      if (!normalized) {
        return br(
          {
            nextState: 'callback_number_collect',
            assistantLine: SCRIPT.callbackNumberAsk,
            issueMatchResult: null,
            collected: { ...collected, callbackInboundConfirmRejected: true },
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'callback_number_collect', utterance, null, false, 'inbound_invalid')
        );
      }
      reset('callback_phone');
      collected = {
        ...collected,
        callbackPhoneNumber: normalized,
        callbackPhoneSource: 'inbound_confirmed',
        callbackPhonePartialDigits: null,
        callbackLocked: true,
        callbackInboundConfirmRejected: false,
      };
      return br(
        {
          nextState: 'collect_callback_time',
          assistantLine: SCRIPT.callback,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_callback_time', utterance, normalized, true, 'callback_number_inbound_yes')
      );
    }
    if (matchNo(trimUtterance)) {
      if (hasPendingSpokenCallback) {
        return br(
          {
            nextState: 'callback_number_collect',
            assistantLine: SCRIPT.callbackNumberAsk,
            issueMatchResult: null,
            collected: {
              ...collected,
              callbackPhoneNumber: null,
              callbackPhoneSource: null,
              callbackLocked: false,
              callbackPhonePartialDigits: null,
              callbackInboundConfirmRejected: true,
            },
            leakLocationReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, 'callback_number_collect', utterance, null, true, 'callback_number_spoken_no')
        );
      }
      return br(
        {
          nextState: 'callback_number_collect',
          assistantLine: SCRIPT.callbackNumberAsk,
          issueMatchResult: null,
          collected: { ...collected, callbackInboundConfirmRejected: true },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_collect', utterance, null, true, 'callback_number_inbound_no')
      );
    }
    const disp = hasPendingSpokenCallback
      ? formatNanpE164ForAssistantSpeechHyphen(collected.callbackPhoneNumber!)
      : hasInboundPhoneForConfirm(collected)
        ? formatNanpE164ForAssistantSpeechHyphen(normalizeNanpPhoneToE164(collected.inboundCallerPhoneE164!)!)
        : '';
    return br(
      {
        nextState: 'callback_number_confirm',
        assistantLine: disp ? SCRIPT.callbackNumberConfirmUnclear : SCRIPT.callbackNumberAsk,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'callback_number_confirm', utterance, null, false, 'callback_number_confirm_unclear')
    );
  }

  if (state === 'callback_number_collect') {
    if (matchCallbackNumberIncompleteObjection(trimUtterance)) {
      reset('callback_phone');
      collected = {
        ...collected,
        callbackPhonePartialDigits: null,
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackLocked: false,
        callbackInboundConfirmRejected: true,
      };
      return br(
        {
          nextState: 'callback_number_collect',
          assistantLine: SCRIPT.callbackNumberAsk,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_collect', utterance, null, true, 'callback_incomplete_objection')
      );
    }
    if (
      hasInboundPhoneForConfirm(collected) &&
      !isCallbackPhoneResolved(collected) &&
      !collected.callbackInboundConfirmRejected
    ) {
      const disp = formatNanpE164ForAssistantSpeechHyphen(
        normalizeNanpPhoneToE164(collected.inboundCallerPhoneE164!)!
      );
      return br(
        {
          nextState: 'callback_number_confirm',
          assistantLine: SCRIPT.callbackNumberConfirm(disp),
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_confirm', utterance, null, true, 'callback_collect_redirect_inbound_confirm')
      );
    }
    if (isUnusableCallbackPhoneTranscript(trimUtterance)) {
      bump('callback_phone');
      const fails = slotRetryCounts.callback_phone ?? 0;
      const line = fails >= 2 ? SCRIPT.callbackNumberAskReprompt : SCRIPT.callbackNumberAsk;
      return br(
        {
          nextState: 'callback_number_collect',
          assistantLine: line,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_collect', utterance, null, false, 'callback_unusable_transcript')
      );
    }
    const p = validateSpokenNanpPhone(trimUtterance);
    const digitsOnly = trimUtterance.replace(/\D/g, '');
    const looksLikeFullNanp =
      digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'));
    let acceptNanp = p.ok && looksLikeFullNanp;
    const prevPartial = collected.callbackPhonePartialDigits;
    if (acceptNanp && prevPartial && digitsOnly.startsWith(prevPartial)) {
      if (digitsOnly.length <= prevPartial.length) {
        acceptNanp = false;
      }
    }
    if (acceptNanp && p.ok) {
      reset('callback_phone');
      const disp = formatNanpE164ForAssistantSpeechHyphen(p.e164);
      collected = {
        ...collected,
        callbackPhoneNumber: p.e164,
        callbackPhoneSource: 'spoken',
        callbackPhonePartialDigits: null,
        callbackLocked: false,
        callbackInboundConfirmRejected: true,
      };
      return br(
        {
          nextState: 'callback_number_confirm',
          assistantLine: SCRIPT.callbackNumberConfirm(disp),
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_number_confirm', utterance, p.e164, true, 'callback_number_spoken_pending_confirm')
      );
    }
    bump('callback_phone');
    const partial = extractPartialNanpDigits(trimUtterance);
    const nextPartial = partial ?? collected.callbackPhonePartialDigits ?? null;
    collected = { ...collected, callbackPhonePartialDigits: nextPartial };
    const fails = slotRetryCounts.callback_phone ?? 0;
    const line =
      nextPartial && fails >= 2
        ? SCRIPT.callbackNumberSoftReprompt
        : nextPartial && fails === 1
          ? SCRIPT.callbackNumberAfterPartial(nextPartial)
          : fails >= 2
            ? SCRIPT.callbackNumberAskReprompt
            : SCRIPT.callbackNumberAsk;
    return br(
      {
        nextState: 'callback_number_collect',
        assistantLine: line,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(
        state,
        'callback_number_collect',
        utterance,
        null,
        false,
        !p.ok ? p.reason : 'nanp_not_full_enough'
      )
    );
  }

  if (state === 'collect_callback_time') {
    const cb = validateCallbackWindow(trimUtterance);
    if (cb.ok) {
      reset('callback');
      const windowPhrase = displayCallbackWindow(cb.normalized);
      pendingCallbackNormalized = cb.normalized;
      return br(
        {
          nextState: 'callback_confirm',
          assistantLine: SCRIPT.callbackConfirm(windowPhrase),
          issueMatchResult: null,
          collected: { ...collected, callbackTimePreference: windowPhrase },
          leakLocationReprompts,
          pendingCallbackNormalized: cb.normalized,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'callback_confirm', utterance, windowPhrase, true, null)
      );
    }

    if (matchCallbackRequestIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_callback_time',
          assistantLine: SCRIPT.callback,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_callback_time', utterance, null, false, 'callback_intent_reprompt')
      );
    }

    bump('callback');
    const fails = slotRetryCounts.callback ?? 0;
    const cbLine = fails >= 1 ? SCRIPT.callbackTimeNarrowReprompt : SCRIPT.callback;

    return br(
      {
        nextState: 'collect_callback_time',
        assistantLine: cbLine,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_callback_time', utterance, null, false, cb.reason)
    );
  }

  if (state === 'callback_confirm') {
    const prefBucket = validateCallbackWindow(collected.callbackTimePreference ?? '');
    const windowPhrase = prefBucket.ok
      ? displayCallbackWindow(prefBucket.normalized)
      : pendingCallbackNormalized != null
        ? displayCallbackWindow(pendingCallbackNormalized)
        : collected.callbackTimePreference || 'your preferred time';

    const direct = validateCallbackWindow(trimUtterance);
    if (direct.ok) {
      pendingCallbackNormalized = direct.normalized;
      const w = displayCallbackWindow(direct.normalized);
      const collectedWithBucket = { ...collected, callbackTimePreference: w };
      if (!allRequiredFieldsValid(collectedWithBucket, activeTestMode)) {
        const r = routeToMissingSlotForClose(collectedWithBucket, activeTestMode);
        const patched = { ...collectedWithBucket, ...(r.collectedPatch ?? {}) };
        const clearedCb = keepCallbackPreferenceWhenCloseBlockedRepair(r.state)
          ? patched
          : { ...patched, callbackTimePreference: null };
        pendingCallbackNormalized = null;
        return br(
          {
            nextState: r.state,
            assistantLine: r.line,
            issueMatchResult: null,
            collected: clearedCb,
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, r.state, utterance, null, false, 'close_blocked_not_all_valid_direct_bucket')
        );
      }
      const allOkDirect = allRequiredFieldsValid(collectedWithBucket, activeTestMode);
      if (!allOkDirect) {
        console.warn('VOICE_FSM_INVARIANT_DIRECT_CLOSE_WITHOUT_VALID_LEAD', {
          normalizedIssue: collectedWithBucket.normalizedIssue,
          activeTestMode,
          leakPrimary: collectedWithBucket.leakPrimary,
          leakSecondary: collectedWithBucket.leakSecondary,
        });
      }
      console.info('VOICE_KITCHEN_SINK_CLOSE_SUMMARY', {
        normalizedIssue: collectedWithBucket.normalizedIssue,
        leakPrimary: collectedWithBucket.leakPrimary,
        leakSecondary: collectedWithBucket.leakSecondary,
        collectedName: collectedWithBucket.callerName,
        streetAddress: collectedWithBucket.streetAddress,
        city: collectedWithBucket.city,
        state: collectedWithBucket.state,
        zip: collectedWithBucket.zip,
        addressRemainderDeferredToSms: collectedWithBucket.addressRemainderDeferredToSms,
        callbackTime: collectedWithBucket.callbackTimePreference,
        callbackPhone: collectedWithBucket.callbackPhoneNumber,
        closePath: 'callback_confirm_direct_bucket',
        allRequiredFieldsValid: allOkDirect,
      });
      const got = `Got it — ${w}.`;
      const phoneDisplay = lockedSpokenCallbackPhoneDisplay(collectedWithBucket);
      const line = collectedWithBucket.addressRemainderDeferredToSms
        ? `${got} ${SCRIPT.closeShortDeferred(collectedWithBucket.callerName?.trim() || 'there', phoneDisplay, w)}`
        : `${got} ${SCRIPT.closeShortFull(collectedWithBucket.callerName?.trim() || 'there', phoneDisplay, w)}`;
      return br({
        nextState: 'close_wait',
        assistantLine: line,
        issueMatchResult: null,
        collected: collectedWithBucket,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome:
          collectedWithBucket.normalizedIssue === KITCHEN_SINK_LEAK_NORMALIZED
            ? 'qualified_kitchen_sink_leak'
            : 'qualified_plumbing_intake',
        awaitingUserAudioAfter: true,
      });
    }

    if (matchYes(trimUtterance)) {
      if (!allRequiredFieldsValid(collected, activeTestMode)) {
        const r = routeToMissingSlotForClose(collected, activeTestMode);
        const patched = { ...collected, ...(r.collectedPatch ?? {}) };
        const clearedCb = keepCallbackPreferenceWhenCloseBlockedRepair(r.state)
          ? patched
          : { ...patched, callbackTimePreference: null };
        pendingCallbackNormalized = null;
        return br(
          {
            nextState: r.state,
            assistantLine: r.line,
            issueMatchResult: null,
            collected: clearedCb,
            leakLocationReprompts,
            secondaryLeakReprompts,
            pendingCallbackNormalized: null,
            endReason: null,
            callOutcome: null,
            awaitingUserAudioAfter: true,
          },
          fsmLog(state, r.state, utterance, null, false, 'close_blocked_not_all_valid')
        );
      }
      const name = collected.callerName?.trim() || 'there';
      const addr = formatAddressForCloseSummary(collected);
      const allOk = allRequiredFieldsValid(collected, activeTestMode);
      if (!allOk) {
        console.warn('VOICE_FSM_INVARIANT_YES_CLOSE_WITHOUT_VALID_LEAD', {
          normalizedIssue: collected.normalizedIssue,
          activeTestMode,
          leakPrimary: collected.leakPrimary,
          leakSecondary: collected.leakSecondary,
        });
      }
      console.info('VOICE_KITCHEN_SINK_CLOSE_SUMMARY', {
        normalizedIssue: collected.normalizedIssue,
        leakPrimary: collected.leakPrimary,
        leakSecondary: collected.leakSecondary,
        collectedName: collected.callerName,
        streetAddress: collected.streetAddress,
        city: collected.city,
        state: collected.state,
        zip: collected.zip,
        addressRemainderDeferredToSms: collected.addressRemainderDeferredToSms,
        callbackTime: collected.callbackTimePreference,
        callbackPhone: collected.callbackPhoneNumber,
        closePath: 'callback_confirm_yes',
        allRequiredFieldsValid: allOk,
      });
      const phoneDisplay = lockedSpokenCallbackPhoneDisplay(collected);
      void addr;
      const line = collected.addressRemainderDeferredToSms
        ? SCRIPT.closeShortDeferred(name, phoneDisplay, windowPhrase)
        : SCRIPT.closeShortFull(name, phoneDisplay, windowPhrase);
      return br({
        nextState: 'close_wait',
        assistantLine: line,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome:
          collected.normalizedIssue === KITCHEN_SINK_LEAK_NORMALIZED
            ? 'qualified_kitchen_sink_leak'
            : 'qualified_plumbing_intake',
        awaitingUserAudioAfter: true,
      });
    }
    if (matchNo(trimUtterance)) {
      pendingCallbackNormalized = null;
      return br(
        {
          nextState: 'collect_callback_time',
          assistantLine: SCRIPT.callback,
          issueMatchResult: null,
          collected: { ...collected, callbackTimePreference: null },
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_callback_time', utterance, null, true, 'callback_confirm_no')
      );
    }
    return br(
      {
        nextState: 'callback_confirm',
        assistantLine: SCRIPT.confirmUnclearCb,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'callback_confirm', utterance, null, false, 'confirm_unclear')
    );
  }

  if (state === 'close_wait') {
    const line = matchThanks(trimUtterance) ? SCRIPT.closeThanksReply : SCRIPT.closeSignoff;
    return br({
      nextState: 'close',
      assistantLine: line,
      issueMatchResult: null,
      collected,
      leakLocationReprompts,
      pendingCallbackNormalized: null,
      endReason: null,
      callOutcome:
        collected.normalizedIssue === KITCHEN_SINK_LEAK_NORMALIZED
          ? 'qualified_kitchen_sink_leak'
          : 'qualified_plumbing_intake',
      awaitingUserAudioAfter: false,
    });
  }

  void companyName;
  return br({
    nextState: state,
    assistantLine: "I'm sorry, something went wrong. Goodbye.",
    issueMatchResult: null,
    collected,
    leakLocationReprompts,
    secondaryLeakReprompts,
    pendingCallbackNormalized: null,
    endReason: 'unexpected_state',
    callOutcome: null,
    awaitingUserAudioAfter: false,
  });
}

export function createInitialFsmContext(opts?: {
  inboundCallerPhoneE164?: string | null;
}): {
  state: KitchenSinkLeakOnlyFsmState;
  collected: KitchenSinkCollected;
  leakLocationReprompts: number;
  secondaryLeakReprompts: number;
} {
  const inboundNorm = opts?.inboundCallerPhoneE164
    ? normalizeNanpPhoneToE164(opts.inboundCallerPhoneE164)
    : null;
  return {
    state: 'greeting',
    collected: { ...initialCollected(), inboundCallerPhoneE164: inboundNorm },
    leakLocationReprompts: 0,
    secondaryLeakReprompts: 0,
  };
}
