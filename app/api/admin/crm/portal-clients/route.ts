import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail, requireAdmin } from "@/lib/auth";
import {
  createPortalClientAndInvite,
  listPortalClients,
} from "@/lib/admin/crm/portalClientService";
import { validateNewClientForm } from "@/lib/admin/crm/validation";
import type { NewPortalClientInput } from "@/lib/admin/crm/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || !isAdminEmail(admin.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const clients = await listPortalClients();
    return NextResponse.json({ clients });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to list clients";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

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

  const input = body as NewPortalClientInput;
  const v = validateNewClientForm(input);
  if (!v.ok) {
    return NextResponse.json({ error: "Validation failed", fieldErrors: v.fieldErrors }, { status: 400 });
  }

  try {
    const result = await createPortalClientAndInvite(input);
    const status = result.inviteEmailSent ? 201 : 200;
    return NextResponse.json({ ok: true, ...result }, { status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create client";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
