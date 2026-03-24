import { prisma } from "@/lib/prisma";
import type {
  ArchDriver,
  ArchRecommendedAction,
  ArchSnapshotPayload,
} from "./types";

export async function upsertArchSnapshot(payload: ArchSnapshotPayload) {
  const {
    clientId,
    asOfDate,
    overallScore,
    categoryScores,
    topPositiveDrivers,
    topNegativeDrivers,
    recommendedActions,
  } = payload;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO arch_snapshots (
      client_id,
      as_of_date,
      overall_score,
      category_scores,
      top_positive_drivers,
      top_negative_drivers,
      recommended_actions
    )
    VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb)
    ON CONFLICT (client_id, as_of_date)
    DO UPDATE SET
      overall_score = EXCLUDED.overall_score,
      category_scores = EXCLUDED.category_scores,
      top_positive_drivers = EXCLUDED.top_positive_drivers,
      top_negative_drivers = EXCLUDED.top_negative_drivers,
      recommended_actions = EXCLUDED.recommended_actions,
      created_at = arch_snapshots.created_at
  `,
    clientId,
    asOfDate,
    overallScore,
    JSON.stringify(categoryScores),
    JSON.stringify(topPositiveDrivers),
    JSON.stringify(topNegativeDrivers),
    JSON.stringify(recommendedActions)
  );
}

export async function getLatestArchSnapshots(clientId: string, limit = 90) {
  const rows = await prisma.$queryRawUnsafe<
    {
      client_id: string;
      as_of_date: Date;
      overall_score: number;
      category_scores: any;
      top_positive_drivers: ArchDriver[];
      top_negative_drivers: ArchDriver[];
      recommended_actions: ArchRecommendedAction[];
      created_at: Date;
    }[]
  >(
    `
    SELECT
      client_id,
      as_of_date,
      overall_score,
      category_scores,
      top_positive_drivers,
      top_negative_drivers,
      recommended_actions,
      created_at
    FROM arch_snapshots
    WHERE client_id = $1
    ORDER BY as_of_date DESC
    LIMIT $2
  `,
    clientId,
    limit
  );

  return rows;
}

export async function getRecentArchEvents(clientId: string, limit = 50) {
  const rows = await prisma.$queryRawUnsafe<
    {
      id: string;
      client_id: string;
      event_type: string;
      severity: string;
      title: string;
      detail: string | null;
      as_of_date: Date;
      metadata: any;
      created_at: Date;
    }[]
  >(
    `
    SELECT
      id,
      client_id,
      event_type,
      severity,
      title,
      detail,
      as_of_date,
      metadata,
      created_at
    FROM arch_events
    WHERE client_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `,
    clientId,
    limit
  );

  return rows;
}

export async function maybeInsertArchEvent(
  clientId: string,
  asOfDate: string,
  previousScore: number | null,
  newScore: number
) {
  if (previousScore === null) return;

  const delta = newScore - previousScore;
  const absDelta = Math.abs(delta);

  if (absDelta < 5) return;

  const severity = absDelta >= 15 ? "critical" : absDelta >= 10 ? "warning" : "info";
  const title =
    delta >= 0
      ? `Health score improved by ${absDelta.toFixed(0)} points`
      : `Health score dropped by ${absDelta.toFixed(0)} points`;

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO arch_events (
      client_id,
      event_type,
      severity,
      title,
      detail,
      as_of_date,
      metadata
    )
    VALUES ($1, 'score_delta', $2, $3, NULL, $4, jsonb_build_object('delta', $5, 'previous', $6, 'current', $7))
  `,
    clientId,
    severity,
    title,
    asOfDate,
    delta,
    previousScore,
    newScore
  );
}

