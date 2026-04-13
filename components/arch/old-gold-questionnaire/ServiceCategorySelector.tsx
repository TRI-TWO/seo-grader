import { SERVICE_CATEGORIES } from "@/lib/arch/oldGoldQuestionnaire/constants";

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
};

export function ServiceCategorySelector({ selected, onChange }: Props) {
  const set = new Set(selected);

  function toggle(cat: string) {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange(Array.from(next));
  }

  return (
    <div className="flex flex-wrap gap-2">
      {SERVICE_CATEGORIES.map((cat) => {
        const on = set.has(cat);
        return (
          <button
            key={cat}
            type="button"
            onClick={() => toggle(cat)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
              on
                ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-50"
                : "border-slate-600/80 bg-slate-900/60 text-slate-300 hover:border-slate-500"
            }`}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}
