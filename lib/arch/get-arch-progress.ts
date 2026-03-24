import { prisma } from "@/lib/prisma";
import { getCurrentUser, getClientForUser } from "@/lib/auth";
import { toArchProgressViewModel } from "./transformers";

export async function getArchProgress() {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClientForUser(user);
  if (!client) return null;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT *
    FROM arch_client_outputs
    WHERE client_id = $1
    ORDER BY month_key DESC, updated_at DESC
    LIMIT 1
  `,
    client.id
  );

  const row = rows.length > 0 ? rows[0] : null;
  return toArchProgressViewModel(row);
}

