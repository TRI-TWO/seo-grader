import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scoreReadiness } from "@/lib/readiness/score";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT *
    FROM readiness_assessments
    WHERE client_id = $1
    ORDER BY as_of_date DESC
    LIMIT 24
  `,
    clientId
  );

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientId, asOfDate, loomUrl, top5Actions, recommendedTrack, inputs } = body;

  if (!clientId || !inputs || !asOfDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const scored = scoreReadiness(inputs);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO readiness_assessments (
      client_id, as_of_date, readiness_status, readiness_score, audit_scorecard_json, loom_url, top_5_actions, recommended_track, source_inputs_json
    )
    VALUES ($1, $2::date, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9::jsonb)
    ON CONFLICT (client_id, as_of_date)
    DO UPDATE SET
      readiness_status = EXCLUDED.readiness_status,
      readiness_score = EXCLUDED.readiness_score,
      audit_scorecard_json = EXCLUDED.audit_scorecard_json,
      loom_url = EXCLUDED.loom_url,
      top_5_actions = EXCLUDED.top_5_actions,
      recommended_track = EXCLUDED.recommended_track,
      source_inputs_json = EXCLUDED.source_inputs_json,
      updated_at = now()
  `,
    clientId,
    asOfDate,
    scored.readiness_status,
    scored.readiness_score,
    JSON.stringify(scored.audit_scorecard_json),
    loomUrl ?? null,
    JSON.stringify(Array.isArray(top5Actions) ? top5Actions : []),
    recommendedTrack ?? null,
    JSON.stringify(inputs)
  );

  return NextResponse.json({ success: true, scored });
}

