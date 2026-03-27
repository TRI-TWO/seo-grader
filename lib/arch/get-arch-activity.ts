import { prisma } from "@/lib/prisma";
import { getCurrentUser, getClientForUser } from "@/lib/auth";
import type {
  ArchActivityDrillDownViewModel,
  ArchActivityViewModel,
  ArchCrmActivitySegment,
} from "./client-types";
import { isArchCrmActivitySegment } from "./client-types";
import { groupEventsByCrmSegment } from "./build-crm-from-events";

function titleForEventType(eventType: string): string {
  if (eventType.startsWith("calendly_")) return "Scheduling";
  if (eventType.includes("audit")) return "Audit";
  return "Activity";
}

const SEGMENT_TITLES: Record<ArchCrmActivitySegment, string> = {
  "follow-up-calls": "Follow-up calls",
  "incoming-calls": "Incoming calls",
  meetings: "Meetings",
  bids: "Bids to follow up",
};

/**
 * Activity view from `public.events` for this client (platform-native audit trail).
 */
export async function getArchActivity(): Promise<ArchActivityViewModel | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClientForUser(user);
  if (!client) return null;

  const rows = await prisma.events.findMany({
    where: { client_id: client.id },
    orderBy: { created_at: "desc" },
    take: 25,
  });

  const buckets = groupEventsByCrmSegment(rows, client.name);

  const crmUpdates = rows.map((row) => ({
    title: `${titleForEventType(row.event_type)}: ${row.event_type}`,
    detail: JSON.stringify(row.payload).slice(0, 280),
  }));

  const followUpEmails = buckets["follow-up-calls"].slice(0, 5).map((r) => ({
    title: r.contactName,
    detail: r.summaryNotes,
  }));

  const callsHandled = buckets["incoming-calls"].slice(0, 5).map((r) => ({
    title: r.contactName,
    detail: r.summaryNotes,
  }));

  const pendingItems = buckets.bids.slice(0, 5).map((r) => ({
    title: r.serviceType,
    detail: r.summaryNotes,
  }));

  const nextActions = buckets.meetings.slice(0, 5).map((r) => ({
    title: r.summaryNotes.slice(0, 80) || "Meeting",
    detail: r.occurredAt ? new Date(r.occurredAt).toLocaleString() : "",
  }));

  return {
    callsHandled,
    followUpEmails,
    crmUpdates,
    pendingItems,
    nextActions,
  };
}

export async function getArchActivityDrillDown(
  segment: string
): Promise<ArchActivityDrillDownViewModel | null> {
  if (!isArchCrmActivitySegment(segment)) return null;

  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClientForUser(user);
  if (!client) return null;

  const rows = await prisma.events.findMany({
    where: { client_id: client.id },
    orderBy: { created_at: "desc" },
    take: 120,
  });

  const buckets = groupEventsByCrmSegment(rows, client.name);

  return {
    segment,
    segmentTitle: SEGMENT_TITLES[segment],
    rows: buckets[segment],
  };
}
