import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth";
import { softDeletePortalClients } from "@/lib/admin/crm/portalClientService";
import { validateClientDeleteSelection } from "@/lib/admin/crm/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin || !isAdminEmail(admin.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientIds = (body as { clientIds?: string[] }).clientIds;
  if (!Array.isArray(clientIds)) {
    return NextResponse.json({ error: "clientIds array required" }, { status: 400 });
  }

  const v = validateClientDeleteSelection(clientIds);
  if (!v.ok) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: v.fieldErrors }, { status: 400 });
  }

  try {
    const summary = await softDeletePortalClients(clientIds);
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to remove clients";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
