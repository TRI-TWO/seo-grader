import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { commitBlockReasonForDebug, manualCommitDelayMsForState } from './kitchenSinkLeakOnlyBridge';

describe('kitchenSinkLeakOnlyBridge manual commit delay', () => {
  it('uses longer callback commit window for callback states', () => {
    assert.equal(manualCommitDelayMsForState('callback_number_confirm'), 4200);
    assert.equal(manualCommitDelayMsForState('callback_number_collect'), 4200);
    assert.equal(manualCommitDelayMsForState('collect_callback_time'), 4200);
    assert.equal(manualCommitDelayMsForState('callback_confirm'), 4200);
    assert.equal(manualCommitDelayMsForState('close_wait'), 4200);
  });

  it('street uses address-capture commit window and is not callback-timed', () => {
    assert.equal(manualCommitDelayMsForState('collect_street_address'), 4200);
  });

  it('painting scope follow-up uses issue-tier commit window', () => {
    assert.equal(manualCommitDelayMsForState('painting_scope_capture'), 2400);
  });
});

describe('kitchenSinkLeakOnlyBridge commit block reason', () => {
  it('does not block commit when audio appended and no other blockers', () => {
    const r = commitBlockReasonForDebug({
      closed: false,
      manualTurnOpen: true,
      assistantResponseOpen: false,
      commitInFlight: false,
      callerAudioAppendedSinceLastCommit: true,
      bufferedCallerMs: 500,
      minCallerAudioMsForCommit: 200,
      waitingForUserTranscript: false,
    });
    assert.equal(r, null);
  });
});

