import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type CalendlyEvent = 'invitee.created' | 'invitee.canceled';

interface CalendlyWebhookPayload {
  event: CalendlyEvent;
  payload: {
    event_uri: string;
    invitee: {
      uri: string;
      email: string;
      name: string;
    };
    scheduled_event: {
      uri: string;
      start_time: string;
      end_time: string;
    };
    questions_and_answers?: Array<{
      question: string;
      answer: string;
    }>;
  };
}

/** Persists Calendly activity in `public.events` (no legacy `calendlyAppointment` / `User` tables). */
export async function POST(req: NextRequest) {
  try {
    const body: CalendlyWebhookPayload = await req.json();
    const { event, payload } = body;

    const eventIdMatch = payload.scheduled_event?.uri?.match(/scheduled_events\/([^/]+)/);
    const calendlyEventId = eventIdMatch ? eventIdMatch[1] : null;

    if (event === 'invitee.created') {
      if (!calendlyEventId) {
        return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
      }

      await prisma.events.create({
        data: {
          client_id: null,
          event_type: 'calendly_invitee_created',
          payload: {
            calendlyEventId,
            email: payload.invitee.email,
            name: payload.invitee.name,
            start_time: payload.scheduled_event.start_time,
            end_time: payload.scheduled_event.end_time,
            questions_and_answers: payload.questions_and_answers ?? [],
          },
        },
      });

      return NextResponse.json({ success: true, message: 'Event recorded' });
    }

    if (event === 'invitee.canceled') {
      if (!calendlyEventId) {
        return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 });
      }

      await prisma.events.create({
        data: {
          client_id: null,
          event_type: 'calendly_invitee_canceled',
          payload: {
            calendlyEventId,
            email: payload.invitee.email,
          },
        },
      });

      return NextResponse.json({ success: true, message: 'Cancellation recorded' });
    }

    return NextResponse.json({ success: true, message: 'Event not handled' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Calendly webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: message },
      { status: 500 }
    );
  }
}
