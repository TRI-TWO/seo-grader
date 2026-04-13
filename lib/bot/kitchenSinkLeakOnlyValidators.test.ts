import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchBroadLeakLocation,
  matchKitchenSinkLeakIssue,
  matchLeakLocationDetailed,
} from './kitchenSinkLeakOnlyMatchers';
import {
  matchAddressConfirmAffirmative,
  matchAddressRepairIntent,
  matchCallbackRequestIntent,
  matchOptionalDetailDecline,
  matchYes,
  extractCallerNameForIntake,
  streetLineLooksCompleteEnoughForProgress,
  tryParseCityStateCombined,
  tryParseCityStateZipCombined,
  tryParseStreetLineAndCity,
  validateCallbackWindow,
  validateCity,
  validateCityPortionInCityStatePair,
  validateName,
  validateState,
  validateStreet,
  validateZip,
} from './kitchenSinkLeakOnlyValidators';

describe('kitchenSinkLeakOnlyValidators', () => {
  it('validateName rejects fillers and short names', () => {
    assert.equal(validateName('yeah').ok, false);
    assert.equal(validateName('Jo').ok, true);
    assert.equal(validateName('J').ok, false);
  });

  it('validateStreet requires digits and letters', () => {
    assert.equal(validateStreet('1234').ok, false);
    assert.equal(validateStreet('Main Street').ok, false);
    assert.equal(validateStreet('123 Main St').ok, true);
  });

  it('validateStreet accepts common full street lines on first pass', () => {
    assert.equal(validateStreet('123 Smith Street').ok, true);
    assert.equal(validateStreet('456 West Main Road').ok, true);
    assert.equal(validateStreet('789 Oak Lane').ok, true);
    assert.equal(validateStreet('12B Pine Drive').ok, true);
  });

  it('streetLineLooksCompleteEnoughForProgress accepts road-type or multi-token lines', () => {
    assert.equal(streetLineLooksCompleteEnoughForProgress('123 Oak Lane'), true);
    assert.equal(streetLineLooksCompleteEnoughForProgress('123 smith'), false);
    assert.equal(streetLineLooksCompleteEnoughForProgress('123 Broadway'), true);
  });

  it('tryParseStreetLineAndCity parses comma and in-forms', () => {
    const a = tryParseStreetLineAndCity('123 Main St, Dover');
    assert.equal(a.ok, true);
    if (a.ok) {
      assert.equal(a.street, '123 Main St');
      assert.equal(a.city, 'Dover');
    }
    const b = tryParseStreetLineAndCity('99 Pine Road in Wilmington');
    assert.equal(b.ok, true);
    if (b.ok) {
      assert.equal(b.city, 'Wilmington');
    }
    assert.equal(tryParseStreetLineAndCity('123 Main').ok, false);
  });

  it('matchAddressRepairIntent detects cut-off / correction phrases', () => {
    assert.equal(matchAddressRepairIntent('wait'), true);
    assert.equal(matchAddressRepairIntent('I was not finished'), true);
    assert.equal(matchAddressRepairIntent('let me finish'), true);
    assert.equal(matchAddressRepairIntent('Dover Delaware'), false);
  });

  it('validateCity rejects state-looking tokens', () => {
    assert.equal(validateCity('TX').ok, false);
    assert.equal(validateCity('Dallas').ok, true);
  });

  it('validateState accepts abbr and full name', () => {
    const a = validateState('CA');
    assert.equal(a.ok, true);
    assert.equal(a.normalized, 'CA');
    const b = validateState('California');
    assert.equal(b.ok, true);
    assert.equal(b.normalized, 'CA');
  });

  it('validateState accepts DE MD VA PA DC and spaced letter abbr', () => {
    assert.equal(validateState('Delaware').normalized, 'DE');
    assert.equal(validateState('DE').normalized, 'DE');
    assert.equal(validateState('Maryland').normalized, 'MD');
    assert.equal(validateState('Virginia').normalized, 'VA');
    assert.equal(validateState('Pennsylvania').normalized, 'PA');
    assert.equal(validateState('District of Columbia').normalized, 'DC');
    assert.equal(validateState('D E').normalized, 'DE');
    assert.equal(validateState('d e').normalized, 'DE');
  });

  it('tryParseCityStateCombined parses comma and space forms', () => {
    const a = tryParseCityStateCombined('Dover, Delaware');
    assert.equal(a.ok, true);
    if (a.ok) {
      assert.equal(a.city, 'Dover');
      assert.equal(a.stateAbbr, 'DE');
    }
    const b = tryParseCityStateCombined('Dover Delaware');
    assert.equal(b.ok, true);
    if (b.ok) {
      assert.equal(b.city, 'Dover');
      assert.equal(b.stateAbbr, 'DE');
    }
    const c = tryParseCityStateCombined('Dover, DE');
    assert.equal(c.ok, true);
    if (c.ok) {
      assert.equal(c.city, 'Dover');
      assert.equal(c.stateAbbr, 'DE');
    }
    const d = tryParseCityStateCombined('Dover DE');
    assert.equal(d.ok, true);
    if (d.ok) {
      assert.equal(d.city, 'Dover');
      assert.equal(d.stateAbbr, 'DE');
    }
  });

  it('tryParseCityStateCombined rejects state-only utterance', () => {
    assert.equal(tryParseCityStateCombined('Delaware').ok, false);
    assert.equal(validateCity('Delaware').ok, false);
    assert.equal(validateCityPortionInCityStatePair('Delaware').ok, true);
  });

  it('tryParseCityStateZipCombined parses trailing zip variants', () => {
    const a = tryParseCityStateZipCombined('Dover, Delaware, 19901');
    assert.equal(a.ok, true);
    if (a.ok) {
      assert.equal(a.city, 'Dover');
      assert.equal(a.stateAbbr, 'DE');
      assert.equal(a.zipDigits, '19901');
    }
    const b = tryParseCityStateZipCombined('Dover DE 19901');
    assert.equal(b.ok, true);
    if (b.ok) {
      assert.equal(b.zipDigits, '19901');
    }
    const c = tryParseCityStateZipCombined('Dover Delaware 1 9 9 0 1');
    assert.equal(c.ok, true);
    if (c.ok) {
      assert.equal(c.zipDigits, '19901');
    }
    const noZip = tryParseCityStateZipCombined('Dover, Delaware');
    assert.equal(noZip.ok, true);
    if (noZip.ok) {
      assert.equal(noZip.zipDigits, null);
    }
  });

  it('matchAddressConfirmAffirmative accepts trailing clause after yes', () => {
    assert.equal(matchAddressConfirmAffirmative('yes'), true);
    assert.equal(matchAddressConfirmAffirmative("yes I'd like a callback"), true);
    assert.equal(matchAddressConfirmAffirmative('yeah can I get a call back'), true);
  });

  it('matchCallbackRequestIntent detects callback ask without time window', () => {
    assert.equal(matchCallbackRequestIntent('can I get a call back'), true);
    assert.equal(matchCallbackRequestIntent('could you call me back'), true);
    assert.equal(matchCallbackRequestIntent('morning'), false);
  });

  it('validateZip accepts exactly five digits only', () => {
    const z = validateZip('90210');
    assert.equal(z.ok, true);
    assert.equal(z.digits, '90210');
    assert.equal(validateZip('9021').ok, false);
    const spaced = validateZip('1 9 9 1 1');
    assert.equal(spaced.ok, true);
    if (spaced.ok) {
      assert.equal(spaced.digits, '19911');
    }
    assert.equal(validateZip('902101234').ok, false);
  });

  it('extractCallerNameForIntake strips common prefixes', () => {
    assert.equal(extractCallerNameForIntake('Matt'), 'Matt');
    assert.equal(extractCallerNameForIntake('My name is Matt'), 'Matt');
    assert.equal(extractCallerNameForIntake('This is Matt'), 'Matt');
    assert.equal(extractCallerNameForIntake("I'm Matt"), 'Matt');
  });

  it('validateName accepts first name only and full name', () => {
    assert.equal(validateName('Matt').ok, true);
    assert.equal(validateName('Matthew Hanratty').ok, true);
    assert.equal(validateName(extractCallerNameForIntake('My name is Matt')).ok, true);
  });

  it('validateCallbackWindow parses windows', () => {
    assert.equal(validateCallbackWindow('morning').ok, true);
    assert.equal(validateCallbackWindow('California').ok, false);
  });

  it('matchYes handles phrases', () => {
    assert.equal(matchYes('yes'), true);
    assert.equal(matchYes("that's right"), true);
  });
});

