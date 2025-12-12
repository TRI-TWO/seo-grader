import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Calendly webhook event types
type CalendlyEvent = "invitee.created" | "invitee.canceled";

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

export async function POST(req: NextRequest) {
  try {
    const body: CalendlyWebhookPayload = await req.json();

    // Verify webhook signature if CALENDLY_WEBHOOK_SIGNING_KEY is set
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    if (signingKey) {
      // TODO: Implement webhook signature verification
      // Calendly provides a signature in headers for verification
      // For now, we'll skip this but it should be implemented for production
    }

    const { event, payload } = body;

    // Handle different event types
    if (event === "invitee.created") {
      // Extract event ID from URI (format: https://api.calendly.com/scheduled_events/{uuid})
      const eventIdMatch = payload.scheduled_event.uri.match(/scheduled_events\/([^/]+)/);
      const eventId = eventIdMatch ? eventIdMatch[1] : null;

      if (!eventId) {
        console.error("Could not extract event ID from Calendly webhook");
        return NextResponse.json(
          { error: "Invalid webhook payload" },
          { status: 400 }
        );
      }

      // Check if appointment already exists
      const existingAppointment = await prisma.calendlyAppointment.findUnique({
        where: { calendlyEventId: eventId },
      });

      if (existingAppointment) {
        console.log(`Appointment ${eventId} already exists, skipping`);
        return NextResponse.json({ success: true, message: "Appointment already exists" });
      }

      // Parse scheduled time
      const scheduledAt = new Date(payload.scheduled_event.start_time);

      // Try to extract audit URL from questions or use a default
      // You can customize this based on your Calendly form questions
      let auditUrl = "";
      let auditId: string | null = null;

      if (payload.questions_and_answers) {
        // Look for a question about the audit URL
        const urlAnswer = payload.questions_and_answers.find(
          (qa) => qa.question.toLowerCase().includes("url") || qa.question.toLowerCase().includes("website")
        );
        if (urlAnswer) {
          auditUrl = urlAnswer.answer;
        }
      }

      // If audit URL is provided, try to find the audit result
      if (auditUrl) {
        try {
          const auditResult = await prisma.auditResult.findFirst({
            where: { url: auditUrl },
            orderBy: { createdAt: "desc" },
          });
          if (auditResult) {
            auditId = auditResult.id;
            // Update audit result to mark as having appointment
            await prisma.auditResult.update({
              where: { id: auditResult.id },
              data: { hasAppointment: true },
            });
          }
        } catch (err) {
          console.error("Error finding audit result:", err);
        }
      }

      // Ensure user exists (create if not)
      // Note: For webhook users who haven't registered yet, we generate a UUID
      // When they register via Supabase Auth, a new User record will be created with their Supabase ID
      let user = await prisma.user.findUnique({
        where: { email: payload.invitee.email },
      });

      if (!user) {
        // Generate a UUID for webhook users (they can register later to get a Supabase account)
        const { randomUUID } = await import('crypto');
        user = await prisma.user.create({
          data: {
            id: randomUUID(), // Generate UUID for webhook users
            email: payload.invitee.email,
            role: "VISITOR",
          },
        });
      }

      // Create appointment record
      await prisma.calendlyAppointment.create({
        data: {
          calendlyEventId: eventId,
          url: auditUrl || "https://calendly.com/mgr-tri-two",
          userEmail: payload.invitee.email,
          scheduledAt: scheduledAt,
          status: "scheduled",
          auditId: auditId,
        },
      });

      console.log(`Created appointment record for ${payload.invitee.email} at ${scheduledAt}`);

      return NextResponse.json({ success: true, message: "Appointment created" });
    } else if (event === "invitee.canceled") {
      // Extract event ID from URI
      const eventIdMatch = payload.scheduled_event.uri.match(/scheduled_events\/([^/]+)/);
      const eventId = eventIdMatch ? eventIdMatch[1] : null;

      if (!eventId) {
        console.error("Could not extract event ID from Calendly webhook");
        return NextResponse.json(
          { error: "Invalid webhook payload" },
          { status: 400 }
        );
      }

      // Update appointment status to canceled
      const appointment = await prisma.calendlyAppointment.findUnique({
        where: { calendlyEventId: eventId },
      });

      if (appointment) {
        await prisma.calendlyAppointment.update({
          where: { calendlyEventId: eventId },
          data: { status: "canceled" },
        });

        console.log(`Canceled appointment ${eventId}`);
      } else {
        console.log(`Appointment ${eventId} not found for cancellation`);
      }

      return NextResponse.json({ success: true, message: "Appointment canceled" });
    } else {
      console.log(`Unhandled Calendly event: ${event}`);
      return NextResponse.json({ success: true, message: "Event not handled" });
    }
  } catch (error: any) {
    console.error("Calendly webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed", details: error?.message },
      { status: 500 }
    );
  }
}
