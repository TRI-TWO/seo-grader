import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLatestArchSnapshots } from "@/lib/arch/snapshots";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 }
    );
  }

  try {
    const [client, categories, signals, rules, snapshots] = await Promise.all([
      prisma.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          companyName: true,
          canonicalUrl: true,
          planTier: true,
          status: true,
        },
      }),
      prisma.$queryRawUnsafe<any[]>(
        `
        SELECT *
        FROM arch_categories
        WHERE client_id = $1
        ORDER BY sort_order ASC, label ASC
      `,
        clientId
      ),
      prisma.$queryRawUnsafe<any[]>(
        `
        SELECT *
        FROM arch_signals
        WHERE client_id = $1
        ORDER BY label ASC
      `,
        clientId
      ),
      prisma.$queryRawUnsafe<any[]>(
        `
        SELECT *
        FROM arch_rules
        WHERE client_id = $1
        ORDER BY created_at ASC
      `,
        clientId
      ),
      getLatestArchSnapshots(clientId, 1),
    ]);

    return NextResponse.json({
      client,
      categories,
      signals,
      rules,
      latestSnapshot: snapshots[0] ?? null,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load Arch configuration" },
      { status: 500 }
    );
  }
}

