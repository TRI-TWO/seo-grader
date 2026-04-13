import type { QuestionnaireData } from "@/lib/arch/oldGoldQuestionnaire/types";

type Props = {
  data: QuestionnaireData;
  fieldErrors: Record<string, string>;
  patchData: (p: Partial<QuestionnaireData>) => void;
};

const inp =
  "mt-1 w-full rounded-lg border border-slate-600/80 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/40";

export function StepBusinessInfo({ data, fieldErrors, patchData }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
        Client name
        <input
          className={inp}
          value={data.client_name}
          onChange={(e) => patchData({ client_name: e.target.value })}
        />
        {fieldErrors.client_name ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.client_name}</p>
        ) : null}
      </label>
      <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
        Client business name
        <input
          className={inp}
          value={data.business_name}
          onChange={(e) => patchData({ business_name: e.target.value })}
        />
        {fieldErrors.business_name ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.business_name}</p>
        ) : null}
      </label>

      <div className="sm:col-span-2 space-y-2">
        <p className="text-xs font-medium text-slate-300">Client address</p>
        <label className="block text-xs text-slate-400">
          Street
          <input
            className={inp}
            value={data.business_address.street}
            onChange={(e) =>
              patchData({
                business_address: { ...data.business_address, street: e.target.value },
              })
            }
          />
          {fieldErrors.street ? (
            <p className="mt-1 text-xs text-rose-400">{fieldErrors.street}</p>
          ) : null}
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-xs text-slate-400">
            City
            <input
              className={inp}
              value={data.business_address.city}
              onChange={(e) =>
                patchData({
                  business_address: { ...data.business_address, city: e.target.value },
                })
              }
            />
            {fieldErrors.city ? (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.city}</p>
            ) : null}
          </label>
          <label className="block text-xs text-slate-400">
            State
            <input
              className={inp}
              value={data.business_address.state}
              onChange={(e) =>
                patchData({
                  business_address: { ...data.business_address, state: e.target.value },
                })
              }
            />
            {fieldErrors.state ? (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.state}</p>
            ) : null}
          </label>
          <label className="block text-xs text-slate-400">
            ZIP
            <input
              className={inp}
              inputMode="numeric"
              maxLength={5}
              value={data.business_address.zip}
              onChange={(e) =>
                patchData({
                  business_address: { ...data.business_address, zip: e.target.value },
                })
              }
            />
            {fieldErrors.zip ? (
              <p className="mt-1 text-xs text-rose-400">{fieldErrors.zip}</p>
            ) : null}
          </label>
        </div>
      </div>

      <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
        Client website (optional)
        <input
          className={inp}
          value={data.website}
          onChange={(e) => patchData({ website: e.target.value })}
          placeholder="https://"
        />
        {fieldErrors.website ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.website}</p>
        ) : null}
      </label>
      <label className="block text-xs font-medium text-slate-300">
        Client work number
        <input
          className={inp}
          value={data.work_number}
          onChange={(e) => patchData({ work_number: e.target.value })}
        />
        {fieldErrors.work_number ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.work_number}</p>
        ) : null}
      </label>
      <label className="block text-xs font-medium text-slate-300">
        Client email
        <input
          className={inp}
          type="email"
          autoComplete="email"
          value={data.email}
          onChange={(e) => patchData({ email: e.target.value })}
        />
        {fieldErrors.email ? (
          <p className="mt-1 text-xs text-rose-400">{fieldErrors.email}</p>
        ) : null}
      </label>
      <label className="block text-xs font-medium text-slate-300">
        Emergency line (optional)
        <input
          className={inp}
          value={data.emergency_line}
          onChange={(e) => patchData({ emergency_line: e.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-slate-300 sm:col-span-2">
        Numbers to bypass (optional, CSV)
        <input
          className={inp}
          value={data.numbers_to_bypass_csv}
          onChange={(e) => patchData({ numbers_to_bypass_csv: e.target.value })}
          placeholder="+1..., +1..."
        />
      </label>
    </div>
  );
}
