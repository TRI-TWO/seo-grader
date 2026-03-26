import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    FROM maps_rank_snapshots
    WHERE client_id = $1
    ORDER BY as_of_date DESC, keyword ASC
    LIMIT 100
  `,
    clientId
  );

  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { clientId, keyword, city, rankPosition, asOfDate, notes } = body;
  if (!clientId || !keyword || !city || !rankPosition || !asOfDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO maps_rank_snapshots (client_id, keyword, city, rank_position, as_of_date, notes)
    VALUES ($1, $2, $3, $4, $5::date, $6)
    ON CONFLICT (client_id, keyword, city, as_of_date)
    DO UPDATE SET rank_position = EXCLUDED.rank_position, notes = EXCLUDED.notes
  `,
    clientId,
    keyword,
    city,
    Number(rankPosition),
    asOfDate,
    notes ?? null
  );

  return NextResponse.json({ success: true });
}

