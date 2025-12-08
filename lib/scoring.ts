export type ScoreStatus = "good" | "warn" | "bad";

export type TitleMetrics = {
  title: string;
  hasTitleTag: boolean;
  bodyKeywords: string[];
  hasLocalityInTitle: boolean;
  hasLocalityInBodyOnly: boolean;
  hasStrongServiceKeyword: boolean;
  hasWeakServiceKeyword: boolean;
  semanticExactOverlapCount: number;
  semanticFuzzyOverlapCount: number;
};

export type MediaMetrics = {
  totalImages: number;
  imagesWithAlt: number;
  badFilenameCount: number;
  ogTitlePresent: boolean;
  ogDescriptionPresent: boolean;
};

export type TitleScoreBreakdown = {
  raw: number;
  score10: number;
  status: ScoreStatus;
  localityPoints: number;
  serviceKeywordPoints: number;
  semanticPoints: number;
  lengthPoints: number;
  separatorPoints: number;
  presencePoints: number;
};

export type MediaScoreBreakdown = {
  raw: number;
  score10: number;
  status: ScoreStatus;
  altCoveragePoints: number;
  filenamePoints: number;
  metadataPoints: number;
  imageCountPoints: number;
};

export type TitleConfig = {
  weights: {
    locality: number;
    serviceKeyword: number;
    semantic: number;
    length: number;
    separator: number;
    presence: number;
  };
  length: {
    idealMin: number;
    idealMax: number;
    softMin: number;
    softMax: number;
  };
  serviceKeywordsStrong: string[];
  serviceKeywordsWeak: string[];
  semantic: {
    minExactOverlap: number;
    minFuzzyOverlap: number;
  };
  structure: {
    separators: string[];
  };
};

export type MediaConfig = {
  weights: {
    altCoverage: number;
    filenameQuality: number;
    metadata: number;
    imageCount: number;
  };
  altCoverageThresholds: {
    green: number;
    yellow: number;
  };
  badFilenameYellowMaxRatio: number;
  imageCount: {
    greenMin: number;
    yellowMin: number;
  };
};

export type StatusBuckets = {
  goodMin: number;
  warnMin: number;
};

export type ScoringConfig = {
  statusBuckets: StatusBuckets;
  title: TitleConfig;
  media: MediaConfig;
};

const toStatus = (raw: number, buckets: StatusBuckets): ScoreStatus => {
  if (raw >= buckets.goodMin) return "good";
  if (raw >= buckets.warnMin) return "warn";
  return "bad";
};

