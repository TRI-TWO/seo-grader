import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    FROM gbp_health_snapshots
    WHERE client_id = $1
    ORDER BY as_of_date DESC
    LIMIT 36
  `,
    clientId
  );

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    clientId,
    primaryCategory,
    secondaryCategories,
    reviewCount,
    averageRating,
    reviewVelocity30d,
    completenessScore,
    asOfDate,
  } = body;

  if (!clientId || !primaryCategory || !asOfDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO gbp_health_snapshots (
      client_id, primary_category, secondary_categories, review_count, average_rating, review_velocity_30d, completeness_score, as_of_date
    )
    VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::date)
    ON CONFLICT (client_id, as_of_date)
    DO UPDATE SET
      primary_category = EXCLUDED.primary_category,
      secondary_categories = EXCLUDED.secondary_categories,
      review_count = EXCLUDED.review_count,
      average_rating = EXCLUDED.average_rating,
      review_velocity_30d = EXCLUDED.review_velocity_30d,
      completeness_score = EXCLUDED.completeness_score
  `,
    clientId,
    primaryCategory,
    JSON.stringify(Array.isArray(secondaryCategories) ? secondaryCategories : []),
    Number(reviewCount ?? 0),
    Number(averageRating ?? 0),
    Number(reviewVelocity30d ?? 0),
    Number(completenessScore ?? 0),
    asOfDate
  );

  return NextResponse.json({ success: true });
}

