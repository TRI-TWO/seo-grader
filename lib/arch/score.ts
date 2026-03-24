import { prisma } from "@/lib/prisma";
import type {
  ArchCategory,
  ArchSignal,
  ArchRule,
  ArchSignalValue,
  ArchCategoryScores,
  ArchComputeOptions,
  ArchDriver,
  ArchRecommendedAction,
  ArchSnapshotPayload,
  ArchStatusBand,
} from "./types";
import { evaluateRulesForSignal } from "./rules";
import { upsertArchSnapshot, getLatestArchSnapshots, maybeInsertArchEvent } from "./snapshots";

interface LoadedArchConfig {
  categories: ArchCategory[];
  signals: ArchSignal[];
  rules: ArchRule[];
}

function toBand(score: number): ArchStatusBand {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

async function loadArchConfig(clientId: string): Promise<LoadedArchConfig> {
  const [categories, signals, rules] = await Promise.all([
    prisma.$queryRawUnsafe<ArchCategory[]>(
      `
      SELECT *
      FROM arch_categories
      WHERE client_id = $1
      AND is_enabled = true
      ORDER BY sort_order ASC, label ASC
    `,
      clientId
    ),
    prisma.$queryRawUnsafe<ArchSignal[]>(
      `
      SELECT *
      FROM arch_signals
      WHERE client_id = $1
      AND is_enabled = true
    `,
      clientId
    ),
    prisma.$queryRawUnsafe<ArchRule[]>(
      `
      SELECT *
      FROM arch_rules
      WHERE client_id = $1
      AND is_enabled = true
    `,
      clientId
    ),
  ]);

  return { categories, signals, rules };
}

async function loadSignalValuesForDate(
  clientId: string,
  asOfDate: string
): Promise<ArchSignalValue[]> {
  const rows = await prisma.$queryRawUnsafe<ArchSignalValue[]>(
    `
    SELECT *
    FROM arch_signal_values
    WHERE client_id = $1
      AND as_of_date = $2::date
  `,
    clientId,
    asOfDate
  );

  return rows;
}

export async function computeArchScore(
  clientId: string,
  asOfDate: string,
  options: ArchComputeOptions = {}
) {
  const { categories, signals, rules } = await loadArchConfig(clientId);
  const values = await loadSignalValuesForDate(clientId, asOfDate);

  if (categories.length === 0 || signals.length === 0 || values.length === 0) {
    const emptyPayload: ArchSnapshotPayload = {
      clientId,
      asOfDate,
      overallScore: 0,
      categoryScores: {},
      topPositiveDrivers: [],
      topNegativeDrivers: [],
      recommendedActions: [],
    };

    if (!options.dryRun) {
      await upsertArchSnapshot(emptyPayload);
    }

    return emptyPayload;
  }

  const signalById = new Map<string, ArchSignal>();
  signals.forEach((s) => signalById.set(s.id, s));

  const categoryById = new Map<string, ArchCategory>();
  const categoryByKey = new Map<string, ArchCategory>();
  categories.forEach((c) => {
    categoryById.set(c.id, c);
    categoryByKey.set(c.key, c);
  });

  const rulesBySignalId = new Map<string, ArchRule[]>();
  for (const rule of rules) {
    const arr = rulesBySignalId.get(rule.signal_id) || [];
    arr.push(rule);
    rulesBySignalId.set(rule.signal_id, arr);
  }

  const categoryTotals = new Map<string, number>();
  const categoryWeights = new Map<string, number>();
  const drivers: ArchDriver[] = [];
  const recommendedActions: ArchRecommendedAction[] = [];

  for (const category of categories) {
    categoryTotals.set(category.key, 0);
    categoryWeights.set(category.key, category.weight || 1);
  }

  for (const value of values) {
    const signal = signalById.get(value.signal_id);
    if (!signal) continue;

    const category = categoryById.get(signal.category_id);
    if (!category) continue;

    const signalRules = rulesBySignalId.get(signal.id) || [];
    if (signalRules.length === 0) continue;

    const evaluated = evaluateRulesForSignal(signalRules, value.value);

    let totalPointsForSignal = 0;

    for (const { rule, matched } of evaluated) {
      if (!matched) continue;

      totalPointsForSignal += rule.points;

      const driver: ArchDriver = {
        signalId: signal.id,
        signalKey: signal.key,
        signalLabel: signal.label,
        categoryId: category.id,
        categoryKey: category.key,
        categoryLabel: category.label,
        points: rule.points,
        message: rule.message,
        severity: rule.severity,
      };
      drivers.push(driver);

      if (rule.action_title) {
        recommendedActions.push({
          title: rule.action_title,
          detail: rule.action_detail,
          categoryKey: category.key,
          categoryLabel: category.label,
          signalKey: signal.key,
          signalLabel: signal.label,
          severity: rule.severity,
        });
      }
    }

    if (totalPointsForSignal !== 0) {
      const categoryKey = category.key;
      const current = categoryTotals.get(categoryKey) || 0;
      const weightedContribution = totalPointsForSignal * (signal.weight || 1);
      categoryTotals.set(categoryKey, current + weightedContribution);
    }
  }

  const categoryScores: ArchCategoryScores = {};
  let weightedSum = 0;
  let totalCategoryWeight = 0;

  for (const category of categories) {
    const totalPoints = categoryTotals.get(category.key) || 0;

    const clamped = Math.max(0, Math.min(100, 50 + totalPoints));
    const band = toBand(clamped);

    categoryScores[category.key] = {
      score: clamped,
      band,
    };

    const w = category.weight || 1;
    weightedSum += clamped * w;
    totalCategoryWeight += w;
  }

  const overallScore =
    totalCategoryWeight > 0 ? Math.round(weightedSum / totalCategoryWeight) : 0;

  const sortedDrivers = [...drivers].sort(
    (a, b) => Math.abs(b.points) - Math.abs(a.points)
  );

  const maxDriversPerSide = options.maxDriversPerSide ?? 5;
  const positiveDrivers: ArchDriver[] = [];
  const negativeDrivers: ArchDriver[] = [];

  for (const d of sortedDrivers) {
    if (d.points > 0 && positiveDrivers.length < maxDriversPerSide) {
      positiveDrivers.push(d);
    } else if (d.points < 0 && negativeDrivers.length < maxDriversPerSide) {
      negativeDrivers.push(d);
    }

    if (
      positiveDrivers.length >= maxDriversPerSide &&
      negativeDrivers.length >= maxDriversPerSide
    ) {
      break;
    }
  }

  const snapshotPayload: ArchSnapshotPayload = {
    clientId,
    asOfDate,
    overallScore,
    categoryScores,
    topPositiveDrivers: positiveDrivers,
    topNegativeDrivers: negativeDrivers,
    recommendedActions,
  };

  if (!options.dryRun) {
    const recentSnapshots = await getLatestArchSnapshots(clientId, 1);
    const previousScore =
      recentSnapshots.length > 0 ? recentSnapshots[0].overall_score : null;

    await upsertArchSnapshot(snapshotPayload);
    await maybeInsertArchEvent(clientId, asOfDate, previousScore, overallScore);
  }

  return snapshotPayload;
}

