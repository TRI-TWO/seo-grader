import type { ServiceDefinition } from "@/lib/arch/oldGoldQuestionnaire/constants";
import type { ServiceTriState } from "@/lib/arch/oldGoldQuestionnaire/types";

type Props = {
  category: string;
  definitions: ServiceDefinition[];
  answers: Record<string, ServiceTriState>;
  onChange: (serviceKey: string, value: ServiceTriState) => void;
};

function TriButtons({
  value,
  onPick,
}: {
  value: ServiceTriState;
  onPick: (v: ServiceTriState) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-600/80 p-0.5" role="group">
      {(
        [
          { v: true as const, label: "Yes" },
          { v: false as const, label: "No" },
        ] as const
      ).map(({ v, label }) => (
        <button
          key={label}
          type="button"
          onClick={() => onPick(v)}
          className={`px-3 py-1 text-xs font-semibold rounded-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
            value === v ? "bg-cyan-500/25 text-cyan-50" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ServiceYesNoMatrix({ category, definitions, answers, onChange }: Props) {
  if (!definitions.length) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-200">{category}</h3>
      <ul className="divide-y divide-slate-700/80 rounded-xl border border-slate-700/80 bg-slate-950/40">
        {definitions.map((def) => {
          const value = answers[def.key] ?? null;
          return (
            <li
              key={def.key}
              className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="text-sm text-slate-200">{def.label}</span>
              <TriButtons value={value} onPick={(v) => onChange(def.key, v)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
