import type { ArchStatusBand } from "@/lib/arch/types";

interface ArchHealthScoreHeroProps {
  score: number;
  band: ArchStatusBand;
  delta?: number | null;
}

const BAND_LABEL: Record<ArchStatusBand, string> = {
  green: "Healthy",
  yellow: "Monitor",
  orange: "At Risk",
  red: "Critical",
};

const BAND_COLOR_CLASS: Record<ArchStatusBand, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  orange: "bg-orange-400",
  red: "bg-red-500",
};

export function ArchHealthScoreHero({
  score,
  band,
  delta,
}: ArchHealthScoreHeroProps) {
  const bandLabel = BAND_LABEL[band];
  const bandColor = BAND_COLOR_CLASS[band];

  const deltaLabel =
    typeof delta === "number" && delta !== 0
      ? `${delta > 0 ? "+" : ""}${delta.toFixed(0)} vs. prior`
      : "No recent change";

  const deltaColor =
    typeof delta === "number" && delta !== 0
      ? delta > 0
        ? "text-emerald-400"
        : "text-red-400"
      : "text-gray-400";

  return (
    <section className="bg-obsidian rounded-lg border border-steel-gray px-6 py-6 flex flex-col md:flex-row items-start md:items-center gap-6">
      <div className="flex-1">
        <h2 className="text-2xl font-bold text-white mb-1">
          Overall Health Score
        </h2>
        <p className="text-sm text-cool-ash">
          Composite SEO + growth health signal for this client.
        </p>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <div
            className={`inline-flex items-center mb-2 px-3 py-1 rounded-full text-xs font-semibold ${bandColor} text-white`}
          >
            {bandLabel}
          </div>
          <div className="flex items-baseline justify-end gap-2">
            <span className="text-5xl md:text-6xl font-bold text-white">
              {score}
            </span>
            <span className="text-sm text-gray-400">/ 100</span>
          </div>
          <div className={`text-xs mt-1 ${deltaColor}`}>{deltaLabel}</div>
        </div>
      </div>
    </section>
  );
}

