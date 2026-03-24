import { READINESS_LABELS, READINESS_WEIGHTS, type ReadinessCategoryKey } from "./config";

export type ReadinessStatus = "NOT_READY" | "CONDITIONAL" | "READY";

export type ReadinessInput = Record<ReadinessCategoryKey, number> & {
  indexingIssuesCritical?: boolean;
  gbpBroken?: boolean;
  noClearConversionPath?: boolean;
  weakHubs?: boolean;
  poorReviews?: boolean;
  thinContent?: boolean;
};

export type ReadinessResult = {
  readiness_status: ReadinessStatus;
  readiness_score: number;
  audit_scorecard_json: Record<
    ReadinessCategoryKey,
    { label: string; score: number; weight: number; contribution: number }
  >;
};

function clamp(input: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, input));
}

export function scoreReadiness(input: ReadinessInput): ReadinessResult {
  const scorecard = {} as ReadinessResult["audit_scorecard_json"];
  let weightedTotal = 0;

  (Object.keys(READINESS_WEIGHTS) as ReadinessCategoryKey[]).forEach((key) => {
    const weight = READINESS_WEIGHTS[key];
    const score = clamp(Number(input[key] ?? 0));
    const contribution = (score * weight) / 100;
    scorecard[key] = {
      label: READINESS_LABELS[key],
      score,
      weight,
      contribution,
    };
    weightedTotal += contribution;
  });

  const readiness_score = Math.round(clamp(weightedTotal));

  let readiness_status: ReadinessStatus = "READY";

  if (input.indexingIssuesCritical || input.gbpBroken || input.noClearConversionPath) {
    readiness_status = "NOT_READY";
  } else if (input.weakHubs || input.poorReviews || input.thinContent || readiness_score < 70) {
    readiness_status = "CONDITIONAL";
  }

  return {
    readiness_status,
    readiness_score,
    audit_scorecard_json: scorecard,
  };
}

