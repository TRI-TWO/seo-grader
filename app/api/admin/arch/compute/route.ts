import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { computeArchScore } from "@/lib/arch/score";

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, asOfDate, dryRun } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId is required" },
        { status: 400 }
      );
    }

    const date = typeof asOfDate === "string" && asOfDate.length > 0
      ? asOfDate
      : new Date().toISOString().slice(0, 10);

    const snapshot = await computeArchScore(clientId, date, {
      dryRun: dryRun !== false ? true : false,
      maxDriversPerSide: 5,
    });

    return NextResponse.json({ snapshot });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to compute Arch score" },
      { status: 500 }
    );
  }
}

