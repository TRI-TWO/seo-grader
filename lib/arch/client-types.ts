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

export type ArchOverviewViewModel = {
  clientName: string;
  siteUrl: string;
  serviceTier: string;
  lastUpdated: string;
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

