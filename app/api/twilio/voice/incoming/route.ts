import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildTwilioValidationUrl,
  getTwilioSignature,
  isTwilioSignatureValid,
  normalizePhone,
  parseTwilioFormPayload,
  shouldValidateTwilioSignature,
  twimlResponse,
  validateIncomingPayload,
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
        return new NextResponse(twimlResponse('Unauthorized request.'), {
          status: 401,
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        });
      }

      const isValid = isTwilioSignatureValid({
        url: buildTwilioValidationUrl(req),
        params: rawPayload,
        authToken: twilioAuthToken,
        twilioSignature,
      });

      if (!isValid) {
        console.warn('OLD GOLD incoming webhook invalid signature', { callSid: callSidForLog });
        return new NextResponse(twimlResponse('Unauthorized request.'), {
          status: 401,
          headers: { 'Content-Type': 'text/xml; charset=utf-8' },
        });
      }
    }

    const parsed = validateIncomingPayload({
      CallSid: rawPayload.CallSid,
      From: rawPayload.From,
      To: rawPayload.To,
      CallStatus: rawPayload.CallStatus,
      AccountSid: rawPayload.AccountSid,
      Direction: rawPayload.Direction,
      ApiVersion: rawPayload.ApiVersion,
      ForwardedFrom: rawPayload.ForwardedFrom,
    });

    if (!parsed.ok) {
      return new NextResponse(twimlResponse('Sorry, we could not process your call details. Our team will follow up shortly.'), {
        status: 400,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      });
    }

    const payload = parsed.value;
    callSidForLog = payload.CallSid;

    const fromPhone = normalizePhone(payload.From);
    const toPhone = normalizePhone(payload.To);

    if (!fromPhone || !toPhone) {
      return new NextResponse(twimlResponse('Sorry, we could not process your call details. Our team will follow up shortly.'), {
        status: 400,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      });
    }

    // TODO(step5): Replace fallback account mapping with phone-number-to-client mapping.
    const clientAccount = toPhone;

    console.info('OLD GOLD incoming webhook received', {
      callSid: payload.CallSid,
      fromPhone,
      toPhone,
      clientAccount,
    });

    const upsertRows = await prisma.$queryRaw<Array<{ id: string; lead_id: string | null }>>`
      INSERT INTO public.call_logs (
        client_account,
        twilio_call_sid,
        from_phone,
        to_phone,
        started_at,
        intake_completed
      )
      VALUES (
        ${clientAccount},
        ${payload.CallSid},
        ${fromPhone},
        ${toPhone},
        now(),
        false
      )
      ON CONFLICT (twilio_call_sid)
      DO UPDATE SET
        from_phone = EXCLUDED.from_phone,
        to_phone = EXCLUDED.to_phone,
        updated_at = now()
      RETURNING id, lead_id
    `;

    const callLog = upsertRows[0];
    if (!callLog) {
      throw new Error('Unable to upsert call_logs row');
    }

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
        'call_answered'::timeline_event_type,
        'voice',
        jsonb_build_object(
          'call_sid', ${payload.CallSid},
          'from_phone', ${fromPhone},
          'to_phone', ${toPhone}
        ),
        now()
      )
    `;

    // TODO(step5): implement lead creation/update in public.leads.
    // TODO(step5): implement notification fan-out (sms/slack/email).
    // TODO(step5): implement real client-account mapping from Twilio destination number.
    // TODO(step6): harden Twilio signature validation for production deployment behavior.

    return new NextResponse(
      twimlResponse('Hi, thanks for calling. We are capturing your information now and our team will follow up shortly.'),
      {
        status: 200,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      }
    );
  } catch (error: unknown) {
    console.error('OLD GOLD incoming webhook error', { callSid: callSidForLog, error });
    return new NextResponse(
      twimlResponse('We are experiencing a temporary issue. Our team will call you back shortly.'),
      {
        status: 500,
        headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      }
    );
  }
}
