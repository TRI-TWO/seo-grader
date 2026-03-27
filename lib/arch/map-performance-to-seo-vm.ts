import type {
  ArchSeoPyramidLayerStatus,
  ArchSeoPyramidViewModel,
  ArchScoreCircleTone,
  ArchScoreCirclesViewModel,
} from "./client-types";

type SignalRow = {
  seo_health: string;
  content_velocity: string;
  paid_dependency: string;
  conversion_trend: string;
  source: string;
} | null;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function stringToLayerStatus(raw: string): ArchSeoPyramidLayerStatus {
  const s = norm(raw);
  if (!s) return "inactive";
  if (
    s.includes("good") ||
    s.includes("strong") ||
    s.includes("high") ||
    s.includes("excellent")
  ) {
    return "strong";
  }
  if (
    s.includes("warn") ||
    s.includes("moderate") ||
    s.includes("medium") ||
    s.includes("fair")
  ) {
    return "moderate";
  }
  if (
    s.includes("bad") ||
    s.includes("weak") ||
    s.includes("low") ||
    s.includes("critical") ||
    s.includes("poor")
  ) {
    return "weak";
  }
  return "moderate";
}

function statusToScore(st: ArchSeoPyramidLayerStatus, salt: number): number {
  const base =
    st === "strong" ? 92 : st === "moderate" ? 78 : st === "weak" ? 62 : 45;
  return Math.max(0, Math.min(100, base + salt));
}

function toneFromScore(score: number): ArchScoreCircleTone {
  if (score >= 85) return "good";
  if (score >= 70) return "warn";
  return "bad";
}

export function estimatedTierFromAverage(avg: number): string {
  if (avg >= 100) return "Page 1";
  if (avg >= 90) return "Page 2";
  if (avg >= 80) return "Page 3";
  return "Developing";
}

export function buildSeoPyramidVm(
  signal: SignalRow,
  enabled: boolean
): ArchSeoPyramidViewModel {
  if (!enabled) {
    return {
      enabled: false,
      title: "SEO foundation pyramid",
      subtitle:
        "Maslow-style layers show how crawl-to-click readiness stacks for search visibility.",
      layers: [
        { key: "crawl", label: "Crawlability", status: "inactive" },
        { key: "index", label: "Indexability", status: "inactive" },
        { key: "a11y", label: "Accessibility", status: "inactive" },
        { key: "rank", label: "Rankability", status: "inactive" },
        { key: "click", label: "Clickability", status: "inactive" },
      ],
    };
  }

  const crawlSt = stringToLayerStatus(signal?.content_velocity ?? "");
  const indexSt = stringToLayerStatus(signal?.paid_dependency ?? "");
  const a11ySt = stringToLayerStatus(signal?.conversion_trend ?? "");
  const rankSt = stringToLayerStatus(signal?.seo_health ?? "");

  const layers = [
    {
      key: "crawl",
      label: "Crawlability",
      status: crawlSt,
      score: statusToScore(crawlSt, -2),
      detail: signal?.content_velocity
        ? `Content velocity signal: ${signal.content_velocity}`
        : undefined,
    },
    {
      key: "index",
      label: "Indexability",
      status: indexSt,
      score: statusToScore(indexSt, 1),
      detail: signal?.paid_dependency
        ? `Dependence profile: ${signal.paid_dependency}`
        : undefined,
    },
    {
      key: "a11y",
      label: "Accessibility",
      status: a11ySt,
      score: statusToScore(a11ySt, -1),
      detail: signal?.conversion_trend
        ? `Experience trend: ${signal.conversion_trend}`
        : undefined,
    },
    {
      key: "rank",
      label: "Rankability",
      status: rankSt,
      score: statusToScore(rankSt, 2),
      detail: signal?.seo_health
        ? `SEO health signal: ${signal.seo_health}`
        : undefined,
    },
    {
      key: "click",
      label: "Clickability",
      status: stringToLayerStatus(signal?.seo_health ?? ""),
      score: statusToScore(
        stringToLayerStatus(signal?.seo_health ?? ""),
        -1
      ),
      detail:
        "Conversion readiness — tied to overall SEO health and on-page signals.",
    },
  ];

  return {
    enabled: true,
    title: "SEO foundation pyramid",
    subtitle:
      "A Maslow-style view of layered site health from crawl through conversion readiness.",
    layers,
  };
}

const SCORE_HELPER =
  "These scores reflect your current search readiness and visibility strength based on TRI-TWO scoring and connected search data. They are guidance, not a guarantee of rankings.";

export function buildScoreCirclesVm(
  signal: SignalRow,
  enabled: boolean
): ArchScoreCirclesViewModel {
  if (!enabled) {
    return {
      enabled: false,
      items: [],
      helperText: SCORE_HELPER,
    };
  }

  const perfSt = stringToLayerStatus(signal?.content_velocity ?? "");
  const a11ySt = stringToLayerStatus(signal?.conversion_trend ?? "");
  const bpSt = stringToLayerStatus(signal?.paid_dependency ?? "");
  const seoSt = stringToLayerStatus(signal?.seo_health ?? "");

  const items = [
    {
      key: "performance",
      label: "Performance",
      score: statusToScore(perfSt, 0),
      tone: toneFromScore(statusToScore(perfSt, 0)),
    },
    {
      key: "accessibility",
      label: "Accessibility",
      score: statusToScore(a11ySt, 3),
      tone: toneFromScore(statusToScore(a11ySt, 3)),
    },
    {
      key: "best-practices",
      label: "Best Practices",
      score: statusToScore(bpSt, -3),
      tone: toneFromScore(statusToScore(bpSt, -3)),
    },
    {
      key: "seo",
      label: "SEO",
      score: statusToScore(seoSt, 1),
      tone: toneFromScore(statusToScore(seoSt, 1)),
    },
  ];

  const avg =
    items.reduce((s, i) => s + i.score, 0) / Math.max(1, items.length);
  const tier = estimatedTierFromAverage(avg);

  return {
    enabled: true,
    items,
    estimatedTierLabel: `Estimated search position tier: ${tier}`,
    helperText: SCORE_HELPER,
  };
}
