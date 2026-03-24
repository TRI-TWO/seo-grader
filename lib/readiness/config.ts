export const READINESS_WEIGHTS = {
  indexation_crawl: 20,
  maps_gbp: 25,
  onpage_hub_structure: 20,
  conversion_trust: 15,
  reviews_reputation: 10,
  performance_mobile: 10,
} as const;

export type ReadinessCategoryKey = keyof typeof READINESS_WEIGHTS;

export const READINESS_LABELS: Record<ReadinessCategoryKey, string> = {
  indexation_crawl: "Indexation & Crawl Health",
  maps_gbp: "Google Maps / GBP Health",
  onpage_hub_structure: "On-Page & Hub Structure",
  conversion_trust: "Conversion Path & Trust",
  reviews_reputation: "Reviews & Reputation",
  performance_mobile: "Performance (Mobile PSI)",
};

