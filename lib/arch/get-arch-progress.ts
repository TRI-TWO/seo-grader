import { prisma } from "@/lib/prisma";
import { getCurrentUser, getClientForUser } from "@/lib/auth";
import type { ArchProgressViewModel } from "./client-types";

function statusFromSeoHealth(
  raw: string | undefined
): ArchProgressViewModel["healthCard"]["status"] {
  if (raw === "good") return "good";
  if (raw === "warning") return "warning";
  return "critical";
}

/**
 * Progress view backed by `public.client_performance_signals` (authoritative platform data).
 * Legacy `arch_client_outputs` is not used when absent from the database.
 */
export async function getArchProgress(): Promise<ArchProgressViewModel | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClientForUser(user);
  if (!client) return null;

  const signal = await prisma.client_performance_signals.findFirst({
    where: { client_id: client.id },
    orderBy: { created_at: "desc" },
  });

  const status = statusFromSeoHealth(signal?.seo_health);
  const summary =
    status === "good"
      ? "Overall trajectory looks solid."
      : status === "warning"
        ? "A few areas need focused work."
        : "We are prioritizing fixes to stabilize performance.";

  return {
    healthCard: {
      score: 0,
      status,
      direction: "flat",
      summary,
    },
    improvements: signal
      ? [
          {
            title: "SEO health",
            detail: `Latest assessment: ${signal.seo_health}.`,
          },
          {
            title: "Content velocity",
            detail: `Current pace: ${signal.content_velocity}.`,
          },
        ]
      : [],
    laggingAreas: signal
      ? [
          {
            title: "Paid dependency",
            detail: signal.paid_dependency,
          },
        ]
      : [],
    trustSignals: signal
      ? [
          {
            title: "Conversion trend",
            detail: signal.conversion_trend,
          },
        ]
      : [],
    beforeAfter: [
      {
        title: "Reporting basis",
        detail: signal
          ? `Signals refreshed from source: ${signal.source}.`
          : "No performance signal rows yet for this client.",
      },
    ],
  };
}
