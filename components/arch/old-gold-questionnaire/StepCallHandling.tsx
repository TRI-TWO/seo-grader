import {
  EMERGENCY_BEHAVIOR_OPTIONS,
  EXISTING_CUSTOMER_BEHAVIOR_OPTIONS,
  PRICING_BEHAVIOR_OPTIONS,
  REQUIRED_INTAKE_FIELD_OPTIONS,
  SCHEDULING_BEHAVIOR_OPTIONS,
} from "@/lib/arch/oldGoldQuestionnaire/constants";
import type { QuestionnaireData } from "@/lib/arch/oldGoldQuestionnaire/types";

type Props = {
  data: QuestionnaireData;
  fieldErrors: Record<string, string>;
  patchData: (p: Partial<QuestionnaireData>) => void;
};

const inp =
  "mt-1 w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40";

export function StepCallHandling({ data, fieldErrors, patchData }: Props) {
  function toggleIntake(value: string) {
    const set = new Set(data.required_intake_fields);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    patchData({ required_intake_fields: Array.from(set) });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-slate-300">
          What should OLD GOLD always collect?
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {REQUIRED_INTAKE_FIELD_OPTIONS.map((o) => {
            const on = data.required_intake_fields.includes(o.value);
            return (
              <li key={o.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 hover:border-slate-600">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleIntake(o.value)}
                    className="h-4 w-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500/40"
                  />
                  {o.label}
                </label>
              </li>
            );
          })}
        </ul>
        {fieldErrors.required_intake_fields ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.required_intake_fields}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          When a caller asks for pricing
          <select
            className={inp}
            value={data.pricing_behavior}
            onChange={(e) => patchData({ pricing_behavior: e.target.value })}
          >
            <option value="">Select…</option>
            {PRICING_BEHAVIOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErrors.pricing_behavior ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.pricing_behavior}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          When a caller asks for scheduling
          <select
            className={inp}
            value={data.scheduling_behavior}
            onChange={(e) => patchData({ scheduling_behavior: e.target.value })}
          >
            <option value="">Select…</option>
            {SCHEDULING_BEHAVIOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErrors.scheduling_behavior ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.scheduling_behavior}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          If the caller says it is an emergency
          <select
            className={inp}
            value={data.emergency_behavior}
            onChange={(e) => patchData({ emergency_behavior: e.target.value })}
          >
            <option value="">Select…</option>
            {EMERGENCY_BEHAVIOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErrors.emergency_behavior ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.emergency_behavior}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Existing customers should be handled by
          <select
            className={inp}
            value={data.existing_customer_behavior}
            onChange={(e) => patchData({ existing_customer_behavior: e.target.value })}
          >
            <option value="">Select…</option>
            {EXISTING_CUSTOMER_BEHAVIOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErrors.existing_customer_behavior ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.existing_customer_behavior}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Greeting style
          <textarea
            className={`${inp} min-h-[72px]`}
            value={data.greeting_style}
            onChange={(e) => patchData({ greeting_style: e.target.value })}
            placeholder="Tone, opener, and any brand phrasing."
          />
          {fieldErrors.greeting_style ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.greeting_style}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Anything the bot should avoid saying
          <textarea
            className={`${inp} min-h-[72px]`}
            value={data.banned_phrases}
            onChange={(e) => patchData({ banned_phrases: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Anything important we should know
          <textarea
            className={`${inp} min-h-[88px]`}
            value={data.business_notes}
            onChange={(e) => patchData({ business_notes: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
