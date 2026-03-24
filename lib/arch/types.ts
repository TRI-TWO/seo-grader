export type ArchStatusBand = "green" | "yellow" | "orange" | "red";

export interface ArchCategory {
  id: string;
  client_id: string;
  key: string;
  label: string;
  weight: number;
  sort_order: number;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArchSignal {
  id: string;
  client_id: string;
  category_id: string;
  key: string;
  label: string;
  weight: number;
  direction: "higher_is_better" | "lower_is_better";
  unit: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type ArchRuleType = "threshold";

export interface ArchRule {
  id: string;
  client_id: string;
  signal_id: string;
  rule_type: ArchRuleType;
  operator: string;
  threshold: number;
  points: number;
  message: string;
  action_title: string | null;
  action_detail: string | null;
  severity: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArchSignalValue {
  id: string;
  client_id: string;
  signal_id: string;
  as_of_date: string;
  value: number;
  source: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ArchDriver {
  signalId: string;
  signalKey: string;
  signalLabel: string;
  categoryId: string;
  categoryKey: string;
  categoryLabel: string;
  points: number;
  message: string;
  severity: string;
}

export interface ArchRecommendedAction {
  title: string;
  detail: string | null;
  categoryKey: string;
  categoryLabel: string;
  signalKey: string;
  signalLabel: string;
  severity: string;
}

export interface ArchCategoryScores {
  [categoryKey: string]: {
    score: number;
    band: ArchStatusBand;
  };
}

export interface ArchSnapshotPayload {
  clientId: string;
  asOfDate: string;
  overallScore: number;
  categoryScores: ArchCategoryScores;
  topPositiveDrivers: ArchDriver[];
  topNegativeDrivers: ArchDriver[];
  recommendedActions: ArchRecommendedAction[];
}

export interface ArchComputeOptions {
  dryRun?: boolean;
  maxDriversPerSide?: number;
}