describe('matchOptionalDetailDecline', () => {
  it('treats empty and common declines as skip', () => {
    assert.equal(matchOptionalDetailDecline(''), true);
    assert.equal(matchOptionalDetailDecline("No, that's it"), true);
    assert.equal(matchOptionalDetailDecline('not really'), true);
    assert.equal(matchOptionalDetailDecline('nope thanks'), true);
  });

  it('does not decline substantive notes', () => {
    assert.equal(matchOptionalDetailDecline('The shutoff is stuck'), false);
  });
});

describe('matchKitchenSinkLeakIssue off-lane', () => {
  it('rejects toilet and other fixtures without kitchen-sink leak path', () => {
    const cases = [
      'toilet clog',
      'leak at the base of my toilet',
      'bathroom sink leak',
      'water heater leaking',
      'I need a plumber',
    ];
    for (const line of cases) {
      const m = matchKitchenSinkLeakIssue(line);
      assert.equal(m.accepted, false, line);
      assert.ok(
        m.rejectReason?.startsWith('off_lane') ||
          m.rejectReason === 'missing_kitchen_or_sink' ||
          m.rejectReason === 'no_leak_signal',
        line
      );
    }
  });

  it('still accepts kitchen sink leak', () => {
    const m = matchKitchenSinkLeakIssue('I have a leak at my kitchen sink');
    assert.equal(m.accepted, true);
  });

  it('does not treat kitchen-sink-only clog wording as off_lane fixture_clog', () => {
    const m = matchKitchenSinkLeakIssue('my kitchen sink is clogged and leaking');
    assert.equal(m.accepted, true);
  });
});

