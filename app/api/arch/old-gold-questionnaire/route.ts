import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, getClientForUser } from "@/lib/auth";
import { buildFinalPayload, envelopeFromDbJson } from "@/lib/arch/oldGoldQuestionnaire/mappers";
import {
  loadQuestionnaireByClientId,
  saveQuestionnaireDraft,
  submitQuestionnaire,
} from "@/lib/arch/oldGoldQuestionnaire/repository";
import type { QuestionnaireDraftEnvelope } from "@/lib/arch/oldGoldQuestionnaire/types";
import { validateAllSteps } from "@/lib/arch/oldGoldQuestionnaire/validation";
import { updatePortalQuestionnaireStatus } from "@/lib/admin/crm/portalClientService";

async function assertOwnsClient(clientId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const client = await getClientForUser(user);
  if (!client || client.id !== clientId) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, user, client };
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  const gate = await assertOwnsClient(clientId);
  if (!gate.ok) return gate.response;

  const row = await loadQuestionnaireByClientId(clientId);
  if (!row) {
    return NextResponse.json({ found: false, status: null, draft: null, final: null });
  }

  const draft = envelopeFromDbJson(row.draft_payload);
  return NextResponse.json({
    found: true,
    status: row.status,
    draft,
    final: row.final_payload,
    completed_at: row.completed_at,
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as {
    mode?: string;
    clientId?: string;
    envelope?: QuestionnaireDraftEnvelope;
  };

  if (!b.clientId || typeof b.clientId !== "string") {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }

  const gate = await assertOwnsClient(b.clientId);
  if (!gate.ok) return gate.response;

  if (b.mode === "draft") {
    if (!b.envelope || b.envelope.version !== 1) {
      return NextResponse.json({ error: "Invalid envelope" }, { status: 400 });
    }
    await saveQuestionnaireDraft(b.clientId, b.envelope as object);
    await updatePortalQuestionnaireStatus(b.clientId, "in_progress").catch(() => {});
    return NextResponse.json({ ok: true });
  }

  if (b.mode === "submit") {
    if (!b.envelope || b.envelope.version !== 1) {
      return NextResponse.json({ error: "Invalid envelope" }, { status: 400 });
    }
    const env = b.envelope;
    const v = validateAllSteps({
      data: env.data,
      wizardServiceAnswers: env.wizardServiceAnswers,
      customServices: env.customServices,
    });
    if (!v.ok) {
      return NextResponse.json(
        { error: "Validation failed", validation: v },
        { status: 400 }
      );
    }
    const final = buildFinalPayload(env.data, env.wizardServiceAnswers, env.customServices);
    await submitQuestionnaire(b.clientId, final as object);
    await updatePortalQuestionnaireStatus(b.clientId, "completed").catch(() => {});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}
