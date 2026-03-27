/**
 * Arch overview: org_members → clients, sites, client_performance_signals, events.
 * Contract hints from smokey_client_state / smokey_client_config when present.
 */
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getClientForUser } from "@/lib/auth";
import type {
  ArchListItem,
  ArchOverviewViewModel,
  ArchUpsellOpportunity,
} from "./client-types";
import {
  buildCrmInteractionGrid,
  groupEventsByCrmSegment,
} from "./build-crm-from-events";
import {
  buildScoreCirclesVm,
  buildSeoPyramidVm,
} from "./map-performance-to-seo-vm";

function daysUntil(d: Date): number {
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function inferHasSeoService(
  contractTier: string | null | undefined,
  contractLevel: string | null | undefined,
  hasPerformanceSignal: boolean
): boolean {
  const t = `${contractTier ?? ""} ${contractLevel ?? ""}`.toLowerCase();
  if (/seo|organic|search\s*rank|serp/.test(t)) return true;
  // Signals row implies some SEO management telemetry in many deployments.
  if (hasPerformanceSignal) return true;
  return false;
}

function collectUpsellOpps(
  hasSeo: boolean,
  _hasGbpSignal: boolean
): ArchUpsellOpportunity[] {
  const opps: ArchUpsellOpportunity[] = [];
  if (!hasSeo) opps.push("seo");
  // TODO: surface gbp/geo/website when entitlements or signals exist
  return opps;
}

export async function getArchOverview(): Promise<ArchOverviewViewModel | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClientForUser(user);
  if (!client) return null;

  const [site, signal, smokeyState, smokeyConfig, eventRows] =
    await Promise.all([
      prisma.sites.findFirst({
        where: { client_id: client.id },
        orderBy: { created_at: "desc" },
      }),
      prisma.client_performance_signals.findFirst({
        where: { client_id: client.id },
        orderBy: { created_at: "desc" },
      }),
      prisma.smokey_client_state.findFirst({
        where: { client_id: client.id },
        orderBy: { last_evaluated_at: "desc" },
      }),
      prisma.smokey_client_config.findUnique({
        where: { client_id: client.id },
      }),
      prisma.events.findMany({
        where: { client_id: client.id },
        orderBy: { created_at: "desc" },
        take: 80,
      }),
    ]);

  const now = new Date().toISOString();
  const status =
    signal?.seo_health === "good"
      ? "good"
      : signal?.seo_health === "warning"
        ? "warning"
        : "critical";

  const contractEnd =
    smokeyState?.contract_end ?? smokeyConfig?.contract_end ?? null;
  const contractEndsAtIso = contractEnd
    ? contractEnd.toISOString().slice(0, 10)
    : null;
  const renewalWindowActive =
    contractEnd != null &&
    contractEnd >= new Date(new Date().toDateString()) &&
    daysUntil(contractEnd) <= 30 &&
    daysUntil(contractEnd) >= 0;

  // TODO: tie hasChatbotService to explicit entitlements table when available.
  const hasChatbotService = true;
  const hasSeoService = inferHasSeoService(
    smokeyState?.contract_tier,
    smokeyConfig?.contract_level,
    Boolean(signal)
  );

  const upsellOpportunities = collectUpsellOpps(hasSeoService, false);

  const buckets = groupEventsByCrmSegment(eventRows, client.name);
  const crmInteractionGrid = {
    cells: buildCrmInteractionGrid(buckets),
  };

  const seoPyramid = buildSeoPyramidVm(signal, hasSeoService);
  const scoreCircles = buildScoreCirclesVm(signal, hasSeoService);

  let renewalMode: ArchOverviewViewModel["renewalUpsell"]["mode"] = "upsell";
  let renewalHeadline = "";
  let renewalDetail: string | undefined;
  let ctaLabel: string | undefined;
  let ctaHref: string | undefined;

  if (renewalWindowActive && contractEnd) {
    const d = daysUntil(contractEnd);
    renewalHeadline = `Your current service term ends in ${d} day${d === 1 ? "" : "s"}.`;
    renewalDetail = "Renew early to avoid interruptions to chatbot coverage and reporting.";
    ctaLabel = "Account & billing";
    ctaHref = "/arch/account";
    renewalMode = upsellOpportunities.length > 0 ? "renewal_and_upsell" : "renewal";
  }

  if (upsellOpportunities.includes("seo") && !hasSeoService) {
    if (!renewalHeadline) {
      renewalHeadline =
        "Add SEO management to improve search visibility and lead quality.";
      renewalDetail =
        "TRI-TWO layers crawl-to-click readiness so you can compete for page-one placements.";
      ctaLabel = "Learn more";
      ctaHref = "/arch/account";
      renewalMode = "upsell";
    } else {
      renewalDetail =
        `${renewalDetail ?? ""} You can also add SEO management to strengthen organic discovery.`.trim();
      renewalMode = "renewal_and_upsell";
    }
  }

  if (!renewalHeadline && upsellOpportunities.length > 0) {
    renewalHeadline = "Upgrade options are available for your account.";
    renewalDetail = "Explore add-ons with your TRI-TWO contact.";
    ctaLabel = "View account";
    ctaHref = "/arch/account";
    renewalMode = "upsell";
  }

  const renewalVisible =
    renewalWindowActive || !hasSeoService || upsellOpportunities.length > 0;

  const renewalUpsell = {
    visible: renewalVisible,
    mode: renewalMode,
    headline:
      renewalHeadline ||
      (renewalVisible ? "Stay ahead with TRI-TWO services." : ""),
    detail: renewalDetail,
    ctaLabel,
    ctaHref,
  };

  const toTask = (items: ArchListItem[], prefix: string) =>
    items.map((item, i) => ({
      id: `${prefix}-${i}-${item.title.slice(0, 24).replace(/\s+/g, "-")}`,
      title: item.title,
      detail: item.detail,
    }));

  const approvalItems: ArchListItem[] = [];
  const upcomingTaskItems: ArchListItem[] = [];

  const serviceTasks = hasSeoService
    ? {
        enabled: true,
        mode: "seo_tasks" as const,
        waitingApproval: toTask(approvalItems, "wa"),
        active: [],
        upcoming: toTask(upcomingTaskItems, "up"),
      }
    : {
        enabled: false,
        mode: "upsell" as const,
        waitingApproval: [],
        active: [],
        upcoming: [],
        upsellHeadline: "SEO service tasks",
        upsellDetail:
          "When you add SEO management, approvals, live work, and the queue will show here.",
      };

  const serviceTier =
    smokeyState?.contract_tier ??
    smokeyConfig?.contract_level ??
    (hasSeoService ? "platform + seo" : "platform");

  return {
    clientName: client.name,
    siteUrl: site?.canonical_url || client.website_url || "",
    serviceTier,
    lastUpdated: now,
    hasChatbotService,
    hasSeoService,
    contractEndsAt: contractEndsAtIso,
    renewalWindowActive,
    upsellOpportunities,
    seoPyramid,
    scoreCircles,
    crmInteractionGrid,
    renewalUpsell,
    serviceTasks,
    healthCard: {
      score: scoreCircles.enabled && scoreCircles.items.length
        ? Math.round(
            scoreCircles.items.reduce((s, i) => s + i.score, 0) /
              scoreCircles.items.length
          )
        : 0,
      status,
      direction: "flat",
      summary:
        status === "good"
          ? "Everything looks healthy."
          : status === "warning"
            ? "Some items need attention."
            : "We’re working through key issues.",
    },
    momentumCard: {
      periodLabel: "Last 30 days",
      delta: 0,
      direction: "flat",
      summary: "Metrics are stabilizing as new improvements roll out.",
    },
    whatWeDidItems: [],
    whyItMattersItems: [],
    nextFocusItems: [],
    activityFeedItems: [],
    approvalItems,
    upcomingTaskItems,
    renewalItems: [],
  };
}
