import type {
  ArchSeoPyramidLayerStatus,
  ArchSeoPyramidViewModel,
} from "@/lib/arch/client-types";
import { ArchDashboardSurface } from "./arch-dashboard-surface";

const statusRing: Record<ArchSeoPyramidLayerStatus, string> = {
  strong: "border-emerald-400/50 bg-emerald-500/10 text-emerald-200",
  moderate: "border-amber-400/40 bg-amber-500/10 text-amber-100",
  weak: "border-rose-400/40 bg-rose-500/10 text-rose-100",
  inactive: "border-slate-600/50 bg-slate-800/40 text-slate-400",
};

function layerWidths(i: number, total: number): string {
  const pct = 38 + (i / Math.max(1, total - 1)) * 52;
  return `${Math.round(pct)}%`;
}

export function ArchSeoPyramidCard({ data }: { data: ArchSeoPyramidViewModel }) {
  if (!data.enabled) {
    return (
      <ArchDashboardSurface className="p-6">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {data.title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {data.subtitle ??
            "Upgrade to SEO management to see your foundation pyramid and layered readiness."}
        </p>
        <div className="mt-6 rounded-2xl border border-dashed border-cyan-500/25 bg-slate-900/50 p-8 text-center text-sm text-slate-400">
          Add SEO management to unlock crawl-to-click diagnostics tailored to your site.
        </div>
      </ArchDashboardSurface>
    );
  }

  const layers = [...data.layers].reverse();
  const n = layers.length;

  return (
    <ArchDashboardSurface className="p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          {data.title}
        </h2>
        {data.subtitle ? (
          <p className="text-sm text-slate-400">{data.subtitle}</p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col items-center gap-1.5">
        {layers.map((layer, idx) => {
          const fromTop = idx;
          const ring =
            statusRing[layer.status] ??
            "border-slate-600/50 bg-slate-800/40 text-slate-400";
          const width = layerWidths(fromTop, n);
          return (
            <div
              key={layer.key}
              className={`flex items-center justify-between gap-3 border px-3 py-2.5 transition-colors ${ring}`}
              style={{
                width,
                clipPath:
                  fromTop === 0
                    ? "polygon(8% 0, 92% 0, 100% 100%, 0 100%)"
                    : "polygon(4% 0, 96% 0, 100% 100%, 0 100%)",
                borderRadius: "4px",
              }}
            >
              <span className="text-xs font-medium uppercase tracking-wide">
                {layer.label}
              </span>
              <span className="text-xs tabular-nums opacity-90">
                {typeof layer.score === "number" ? `${layer.score}` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="mt-5 space-y-2 border-t border-slate-800/80 pt-4">
        {[...data.layers].map((layer) => (
          <li key={layer.key} className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">{layer.label}</span>
            {layer.detail ? ` — ${layer.detail}` : null}
          </li>
        ))}
      </ul>
    </ArchDashboardSurface>
  );
}