export const scoreTitle = (
  metrics: TitleMetrics,
  cfg: ScoringConfig
): TitleScoreBreakdown => {
  const { title, hasTitleTag } = metrics;
  const { title: tCfg, statusBuckets } = cfg;

  if (!hasTitleTag || !title.trim()) {
    return {
      raw: 0,
      score10: 0,
      status: "bad",
      localityPoints: 0,
      serviceKeywordPoints: 0,
      semanticPoints: 0,
      lengthPoints: 0,
      separatorPoints: 0,
      presencePoints: 0
    };
  }

  let localityPoints = 0;
  if (metrics.hasLocalityInTitle) localityPoints = tCfg.weights.locality;
  else if (metrics.hasLocalityInBodyOnly)
    localityPoints = Math.round(tCfg.weights.locality * 0.4);

  let serviceKeywordPoints = 0;
  if (metrics.hasStrongServiceKeyword) {
    serviceKeywordPoints = tCfg.weights.serviceKeyword;
  } else if (metrics.hasWeakServiceKeyword) {
    serviceKeywordPoints = Math.round(tCfg.weights.serviceKeyword * 0.4);
  }

  let semanticPoints = 0;
  if (metrics.semanticExactOverlapCount >= tCfg.semantic.minExactOverlap) {
    semanticPoints = tCfg.weights.semantic;
  } else if (
    metrics.semanticFuzzyOverlapCount >= tCfg.semantic.minFuzzyOverlap
  ) {
    semanticPoints = Math.round(tCfg.weights.semantic * 0.5);
  }

  const len = title.length;
  let lengthPoints = 0;
  if (len >= tCfg.length.idealMin && len <= tCfg.length.idealMax) {
    lengthPoints = tCfg.weights.length;
  } else if (
    (len >= tCfg.length.softMin && len < tCfg.length.idealMin) ||
    (len > tCfg.length.idealMax && len <= tCfg.length.softMax)
  ) {
    lengthPoints = Math.round(tCfg.weights.length * 0.33);
  }

  let separatorPoints = 0;
  if (tCfg.structure.separators.some((sep) => title.includes(sep))) {
    separatorPoints = tCfg.weights.separator;
  }

  const presencePoints = hasTitleTag ? tCfg.weights.presence : 0;

  const raw =
    localityPoints +
    serviceKeywordPoints +
    semanticPoints +
    lengthPoints +
    separatorPoints +
    presencePoints;

  const clamped = Math.max(0, Math.min(100, raw));
  const score10 = Math.round(clamped / 10);
  const status = toStatus(clamped, statusBuckets);

  return {
    raw: clamped,
    score10,
    status,
    localityPoints,
    serviceKeywordPoints,
    semanticPoints,
    lengthPoints,
    separatorPoints,
    presencePoints
  };
};

export const scoreMedia = (
  metrics: MediaMetrics,
  cfg: ScoringConfig
): MediaScoreBreakdown => {
  const { media: mCfg, statusBuckets } = cfg;

  const { totalImages, imagesWithAlt, badFilenameCount } = metrics;

  let altCoveragePoints = 0;
  if (totalImages === 0) {
    altCoveragePoints = Math.round(mCfg.weights.altCoverage * 0.5);
  } else {
    const coverage = imagesWithAlt / totalImages;
    if (coverage >= mCfg.altCoverageThresholds.green) {
      altCoveragePoints = mCfg.weights.altCoverage;
    } else if (coverage >= mCfg.altCoverageThresholds.yellow) {
      altCoveragePoints = Math.round(mCfg.weights.altCoverage * 0.5);
    }
  }

  let filenamePoints = 0;
  if (totalImages === 0) {
    filenamePoints = Math.round(mCfg.weights.filenameQuality * 0.5);
  } else {
    const badRatio = badFilenameCount / totalImages;
    if (badRatio === 0) {
      filenamePoints = mCfg.weights.filenameQuality;
    } else if (badRatio <= mCfg.badFilenameYellowMaxRatio) {
      filenamePoints = Math.round(mCfg.weights.filenameQuality * 0.5);
    }
  }

  let metadataPoints = 0;
  const hasAnyMeta = metrics.ogTitlePresent || metrics.ogDescriptionPresent;
  const hasBothMeta = metrics.ogTitlePresent && metrics.ogDescriptionPresent;
  if (hasBothMeta) {
    metadataPoints = mCfg.weights.metadata;
  } else if (hasAnyMeta) {
    metadataPoints = Math.round(mCfg.weights.metadata * 0.5);
  }

  let imageCountPoints = 0;
  if (totalImages >= mCfg.imageCount.greenMin) {
    imageCountPoints = mCfg.weights.imageCount;
  } else if (totalImages >= mCfg.imageCount.yellowMin) {
    imageCountPoints = Math.round(mCfg.weights.imageCount * 0.5);
  }

  const raw =
    altCoveragePoints + filenamePoints + metadataPoints + imageCountPoints;

  const clamped = Math.max(0, Math.min(100, raw));
  const score10 = Math.round(clamped / 10);
  const status = toStatus(clamped, statusBuckets);

  return {
    raw: clamped,
    score10,
    status,
    altCoveragePoints,
    filenamePoints,
    metadataPoints,
    imageCountPoints
  };
};

