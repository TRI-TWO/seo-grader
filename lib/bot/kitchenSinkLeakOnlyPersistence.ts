import { prisma } from '@/lib/prisma';
import type { KitchenSinkLeakOnlyActiveTestMode } from '@/lib/bot/kitchenSinkLeakOnlyVoiceMode';
import type { KitchenSinkCollected } from '@/lib/bot/kitchenSinkLeakOnlyStateMachine';

export type KitchenSinkLeakOnlyPersistPayload = {
  callLogId: string;
  leadId: string | null;
  activeTestMode: KitchenSinkLeakOnlyActiveTestMode;
  callOutcome:
    | 'qualified_kitchen_sink_leak'
    | 'qualified_plumbing_intake'
    | 'unsupported_issue'
    | 'leak_location_unclear';
  endReason: string | null;
  collected: KitchenSinkCollected;
  transcriptSummary: string;
};

/**
 * Updates `call_logs` and inserts `timeline_events` (intake_completed) for admin follow-up.
 * Safe to fire-and-forget; logs errors only.
 */
export async function persistKitchenSinkLeakOnlyOutcome(
  payload: KitchenSinkLeakOnlyPersistPayload
): Promise<void> {
  const {
    callLogId,
    leadId,
    activeTestMode,
    callOutcome,
    endReason,
    collected,
    transcriptSummary,
  } = payload;

  const legacyLeakLocation =
    collected.leakPrimary === 'faucet'
      ? 'faucet_area'
      : collected.leakPrimary === 'below_sink'
        ? 'under_sink'
        : collected.leakPrimary === 'unknown'
          ? 'unknown'
          : null;

  const json = {
    activeTestMode,
    call_outcome: callOutcome,
    end_reason: endReason,
    normalized_issue: collected.normalizedIssue,
    leak_primary: collected.leakPrimary,
    leak_secondary: collected.leakSecondary,
    leak_location: legacyLeakLocation,
    technician_detail_note: null,
    caller_name: collected.callerName,
    service_address: collected.serviceAddress,
    street_address: collected.streetAddress,
    city: collected.city,
    state: collected.state,
    zip: collected.zip,
    callback_time_preference: collected.callbackTimePreference,
    inbound_caller_phone_e164: collected.inboundCallerPhoneE164,
    callback_phone_number: collected.callbackPhoneNumber,
    callback_phone_source: collected.callbackPhoneSource,
    address_remainder_deferred_to_sms: collected.addressRemainderDeferredToSms,
    transcript_summary: transcriptSummary,
    voice_mode: 'VOICE_MODE_PLUMBING_INTAKE',
    zip_partial_digits: collected.zipPartialDigits,
    callback_phone_partial_digits: collected.callbackPhonePartialDigits,
  };

  const jsonText = JSON.stringify(json);

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE public.call_logs
       SET transcript = $1, call_outcome = $2, intake_completed = true, updated_at = now()
       WHERE id = $3::uuid`,
      jsonText,
      callOutcome,
      callLogId
    );

    if (leadId) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.timeline_events (
          lead_id, call_log_id, event_type, channel, payload, occurred_at
        ) VALUES ($1::uuid, $2::uuid, 'intake_completed'::timeline_event_type, 'voice', $3::jsonb, now())`,
        leadId,
        callLogId,
        jsonText
      );
    } else {
      console.warn('VOICE_KITCHEN_SINK_ONLY persist skipped timeline_events (no lead_id)', {
        callLogId,
      });
    }
  } catch (err) {
    console.error('VOICE_KITCHEN_SINK_ONLY persist failed', { callLogId, err });
  }
}
