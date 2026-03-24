import { redirect } from "next/navigation";
import { getCurrentUser, getClientForUser, requireCapability } from "@/lib/auth";
import { computeArchScore } from "@/lib/arch/score";
import { getLatestArchSnapshots, getRecentArchEvents } from "@/lib/arch/snapshots";
import type { ArchStatusBand } from "@/lib/arch/types";
import { ArchHealthScoreHero } from "./components/ArchHealthScoreHero";
import { ArchCategoryScoreGrid } from "./components/ArchCategoryScoreGrid";
import { ArchDriversPanel } from "./components/ArchDriversPanel";
import { ArchRecommendedActions } from "./components/ArchRecommendedActions";
import { ArchEventsFeed } from "./components/ArchEventsFeed";
import { ArchTrendChart } from "./components/ArchTrendChart";

function toBand(score: number): ArchStatusBand {
  if (score >= 80) return "green";
  if (score >= 60) return "yellow";
  if (score >= 40) return "orange";
  return "red";
}

export default async function ArchDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const client = await getClientForUser(user);
  if (!client) {
    redirect("/");
  }

  const hasArchAccess = await requireCapability(user.id, "use_arch_dashboard");
  if (!hasArchAccess) {
    redirect("/"); // Paywall/upgrade flow can be wired here later
  }

  const today = new Date();
  const isoDate = today.toISOString().slice(0, 10);

  const snapshot = await computeArchScore(client.id, isoDate, {
    dryRun: false,
    maxDriversPerSide: 5,
  });

  const [recentSnapshots, events] = await Promise.all([
    getLatestArchSnapshots(client.id, 90),
    getRecentArchEvents(client.id, 50),
  ]);

  const previousSnapshot =
    recentSnapshots.length > 1 ? recentSnapshots[1] : null;
  const delta =
    previousSnapshot != null
      ? snapshot.overallScore - previousSnapshot.overall_score
      : null;

  const trendPoints = recentSnapshots
    .slice()
    .reverse()
    .map((row) => ({
      date: row.as_of_date.toISOString().slice(0, 10),
      score: row.overall_score,
    }));

  const windowLabel = `${Math.min(trendPoints.length, 90)} day trend`;

  const band = toBand(snapshot.overallScore);

  return (
    <main className="min-h-[calc(100vh-200px)] px-6 py-12">
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-4xl font-bold text-white mb-2">Arch</h1>
          <p className="text-gray-400 text-sm">
            SEO & growth health dashboard for {client.companyName ?? "this client"}.
          </p>
          <p className="text-cool-ash mt-1 text-sm">
            Daily health snapshots, category scores, and explainable drivers.
          </p>
        </header>

        <ArchHealthScoreHero score={snapshot.overallScore} band={band} delta={delta} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ArchCategoryScoreGrid categoryScores={snapshot.categoryScores} />
            <ArchDriversPanel
              positiveDrivers={snapshot.topPositiveDrivers}
              negativeDrivers={snapshot.topNegativeDrivers}
            />
            <ArchRecommendedActions actions={snapshot.recommendedActions} />
          </div>
          <div className="space-y-6">
            <ArchTrendChart points={trendPoints} windowLabel={windowLabel} />
            <ArchEventsFeed
              events={events.map((e) => ({
                id: e.id,
                event_type: e.event_type,
                severity: e.severity,
                title: e.title,
                detail: e.detail,
                as_of_date: e.as_of_date.toISOString().slice(0, 10),
                created_at: e.created_at.toISOString(),
              }))}
            />
          </div>
        </div>
      </div>
    </main>
  );
}


