import type { CustomServiceRow, ServiceTriState } from "@/lib/arch/oldGoldQuestionnaire/types";
import { SERVICE_CATEGORIES } from "@/lib/arch/oldGoldQuestionnaire/constants";

type Props = {
  rows: CustomServiceRow[];
  onChange: (rows: CustomServiceRow[]) => void;
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

export function CustomServiceEditor({ rows, onChange }: Props) {
  function addRow() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    onChange([
      ...rows,
      { id, category: "Other", label: "", offered: null },
    ]);
  }

  function updateRow(id: string, patch: Partial<CustomServiceRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">Custom services</h3>
        <button
          type="button"
          onClick={addRow}
          className="rounded-lg border border-slate-600/80 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500"
        >
          Add custom service
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500">Optional — add trades or services not listed above.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-3 space-y-2"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-300">
                  Category
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-2 py-2 text-sm text-slate-100"
                    value={row.category}
                    onChange={(e) => updateRow(row.id, { category: e.target.value })}
                  >
                    {SERVICE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
                  Service label
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                    value={row.label}
                    onChange={(e) => updateRow(row.id, { label: e.target.value })}
                    placeholder="e.g. Backflow testing"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TriButtons
                  value={row.offered}
                  onPick={(v) => updateRow(row.id, { offered: v })}
                />
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="text-xs text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
