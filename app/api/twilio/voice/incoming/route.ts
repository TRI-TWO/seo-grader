import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  getTwilioVoiceBotClientIdFromEnv,
  getTwilioVoiceMediaStreamUrlFromEnv,
  runTwilioInboundRealtimeInit,
} from '@/lib/bot/twilioInboundRealtimeInit';
import {
  buildTwilioValidationUrl,
  getTwilioSignature,
  isTwilioSignatureValid,
  normalizePhone,
  parseTwilioFormPayload,
  shouldValidateTwilioSignature,
  twimlResponse,
  twimlStreamConnectResponse,
  validateIncomingPayload,
} from '@/lib/old-gold/twilio-webhook';

export const runtime = 'nodejs';

const VOICE_FALLBACK_TWIML_MESSAGE =
  'Hi, thanks for calling. We are capturing your information now and our team will follow up shortly.';

const VOICE_SESSION_INIT_FALLBACK_MESSAGE =
  "Sorry, we're having trouble connecting right now. Please try again in a moment.";

function twilioXmlResponse(xmlBody: string, status: number) {
  return new NextResponse(xmlBody, {
    status,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

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

    const botClientId = getTwilioVoiceBotClientIdFromEnv();
    const { log: realtimeLog, init: realtimeInit } = await runTwilioInboundRealtimeInit(botClientId);

    if (realtimeLog.ok) {
      console.info('Twilio inbound voice realtime session', {
        callSid: payload.CallSid,
        success: true,
        botClientId: realtimeLog.bot_client_id,
        promptVersion: realtimeLog.prompt_version,
        tradeType: realtimeLog.trade_type,
        openaiSessionId: realtimeLog.openai_session_id,
        streamUrlConfigured: realtimeLog.stream_url_configured,
      });
    } else if ('skipped' in realtimeLog && realtimeLog.skipped) {
      console.info('Twilio inbound voice realtime session skipped', {
        callSid: payload.CallSid,
        reason: realtimeLog.reason,
      });
    } else if ('error' in realtimeLog) {
      console.warn('Twilio inbound voice realtime session failed', {
        callSid: payload.CallSid,
        botClientId: realtimeLog.bot_client_id,
        error: realtimeLog.error,
      });
    }

    const timelinePayload = {
      call_sid: payload.CallSid,
      from_phone: fromPhone,
      to_phone: toPhone,
      realtime_session: realtimeLog,
    };

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.timeline_events (
        lead_id,
        call_log_id,
        event_type,
        channel,
        payload,
        occurred_at
      )
      VALUES ($1, $2::uuid, 'call_answered'::timeline_event_type, 'voice', $3::jsonb, now())`,
      callLog.lead_id,
      callLog.id,
      JSON.stringify(timelinePayload)
    );

    // TODO(step5): implement lead creation/update in public.leads.
    // TODO(step5): implement notification fan-out (sms/slack/email).
    // TODO(step5): implement real client-account mapping from Twilio destination number (beyond TWILIO_VOICE_BOT_CLIENT_ID).
    // TODO(step6): harden Twilio signature validation for production deployment behavior.

    const streamUrl = getTwilioVoiceMediaStreamUrlFromEnv();
    const ephemeralSecret = realtimeInit?.session.client_secret?.value?.trim();

    if (realtimeLog.ok && realtimeInit && streamUrl) {
      const streamParameters: Record<string, string> = {
        call_sid: payload.CallSid,
        call_log_id: callLog.id,
        bot_client_id: realtimeInit.botClientId,
        openai_session_id: realtimeInit.session.id ?? '',
        /** Kitchen-sink-only bridge: confirm callback vs collect spoken number. */
        caller_phone_e164: fromPhone,
      };
      if (ephemeralSecret) {
        streamParameters.openai_client_secret = ephemeralSecret;
      }

      return twilioXmlResponse(
        twimlStreamConnectResponse({
          streamUrl,
          parameters: streamParameters,
        }),
        200
      );
    }

    if (realtimeLog.ok && !streamUrl) {
      console.info('Twilio inbound voice: realtime session ready; set TWILIO_VOICE_MEDIA_STREAM_URL for live streaming TwiML', {
        callSid: payload.CallSid,
      });
    }

    const sessionInitFailed =
      !realtimeLog.ok &&
      'session_init_failed' in realtimeLog &&
      realtimeLog.session_init_failed === true;

    return twilioXmlResponse(
      twimlResponse(sessionInitFailed ? VOICE_SESSION_INIT_FALLBACK_MESSAGE : VOICE_FALLBACK_TWIML_MESSAGE),
      200
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
