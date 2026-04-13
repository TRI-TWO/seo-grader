import type { ReactNode } from "react";
import { CATEGORY_SERVICE_DEFINITIONS } from "@/lib/arch/oldGoldQuestionnaire/constants";
import type { CustomServiceRow, QuestionnaireData, WizardServiceAnswers } from "@/lib/arch/oldGoldQuestionnaire/types";

type Props = {
  data: QuestionnaireData;
  wizardServiceAnswers: WizardServiceAnswers;
  customServices: CustomServiceRow[];
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-700/80 bg-slate-950/40 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-400/85">
        {title}
      </h3>
      <div className="mt-3 space-y-2 text-sm text-slate-200">{children}</div>
    </section>
  );
}

export function StepReviewSave({ data, wizardServiceAnswers, customServices }: Props) {
  return (
    <div className="space-y-4">
      <Section title="Business info">
        <p>
          <span className="text-slate-500">Client:</span> {data.client_name}
        </p>
        <p>
          <span className="text-slate-500">Business:</span> {data.business_name}
        </p>
        <p>
          <span className="text-slate-500">Address:</span>{" "}
          {[
            data.business_address.street,
            data.business_address.city,
            data.business_address.state,
            data.business_address.zip,
          ]
            .filter(Boolean)
            .join(", ")}
        </p>
        {data.website.trim() ? (
          <p>
            <span className="text-slate-500">Website:</span> {data.website}
          </p>
        ) : null}
        <p>
          <span className="text-slate-500">Work #:</span> {data.work_number}{" "}
          <span className="text-slate-500">· Email:</span> {data.email}
        </p>
        {data.emergency_line.trim() ? (
          <p>
            <span className="text-slate-500">Emergency line:</span> {data.emergency_line}
          </p>
        ) : null}
        {data.numbers_to_bypass_csv.trim() ? (
          <p>
            <span className="text-slate-500">Bypass numbers:</span> {data.numbers_to_bypass_csv}
          </p>
        ) : null}
      </Section>

      <Section title="Hours + service area">
        <p>
          <span className="text-slate-500">Days:</span> {data.days_open.join(", ")}
        </p>
        <p>
          <span className="text-slate-500">Hours:</span> {data.business_hours.open} –{" "}
          {data.business_hours.close} ({data.time_zone})
        </p>
        <p>
          <span className="text-slate-500">Primary area:</span> {data.primary_service_area}
        </p>
        <p>
          <span className="text-slate-500">Radius:</span> {data.travel_radius_value}{" "}
          {data.travel_radius_unit}
        </p>
        <p>
          <span className="text-slate-500">Outside area:</span> {data.out_of_area_behavior}
        </p>
        <p>
          <span className="text-slate-500">After hours:</span> {data.after_hours_behavior}
        </p>
        {data.holiday_notes.trim() ? (
          <p>
            <span className="text-slate-500">Holidays:</span> {data.holiday_notes}
          </p>
        ) : null}
      </Section>

      <Section title="Selected categories">
        <p>{data.service_categories.join(", ") || "—"}</p>
      </Section>

      <Section title="Approved services (Yes / No)">
        {data.service_categories.map((cat) => {
          const defs = CATEGORY_SERVICE_DEFINITIONS[cat] ?? [];
          const ans = wizardServiceAnswers[cat] ?? {};
          return (
            <div key={cat} className="mb-3">
              <p className="font-medium text-slate-100">{cat}</p>
              <ul className="ml-4 list-disc text-slate-300">
                {defs.map((d) => (
                  <li key={d.key}>
                    {d.label}: {ans[d.key] === true ? "Yes" : ans[d.key] === false ? "No" : "—"}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {customServices.filter((r) => r.label.trim()).length ? (
          <div className="mt-2">
            <p className="font-medium text-slate-100">Custom</p>
            <ul className="ml-4 list-disc text-slate-300">
              {customServices
                .filter((r) => r.label.trim())
                .map((r) => (
                  <li key={r.id}>
                    {r.category}: {r.label} —{" "}
                    {r.offered === true ? "Yes" : r.offered === false ? "No" : "—"}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </Section>

      <Section title="Call handling rules">
        <p>
          <span className="text-slate-500">Intake fields:</span>{" "}
          {data.required_intake_fields.join(", ")}
        </p>
        <p>
          <span className="text-slate-500">Pricing:</span> {data.pricing_behavior}
        </p>
        <p>
          <span className="text-slate-500">Scheduling:</span> {data.scheduling_behavior}
        </p>
        <p>
          <span className="text-slate-500">Emergency:</span> {data.emergency_behavior}
        </p>
        <p>
          <span className="text-slate-500">Existing customers:</span>{" "}
          {data.existing_customer_behavior}
        </p>
        <p>
          <span className="text-slate-500">Greeting:</span> {data.greeting_style}
        </p>
        {data.banned_phrases.trim() ? (
          <p>
            <span className="text-slate-500">Avoid:</span> {data.banned_phrases}
          </p>
        ) : null}
        {data.business_notes.trim() ? (
          <p>
            <span className="text-slate-500">Notes:</span> {data.business_notes}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
