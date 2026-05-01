import type {
  KitchenSinkCollected,
  TransitionResult,
} from '@/lib/bot/kitchenSinkLeakOnlyStateMachine';

export type LockedSlotDebugAction = 'reopened' | 'ignored' | 'repeat_ok' | 'advance_under_lock';

export type LockedSlotDebugEvent = {
  action: LockedSlotDebugAction;
  slot: string;
  reason: string;
};

function fmtValue(key: keyof KitchenSinkCollected, v: unknown): string {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v !== 'string') return String(v);
  const s = v.trim();
  if (!s) return '∅';
  if (key === 'callbackPhoneNumber' || key === 'inboundCallerPhoneE164') {
    const d = s.replace(/\D/g, '');
    return d.length >= 4 ? `…${d.slice(-4)}` : '(digits)';
  }
  if (key === 'callerName') {
    return `${s[0] ?? '?'}…(n=${s.length})`;
  }
  if (s.length > 24) return `${s.slice(0, 24)}…`;
  return s;
}

/** Compact, low-PII list of collected fields that changed on this transition. */
export function kitchenSinkCollectedSlotWrites(
  before: KitchenSinkCollected,
  after: KitchenSinkCollected
): string[] {
  const keys: (keyof KitchenSinkCollected)[] = [
    'normalizedIssue',
    'leakPrimary',
    'leakSecondary',
    'callerName',
    'streetAddress',
    'city',
    'state',
    'zip',
    'serviceAddress',
    'callbackPhoneNumber',
    'callbackPhoneSource',
    'callbackTimePreference',
    'addressRemainderDeferredToSms',
    'zipPartialDigits',
    'callbackPhonePartialDigits',
  ];
  const out: string[] = [];
  for (const k of keys) {
    if (before[k] !== after[k]) {
      out.push(`${String(k)}:${fmtValue(k, before[k])}→${fmtValue(k, after[k])}`);
    }
  }
  return out;
}

function intentOrMatchSummary(res: TransitionResult): string {
  if (res.issueMatchResult) {
    const im = res.issueMatchResult;
    return im.accepted ? 'issue:accepted' : `issue:reject:${im.rejectReason ?? 'unknown'}`;
  }
  const rr = res.transitionLog?.rejectionReason;
  if (rr) return `branch:${rr}`;
  if (res.transitionLog?.validationOk === false) return 'branch:validation_fail';
  return 'branch:ok';
}

/**
 * Derives locked-slot debugging from lock flag deltas and known `rejectionReason` tokens
 * (see kitchenSinkLeakOnlyStateMachine `fsmLog` reasons). Does not change FSM behavior.
 */
export function kitchenSinkLockedSlotEvents(
  before: KitchenSinkCollected,
  after: KitchenSinkCollected,
  rejectionReason: string | null
): LockedSlotDebugEvent[] {
  const events: LockedSlotDebugEvent[] = [];
  const rr = rejectionReason ?? '';

  if (before.streetLocked && !after.streetLocked) {
    events.push({ action: 'reopened', slot: 'street', reason: rr || 'street_lock_cleared' });
  }
  if (before.cityLocked && !after.cityLocked) {
    events.push({ action: 'reopened', slot: 'city', reason: rr || 'city_lock_cleared' });
  }
  if (before.stateLocked && !after.stateLocked) {
    events.push({ action: 'reopened', slot: 'state', reason: rr || 'state_lock_cleared' });
  }
  if (before.zipLocked && !after.zipLocked) {
    events.push({ action: 'reopened', slot: 'zip', reason: rr || 'zip_lock_cleared' });
  }
  if (before.callbackLocked && !after.callbackLocked) {
    events.push({ action: 'reopened', slot: 'callback', reason: rr || 'callback_lock_cleared' });
  }

  const lockedReason = /^(street|city|state|zip)_locked_/.exec(rr);
  if (lockedReason) {
    const slot = lockedReason[1];
    const hadLock =
      (slot === 'street' && before.streetLocked) ||
      (slot === 'city' && before.cityLocked) ||
      (slot === 'state' && before.stateLocked) ||
      (slot === 'zip' && before.zipLocked);
    if (hadLock) {
      if (
        rr.includes('skip_overwrite') ||
        rr.includes('ignore_garbled') ||
        rr.includes('reprompt_different')
      ) {
        events.push({ action: 'ignored', slot, reason: rr });
      } else if (rr.includes('repeat_ok') || rr.includes('skip_reprompt')) {
        events.push({ action: 'repeat_ok', slot, reason: rr });
      } else if (rr === 'street_locked_city_heard' && before.streetLocked) {
        events.push({ action: 'advance_under_lock', slot: 'street', reason: rr });
      }
    }
  }

  return events;
}

export type KitchenSinkTurnDebugPayload = {
  fromState: string;
  toState: string;
  intentOrMatch: string;
  slotWrites: string[];
  normalizedValueWritten: string | null;
  validationOk: boolean | null;
  rejectionReason: string | null;
  utterancePreview: string;
};

export function buildKitchenSinkTurnDebug(params: {
  fromState: string;
  res: TransitionResult;
  collectedBefore: KitchenSinkCollected;
  utterancePreview: string;
}): KitchenSinkTurnDebugPayload {
  const { fromState, res, collectedBefore, utterancePreview } = params;
  const tl = res.transitionLog;
  return {
    fromState,
    toState: res.nextState,
    intentOrMatch: intentOrMatchSummary(res),
    slotWrites: kitchenSinkCollectedSlotWrites(collectedBefore, res.collected),
    normalizedValueWritten: tl?.normalizedValueWritten ?? null,
    validationOk: tl?.validationOk ?? null,
    rejectionReason: tl?.rejectionReason ?? null,
    utterancePreview,
  };
}
