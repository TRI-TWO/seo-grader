import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KITCHEN_SINK_LEAK_NORMALIZED } from './kitchenSinkLeakOnlyMatchers';
import { WATER_HEATER_LEAK_ISSUE } from './plumbingIntakeMatchers';
import {
  allRequiredFieldsValid,
  ASR_EMPTY_TRANSCRIPT_SIGNAL,
  formatAddressForCloseSummary,
  formatLockedFullAddressForSpeech,
  formatFullAddress,
  lineContainsPrematureSchedulingPromise,
  POST_TRIAGE_HANDOFF_NAME_LINE,
  transitionKitchenSinkLeakOnly,
  type KitchenSinkCollected,
  type KitchenSinkSlotRetryKey,
} from './kitchenSinkLeakOnlyStateMachine';
import {
  matchAddressRepairIntent,
  streetLineLooksCompleteEnoughForProgress,
} from './kitchenSinkLeakOnlyValidators';
import type { CallbackWindow } from './kitchenSinkLeakOnlyValidators';

const baseParams: {
  leakLocationReprompts: number;
  secondaryLeakReprompts: number;
  companyName: string;
  pendingCallbackNormalized: CallbackWindow | null;
} = {
  leakLocationReprompts: 0,
  secondaryLeakReprompts: 0,
  companyName: 'Acme',
  pendingCallbackNormalized: null,
};

const OPEN_LOCKS: Pick<
  KitchenSinkCollected,
  'streetLocked' | 'cityLocked' | 'stateLocked' | 'zipLocked' | 'callbackLocked'
> = {
  streetLocked: false,
  cityLocked: false,
  stateLocked: false,
  zipLocked: false,
  callbackLocked: false,
};

const baseCollected = (): KitchenSinkCollected => ({
  normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
  leakPrimary: 'below_sink',
  leakSecondary: 'drain',
  callerName: 'Alex',
  serviceAddress: '10 Oak St, Austin, TX 78701',
  streetAddress: '10 Oak St',
  city: 'Austin',
  state: 'TX',
  zip: '78701',
  inboundCallerPhoneE164: null,
  callbackPhoneNumber: '+15551234567',
  callbackPhoneSource: 'spoken',
  callbackTimePreference: 'the morning',
  addressRemainderDeferredToSms: false,
  zipPartialDigits: null,
  streetNumberPending: null,
  callbackPhonePartialDigits: null,
  ...OPEN_LOCKS,
  streetLocked: true,
  cityLocked: true,
  stateLocked: true,
  zipLocked: true,
  callbackLocked: true,
  callbackInboundConfirmRejected: false,
  unitOrSuite: null,
});

const emptyIntakeCollected = (): KitchenSinkCollected => ({
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
  ...OPEN_LOCKS,
  callbackInboundConfirmRejected: false,
  streetNumberPending: null,
  unitOrSuite: null,
});

const afterStreetCollected = (): KitchenSinkCollected => ({
  ...emptyIntakeCollected(),
  normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
  leakPrimary: 'below_sink',
  leakSecondary: 'drain',
  callerName: 'Pat',
  streetAddress: '100 Main St',
  streetLocked: true,
});

