import Link from "next/link";
import type { ArchCrmInteractionGridViewModel } from "@/lib/arch/client-types";
import { ArchDashboardSurface } from "./arch-dashboard-surface";

export function ArchCrmInteractionGrid({
  data,
}: {
  data: ArchCrmInteractionGridViewModel;
}) {
  return (
    <ArchDashboardSurface className="p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-200/80">
        CRM & activity
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Core operations for your chatbot and service lane — drill into each
        bucket.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.cells.map((cell) => (
          <Link
            key={cell.key}
            href={cell.href}
            className="group block rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4 transition hover:border-cyan-500/35 hover:bg-slate-800/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 group-hover:text-cyan-200/90">
              {cell.title}
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {cell.primary}
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-slate-500 group-hover:text-slate-400">
              {cell.preview}
            </p>
          </Link>
        ))}
      </div>
    </ArchDashboardSurface>
  );
}
