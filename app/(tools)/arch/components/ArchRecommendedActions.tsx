import type { ArchRecommendedAction } from "@/lib/arch/types";

interface ArchRecommendedActionsProps {
  actions: ArchRecommendedAction[];
}

export function ArchRecommendedActions({
  actions,
}: ArchRecommendedActionsProps) {
  if (actions.length === 0) {
    return (
      <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
        <h2 className="text-xl font-bold text-white mb-2">
          Recommended Actions
        </h2>
        <p className="text-sm text-cool-ash">
          When rules start firing, Arch will list clear, prioritized actions for
          this client here.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-obsidian rounded-lg border border-steel-gray p-6">
      <h2 className="text-xl font-bold text-white mb-4">Recommended Actions</h2>
      <div className="space-y-3">
        {actions.map((action, idx) => (
          <div
            key={`${action.title}-${idx}`}
            className="bg-void-black rounded-lg border border-zinc-700 p-4"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="text-sm font-semibold text-white">
                  {action.title}
                </div>
                <div className="text-xs text-cool-ash mt-1">
                  {action.categoryLabel} · {action.signalLabel}
                </div>
              </div>
              <div className="text-[10px] uppercase tracking-wide text-gray-400">
                {action.severity}
              </div>
            </div>
            {action.detail && (
              <div className="text-sm text-gray-300">{action.detail}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