describe('kitchenSinkLeakOnlyStateMachine', () => {
  it('formatFullAddress joins parts', () => {
    assert.equal(formatFullAddress(baseCollected()), '10 Oak St, Austin, TX 78701');
  });

  it('formatLockedFullAddressForSpeech returns empty when a slot is not locked', () => {
    assert.equal(formatLockedFullAddressForSpeech({ ...baseCollected(), cityLocked: false }), '');
  });

  it('formatAddressForCloseSummary does not emit a full street line when zip is not locked', () => {
    const s = formatAddressForCloseSummary({ ...baseCollected(), zipLocked: false });
    assert.ok(!s.includes('Oak'));
    assert.ok(s.toLowerCase().includes('service address'));
  });

  it('callback_confirm yes prefers stored callback time phrase over stale pending bucket', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'yes',
      collected: {
        ...baseCollected(),
        callbackTimePreference: 'the evening',
      },
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'close_wait');
    assert.ok(r.assistantLine.toLowerCase().includes('evening'));
    assert.ok(!r.assistantLine.toLowerCase().includes('the morning'));
  });

  it('allRequiredFieldsValid is true for full collected', () => {
    assert.equal(allRequiredFieldsValid(baseCollected()), true);
  });

  it('advances street to city when street valid', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '99 Pine Road',
      collected: { ...baseCollected(), streetAddress: null, city: null, state: null, zip: null },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_unit');
    assert.equal(r.collected.streetAddress, '99 Pine Road');
    assert.ok(r.assistantLine.toLowerCase().includes('apartment'));
  });

  it('no street prompt contains building name or building number', () => {
    const initial = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 Main Street',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.ok(!initial.assistantLine.toLowerCase().includes('building name'));
    assert.ok(!initial.assistantLine.toLowerCase().includes('building number'));
  });

  it('no street prompt contains apartment building classification language', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.ok(!r.assistantLine.toLowerCase().includes('apartment building'));
  });

  it('street ASR-empty defers to SMS after 6 misses (avoid premature defer)', () => {
    const c: KitchenSinkCollected = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
    };
    let curCollected: KitchenSinkCollected = c;
    let curSlot: Partial<Record<KitchenSinkSlotRetryKey, number>> = {};
    for (let miss = 1; miss <= 5; miss += 1) {
      const cur = transitionKitchenSinkLeakOnly({
        state: 'collect_street_address',
        utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
        collected: curCollected,
        ...baseParams,
        slotRetryCounts: curSlot,
      });
      assert.equal(cur.nextState, 'collect_street_address');
      assert.equal(cur.slotRetryCounts.address_asr_empty, miss);
      curCollected = cur.collected;
      curSlot = cur.slotRetryCounts;
    }
    const last = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: curCollected,
      ...baseParams,
      slotRetryCounts: curSlot,
    });
    assert.equal(last.nextState, 'address_city_deferred_sms');
    assert.equal(last.collected.addressRemainderDeferredToSms, true);
  });

  it('collect_street_address unstructured number-ish tokens defer after sixth partial-number-only miss', () => {
    /** Not pure digit-token speech; must keep bump path (unlike compact "two four five"). */
    const partialOnly = 'forty ninety';
    const c: KitchenSinkCollected = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
    };
    let curCollected: KitchenSinkCollected = c;
    let curSlot: Partial<Record<KitchenSinkSlotRetryKey, number>> | undefined = undefined;
    for (let miss = 1; miss <= 5; miss += 1) {
      const cur = transitionKitchenSinkLeakOnly({
        state: 'collect_street_address',
        utterance: partialOnly,
        collected: curCollected,
        ...baseParams,
        slotRetryCounts: curSlot,
      });
      assert.equal(cur.nextState, 'collect_street_address');
      assert.equal(cur.slotRetryCounts.address_asr_empty, miss);
      curCollected = cur.collected;
      curSlot = cur.slotRetryCounts;
    }
    const last = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: partialOnly,
      collected: curCollected,
      ...baseParams,
      slotRetryCounts: curSlot,
    });
    assert.equal(last.nextState, 'address_city_deferred_sms');
  });

  it('collect_street_address carries house number then merges street name on next turn', () => {
    const c: KitchenSinkCollected = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
    };
    const first = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '245',
      collected: c,
      ...baseParams,
    });
    assert.equal(first.nextState, 'collect_street_address');
    assert.equal(first.collected.streetNumberPending, '245');
    assert.ok(first.assistantLine.toLowerCase().includes('street name'));

    const second = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: 'Maple Avenue',
      collected: first.collected,
      ...baseParams,
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'collect_unit');
    assert.ok((second.collected.streetAddress ?? '').toLowerCase().includes('maple'));
    assert.ok((second.collected.streetAddress ?? '').includes('245'));
    assert.equal(second.collected.streetNumberPending, null);
  });

  it('collect_street_address accepts number words + street tokens (one two three main street)', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: 'one two three main street',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_unit');
  });

  it('asks optional unit after street and does not block progress when skipped', () => {
    const street = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '500 Market Street',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(street.nextState, 'collect_unit');
    assert.ok(street.assistantLine.toLowerCase().includes('apartment'));
    const unit = transitionKitchenSinkLeakOnly({
      state: 'collect_unit',
      utterance: 'Suite 200',
      collected: street.collected,
      ...baseParams,
    });
    assert.equal(unit.nextState, 'collect_city');
    assert.equal(unit.collected.unitOrSuite, 'Suite 200');
    assert.equal(unit.assistantLine, 'Got it. What city is that in?');

    const skip = transitionKitchenSinkLeakOnly({
      state: 'collect_unit',
      utterance: 'no',
      collected: street.collected,
      ...baseParams,
    });
    assert.equal(skip.nextState, 'collect_city');
  });

  it('123 Main Street first pass uses narrow street-to-city line (no full-street repair)', () => {
    const street = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 Main Street',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(street.nextState, 'collect_unit');
    assert.equal(street.collected.streetAddress, '123 Main Street');
    const unitSkip = transitionKitchenSinkLeakOnly({
      state: 'collect_unit',
      utterance: 'no',
      collected: street.collected,
      ...baseParams,
    });
    assert.equal(unitSkip.nextState, 'collect_city');
    assert.equal(unitSkip.assistantLine, 'Got it. What city is that in?');
    assert.ok(!unitSkip.assistantLine.toLowerCase().includes('building'));
  });

  it('collect_street_address accepts non-Main street names like Maple Road', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 Maple Road',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_unit');
    assert.equal(r.collected.streetAddress, '123 Maple Road');
  });

  it('plausible locked street skips completeness reprompt on noisy follow-up', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: 'DE',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
        streetAddress: '123 Main Street',
        streetLocked: true,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.streetAddress, '123 Main Street');
    assert.equal(r.assistantLine, 'Got it. What city is that in?');
  });

  it('address_confirm yes goes to callback_number_collect when no inbound caller id', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_confirm',
      utterance: 'yes',
      collected: {
        ...baseCollected(),
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
    assert.ok(r.assistantLine.includes('best number'));
  });

  it('address_confirm yes goes to callback_number_confirm when inbound id present', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_confirm',
      utterance: 'yes',
      collected: {
        ...baseCollected(),
        inboundCallerPhoneE164: '+12025559876',
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_confirm');
    assert.ok(r.assistantLine.toLowerCase().includes('callback number'));
    assert.ok(r.assistantLine.toLowerCase().includes('say yes or no'));
    assert.ok(r.assistantLine.includes('202-555-9876'));
  });

  it('callback_number_confirm yes copies inbound to callback phone and asks callback time', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: 'yes',
      collected: {
        ...baseCollected(),
        inboundCallerPhoneE164: '+12025559876',
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackTimePreference: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_callback_time');
    assert.equal(r.collected.callbackPhoneNumber, '+12025559876');
    assert.equal(r.collected.callbackPhoneSource, 'inbound_confirmed');
  });

  it('callback_number_confirm no goes to collect spoken number', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: 'no',
      collected: {
        ...baseCollected(),
        inboundCallerPhoneE164: '+12025559876',
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackTimePreference: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
  });

  it('callback_number_collect redirects to ANI confirm when inbound is present and ANI was not rejected', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '3025559999',
      collected: {
        ...baseCollected(),
        inboundCallerPhoneE164: '+12025559876',
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackTimePreference: null,
        callbackLocked: false,
        callbackInboundConfirmRejected: false,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_confirm');
    assert.ok(r.assistantLine.includes('202-555-9876'));
  });

  it('callback_number_confirm repeated ASR-empty with inbound stays on confirm (no collect escalation)', () => {
    const collected = {
      ...baseCollected(),
      inboundCallerPhoneE164: '+12025559876',
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      callbackTimePreference: null,
      callbackLocked: false,
      callbackInboundConfirmRejected: false,
    };
    const first = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected,
      ...baseParams,
    });
    assert.equal(first.nextState, 'callback_number_confirm');
    const second = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: first.collected,
      ...baseParams,
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'callback_number_confirm');
    assert.notEqual(second.nextState, 'callback_number_collect');
  });

  it('callback_number_confirm ASR-empty escalates to collect when address is deferred', () => {
    const collected = {
      ...baseCollected(),
      inboundCallerPhoneE164: '+12025559876',
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      callbackTimePreference: null,
      callbackLocked: false,
      callbackInboundConfirmRejected: false,
      addressRemainderDeferredToSms: true,
    };
    const first = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected,
      ...baseParams,
    });
    assert.equal(first.nextState, 'callback_number_confirm');
    const second = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: first.collected,
      ...baseParams,
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'callback_number_collect');
  });

  it('callback_number_confirm objection forces collect (no advancement)', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: "you don't have my full number",
      collected: {
        ...baseCollected(),
        inboundCallerPhoneE164: '+14432541963',
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackTimePreference: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
    assert.ok(r.assistantLine.toLowerCase().includes('best number'));
    assert.notEqual(r.nextState, 'collect_callback_time');
  });

  it('callback_number_collect accepts NANP and asks explicit confirmation before callback time', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '202 555 1212',
      collected: {
        ...baseCollected(),
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackTimePreference: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_confirm');
    assert.equal(r.collected.callbackPhoneNumber, '+12025551212');
    assert.equal(r.collected.callbackPhoneSource, 'spoken');
    assert.equal(r.collected.callbackLocked, false);
    assert.ok(r.assistantLine.toLowerCase().includes('is that the best number'));
  });

  it('callback_number_confirm yes locks spoken callback phone and advances to callback time', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: 'yes',
      collected: {
        ...baseCollected(),
        callbackPhoneNumber: '+12025551212',
        callbackPhoneSource: 'spoken',
        callbackLocked: false,
        callbackTimePreference: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_callback_time');
    assert.equal(r.collected.callbackPhoneNumber, '+12025551212');
    assert.equal(r.collected.callbackPhoneSource, 'spoken');
    assert.equal(r.collected.callbackLocked, true);
  });

  it('callback_number_confirm no on spoken phone returns to full number recollect', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_confirm',
      utterance: 'no',
      collected: {
        ...baseCollected(),
        callbackPhoneNumber: '+12025551212',
        callbackPhoneSource: 'spoken',
        callbackLocked: false,
        callbackTimePreference: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
    assert.equal(r.collected.callbackPhoneNumber, null);
    assert.equal(r.collected.callbackPhoneSource, null);
    assert.equal(r.collected.callbackLocked, false);
  });

  it('callback_number_collect single-character garbage does not run phone validation', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: 'А',
      collected: {
        ...baseCollected(),
        callbackPhoneNumber: null,
        callbackPhoneSource: null,
        callbackTimePreference: null,
        callbackLocked: false,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
    assert.equal(r.transitionLog?.rejectionReason, 'callback_unusable_transcript');
  });

  it('collect_callback_time valid goes to callback_confirm', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_callback_time',
      utterance: 'afternoon',
      collected: baseCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_confirm');
    assert.equal(r.pendingCallbackNormalized, 'afternoon');
  });

  it('issue_capture thin kitchen sink leak goes to kitchen_sink_confirm', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'I have a leak at my kitchen sink',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'kitchen_sink_confirm');
    assert.equal(r.assistantLine, 'Just to confirm, this is your kitchen sink?');
  });

  it('issue_capture with faucet only skips secondary; locks faucet_self', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'my kitchen sink faucet is leaking',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.assistantLine, "Got it. What's your name?");
    assert.equal(r.collected.leakPrimary, 'faucet');
    assert.equal(r.collected.leakSecondary, 'faucet_self');
  });

  it('issue_capture under sink without pipe/drain asks secondary (below path)', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'my kitchen sink is leaking under the sink',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'leak_location_secondary_capture');
    assert.equal(
      r.assistantLine,
      'Is it the pipes under the sink, the drain, or something else right around the sink?'
    );
    assert.equal(r.collected.leakPrimary, 'below_sink');
  });

  it('issue_capture drain under kitchen sink infers full triage and goes to name', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'The drain under my kitchen sink is leaking',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.assistantLine, "Got it. What's your name?");
    assert.equal(r.collected.leakPrimary, 'below_sink');
    assert.equal(r.collected.leakSecondary, 'drain');
  });

  it('kitchen_sink_confirm uses full utterance: yes + faucet skips primary question', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'kitchen_sink_confirm',
      utterance: 'Yes, the faucet is leaking',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.assistantLine, "Got it. What's your name?");
    assert.equal(r.collected.leakPrimary, 'faucet');
    assert.equal(r.collected.leakSecondary, 'faucet_self');
  });

  it('kitchen_sink_confirm at faucet overrides below_sink infer without under-sink secondary prompt', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'kitchen_sink_confirm',
      utterance: 'at the faucet',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.assistantLine, "Got it. What's your name?");
    assert.equal(r.collected.leakPrimary, 'faucet');
    assert.equal(r.collected.leakSecondary, 'faucet_self');
    assert.ok(!r.assistantLine.toLowerCase().includes('under the sink'));
  });

  it('kitchen_sink_confirm bare yes goes to primary forced-choice', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'kitchen_sink_confirm',
      utterance: 'yes',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'leak_location_primary_capture');
    assert.equal(
      r.assistantLine,
      'Is it coming from the faucet or the pipes below the sink?'
    );
  });

  it('leak_location_primary_capture below the sink then secondary below path', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'leak_location_primary_capture',
      utterance: 'Below the sink',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'leak_location_secondary_capture');
    assert.equal(
      r.assistantLine,
      'Is it the pipes under the sink, the drain, or something else right around the sink?'
    );
    assert.equal(r.collected.leakPrimary, 'below_sink');
  });

  it('primary ambiguous twice sets unknown and goes to name intake', () => {
    const utterance = 'drip at the faucet and also under the sink';
    const first = transitionKitchenSinkLeakOnly({
      state: 'leak_location_primary_capture',
      utterance,
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      },
      leakLocationReprompts: 0,
      secondaryLeakReprompts: 0,
      companyName: 'Acme',
      pendingCallbackNormalized: null,
    });
    assert.equal(first.nextState, 'leak_location_primary_capture');
    assert.equal(first.leakLocationReprompts, 1);

    const second = transitionKitchenSinkLeakOnly({
      state: 'leak_location_primary_capture',
      utterance,
      collected: first.collected,
      leakLocationReprompts: first.leakLocationReprompts,
      secondaryLeakReprompts: first.secondaryLeakReprompts,
      companyName: 'Acme',
      pendingCallbackNormalized: null,
    });
    assert.equal(second.nextState, 'collect_name');
    assert.equal(second.assistantLine, "Got it. What's your name?");
    assert.equal(second.collected.leakPrimary, 'unknown');
    assert.equal(second.collected.leakSecondary, 'unknown');
  });

  it('issue reprompt does not use open-ended tell me more copy', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'I need some help',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'issue_capture');
    assert.ok(r.assistantLine.toLowerCase().includes('plumbing'));
    assert.ok(!r.assistantLine.toLowerCase().includes('little more'));
  });

  it('issue_capture ignores single-character garbage transcript', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: '\u516d',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'issue_capture');
    assert.equal(r.issueMatchResult?.accepted, false);
    assert.equal(r.issueMatchResult?.rejectReason, 'unusable_transcript');
    assert.ok(r.assistantLine.toLowerCase().includes('plumbing'));
  });

  it('issue_capture ASR-empty bumps issue retry and uses narrow plumbing reprompt', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'issue_capture');
    assert.equal(r.issueMatchResult?.rejectReason, 'asr_empty');
    assert.equal(r.slotRetryCounts.issue, 1);
    assert.ok(r.assistantLine.toLowerCase().includes('plumbing'));
  });

  it('post-triage transitions ask for name with handoff copy, never close', () => {
    const fullTriage = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
    };
    const fromIssue = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'The drain under my kitchen sink is leaking',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(fromIssue.nextState, 'collect_name');
    assert.equal(fromIssue.assistantLine, POST_TRIAGE_HANDOFF_NAME_LINE);
    assert.equal(fromIssue.callOutcome, null);
    assert.notEqual(fromIssue.nextState, 'close');
    assert.equal(lineContainsPrematureSchedulingPromise(fromIssue.assistantLine), false);

    const fromSecondary = transitionKitchenSinkLeakOnly({
      state: 'leak_location_secondary_capture',
      utterance: 'the drain',
      collected: { ...fullTriage, leakPrimary: 'faucet' as const },
      ...baseParams,
    });
    assert.equal(fromSecondary.nextState, 'collect_name');
    assert.equal(fromSecondary.assistantLine, POST_TRIAGE_HANDOFF_NAME_LINE);
    assert.equal(lineContainsPrematureSchedulingPromise(fromSecondary.assistantLine), false);
  });

  it('triage states never transition directly to close', () => {
    const seeds: Array<{
      state:
        | 'issue_capture'
        | 'kitchen_sink_confirm'
        | 'leak_location_primary_capture'
        | 'leak_location_secondary_capture';
      utterance: string;
      collected: KitchenSinkCollected;
      leakLocationReprompts?: number;
    }> = [
      {
        state: 'issue_capture',
        utterance: 'kitchen sink leak',
        collected: emptyIntakeCollected(),
      },
      {
        state: 'kitchen_sink_confirm',
        utterance: 'yes',
        collected: {
          ...emptyIntakeCollected(),
          normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        },
      },
      {
        state: 'leak_location_primary_capture',
        utterance: 'faucet',
        collected: {
          ...emptyIntakeCollected(),
          normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        },
      },
      {
        state: 'leak_location_secondary_capture',
        utterance: 'pipe',
        collected: {
          ...emptyIntakeCollected(),
          normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
          leakPrimary: 'below_sink',
        },
      },
    ];
    for (const s of seeds) {
      const r = transitionKitchenSinkLeakOnly({
        ...baseParams,
        ...s,
        pendingCallbackNormalized: null,
      });
      assert.notEqual(
        r.nextState,
        'close',
        `unexpected close from ${s.state} with "${s.utterance}"`
      );
    }
  });

  it('lineContainsPrematureSchedulingPromise flags scheduling wrap-up phrasing', () => {
    assert.equal(
      lineContainsPrematureSchedulingPromise("Great, we'll get that scheduled for you."),
      true
    );
    assert.equal(lineContainsPrematureSchedulingPromise("We'll get that taken care of."), true);
    assert.equal(lineContainsPrematureSchedulingPromise("You're all set."), true);
    assert.equal(lineContainsPrematureSchedulingPromise("We've got that scheduled."), true);
  });

  it('final close recap line is not flagged as premature scheduling promise', () => {
    const close =
      "Thanks, Alex. I have you at 10 Oak St, Austin, TX 78701. Best callback time is the morning. We'll reach you at (555) 123-4567. You'll receive a confirmation text shortly. We've received your request and our team will follow up.";
    assert.equal(lineContainsPrematureSchedulingPromise(close), false);
    assert.equal(close.includes('scheduled'), false);
  });

  it('callback_confirm yes routes to collect_name when name missing, not close', () => {
    const collected: KitchenSinkCollected = {
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
      callerName: null,
      serviceAddress: null,
      streetAddress: null,
      city: null,
      state: null,
      zip: null,
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: '+15550001111',
      callbackPhoneSource: 'spoken',
      callbackTimePreference: 'the morning',
      addressRemainderDeferredToSms: false,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
      ...OPEN_LOCKS,
      callbackInboundConfirmRejected: false,
      unitOrSuite: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'yes',
      collected,
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'collect_name');
    assert.notEqual(r.nextState, 'close');
    assert.equal(r.collected.callbackTimePreference, 'the morning');
    assert.equal(lineContainsPrematureSchedulingPromise(r.assistantLine), false);
  });

  it('callback_confirm direct bucket answer defers close when lead invalid and keeps updated window', () => {
    const collected: KitchenSinkCollected = {
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
      callerName: null,
      serviceAddress: null,
      streetAddress: null,
      city: null,
      state: null,
      zip: null,
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: '+15550001111',
      callbackPhoneSource: 'spoken',
      callbackTimePreference: 'the morning',
      addressRemainderDeferredToSms: false,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
      ...OPEN_LOCKS,
      callbackInboundConfirmRejected: false,
      unitOrSuite: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'afternoon',
      collected,
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.collected.callbackTimePreference, 'the afternoon');
    assert.equal(lineContainsPrematureSchedulingPromise(r.assistantLine), false);
  });

  it('callback_confirm yes goes to close only when all required lead fields valid', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'yes',
      collected: baseCollected(),
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'close_wait');
    assert.ok(r.assistantLine.toLowerCase().includes('thanks for calling') || r.assistantLine.toLowerCase().includes("we'll call you"));
    assert.ok(r.assistantLine.toLowerCase().includes('goodbye'));
    assert.equal(allRequiredFieldsValid(r.collected), true);
    assert.equal(lineContainsPrematureSchedulingPromise(r.assistantLine), false);
  });

  it('close_wait thanks path closes with short thanks reply', () => {
    const start = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'yes',
      collected: baseCollected(),
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(start.nextState, 'close_wait');
    const thanks = transitionKitchenSinkLeakOnly({
      state: 'close_wait',
      utterance: 'thank you',
      collected: start.collected,
      ...baseParams,
    });
    assert.equal(thanks.nextState, 'close');
    assert.equal(thanks.assistantLine, "You're welcome. Thanks for calling. Goodbye.");
    assert.equal(thanks.awaitingUserAudioAfter, false);
  });

  it('close_wait ASR-empty auto-closes with standard signoff', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'close_wait',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: baseCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'close');
    assert.ok(r.assistantLine.includes('Goodbye'));
    assert.equal(r.awaitingUserAudioAfter, false);
  });

  it('kitchen_sink_confirm negation+correction overwrites leak slots and goes to name', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'kitchen_sink_confirm',
      utterance: "no it's below the sink at the pipes",
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'faucet',
        leakSecondary: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.collected.leakPrimary, 'below_sink');
    assert.equal(r.collected.leakSecondary, 'pipe');
    assert.ok(r.assistantLine.includes("What's your name?"));
    assert.notEqual(r.collected.leakPrimary, 'faucet');
  });

  it('leak_location_secondary_capture secondary-only correction after no keeps primary', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'leak_location_secondary_capture',
      utterance: 'no the drain',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: null,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.collected.leakPrimary, 'below_sink');
    assert.equal(r.collected.leakSecondary, 'drain');
  });

  it('formatAddressForCloseSummary notes SMS deferral when street saved', () => {
    const c: KitchenSinkCollected = {
      ...baseCollected(),
      addressRemainderDeferredToSms: true,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
    };
    assert.ok(formatAddressForCloseSummary(c).includes('text follow-up'));
  });

  it('allRequiredFieldsValid true when city zip deferred to SMS but street and callback valid', () => {
    const c: KitchenSinkCollected = {
      ...baseCollected(),
      addressRemainderDeferredToSms: true,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
    };
    assert.equal(allRequiredFieldsValid(c), true);
  });

  it('callback_confirm close recap uses deferral wording when city missing by SMS path', () => {
    const collected: KitchenSinkCollected = {
      ...baseCollected(),
      addressRemainderDeferredToSms: true,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'yes',
      collected,
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'close_wait');
    assert.ok(r.assistantLine.toLowerCase().includes('text'));
    assert.ok(r.assistantLine.toLowerCase().includes('preferred callback window'));
    assert.ok(r.assistantLine.toLowerCase().includes('goodbye'));
  });

  it('callback_confirm accepts direct bucket answer (afternoon) without yes/no loop', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'afternoon',
      collected: {
        ...baseCollected(),
        addressRemainderDeferredToSms: true,
        city: null,
        state: null,
        zip: null,
        serviceAddress: null,
      },
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'close_wait');
    assert.ok(r.assistantLine.toLowerCase().includes('afternoon'));
    assert.ok(r.assistantLine.toLowerCase().includes('got it'));
    assert.ok(r.assistantLine.toLowerCase().includes('goodbye'));
  });

  it('callback_confirm direct evening close omits phone when callback is not locked/trusted', () => {
    const collected: KitchenSinkCollected = {
      ...baseCollected(),
      callbackLocked: false,
      callbackPhoneSource: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'callback_confirm',
      utterance: 'evening',
      collected,
      ...baseParams,
      pendingCallbackNormalized: 'morning',
    });
    assert.equal(r.nextState, 'close_wait');
    assert.ok(r.assistantLine.toLowerCase().includes('evening'));
    assert.ok(r.assistantLine.toLowerCase().includes('confirm the best number separately'));
    assert.ok(!r.assistantLine.includes('555-123-4567'));
    assert.ok(!r.assistantLine.includes('443254'));
  });

  it('collect_callback_time invalid then reprompt narrows without repeating the long option list', () => {
    const collected: KitchenSinkCollected = {
      ...baseCollected(),
      callbackTimePreference: null,
    };
    const first = transitionKitchenSinkLeakOnly({
      state: 'collect_callback_time',
      utterance: 'maybe later',
      collected,
      ...baseParams,
    });
    assert.equal(first.nextState, 'collect_callback_time');
    assert.ok(!first.assistantLine.toLowerCase().includes('such as morning'));
    assert.ok(first.assistantLine.toLowerCase().includes('morning'));
    const second = transitionKitchenSinkLeakOnly({
      state: 'collect_callback_time',
      utterance: 'evening',
      collected: first.collected,
      ...baseParams,
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'callback_confirm');
  });

  it('collect_city rejects digit-heavy partial phone fragments as city', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: '443254',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.city, null);
  });

  it('full address present: address ASR-empty does not defer to SMS', () => {
    const c: KitchenSinkCollected = {
      ...baseCollected(),
      addressRemainderDeferredToSms: false,
      serviceAddress: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_confirm',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: c,
      ...baseParams,
    });
    assert.notEqual(r.nextState, 'address_city_deferred_sms');
  });

  it('collect_city combined city state zip skips duplicate zip question', () => {
    const collected = { ...afterStreetCollected(), serviceAddress: null };
    const variants = [
      'Dover, Delaware, 19901',
      'Dover DE 19901',
      'Dover Delaware 1 9 9 0 1',
    ];
    for (const utterance of variants) {
      const r = transitionKitchenSinkLeakOnly({
        state: 'collect_city',
        utterance,
        collected,
        ...baseParams,
      });
      assert.equal(r.nextState, 'address_confirm', utterance);
      assert.equal(r.collected.city, 'Dover');
      assert.equal(r.collected.state, 'DE');
      assert.equal(r.collected.zip, '19901');
    }
  });

  it('collect_city Dover comma Delaware fills state and skips to zip', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Dover, Delaware',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_zip');
    assert.equal(r.collected.city, 'Dover');
    assert.equal(r.collected.state, 'DE');
  });

  it('collect_city Dover comma DE fills both and goes to zip', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Dover, DE',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_zip');
    assert.equal(r.collected.city, 'Dover');
    assert.equal(r.collected.state, 'DE');
  });

  it('collect_city Dover only goes to collect_state', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Dover',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_state');
    assert.equal(r.collected.city, 'Dover');
    assert.equal(r.collected.state, null);
  });

  it('collect_city Delaware alone does not save as city', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Delaware',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.city, null);
  });

  it('collect_state accepts Delaware and DE', () => {
    const withCity = { ...afterStreetCollected(), city: 'Dover' };
    const a = transitionKitchenSinkLeakOnly({
      state: 'collect_state',
      utterance: 'Delaware',
      collected: withCity,
      ...baseParams,
    });
    assert.equal(a.nextState, 'collect_zip');
    assert.equal(a.collected.state, 'DE');
    const b = transitionKitchenSinkLeakOnly({
      state: 'collect_state',
      utterance: 'DE',
      collected: withCity,
      ...baseParams,
    });
    assert.equal(b.nextState, 'collect_zip');
    assert.equal(b.collected.state, 'DE');
  });

  it('address_confirm yes with callback ask still collects callback number before time', () => {
    const collected: KitchenSinkCollected = {
      ...afterStreetCollected(),
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      serviceAddress: '100 Main St, Dover, DE 19901',
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      addressRemainderDeferredToSms: false,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
      ...OPEN_LOCKS,
      streetLocked: true,
      cityLocked: true,
      stateLocked: true,
      zipLocked: true,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_confirm',
      utterance: "yes I'd like a callback please",
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
    assert.ok(r.assistantLine.includes('number'));
  });

  it('collect_name stores stripped name from my name is Matt', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_name',
      utterance: 'My name is Matt',
      collected: {
        ...afterStreetCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_street_address');
    assert.equal(r.collected.callerName, 'Matt');
  });

  it('collect_name rejects service words and correction phrases', () => {
    const collected = {
      ...afterStreetCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink' as const,
      leakSecondary: 'drain' as const,
      callerName: null,
      streetAddress: null,
      city: null,
      state: null,
      zip: null,
    };
    const a = transitionKitchenSinkLeakOnly({
      state: 'collect_name',
      utterance: 'Dishwasher',
      collected,
      ...baseParams,
    });
    assert.equal(a.nextState, 'collect_name');
    assert.equal(a.collected.callerName, null);
    const b = transitionKitchenSinkLeakOnly({
      state: 'collect_name',
      utterance: "No, that's not correct",
      collected,
      ...baseParams,
    });
    assert.equal(b.nextState, 'collect_name');
    assert.equal(b.collected.callerName, null);
  });

  it('collect_callback_time callback intent re-prompts without burning retry slot', () => {
    const collected: KitchenSinkCollected = {
      ...afterStreetCollected(),
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      serviceAddress: '100 Main St, Dover, DE 19901',
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: '+15550001234',
      callbackPhoneSource: 'spoken',
      callbackTimePreference: null,
      addressRemainderDeferredToSms: false,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
      ...OPEN_LOCKS,
      streetLocked: true,
      cityLocked: true,
      stateLocked: true,
      zipLocked: true,
      callbackLocked: true,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_callback_time',
      utterance: 'can I get a call back',
      collected,
      ...baseParams,
      slotRetryCounts: {},
    });
    assert.equal(r.nextState, 'collect_callback_time');
    assert.equal(r.slotRetryCounts.callback, undefined);
  });

  it('collect_street_address does not advance on fragment without road-type cue', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 smith',
      collected: { ...baseCollected(), streetAddress: null, city: null, state: null, zip: null },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_street_address');
    assert.equal(r.collected.streetAddress, null);
    assert.ok(streetLineLooksCompleteEnoughForProgress('123 smith') === false);
  });

  it('collect_street_address persists street only and always advances to city (no one-turn skip)', () => {
    const collected = { ...baseCollected(), streetAddress: null, city: null, state: null, zip: null };
    const comma = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 Smith Street, Dover',
      collected,
      ...baseParams,
    });
    assert.equal(comma.nextState, 'collect_unit');
    assert.equal(comma.collected.streetAddress, '123 Smith Street');
    assert.equal(comma.collected.city, null);
    const inForm = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 Smith Street in Dover',
      collected,
      ...baseParams,
    });
    assert.equal(inForm.nextState, 'collect_unit');
    assert.equal(inForm.collected.streetAddress, '123 Smith Street');
    assert.equal(inForm.collected.city, null);
  });

  it('collect_street_address compacts split leading digits before street name', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '1 2 3 main st',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        leakPrimary: 'below_sink',
        leakSecondary: 'drain',
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_unit');
    assert.equal(r.collected.streetAddress, '123 Main Street');
  });

  it('collect_street_address ASR-empty advances to city when locked street already exists', () => {
    const collected: KitchenSinkCollected = {
      ...afterStreetCollected(),
      streetAddress: '123 Main Street',
      streetLocked: true,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.assistantLine, 'Got it. What city is that in?');
  });

  it('collect_city first invalid city reprompts with partial street line', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Texas',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.ok(r.assistantLine.includes('I caught'));
    assert.ok(r.assistantLine.includes('100 Main St'));
  });

  it('collect_city does not accept acknowledgements like yes as city', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'yes',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.city, null);
  });

  it('collect_city fourth invalid city with plausible street defers remainder to SMS', () => {
    let slot: Partial<Record<KitchenSinkSlotRetryKey, number>> = {};
    let collected: KitchenSinkCollected = afterStreetCollected();
    const badCities = ['Texas', 'California', 'Vermont', 'Colorado'];
    let last: ReturnType<typeof transitionKitchenSinkLeakOnly> | null = null;
    for (const u of badCities) {
      last = transitionKitchenSinkLeakOnly({
        state: 'collect_city',
        utterance: u,
        collected,
        ...baseParams,
        slotRetryCounts: slot,
      });
      slot = last.slotRetryCounts;
      collected = last.collected;
      if (last.nextState === 'address_city_deferred_sms') {
        break;
      }
    }
    assert.ok(last);
    assert.equal(last!.nextState, 'address_city_deferred_sms');
    assert.equal(last!.collected.addressRemainderDeferredToSms, true);
    assert.equal(last!.collected.city, null);
    assert.ok(last!.assistantLine.toLowerCase().includes('text'));

    const third = transitionKitchenSinkLeakOnly({
      state: 'address_city_deferred_sms',
      utterance: 'okay',
      collected: last!.collected,
      ...baseParams,
    });
    assert.equal(third.nextState, 'callback_number_collect');
  });

  it('address_city_deferred_sms lets caller resume address capture by voice', () => {
    const deferred: KitchenSinkCollected = {
      ...afterStreetCollected(),
      addressRemainderDeferredToSms: true,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
      cityLocked: false,
      stateLocked: false,
      zipLocked: false,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_city_deferred_sms',
      utterance: 'No, I want to give you my address',
      collected: deferred,
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_street_address');
    assert.equal(r.collected.addressRemainderDeferredToSms, false);
    assert.ok(r.assistantLine.toLowerCase().includes('street address'));
  });

  it('address_city_deferred_sms always asks for callback digits (no ANI yes/no confirm)', () => {
    const deferred: KitchenSinkCollected = {
      ...afterStreetCollected(),
      addressRemainderDeferredToSms: true,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
      cityLocked: false,
      stateLocked: false,
      zipLocked: false,
      inboundCallerPhoneE164: '+14432541963',
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      callbackLocked: false,
      callbackInboundConfirmRejected: false,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_city_deferred_sms',
      utterance: 'okay',
      collected: deferred,
      ...baseParams,
    });
    assert.equal(r.nextState, 'callback_number_collect');
    assert.ok(r.assistantLine.toLowerCase().includes('best number'));
  });

  it('collect_city "everything" after address rejection resets to street capture', () => {
    const collected: KitchenSinkCollected = {
      ...afterStreetCollected(),
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
      streetAddress: '123 Main Street',
      streetLocked: true,
      cityLocked: false,
      stateLocked: false,
      zipLocked: false,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'everything',
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_street_address');
    assert.equal(r.collected.streetAddress, null);
    assert.equal(r.collected.city, null);
    assert.ok(r.assistantLine.toLowerCase().includes('street'));
  });

  it('address repair phrases stay in address collection with apology line', () => {
    assert.equal(matchAddressRepairIntent("you don't have my full address"), true);
    const streetRepair = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: "you don't have my full address",
      collected: { ...baseCollected(), streetAddress: null, city: null, state: null, zip: null },
      ...baseParams,
    });
    assert.equal(streetRepair.nextState, 'collect_street_address');
    assert.ok(streetRepair.assistantLine.includes('Sorry'));

    const cityRepair = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'you cut me off',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(cityRepair.nextState, 'collect_city');
    assert.ok(cityRepair.assistantLine.includes('Sorry'));
  });

  it('address_confirm repair clears address and restarts street capture', () => {
    const collected: KitchenSinkCollected = {
      ...afterStreetCollected(),
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      serviceAddress: '100 Main St, Dover, DE 19901',
      addressRemainderDeferredToSms: false,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
      ...OPEN_LOCKS,
      streetLocked: true,
      cityLocked: true,
      stateLocked: true,
      zipLocked: true,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_confirm',
      utterance: "that's not the full address",
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_street_address');
    assert.equal(r.collected.streetAddress, null);
    assert.equal(r.collected.city, null);
    assert.ok(r.assistantLine.includes('Sorry'));
  });

  it('issue_capture water heater leak routes to shared name intake', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'my water heater is leaking',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.collected.normalizedIssue, WATER_HEATER_LEAK_ISSUE);
    assert.ok(r.assistantLine.toLowerCase().includes('water heater'));
  });

  it('issue_capture generic leak routes to shared name intake without forced room menu', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'there is a leak in the ceiling',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_name');
    assert.equal(r.collected.normalizedIssue, 'general_plumbing_leak');
    assert.ok(r.assistantLine.toLowerCase().includes("what's your name"));
  });

  it('issue_capture routes painting requests in painting mode', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'I need interior painting for two bedrooms',
      collected: emptyIntakeCollected(),
      ...baseParams,
      activeTestMode: 'painting_intake',
    });
    assert.equal(r.nextState, 'painting_scope_capture');
    assert.equal(r.collected.normalizedIssue, 'interior_paint');
    assert.ok(r.assistantLine.toLowerCase().includes('walls'));
  });

  it('issue_capture paints my kitchen routes to interior_paint in painting mode', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: "I'd like to paint my kitchen",
      collected: emptyIntakeCollected(),
      ...baseParams,
      activeTestMode: 'painting_intake',
    });
    assert.equal(r.nextState, 'painting_scope_capture');
    assert.equal(r.collected.normalizedIssue, 'interior_paint');
    assert.ok(r.assistantLine.toLowerCase().includes('walls'));
  });

  it('painting_scope_capture interior surfaces then advances to name', () => {
    const first = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: "I'd like to paint my living room",
      collected: emptyIntakeCollected(),
      ...baseParams,
      activeTestMode: 'painting_intake',
    });
    assert.equal(first.nextState, 'painting_scope_capture');
    const second = transitionKitchenSinkLeakOnly({
      state: 'painting_scope_capture',
      utterance: 'both walls and ceiling',
      collected: first.collected,
      ...baseParams,
      activeTestMode: 'painting_intake',
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'collect_name');
    assert.equal(second.collected.paintingSurfaceScope, 'both');
    assert.ok(second.assistantLine.toLowerCase().includes("what's your name"));
  });

  it('painting_scope_capture ambiguous twice falls through to name intake', () => {
    const first = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'I need painting',
      collected: emptyIntakeCollected(),
      ...baseParams,
      activeTestMode: 'painting_intake',
    });
    assert.equal(first.nextState, 'painting_scope_capture');
    const second = transitionKitchenSinkLeakOnly({
      state: 'painting_scope_capture',
      utterance: 'not sure',
      collected: first.collected,
      ...baseParams,
      activeTestMode: 'painting_intake',
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'painting_scope_capture');
    const third = transitionKitchenSinkLeakOnly({
      state: 'painting_scope_capture',
      utterance: 'whatever',
      collected: second.collected,
      ...baseParams,
      activeTestMode: 'painting_intake',
      slotRetryCounts: second.slotRetryCounts,
    });
    assert.equal(third.nextState, 'collect_name');
  });

  it('issue_capture rejects plumbing in painting mode as off-lane', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'my faucet is leaking',
      collected: emptyIntakeCollected(),
      ...baseParams,
      activeTestMode: 'painting_intake',
    });
    assert.equal(r.nextState, 'unsupported_end');
    assert.equal(r.callOutcome, 'unsupported_issue');
    assert.ok(r.assistantLine.toLowerCase().includes('painting and light trim'));
  });

  it('address_confirm no keeps street and narrows to city step', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'address_confirm',
      utterance: 'no',
      collected: baseCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.streetAddress, '10 Oak St');
    assert.equal(r.collected.city, null);
  });

  it('collect_zip reprompt acknowledges partial digits', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_zip',
      utterance: '1990',
      collected: { ...afterStreetCollected(), city: 'Dover', state: 'DE', serviceAddress: null },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_zip');
    assert.ok(/\b1\b/.test(r.assistantLine) && r.assistantLine.includes('9'));
    assert.ok(r.assistantLine.toLowerCase().includes('five'));
  });

  it('collect_callback_time does not jump to address on street-like unrelated utterance', () => {
    const collected: KitchenSinkCollected = {
      ...afterStreetCollected(),
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      serviceAddress: '100 Main St, Dover, DE 19901',
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: '+15550001234',
      callbackPhoneSource: 'spoken',
      callbackTimePreference: null,
      addressRemainderDeferredToSms: false,
      zipPartialDigits: null,
      callbackPhonePartialDigits: null,
      ...OPEN_LOCKS,
      streetLocked: true,
      cityLocked: true,
      stateLocked: true,
      zipLocked: true,
      callbackLocked: true,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_callback_time',
      utterance: '123 Main Street',
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_callback_time');
  });

  it('collect_street accepts 123 main st and confirms before city', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 main st',
      collected: { ...baseCollected(), streetAddress: null, city: null, state: null, zip: null },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_unit');
    assert.equal(r.collected.streetAddress, '123 Main Street');
    assert.ok(r.assistantLine.toLowerCase().includes('unit'));
  });

  it('collect_city stuttered Dover collapses and saves city', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'dover dover dover',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_state');
    assert.equal(r.collected.city, 'Dover');
  });

  it('locked name cannot be overwritten by later city capture', () => {
    const c: KitchenSinkCollected = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
      callerName: 'Alex',
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Dover',
      collected: c,
      ...baseParams,
    });
    assert.equal(r.collected.callerName, 'Alex');
  });

  it('leak_location_secondary below_sink reprompt stays sink-scoped without toilet', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'leak_location_secondary_capture',
      utterance: 'uh',
      collected: {
        ...emptyIntakeCollected(),
        normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
        callerName: 'Sam',
        leakPrimary: 'below_sink',
        leakSecondary: null,
      },
      ...baseParams,
      secondaryLeakReprompts: 0,
    });
    assert.equal(r.nextState, 'leak_location_secondary_capture');
    assert.ok(!r.assistantLine.toLowerCase().includes('toilet'));
  });

  it('collect_zip accepts five digits embedded in noise and clears partial ZIP state', () => {
    const collected = {
      ...afterStreetCollected(),
      city: 'Dover',
      state: 'DE',
      serviceAddress: null,
      zipPartialDigits: '1990',
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_zip',
      utterance: 'zip is 19901 please',
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'address_confirm');
    assert.equal(r.collected.zip, '19901');
    assert.equal(r.collected.zipPartialDigits, null);
  });

  it('collect_zip with locked valid ZIP skips full-ZIP recovery on garbled follow-up', () => {
    const collected: KitchenSinkCollected = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'below_sink',
      leakSecondary: 'drain',
      callerName: 'Pat',
      streetAddress: '10 Oak St',
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      streetLocked: true,
      cityLocked: true,
      stateLocked: true,
      zipLocked: true,
      zipPartialDigits: '1990',
      serviceAddress: null,
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      callbackTimePreference: null,
      addressRemainderDeferredToSms: false,
      callbackPhonePartialDigits: null,
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_zip',
      utterance: "what's the full zip code",
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'address_confirm');
    assert.equal(r.collected.zip, '19901');
    assert.equal(r.collected.zipPartialDigits, null);
    assert.ok(!r.assistantLine.toLowerCase().includes('full five-digit'));
  });

  it('callback_number_collect second partial failure uses softer reprompt and stays on callback', () => {
    const collected = {
      ...baseCollected(),
      streetAddress: null,
      city: null,
      state: null,
      zip: null,
      serviceAddress: null,
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      callbackTimePreference: null,
      ...OPEN_LOCKS,
    };
    const first = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '443254',
      collected,
      ...baseParams,
    });
    assert.equal(first.nextState, 'callback_number_collect');
    assert.ok(first.assistantLine.toLowerCase().includes('caught'));
    assert.ok(/\d/.test(first.assistantLine));
    const second = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '443254',
      collected: first.collected,
      ...baseParams,
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'callback_number_collect');
    assert.ok(second.assistantLine.includes('No problem'));
    assert.ok(second.assistantLine.toLowerCase().includes('number'));
  });

  it('callback_number_collect objection clears partial and never advances to callback time until full NANP', () => {
    const collected: KitchenSinkCollected = {
      ...emptyIntakeCollected(),
      normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
      leakPrimary: 'faucet',
      leakSecondary: 'faucet_self',
      callerName: 'Pat',
      streetAddress: '10 Oak St',
      city: 'Dover',
      state: 'DE',
      zip: '19901',
      streetLocked: true,
      cityLocked: true,
      stateLocked: true,
      zipLocked: true,
      serviceAddress: null,
      inboundCallerPhoneE164: null,
      callbackPhoneNumber: null,
      callbackPhoneSource: null,
      callbackTimePreference: null,
      addressRemainderDeferredToSms: false,
      callbackPhonePartialDigits: null,
      callbackLocked: false,
    };
    const partial = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '5551234',
      collected,
      ...baseParams,
    });
    assert.equal(partial.nextState, 'callback_number_collect');
    assert.ok(partial.collected.callbackPhonePartialDigits);

    const objection = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: "you don't have my full number",
      collected: partial.collected,
      ...baseParams,
      slotRetryCounts: partial.slotRetryCounts,
    });
    assert.equal(objection.nextState, 'callback_number_collect');
    assert.equal(objection.collected.callbackPhonePartialDigits, null);
    assert.equal(objection.collected.callbackPhoneNumber, null);
    assert.equal(objection.assistantLine, "What's the best number to call or text you at?");

    const stillPartial = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '5551234',
      collected: objection.collected,
      ...baseParams,
      slotRetryCounts: objection.slotRetryCounts,
    });
    assert.equal(stillPartial.nextState, 'callback_number_collect');
    assert.notEqual(stillPartial.nextState, 'collect_callback_time');

    const full = transitionKitchenSinkLeakOnly({
      state: 'callback_number_collect',
      utterance: '3025551234',
      collected: stillPartial.collected,
      ...baseParams,
      slotRetryCounts: stillPartial.slotRetryCounts,
    });
    assert.equal(full.nextState, 'callback_number_confirm');
    assert.equal(full.collected.callbackPhoneNumber, '+13025551234');
    assert.equal(full.collected.callbackLocked, false);
  });

  it('collect_street does not overwrite locked good street without correction intent', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '124 pine street',
      collected: {
        ...afterStreetCollected(),
        streetAddress: '123 Main Street',
        streetLocked: true,
      },
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.streetAddress, '123 Main Street');
  });

  it('five ASR-empty on collect_city with plausible street does not yet defer to SMS', () => {
    const c = afterStreetCollected();
    let slot: Partial<Record<KitchenSinkSlotRetryKey, number>> = {};
    let last = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: c,
      ...baseParams,
      slotRetryCounts: slot,
    });
    for (let i = 0; i < 4; i++) {
      slot = last.slotRetryCounts;
      last = transitionKitchenSinkLeakOnly({
        state: 'collect_city',
        utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
        collected: last.collected,
        ...baseParams,
        slotRetryCounts: slot,
      });
    }
    assert.equal(last.nextState, 'collect_city');
    assert.equal(last.collected.addressRemainderDeferredToSms, false);
  });

  it('six ASR-empty signals during collect_city defer to SMS when street already plausible', () => {
    const c = afterStreetCollected();
    let slot: Partial<Record<KitchenSinkSlotRetryKey, number>> = {};
    let last = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: c,
      ...baseParams,
      slotRetryCounts: slot,
    });
    for (let i = 0; i < 5; i++) {
      slot = last.slotRetryCounts;
      last = transitionKitchenSinkLeakOnly({
        state: 'collect_city',
        utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
        collected: last.collected,
        ...baseParams,
        slotRetryCounts: slot,
      });
    }
    assert.equal(last.nextState, 'address_city_deferred_sms');
    assert.equal(last.collected.addressRemainderDeferredToSms, true);
  });
});
