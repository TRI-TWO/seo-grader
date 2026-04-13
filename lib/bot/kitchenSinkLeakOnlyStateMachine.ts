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
} from '@/lib/bot/plumbingIntakeMatchers';
import {
  collapseRepeatedUtterance,
  displayCallbackWindow,
  extractCallerNameForIntake,
  matchAddressConfirmAffirmative,
  matchAddressRepairIntent,
  matchCallbackRequestIntent,
  matchNo,
  matchYes,
  extractPartialNanpDigits,
  extractPartialZipDigits,
  formatDigitsForSpeechAck,
  formatNanpE164ForAssistantSpeech,
  normalizeNanpPhoneToE164,
  normalizeStreetAbbreviations,
  streetLineLooksCompleteEnoughForProgress,
  titleCaseStreetWordsForSpeech,
  tryParseCityStateZipCombined,
  utteranceSuggestsLockedSlotCorrection,
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
  | 'kitchen_sink_confirm'
  | 'leak_location_primary_capture'
  | 'leak_location_secondary_capture'
  | 'collect_name'
  | 'collect_street_address'
  | 'collect_city'
  | 'collect_state'
  | 'collect_zip'
  | 'address_city_deferred_sms'
  | 'address_confirm'
  | 'callback_number_confirm'
  | 'callback_number_collect'
  | 'collect_callback_time'
  | 'callback_confirm'
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
  /** Partial NANP digits from a failed callback capture, for narrow reprompt. */
  callbackPhonePartialDigits: string | null;
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
  issueRepromptPlumbing:
    'What plumbing issue can we help with — for example a leak, clog, toilet, faucet, or water heater?',
  primaryLeak: 'Is it at the faucet, or below the sink?',
  primaryLeakReprompt: 'Faucet, or below the sink?',
  secondaryFaucetPath: 'Does it seem like the faucet itself, or the drain?',
  secondaryBelowPath: 'Does it seem like a pipe, or the drain?',
  nameIntake: POST_TRIAGE_HANDOFF_NAME_LINE,
  name: "What's your name?",
  nameReprompt: "Sorry, I didn't catch that — what's your name?",
  street: "What's the building number and street name?",
  streetPartial: 'I need the building number and street name. What are those?',
  streetHard: 'Please say the building number and street name.',
  addressRepair: 'Sorry about that — go ahead with the building number and street name.',
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
  callbackNumberConfirm: (display: string) =>
    `The number we have is ${display}. Is that the best number to call or text you at?`,
  callbackNumberConfirmUnclear: 'Please say yes or no — is that the best number to reach you at?',
  callbackNumberAsk: "What's the best number to call or text you at?",
  callbackNumberAskReprompt:
    "Sorry, I didn't catch that — what's the best number, area code first?",
  callbackNumberAfterPartial: (partial: string) =>
    `I caught ${formatDigitsForSpeechAck(partial)}. What is the best ten-digit callback number, area code first?`,
  callback:
    'What time of day works best for a callback, such as morning, afternoon, or evening?',
  callbackReprompt:
    'What time of day works best for a callback, such as morning, afternoon, or evening?',
  callbackConfirm: (windowPhrase: string) =>
    `Just to confirm, you'd like us to call you back ${windowPhrase} — is that right?`,
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
} as const;

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
  | 'street'
  | 'city'
  | 'state'
  | 'zip'
  | 'callback'
  | 'callback_phone'
  | 'address_asr_empty';

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
    callbackPhonePartialDigits: null,
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
    next = { ...next, leakPrimary: inf.primary };
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
  const { streetAddress, city, state, zip } = c;
  if (!streetAddress?.trim() || !city?.trim() || !state?.trim() || !zip?.trim()) {
    return '';
  }
  return `${streetAddress.trim()}, ${city.trim()}, ${state.trim()} ${zip.trim()}`;
}

