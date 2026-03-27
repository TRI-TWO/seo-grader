import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    const [client, site, signal] = await Promise.all([
      prisma.clients.findUnique({
        where: { id: clientId },
        select: { id: true, name: true, website_url: true, org_id: true },
      }),
      prisma.sites.findFirst({
        where: { client_id: clientId },
        orderBy: { created_at: "desc" },
        select: { id: true, canonical_url: true, display_name: true },
      }),
      prisma.client_performance_signals.findFirst({
        where: { client_id: clientId },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return NextResponse.json({ client, site, latestSignal: signal ?? null });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to load Arch configuration" },
      { status: 500 }
    );
  }
}

