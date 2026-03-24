import type { ArchCategoryScores } from "@/lib/arch/types";

interface ArchCategoryScoreGridProps {
  categoryScores: ArchCategoryScores;
}

export function ArchCategoryScoreGrid({
  categoryScores,
}: ArchCategoryScoreGridProps) {
  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return (
      <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
        <h2 className="text-xl font-bold text-white mb-2">Category Breakdown</h2>
        <p className="text-sm text-cool-ash">
          No categories configured yet. Configure Arch categories and signals in
          the admin view to see per-category scores.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
      <h2 className="text-xl font-bold text-white mb-4">Category Breakdown</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map(([key, value]) => {
          const label = key
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

          const bandColor =
            value.band === "green"
              ? "bg-green-500/80"
              : value.band === "yellow"
              ? "bg-yellow-400/80"
              : value.band === "orange"
              ? "bg-orange-400/80"
              : "bg-red-500/80";

          return (
            <div
              key={key}
              className="bg-void-black rounded-lg border border-zinc-700 p-4 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {label}
                  </h3>
                  <p className="text-xs text-cool-ash mt-1">
                    Category health on a 0-100 scale.
                  </p>
                </div>
                <div
                  className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${bandColor} text-white`}
                >
                  {value.band}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">
                  {value.score}
                </span>
                <span className="text-xs text-gray-400">/ 100</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