/** Recap line for close: full address, or street + SMS deferral note. */
export function formatAddressForCloseSummary(c: KitchenSinkCollected): string {
  if (c.addressRemainderDeferredToSms) {
    if (c.streetAddress?.trim() && validateStreet(c.streetAddress).ok) {
      return `${c.streetAddress.trim()} — city and zip by text follow-up.`;
    }
    return 'your service address — details will be confirmed by text.';
  }
  return formatFullAddress(c);
}

function syncServiceAddress(collected: KitchenSinkCollected): KitchenSinkCollected {
  const line = formatFullAddress(collected);
  return line ? { ...collected, serviceAddress: line } : { ...collected };
}

export function allRequiredFieldsValid(c: KitchenSinkCollected): boolean {
  if (!c.normalizedIssue || !SUPPORTED_PLUMBING_INTAKE_ISSUES.has(c.normalizedIssue)) {
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
    if (!c.streetAddress || !validateStreet(c.streetAddress).ok) {
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
  };
}

function routeToMissingSlotForClose(collected: KitchenSinkCollected): {
  state: KitchenSinkLeakOnlyFsmState;
  line: string;
  collectedPatch?: Partial<KitchenSinkCollected>;
} {
  if (!collected.normalizedIssue || !SUPPORTED_PLUMBING_INTAKE_ISSUES.has(collected.normalizedIssue)) {
    return { state: 'issue_capture', line: SCRIPT.issueRepromptPlumbing };
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
  if (!collected.callerName || !validateName(collected.callerName).ok) {
    return { state: 'collect_name', line: SCRIPT.nameReprompt };
  }
  if (!collected.addressRemainderDeferredToSms) {
    if (!collected.streetAddress || !validateStreet(collected.streetAddress).ok) {
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
      const disp = formatNanpE164ForAssistantSpeech(
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
  return { state: 'collect_name', line: SCRIPT.nameReprompt };
}

function firstMissingAddressSlot(collected: KitchenSinkCollected): KitchenSinkLeakOnlyFsmState | null {
  if (!collected.streetAddress || !validateStreet(collected.streetAddress).ok) {
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

export function transitionKitchenSinkLeakOnly(params: {
  state: KitchenSinkLeakOnlyFsmState;
  utterance: string;
  collected: KitchenSinkCollected;
  leakLocationReprompts: number;
  secondaryLeakReprompts?: number;
  companyName: string;
  pendingCallbackNormalized: CallbackWindow | null;
  slotRetryCounts?: Partial<Record<KitchenSinkSlotRetryKey, number>>;
}): TransitionResult {
  const { state, utterance, companyName } = params;
  let collected = { ...params.collected };
  let leakLocationReprompts = params.leakLocationReprompts;
  let secondaryLeakReprompts = params.secondaryLeakReprompts ?? 0;
  let pendingCallbackNormalized = params.pendingCallbackNormalized;
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
    const asrAllowed: KitchenSinkLeakOnlyFsmState[] = [
      'collect_street_address',
      'collect_city',
      'collect_state',
      'collect_zip',
      'address_confirm',
    ];
    if (asrAllowed.includes(state)) {
      bump('address_asr_empty');
      const fails = slotRetryCounts.address_asr_empty ?? 0;
      if (fails >= 3) {
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
        state === 'address_confirm' && formatFullAddress(collected)
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
    const m = matchPlumbingIntakeIssue(trimUtterance);
    issueMatchResult = { accepted: m.accepted, rejectReason: m.accepted ? null : m.rejectReason };
    if (m.accepted) {
      const issue = m.issue;
      if (issue === KITCHEN_SINK_LEAK_NORMALIZED) {
        collected = { ...collected, normalizedIssue: issue };
        const inf = inferKitchenSinkLeakTriage(trimUtterance);
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
      return br(
        {
          nextState: 'collect_name',
          assistantLine: plumbingIssueAckLine(issue),
          issueMatchResult,
          collected,
          leakLocationReprompts: 0,
          secondaryLeakReprompts: 0,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_name', utterance, issue, true, 'plumbing_issue_routed')
      );
    }
    if (m.rejectReason === 'off_lane' || m.rejectReason?.startsWith('off_lane')) {
      return br({
        nextState: 'unsupported_end',
        assistantLine: REFUSAL_LINE,
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
      assistantLine: SCRIPT.issueRepromptPlumbing,
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

    const hardConfirm = parseHardLeakLocationOverrideFromUtterance(trimUtterance);
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

    const inf = inferKitchenSinkLeakTriage(trimUtterance);
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

    const hardPrimary = parseHardLeakLocationOverrideFromUtterance(trimUtterance);
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

    const choice = matchPrimaryLeakChoice(trimUtterance);
    if (choice === 'faucet' || choice === 'below_sink') {
      collected = { ...collected, leakPrimary: choice };
      const sec = matchSecondaryLeakChoice(trimUtterance, choice);
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

    const hardSec = parseHardLeakLocationOverrideFromUtterance(trimUtterance);
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
      stripLeakLocationCorrectionPrefix(trimUtterance);
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

    const sec = matchSecondaryLeakChoice(trimUtterance, primary);
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
    if (matchAddressRepairIntent(trimUtterance)) {
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
        fsmLog(state, 'collect_street_address', utterance, null, true, 'address_repair')
      );
    }

    const v = validateStreet(trimUtterance);
    if (!v.ok) {
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

    if (!streetLineLooksCompleteEnoughForProgress(trimUtterance)) {
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
    const parsedCombo = tryParseStreetLineAndCity(trimUtterance);
    const streetOnly =
      parsedCombo.ok && parsedCombo.street.trim() ? parsedCombo.street.trim() : trimUtterance.trim();
    collected = { ...collected, streetAddress: streetOnly };
    return br(
      {
        nextState: 'collect_city',
        assistantLine: SCRIPT.city,
        issueMatchResult: null,
        collected,
        leakLocationReprompts,
        pendingCallbackNormalized: null,
        endReason: null,
        callOutcome: null,
        awaitingUserAudioAfter: true,
      },
      fsmLog(state, 'collect_city', utterance, trimUtterance.trim(), true, null)
    );
  }

  if (state === 'collect_city') {
    if (matchAddressRepairIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_city',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_city', utterance, null, true, 'address_repair')
      );
    }

    const combined = tryParseCityStateZipCombined(trimUtterance);
    if (combined.ok) {
      reset('city');
      reset('state');
      reset('zip');
      reset('address_asr_empty');
      collected = {
        ...collected,
        city: combined.city,
        state: combined.stateAbbr,
        zip: combined.zipDigits ?? null,
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

    const v = validateCity(trimUtterance);
    if (!v.ok) {
      bump('city');
      const fails = slotRetryCounts.city ?? 0;
      const streetOk =
        Boolean(collected.streetAddress?.trim()) &&
        validateStreet(collected.streetAddress ?? '').ok;
      if (fails >= 2 && streetOk) {
        return br(
          {
            nextState: 'address_city_deferred_sms',
            assistantLine: SCRIPT.addressCityDeferredSms,
            issueMatchResult: null,
            collected: {
              ...collected,
              addressRemainderDeferredToSms: true,
              city: null,
              state: null,
              zip: null,
              serviceAddress: null,
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
    collected = { ...collected, city: trimUtterance.trim() };
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
      fsmLog(state, 'collect_state', utterance, trimUtterance.trim(), true, null)
    );
  }

  if (state === 'collect_state') {
    if (matchAddressRepairIntent(trimUtterance)) {
      return br(
        {
          nextState: 'collect_state',
          assistantLine: SCRIPT.addressRepair,
          issueMatchResult: null,
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_state', utterance, null, true, 'address_repair')
      );
    }

    const v = validateState(trimUtterance);
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
    collected = syncServiceAddress({ ...collected, state: v.normalized });
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
          collected,
          leakLocationReprompts,
          pendingCallbackNormalized: null,
          endReason: null,
          callOutcome: null,
          awaitingUserAudioAfter: true,
        },
        fsmLog(state, 'collect_zip', utterance, null, true, 'address_repair')
      );
    }

    const z = validateZip(trimUtterance);
    if (!z.ok || !z.digits) {
      bump('zip');
      const partial = extractPartialZipDigits(trimUtterance);
      const nextPartial = partial ?? collected.zipPartialDigits ?? null;
      collected = { ...collected, zipPartialDigits: nextPartial };
      const fails = slotRetryCounts.zip ?? 0;
      const line =
        nextPartial && fails >= 1
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
    if (hasInboundPhoneForConfirm(collected)) {
      const disp = formatNanpE164ForAssistantSpeech(
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
        fsmLog(state, 'callback_number_confirm', utterance, null, true, 'address_sms_defer_to_callback')
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
      fsmLog(state, 'callback_number_collect', utterance, null, true, 'address_sms_defer_to_callback')
    );
  }

  if (state === 'address_confirm') {
    const addr = formatFullAddress(collected);
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
        const disp = formatNanpE164ForAssistantSpeech(
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
    if (matchYes(trimUtterance)) {
      const inbound = collected.inboundCallerPhoneE164;
      const normalized = inbound ? normalizeNanpPhoneToE164(inbound) : null;
      if (!normalized) {
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
          fsmLog(state, 'callback_number_collect', utterance, null, false, 'inbound_invalid')
        );
      }
      reset('callback_phone');
      collected = {
        ...collected,
        callbackPhoneNumber: normalized,
        callbackPhoneSource: 'inbound_confirmed',
        callbackPhonePartialDigits: null,
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
        fsmLog(state, 'callback_number_collect', utterance, null, true, 'callback_number_inbound_no')
      );
    }
    const disp = hasInboundPhoneForConfirm(collected)
      ? formatNanpE164ForAssistantSpeech(normalizeNanpPhoneToE164(collected.inboundCallerPhoneE164!)!)
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
    const p = validateSpokenNanpPhone(trimUtterance);
    if (!p.ok) {
      bump('callback_phone');
      const partial = extractPartialNanpDigits(trimUtterance);
      const nextPartial = partial ?? collected.callbackPhonePartialDigits ?? null;
      collected = { ...collected, callbackPhonePartialDigits: nextPartial };
      const fails = slotRetryCounts.callback_phone ?? 0;
      const line =
        nextPartial && fails >= 1
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
        fsmLog(state, 'callback_number_collect', utterance, null, false, p.reason)
      );
    }
    reset('callback_phone');
    collected = {
      ...collected,
      callbackPhoneNumber: p.e164,
      callbackPhoneSource: 'spoken',
      callbackPhonePartialDigits: null,
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
      fsmLog(state, 'collect_callback_time', utterance, p.e164, true, 'callback_number_spoken')
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
    const cbLine = fails >= 2 ? SCRIPT.callbackReprompt : SCRIPT.callback;

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
    const windowPhrase =
      pendingCallbackNormalized != null
        ? displayCallbackWindow(pendingCallbackNormalized)
        : collected.callbackTimePreference || 'your preferred time';

    if (matchYes(trimUtterance)) {
      if (!allRequiredFieldsValid(collected)) {
        const r = routeToMissingSlotForClose(collected);
        const patched = { ...collected, ...(r.collectedPatch ?? {}) };
        const keepCallbackWindow =
          r.state === 'collect_callback_time' ||
          r.state === 'callback_confirm' ||
          r.state === 'callback_number_confirm' ||
          r.state === 'callback_number_collect' ||
          r.state === 'address_city_deferred_sms';
        const clearedCb = keepCallbackWindow ? patched : { ...patched, callbackTimePreference: null };
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
      const allOk = allRequiredFieldsValid(collected);
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
        allRequiredFieldsValid: allOk,
      });
      const phoneDisplay =
        collected.callbackPhoneNumber && validateStoredCallbackPhoneE164(collected.callbackPhoneNumber).ok
          ? formatNanpE164ForAssistantSpeech(collected.callbackPhoneNumber)
          : null;
      return br({
        nextState: 'close',
        assistantLine: SCRIPT.closeSummary(name, addr, windowPhrase, phoneDisplay),
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
