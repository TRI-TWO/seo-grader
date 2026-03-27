import { ArchDashboardSurface } from "./arch-dashboard-surface";

type Props = {
  clientName: string;
  siteUrl: string;
  lastUpdatedLabel: string;
};

export function ArchOverviewBrandBlock({
  clientName,
  siteUrl,
  lastUpdatedLabel,
}: Props) {
  return (
    <ArchDashboardSurface className="p-6">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-400/90">
        TRI-TWO
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
        {clientName}
      </h2>
      {siteUrl ? (
        <p className="mt-1 truncate text-sm text-cyan-200/70">{siteUrl}</p>
      ) : null}
      <p className="mt-4 text-xs text-slate-500">
        Last updated {lastUpdatedLabel}
      </p>
    </ArchDashboardSurface>
  );
}