describe('matchBroadLeakLocation', () => {
  it('returns ambiguous when both faucet and under-sink cues appear', () => {
    const m = matchBroadLeakLocation('drip at the faucet and also under the sink');
    assert.equal(m.kind, 'ambiguous');
  });

  it('resolves under_sink for explicit under-sink phrasing', () => {
    const m = matchBroadLeakLocation('the leak is under the sink');
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') {
      assert.equal(m.location, 'under_sink');
    }
  });

  it('does not resolve bare pipe mention to under_sink', () => {
    const m = matchBroadLeakLocation("it's the pipe");
    assert.equal(m.kind, 'none');
  });

  it('resolves under_sink for under there', () => {
    const m = matchBroadLeakLocation('under there');
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') assert.equal(m.location, 'under_sink');
  });

  it('resolves unknown for uncertainty only', () => {
    const m = matchBroadLeakLocation("I don't know");
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') assert.equal(m.location, 'unknown');
  });

  it('resolves faucet_area for handle', () => {
    const m = matchBroadLeakLocation('the handle is dripping');
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') assert.equal(m.location, 'faucet_area');
  });

  it('resolves under_sink for in the cabinet', () => {
    const m = matchBroadLeakLocation('in the cabinet');
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') assert.equal(m.location, 'under_sink');
  });

  it('resolves other_kitchen_sink_area for around the sink', () => {
    const m = matchBroadLeakLocation('somewhere around the sink');
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') assert.equal(m.location, 'other_kitchen_sink_area');
  });
});

describe('matchLeakLocationDetailed legacy', () => {
  it('maps faucet_area to faucet for deprecated API', () => {
    const m = matchLeakLocationDetailed('the faucet is dripping');
    assert.equal(m.kind, 'resolved');
    if (m.kind === 'resolved') assert.equal(m.location, 'faucet');
  });
});
