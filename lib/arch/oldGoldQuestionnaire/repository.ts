import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type OldGoldQuestionnaireRow = {
  id: string;
  client_id: string;
  status: string;
  draft_payload: Prisma.JsonValue;
  final_payload: Prisma.JsonValue | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export async function loadQuestionnaireByClientId(
  clientId: string
): Promise<OldGoldQuestionnaireRow | null> {
  const row = await prisma.old_gold_client_questionnaires.findUnique({
    where: { client_id: clientId },
  });
  return row;
}

export async function saveQuestionnaireDraft(
  clientId: string,
  draftPayload: Prisma.InputJsonValue
): Promise<OldGoldQuestionnaireRow> {
  return prisma.old_gold_client_questionnaires.upsert({
    where: { client_id: clientId },
    create: {
      client_id: clientId,
      status: "draft",
      draft_payload: draftPayload,
    },
    update: {
      status: "draft",
      draft_payload: draftPayload,
    },
  });
}

export async function submitQuestionnaire(
  clientId: string,
  finalPayload: Prisma.InputJsonValue
): Promise<OldGoldQuestionnaireRow> {
  return prisma.old_gold_client_questionnaires.upsert({
    where: { client_id: clientId },
    create: {
      client_id: clientId,
      status: "completed",
      draft_payload: {},
      final_payload: finalPayload,
      completed_at: new Date(),
    },
    update: {
      status: "completed",
      final_payload: finalPayload,
      completed_at: new Date(),
    },
  });
}
