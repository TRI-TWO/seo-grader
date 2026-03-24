import type { ArchCategory, ArchSignal } from "./types";

export const DEFAULT_ARCH_CATEGORIES: Pick<
  ArchCategory,
  "key" | "label" | "weight" | "sort_order" | "is_enabled"
>[] = [
  {
    key: "technical_seo",
    label: "Technical SEO",
    weight: 1,
    sort_order: 0,
    is_enabled: true,
  },
  {
    key: "content",
    label: "Content",
    weight: 1,
    sort_order: 1,
    is_enabled: true,
  },
  {
    key: "authority",
    label: "Authority",
    weight: 1,
    sort_order: 2,
    is_enabled: true,
  },
  {
    key: "performance",
    label: "Performance",
    weight: 1,
    sort_order: 3,
    is_enabled: true,
  },
  {
    key: "conversion",
    label: "Conversion",
    weight: 1,
    sort_order: 4,
    is_enabled: true,
  },
  {
    key: "analytics_integrity",
    label: "Analytics Integrity",
    weight: 1,
    sort_order: 5,
    is_enabled: true,
  },
];

export const DEFAULT_ARCH_SIGNALS: Pick<
  ArchSignal,
  "key" | "label" | "weight" | "direction" | "unit" | "is_enabled"
>[] = [
  {
    key: "core_web_vitals_status",
    label: "Core Web Vitals status",
    weight: 1,
    direction: "higher_is_better",
    unit: null,
    is_enabled: true,
  },
  {
    key: "index_coverage",
    label: "Index coverage",
    weight: 1,
    direction: "higher_is_better",
    unit: "percent",
    is_enabled: true,
  },
  {
    key: "crawl_errors",
    label: "Crawl errors",
    weight: 1,
    direction: "lower_is_better",
    unit: "count",
    is_enabled: true,
  },
  {
    key: "organic_traffic_trend",
    label: "Organic traffic trend",
    weight: 1,
    direction: "higher_is_better",
    unit: "percent",
    is_enabled: true,
  },
  {
    key: "ranking_momentum",
    label: "Ranking momentum",
    weight: 1,
    direction: "higher_is_better",
    unit: "percent",
    is_enabled: true,
  },
  {
    key: "content_freshness",
    label: "Content freshness",
    weight: 1,
    direction: "higher_is_better",
    unit: "days",
    is_enabled: true,
  },
  {
    key: "backlink_velocity",
    label: "Backlink velocity",
    weight: 1,
    direction: "higher_is_better",
    unit: "count",
    is_enabled: true,
  },
  {
    key: "organic_conversion_rate",
    label: "Conversion rate from organic",
    weight: 1,
    direction: "higher_is_better",
    unit: "percent",
    is_enabled: true,
  },
  {
    key: "analytics_connections",
    label: "GA4/GSC connection status",
    weight: 1,
    direction: "higher_is_better",
    unit: null,
    is_enabled: true,
  },
];

