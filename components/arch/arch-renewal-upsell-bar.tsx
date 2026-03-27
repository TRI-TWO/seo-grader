import Link from "next/link";
import type { ArchRenewalUpsellViewModel } from "@/lib/arch/client-types";
import { ArchDashboardSurface } from "./arch-dashboard-surface";

export function ArchRenewalUpsellBar({
  data,
}: {
  data: ArchRenewalUpsellViewModel;
}) {
  if (!data.visible || !data.headline) {
    return null;
  }

  return (
    <ArchDashboardSurface className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 bg-gradient-to-r from-cyan-950/40 via-slate-900/80 to-slate-950 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
            {data.mode === "renewal"
              ? "Renewal"
              : data.mode === "upsell"
                ? "Opportunity"
                : "Renewal & add-ons"}
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">
            {data.headline}
          </h2>
          {data.detail ? (
            <p className="mt-1 text-sm text-slate-400">{data.detail}</p>
          ) : null}
        </div>
        {data.ctaLabel && data.ctaHref ? (
          <Link
            href={data.ctaHref}
            className="inline-flex shrink-0 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
          >
            {data.ctaLabel}
          </Link>
        ) : null}
      </div>
    </ArchDashboardSurface>
  );
}
