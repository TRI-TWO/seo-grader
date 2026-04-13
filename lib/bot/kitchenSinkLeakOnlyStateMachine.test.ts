import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KITCHEN_SINK_LEAK_NORMALIZED } from './kitchenSinkLeakOnlyMatchers';
import { WATER_HEATER_LEAK_ISSUE } from './plumbingIntakeMatchers';
import {
  allRequiredFieldsValid,
  ASR_EMPTY_TRANSCRIPT_SIGNAL,
  formatAddressForCloseSummary,
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
  callbackPhonePartialDigits: null,
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
});

const afterStreetCollected = (): KitchenSinkCollected => ({
  ...emptyIntakeCollected(),
  normalizedIssue: KITCHEN_SINK_LEAK_NORMALIZED,
  leakPrimary: 'below_sink',
  leakSecondary: 'drain',
  callerName: 'Pat',
  streetAddress: '100 Main St',
});

describe('kitchenSinkLeakOnlyStateMachine', () => {
  it('formatFullAddress joins parts', () => {
    assert.equal(formatFullAddress(baseCollected()), '10 Oak St, Austin, TX 78701');
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
    assert.equal(r.nextState, 'collect_city');
    assert.equal(r.collected.streetAddress, '99 Pine Road');
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
    assert.ok(r.assistantLine.includes('best number'));
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

  it('callback_number_collect accepts NANP and advances to callback time', () => {
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
    assert.equal(r.nextState, 'collect_callback_time');
    assert.equal(r.collected.callbackPhoneNumber, '+12025551212');
    assert.equal(r.collected.callbackPhoneSource, 'spoken');
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

  it('issue_capture with faucet only skips primary; asks secondary (faucet path)', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'my kitchen sink faucet is leaking',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'leak_location_secondary_capture');
    assert.equal(r.assistantLine, 'Does it seem like the faucet itself, or the drain?');
    assert.equal(r.collected.leakPrimary, 'faucet');
    assert.equal(r.collected.leakSecondary, null);
  });

  it('issue_capture under sink without pipe/drain asks secondary (below path)', () => {
    const r = transitionKitchenSinkLeakOnly({
      state: 'issue_capture',
      utterance: 'my kitchen sink is leaking under the sink',
      collected: emptyIntakeCollected(),
      ...baseParams,
    });
    assert.equal(r.nextState, 'leak_location_secondary_capture');
    assert.equal(r.assistantLine, 'Does it seem like a pipe, or the drain?');
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
    assert.equal(r.nextState, 'leak_location_secondary_capture');
    assert.equal(r.assistantLine, 'Does it seem like the faucet itself, or the drain?');
    assert.equal(r.collected.leakPrimary, 'faucet');
    assert.equal(r.collected.leakSecondary, null);
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
    assert.equal(r.assistantLine, 'Is it at the faucet, or below the sink?');
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
    assert.equal(r.assistantLine, 'Does it seem like a pipe, or the drain?');
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
    assert.equal(r.nextState, 'close');
    assert.ok(r.assistantLine.startsWith('Thanks, Alex'));
    assert.ok(r.assistantLine.includes('confirmation text'));
    assert.equal(allRequiredFieldsValid(r.collected), true);
    assert.equal(lineContainsPrematureSchedulingPromise(r.assistantLine), false);
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
    assert.equal(r.nextState, 'close');
    assert.ok(r.assistantLine.includes('text follow-up'));
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
    assert.equal(comma.nextState, 'collect_city');
    assert.equal(comma.collected.streetAddress, '123 Smith Street');
    assert.equal(comma.collected.city, null);
    const inForm = transitionKitchenSinkLeakOnly({
      state: 'collect_street_address',
      utterance: '123 Smith Street in Dover',
      collected,
      ...baseParams,
    });
    assert.equal(inForm.nextState, 'collect_city');
    assert.equal(inForm.collected.streetAddress, '123 Smith Street');
    assert.equal(inForm.collected.city, null);
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

  it('collect_city second invalid city with valid street defers remainder to SMS', () => {
    const first = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'Texas',
      collected: afterStreetCollected(),
      ...baseParams,
    });
    assert.equal(first.nextState, 'collect_city');
    const second = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: 'California',
      collected: first.collected,
      ...baseParams,
      slotRetryCounts: first.slotRetryCounts,
    });
    assert.equal(second.nextState, 'address_city_deferred_sms');
    assert.equal(second.collected.addressRemainderDeferredToSms, true);
    assert.equal(second.collected.city, null);
    assert.ok(second.assistantLine.toLowerCase().includes('text'));

    const third = transitionKitchenSinkLeakOnly({
      state: 'address_city_deferred_sms',
      utterance: 'okay',
      collected: second.collected,
      ...baseParams,
    });
    assert.equal(third.nextState, 'callback_number_collect');
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
    };
    const r = transitionKitchenSinkLeakOnly({
      state: 'collect_callback_time',
      utterance: '123 Main Street',
      collected,
      ...baseParams,
    });
    assert.equal(r.nextState, 'collect_callback_time');
  });

  it('three ASR-empty signals during collect_city defer to SMS handoff', () => {
    const c = afterStreetCollected();
    let slot: Partial<Record<KitchenSinkSlotRetryKey, number>> = {};
    let last = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: c,
      ...baseParams,
      slotRetryCounts: slot,
    });
    slot = last.slotRetryCounts;
    last = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: last.collected,
      ...baseParams,
      slotRetryCounts: slot,
    });
    slot = last.slotRetryCounts;
    last = transitionKitchenSinkLeakOnly({
      state: 'collect_city',
      utterance: ASR_EMPTY_TRANSCRIPT_SIGNAL,
      collected: last.collected,
      ...baseParams,
      slotRetryCounts: slot,
    });
    assert.equal(last.nextState, 'address_city_deferred_sms');
    assert.equal(last.collected.addressRemainderDeferredToSms, true);
  });
});
