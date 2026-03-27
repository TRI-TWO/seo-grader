import type { Prisma } from "@prisma/client";
import type {
  ArchCrmActivitySegment,
  ArchCrmDrillDownRow,
  ArchCrmGridCell,
} from "./client-types";

type EventRow = {
  id: string;
  event_type: string;
  payload: Prisma.JsonValue;
  created_at: Date | null;
};

function payloadObj(p: Prisma.JsonValue): Record<string, unknown> {
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return p as Record<string, unknown>;
  }
  return {};
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function classifySegment(eventType: string): ArchCrmActivitySegment | null {
  const t = eventType.toLowerCase();
  if (
    t.includes("follow_up") ||
    t.includes("follow-up") ||
    t.includes("callback") ||
    t === "crm_follow_up"
  ) {
    return "follow-up-calls";
  }
  if (
    t.includes("incoming_call") ||
    t.includes("inbound") ||
    t === "phone_inbound" ||
    t.includes("caller")
  ) {
    return "incoming-calls";
  }
  if (t.startsWith("calendly_") || t.includes("meeting") || t.includes("schedule")) {
    return "meetings";
  }
  if (t.includes("bid") || t.includes("quote") || t.includes("proposal")) {
    return "bids";
  }
  if (t.includes("call") && t.includes("out")) {
    return "follow-up-calls";
  }
  if (t.includes("call")) {
    return "incoming-calls";
  }
  return null;
}

export function eventToDrillDownRow(
  row: EventRow,
  fallbackClientName: string
): ArchCrmDrillDownRow {
  const pl = payloadObj(row.payload);
  const contact =
    str(pl.contact_name) ||
    str(pl.caller_name) ||
    str(pl.name) ||
    str(pl.invitee_name);
  const phone =
    str(pl.phone) || str(pl.phone_number) || str(pl.caller_phone) || "";
  const email = str(pl.email) || str(pl.contact_email) || "";
  const location =
    str(pl.location) || str(pl.city) || str(pl.address) || "";
  const serviceType =
    str(pl.service_type) ||
    str(pl.project_type) ||
    str(pl.service) ||
    row.event_type;
  const summary =
    str(pl.summary) ||
    str(pl.notes) ||
    str(pl.message) ||
    (typeof row.payload === "string" ? row.payload : "");
  const followUp = str(pl.follow_up_notes) || str(pl.followup) || "";
  const clientName = str(pl.client_name) || fallbackClientName;

  return {
    id: row.id,
    clientName: clientName || fallbackClientName,
    contactName: contact || "—",
    phone: phone || "—",
    email: email || "—",
    location: location || "—",
    serviceType: serviceType || "—",
    summaryNotes: summary ? summary.slice(0, 500) : row.event_type,
    followUpNotes: followUp ? followUp.slice(0, 500) : "—",
    occurredAt: row.created_at?.toISOString() ?? null,
  };
}

export function groupEventsByCrmSegment(
  rows: EventRow[],
  fallbackClientName: string
): Record<ArchCrmActivitySegment, ArchCrmDrillDownRow[]> {
  const buckets: Record<ArchCrmActivitySegment, ArchCrmDrillDownRow[]> = {
    "follow-up-calls": [],
    "incoming-calls": [],
    meetings: [],
    bids: [],
  };

  for (const row of rows) {
    const seg = classifySegment(row.event_type);
    if (!seg) continue;
    buckets[seg].push(eventToDrillDownRow(row, fallbackClientName));
  }

  return buckets;
}

const CRM_LABELS: Record<ArchCrmActivitySegment, string> = {
  "follow-up-calls": "Follow-up calls",
  "incoming-calls": "Incoming calls today",
  meetings: "Next meeting",
  bids: "Bids to follow up",
};

function previewForSegment(
  seg: ArchCrmActivitySegment,
  rows: ArchCrmDrillDownRow[]
): string {
  if (rows.length === 0) return "No items yet — click to view activity.";
  const first = rows[0];
  if (seg === "meetings" && first.summaryNotes) {
    return first.summaryNotes.slice(0, 120);
  }
  return `${first.contactName} · ${first.summaryNotes.slice(0, 80)}`;
}

function primaryForSegment(
  seg: ArchCrmActivitySegment,
  rows: ArchCrmDrillDownRow[]
): string {
  if (rows.length === 0) {
    return seg === "meetings" ? "None scheduled" : "0";
  }
  if (seg === "meetings") {
    const t = rows[0].occurredAt;
    return t ? new Date(t).toLocaleString() : rows[0].summaryNotes.slice(0, 60);
  }
  return String(rows.length);
}

export function buildCrmInteractionGrid(
  buckets: Record<ArchCrmActivitySegment, ArchCrmDrillDownRow[]>
): ArchCrmGridCell[] {
  const order: ArchCrmActivitySegment[] = [
    "follow-up-calls",
    "incoming-calls",
    "meetings",
    "bids",
  ];
  return order.map((key) => ({
    key,
    title: CRM_LABELS[key],
    primary: primaryForSegment(key, buckets[key]),
    preview: previewForSegment(key, buckets[key]),
    href: `/arch/activity/${key}`,
  }));
}
