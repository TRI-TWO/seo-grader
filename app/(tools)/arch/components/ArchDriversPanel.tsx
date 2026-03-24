import type { ArchDriver } from "@/lib/arch/types";

interface ArchDriversPanelProps {
  positiveDrivers: ArchDriver[];
  negativeDrivers: ArchDriver[];
}

export function ArchDriversPanel({
  positiveDrivers,
  negativeDrivers,
}: ArchDriversPanelProps) {
  if (positiveDrivers.length === 0 && negativeDrivers.length === 0) {
    return (
      <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
        <h2 className="text-xl font-bold text-white mb-2">Score Drivers</h2>
        <p className="text-sm text-cool-ash">
          Once Arch rules are configured and signals are ingested, this panel will
          surface the top factors improving and hurting the score.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
      <h2 className="text-xl font-bold text-white mb-4">Score Drivers</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-emerald-400 mb-3">
            Top Wins
          </h3>
          <div className="space-y-3">
            {positiveDrivers.map((driver) => (
              <div
                key={driver.signalId + driver.message}
                className="bg-void-black rounded-lg border border-emerald-700/60 p-3"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs uppercase tracking-wide text-emerald-300">
                    {driver.categoryLabel}
                  </div>
                  <div className="text-xs font-semibold text-emerald-200">
                    +{driver.points} pts
                  </div>
                </div>
                <div className="text-sm text-white mb-1">
                  {driver.signalLabel}
                </div>
                <div className="text-xs text-cool-ash">{driver.message}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-400 mb-3">
            Top Issues
          </h3>
          <div className="space-y-3">
            {negativeDrivers.map((driver) => (
              <div
                key={driver.signalId + driver.message}
                className="bg-void-black rounded-lg border border-red-700/60 p-3"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="text-xs uppercase tracking-wide text-red-300">
                    {driver.categoryLabel}
                  </div>
                  <div className="text-xs font-semibold text-red-200">
                    {driver.points} pts
                  </div>
                </div>
                <div className="text-sm text-white mb-1">
                  {driver.signalLabel}
                </div>
                <div className="text-xs text-cool-ash">{driver.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

