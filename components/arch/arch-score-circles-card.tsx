import type {
  ArchScoreCircleTone,
  ArchScoreCirclesViewModel,
} from "@/lib/arch/client-types";
import { ArchDashboardSurface } from "./arch-dashboard-surface";

const toneColor: Record<ArchScoreCircleTone, string> = {
  good: "text-cyan-300 shadow-[0_0_28px_-4px_rgba(34,211,238,0.45)]",
  warn: "text-amber-200 shadow-[0_0_24px_-4px_rgba(251,191,36,0.35)]",
  bad: "text-rose-300 shadow-[0_0_24px_-4px_rgba(251,113,133,0.35)]",
};

export function ArchScoreCirclesCard({
  data,
}: {
  data: ArchScoreCirclesViewModel;
}) {
  if (!data.enabled) {
    return (
      <ArchDashboardSurface className="p-6">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Search readiness scores
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Four pillars of ranking readiness. Add SEO management to see your
          Performance, Accessibility, Best Practices, and SEO scores.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 opacity-40">
          {["Performance", "Accessibility", "Best Practices", "SEO"].map(
            (label) => (
              <div
                key={label}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/30 p-4"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-slate-600 text-lg text-slate-500">
                  —
                </div>
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            )
          )}
        </div>
      </ArchDashboardSurface>
    );
  }

  return (
    <ArchDashboardSurface className="p-6">
      <h2 className="text-lg font-semibold tracking-tight text-white">
        Search readiness scores
      </h2>
      <p className="mt-1 text-sm text-slate-400">
        TRI-TWO client-facing ranking readiness — not raw Lighthouse labels.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {data.items.map((item) => {
          const tone = item.tone ?? "warn";
          return (
            <div
              key={item.key}
              className="flex flex-col items-center gap-2 text-center"
            >
              <div
                className={`flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 border-cyan-500/30 bg-slate-900/80 text-xl font-semibold tabular-nums ${toneColor[tone]}`}
              >
                {item.score}
              </div>
              <span className="text-xs font-medium text-slate-300">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {data.estimatedTierLabel ? (
        <p className="mt-5 text-sm font-medium text-cyan-200/90">
          {data.estimatedTierLabel}
        </p>
      ) : null}

      {data.helperText ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {data.helperText}
        </p>
      ) : null}
    </ArchDashboardSurface>
  );
}
