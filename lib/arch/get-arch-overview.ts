import { prisma } from "@/lib/prisma";
import { getCurrentUser, getClientForUser, requireCapability } from "@/lib/auth";
import { toArchOverviewViewModel } from "./transformers";

export async function getArchOverview() {
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
  const readinessRows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT readiness_status, readiness_score, as_of_date
    FROM readiness_assessments
    WHERE client_id = $1
    ORDER BY as_of_date DESC
    LIMIT 1
  `,
    client.id
  );

  const mapsRows = await prisma.$queryRawUnsafe<any[]>(
    `
    SELECT keyword, city, rank_position, as_of_date
    FROM maps_rank_snapshots
    WHERE client_id = $1
    ORDER BY as_of_date DESC
    LIMIT 3
  `,
    client.id
  );

  const vm = toArchOverviewViewModel(
    row,
    client.companyName || "Client",
    client.canonicalUrl,
    client.planTier
  );

  const latestReadiness = readinessRows[0];
  if (latestReadiness) {
    vm.nextFocusItems.unshift({
      title: `Readiness: ${latestReadiness.readiness_status}`,
      detail: `Current readiness score is ${latestReadiness.readiness_score}.`,
    });
  }

  const canSeeMaps = await requireCapability(user.id, "maps_tracking_visibility");
  const canSeeGeo = await requireCapability(user.id, "geo_visibility_features");

  if (canSeeMaps && mapsRows.length > 0) {
    vm.activityFeedItems.unshift({
      title: "Local Authority update",
      detail: `Captured ${mapsRows.length} recent maps ranking snapshots.`,
    });
  }

  if (!canSeeMaps) {
    vm.renewalItems.unshift({
      title: "Maps visibility reporting",
      detail: "Upgrade package to unlock local maps tracking visibility.",
    });
  }

  if (canSeeGeo) {
    vm.nextFocusItems.unshift({
      title: "GEO expansion lane",
      detail: "Advanced GEO visibility opportunities are available in your package.",
    });
  }

  return vm;
}

