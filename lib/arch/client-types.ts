export type ArchHealthStatus = "good" | "warning" | "critical";
export type ArchDirection = "improving" | "flat" | "declining";

export type ArchHealthCard = {
  score: number;
  status: ArchHealthStatus;
  direction: ArchDirection;
  summary: string;
};

export type ArchMomentumCard = {
  periodLabel: string;
  delta: number;
  direction: ArchDirection;
  summary: string;
};

export type ArchListItem = {
  title: string;
  detail: string;
};

export type ArchSeoPyramidLayerStatus =
  | "strong"
  | "moderate"
  | "weak"
  | "inactive";

export type ArchSeoPyramidViewModel = {
  enabled: boolean;
  title: string;
  subtitle?: string;
  layers: Array<{
    key: string;
    label: string;
    score?: number;
    status: ArchSeoPyramidLayerStatus;
    detail?: string;
  }>;
};

export type ArchScoreCircleTone = "good" | "warn" | "bad";

export type ArchScoreCirclesViewModel = {
  enabled: boolean;
  items: Array<{
    key: string;
    label: string;
    score: number;
    tone?: ArchScoreCircleTone;
  }>;
  estimatedTierLabel?: string;
  helperText?: string;
};

export type ArchCrmGridCell = {
  key: string;
  title: string;
  primary: string;
  preview: string;
  href: string;
};

export type ArchCrmInteractionGridViewModel = {
  cells: ArchCrmGridCell[];
};

export type ArchRenewalUpsellMode =
  | "renewal"
  | "upsell"
  | "renewal_and_upsell";

export type ArchRenewalUpsellViewModel = {
  visible: boolean;
  mode: ArchRenewalUpsellMode;
  headline: string;
  detail?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type ArchServiceTaskItem = {
  id: string;
  title: string;
  detail: string;
};

export type ArchServiceTasksViewModel = {
  enabled: boolean;
  mode: "seo_tasks" | "upsell";
  waitingApproval: ArchServiceTaskItem[];
  active: ArchServiceTaskItem[];
  upcoming: ArchServiceTaskItem[];
  upsellHeadline?: string;
  upsellDetail?: string;
};

export type ArchUpsellOpportunity = "seo" | "gbp" | "geo" | "website";

export type ArchOverviewViewModel = {
  clientName: string;
  siteUrl: string;
  serviceTier: string;
  lastUpdated: string;
  /** Portal-linked client has core chatbot/CRM service. TODO: tie to entitlements table. */
  hasChatbotService: boolean;
  /** Inferred from Smokey tier / signals until first-class flags exist. */
  hasSeoService: boolean;
  contractEndsAt: string | null;
  renewalWindowActive: boolean;
  upsellOpportunities: ArchUpsellOpportunity[];
  seoPyramid: ArchSeoPyramidViewModel;
  scoreCircles: ArchScoreCirclesViewModel;
  crmInteractionGrid: ArchCrmInteractionGridViewModel;
  renewalUpsell: ArchRenewalUpsellViewModel;
  serviceTasks: ArchServiceTasksViewModel;
  healthCard: ArchHealthCard;
  momentumCard: ArchMomentumCard;
  whatWeDidItems: ArchListItem[];
  whyItMattersItems: ArchListItem[];
  nextFocusItems: ArchListItem[];
  activityFeedItems: ArchListItem[];
  approvalItems: ArchListItem[];
  upcomingTaskItems: ArchListItem[];
  renewalItems: ArchListItem[];
};

export type ArchCrmActivitySegment =
  | "follow-up-calls"
  | "incoming-calls"
  | "meetings"
  | "bids";

export type ArchCrmDrillDownRow = {
  id: string;
  clientName: string;
  contactName: string;
  phone: string;
  email: string;
  location: string;
  serviceType: string;
  summaryNotes: string;
  followUpNotes: string;
  occurredAt: string | null;
};

export const ARCH_CRM_SEGMENTS: ArchCrmActivitySegment[] = [
  "follow-up-calls",
  "incoming-calls",
  "meetings",
  "bids",
];

export function isArchCrmActivitySegment(
  s: string
): s is ArchCrmActivitySegment {
  return ARCH_CRM_SEGMENTS.includes(s as ArchCrmActivitySegment);
}

export type ArchProgressViewModel = {
  healthCard: ArchHealthCard;
  improvements: ArchListItem[];
  laggingAreas: ArchListItem[];
  trustSignals: ArchListItem[];
  beforeAfter: ArchListItem[];
};

export type ArchActivityViewModel = {
  callsHandled: ArchListItem[];
  followUpEmails: ArchListItem[];
  crmUpdates: ArchListItem[];
  pendingItems: ArchListItem[];
  nextActions: ArchListItem[];
};

export type ArchActivityDrillDownViewModel = {
  segment: ArchCrmActivitySegment;
  segmentTitle: string;
  rows: ArchCrmDrillDownRow[];
};

