import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildTwilioValidationUrl,
  getTwilioSignature,
  getOptionalTimelineEventType,
  isTwilioSignatureValid,
  normalizePhone,
  parseDurationSeconds,
  parseTwilioFormPayload,
  shouldValidateTwilioSignature,
  TERMINAL_CALL_STATUSES,
  validateStatusPayload,
} from '@/lib/old-gold/twilio-webhook';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let callSidForLog = 'unknown';

  try {
    const rawPayload = await parseTwilioFormPayload(req);
    callSidForLog = rawPayload.CallSid ?? callSidForLog;

    if (shouldValidateTwilioSignature()) {
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioSignature = getTwilioSignature(req);
      if (!twilioAuthToken || !twilioSignature) {
        return NextResponse.json({ ok: false, error: 'Unauthorized request' }, { status: 401 });
      }

      const isValid = isTwilioSignatureValid({
        url: buildTwilioValidationUrl(req),
        params: rawPayload,
        authToken: twilioAuthToken,
        twilioSignature,
      });

      if (!isValid) {
        console.warn('OLD GOLD status webhook invalid signature', { callSid: callSidForLog });
        return NextResponse.json({ ok: false, error: 'Unauthorized request' }, { status: 401 });
      }
    }

    const parsed = validateStatusPayload({
      CallSid: rawPayload.CallSid,
      CallStatus: rawPayload.CallStatus,
      CallDuration: rawPayload.CallDuration,
      Timestamp: rawPayload.Timestamp,
      From: rawPayload.From,
      To: rawPayload.To,
      RecordingUrl: rawPayload.RecordingUrl,
      RecordingSid: rawPayload.RecordingSid,
      RecordingStatus: rawPayload.RecordingStatus,
      SpeechResult: rawPayload.SpeechResult,
    });

    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const payload = parsed.value;
    callSidForLog = payload.CallSid;

    const normalizedFrom = normalizePhone(payload.From);
    const normalizedTo = normalizePhone(payload.To);
    const callOutcome = payload.CallStatus?.toLowerCase() ?? null;
    const durationSeconds = parseDurationSeconds(payload.CallDuration);
    const isTerminal = callOutcome ? TERMINAL_CALL_STATUSES.has(callOutcome) : false;

    console.info('OLD GOLD status webhook received', {
      callSid: payload.CallSid,
      callOutcome,
      durationSeconds,
      normalizedFrom,
      normalizedTo,
    });

    const updateRows = await prisma.$queryRaw<Array<{ id: string; lead_id: string | null }>>`
      UPDATE public.call_logs
      SET
        call_outcome = COALESCE(${callOutcome}, call_outcome),
        duration_seconds = COALESCE(${durationSeconds}, duration_seconds),
        recording_url = COALESCE(${payload.RecordingUrl ?? null}, recording_url),
        from_phone = COALESCE(${normalizedFrom}, from_phone),
        to_phone = COALESCE(${normalizedTo}, to_phone),
        ended_at = CASE
          WHEN ${isTerminal} THEN COALESCE(ended_at, now())
          ELSE ended_at
        END,
        updated_at = now()
      WHERE twilio_call_sid = ${payload.CallSid}
      RETURNING id, lead_id
    `;

    const callLog = updateRows[0];
    if (!callLog) {
      return NextResponse.json({ ok: false, error: 'Call log not found for CallSid' }, { status: 404 });
    }

    const timelineEventType = getOptionalTimelineEventType(callOutcome ?? undefined);
    if (timelineEventType) {
      await prisma.$executeRaw`
        INSERT INTO public.timeline_events (
          lead_id,
          call_log_id,
          event_type,
          channel,
          payload,
          occurred_at
        )
        VALUES (
          ${callLog.lead_id},
          ${callLog.id},
          ${timelineEventType}::timeline_event_type,
          'voice',
          jsonb_build_object(
            'call_sid', ${payload.CallSid},
            'call_status', ${callOutcome},
            'duration_seconds', ${durationSeconds},
            'recording_url', ${payload.RecordingUrl ?? null},
            'from_phone', ${normalizedFrom},
            'to_phone', ${normalizedTo}
          ),
          now()
        )
      `;
    }

    // TODO(step5): implement lead creation/update in public.leads.
    // TODO(step5): implement notification fan-out (sms/slack/email).
    // TODO(step5): implement real client-account mapping from Twilio destination number.
    // TODO(step6): harden Twilio signature validation for production deployment behavior.

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('OLD GOLD status webhook error', { callSid: callSidForLog, error });
    return NextResponse.json({ ok: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
