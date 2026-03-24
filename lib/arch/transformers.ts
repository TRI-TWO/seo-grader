import type {
  ArchActivityViewModel,
  ArchDirection,
  ArchHealthStatus,
  ArchOverviewViewModel,
  ArchProgressViewModel,
} from "./client-types";

type ArchClientOutputRow = {
  health_score: number;
  health_status: string;
  health_direction: string;
  summary: string | null;
  what_we_did_json: any;
  why_it_matters_json: any;
  what_next_json: any;
  trust_signals_json: any;
  before_after_json: any;
  activity_summary_json: any;
  waiting_approval_json: any;
  upcoming_tasks_json: any;
  renewal_updates_json: any;
  updated_at: string | Date;
};

function normalizeStatus(input: string): ArchHealthStatus {
  if (input === "good") return "good";
  if (input === "warning") return "warning";
  return "critical";
}

function normalizeDirection(input: string): ArchDirection {
  if (input === "improving") return "improving";
  if (input === "declining") return "declining";
  return "flat";
}

function normalizeItems(input: any): { title: string; detail: string }[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => ({
      title: typeof item?.title === "string" ? item.title : "Update",
      detail: typeof item?.detail === "string" ? item.detail : "",
    }))
    .filter((item) => item.title.length > 0);
}

export function toArchOverviewViewModel(
  row: ArchClientOutputRow | null,
  fallbackClientName: string,
  fallbackSiteUrl: string,
  fallbackTier: string
): ArchOverviewViewModel {
  const score = row?.health_score ?? 0;
  const status = normalizeStatus(row?.health_status ?? "critical");
  const direction = normalizeDirection(row?.health_direction ?? "flat");
  const updatedAt = row?.updated_at ? new Date(row.updated_at) : new Date();

  return {
    clientName: fallbackClientName,
    siteUrl: fallbackSiteUrl,
    serviceTier: fallbackTier,
    lastUpdated: updatedAt.toISOString(),
    healthCard: {
      score,
      status,
      direction,
      summary:
        row?.summary ??
        "We are actively improving your search visibility and service performance.",
    },
    momentumCard: {
      periodLabel: "Last 30 days",
      delta: direction === "improving" ? 7 : direction === "declining" ? -4 : 0,
      direction,
      summary:
        direction === "improving"
          ? "Progress is moving in the right direction."
          : direction === "declining"
          ? "Some metrics softened; corrective actions are in progress."
          : "Performance is stable while we execute next steps.",
    },
    whatWeDidItems: normalizeItems(row?.what_we_did_json),
    whyItMattersItems: normalizeItems(row?.why_it_matters_json),
    nextFocusItems: normalizeItems(row?.what_next_json),
    activityFeedItems: normalizeItems(row?.activity_summary_json),
    approvalItems: normalizeItems(row?.waiting_approval_json),
    upcomingTaskItems: normalizeItems(row?.upcoming_tasks_json),
    renewalItems: normalizeItems(row?.renewal_updates_json),
  };
}

export function toArchProgressViewModel(
  row: ArchClientOutputRow | null
): ArchProgressViewModel {
  const score = row?.health_score ?? 0;
  return {
    healthCard: {
      score,
      status: normalizeStatus(row?.health_status ?? "critical"),
      direction: normalizeDirection(row?.health_direction ?? "flat"),
      summary:
        row?.summary ??
        "This score reflects technical health, trust signals, and conversion readiness.",
    },
    improvements: normalizeItems(row?.what_we_did_json),
    laggingAreas: normalizeItems(row?.what_next_json),
    trustSignals: normalizeItems(row?.trust_signals_json),
    beforeAfter: normalizeItems(row?.before_after_json),
  };
}

export function toArchActivityViewModel(
  row: ArchClientOutputRow | null
): ArchActivityViewModel {
  const feed = normalizeItems(row?.activity_summary_json);
  return {
    callsHandled: feed.slice(0, 2),
    followUpEmails: feed.slice(2, 4),
    crmUpdates: feed,
    pendingItems: normalizeItems(row?.waiting_approval_json),
    nextActions: normalizeItems(row?.upcoming_tasks_json),
  };
}

