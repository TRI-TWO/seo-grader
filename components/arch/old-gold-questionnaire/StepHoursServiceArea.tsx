import {
  AFTER_HOURS_OPTIONS,
  DAYS_OF_WEEK,
  OUT_OF_AREA_OPTIONS,
  US_TIME_ZONES,
} from "@/lib/arch/oldGoldQuestionnaire/constants";
import type { QuestionnaireData } from "@/lib/arch/oldGoldQuestionnaire/types";

type Props = {
  data: QuestionnaireData;
  fieldErrors: Record<string, string>;
  patchData: (p: Partial<QuestionnaireData>) => void;
};

const inp =
  "mt-1 w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40";

export function StepHoursServiceArea({ data, fieldErrors, patchData }: Props) {
  function toggleDay(day: string) {
    const set = new Set(data.days_open);
    if (set.has(day)) set.delete(day);
    else set.add(day);
    patchData({ days_open: Array.from(set) });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium text-slate-300">Days open</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((d) => {
            const on = data.days_open.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 ${
                  on
                    ? "border-cyan-500/60 bg-cyan-500/15 text-cyan-50"
                    : "border-slate-600/80 bg-slate-900/60 text-slate-300"
                }`}
              >
                {d.slice(0, 3)}
              </button>
            );
          })}
        </div>
        {fieldErrors.days_open ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.days_open}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-300">
          Open
          <input
            className={inp}
            placeholder="08:00"
            value={data.business_hours.open}
            onChange={(e) =>
              patchData({ business_hours: { ...data.business_hours, open: e.target.value } })
            }
          />
          {fieldErrors.business_hours_open ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.business_hours_open}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Close
          <input
            className={inp}
            placeholder="17:00"
            value={data.business_hours.close}
            onChange={(e) =>
              patchData({ business_hours: { ...data.business_hours, close: e.target.value } })
            }
          />
          {fieldErrors.business_hours_close ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.business_hours_close}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Time zone
          <select
            className={inp}
            value={data.time_zone}
            onChange={(e) => patchData({ time_zone: e.target.value })}
          >
            {US_TIME_ZONES.map((z) => (
              <option key={z.value} value={z.value}>
                {z.label}
              </option>
            ))}
          </select>
          {fieldErrors.time_zone ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.time_zone}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Primary service area
          <input
            className={inp}
            value={data.primary_service_area}
            onChange={(e) => patchData({ primary_service_area: e.target.value })}
            placeholder="Cities, counties, or regions"
          />
          {fieldErrors.primary_service_area ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.primary_service_area}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Travel radius value
          <input
            className={inp}
            type="number"
            min={1}
            value={data.travel_radius_value || ""}
            onChange={(e) =>
              patchData({ travel_radius_value: Number(e.target.value) || 0 })
            }
          />
          {fieldErrors.travel_radius_value ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.travel_radius_value}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Travel radius unit
          <select
            className={inp}
            value={data.travel_radius_unit}
            onChange={(e) =>
              patchData({
                travel_radius_unit: e.target.value as QuestionnaireData["travel_radius_unit"],
              })
            }
          >
            <option value="miles">Miles</option>
            <option value="minutes">Minutes</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          If a caller is outside your area
          <select
            className={inp}
            value={data.out_of_area_behavior}
            onChange={(e) => patchData({ out_of_area_behavior: e.target.value })}
          >
            <option value="">Select…</option>
            {OUT_OF_AREA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErrors.out_of_area_behavior ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.out_of_area_behavior}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          After-hours behavior
          <select
            className={inp}
            value={data.after_hours_behavior}
            onChange={(e) => patchData({ after_hours_behavior: e.target.value })}
          >
            <option value="">Select…</option>
            {AFTER_HOURS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {fieldErrors.after_hours_behavior ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.after_hours_behavior}</p>
          ) : null}
        </label>
        <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
          Holiday / closure notes (optional)
          <textarea
            className={`${inp} min-h-[80px]`}
            value={data.holiday_notes}
            onChange={(e) => patchData({ holiday_notes: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
