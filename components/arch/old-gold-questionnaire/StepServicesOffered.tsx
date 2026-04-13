import { CATEGORY_SERVICE_DEFINITIONS } from "@/lib/arch/oldGoldQuestionnaire/constants";
import type { CustomServiceRow, QuestionnaireData, WizardServiceAnswers } from "@/lib/arch/oldGoldQuestionnaire/types";
import { ServiceCategorySelector } from "./ServiceCategorySelector";
import { ServiceYesNoMatrix } from "./ServiceYesNoMatrix";
import { CustomServiceEditor } from "./CustomServiceEditor";

type Props = {
  data: QuestionnaireData;
  wizardServiceAnswers: WizardServiceAnswers;
  customServices: CustomServiceRow[];
  fieldErrors: Record<string, string>;
  stepMessage?: string | null;
  setCategories: (cats: string[]) => void;
  patchWizardAnswer: (category: string, key: string, value: boolean | null) => void;
  setCustomServices: (rows: CustomServiceRow[]) => void;
};

export function StepServicesOffered({
  data,
  wizardServiceAnswers,
  customServices,
  fieldErrors,
  stepMessage,
  setCategories,
  patchWizardAnswer,
  setCustomServices,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium text-slate-300 mb-2">Service categories</p>
        <ServiceCategorySelector
          selected={data.service_categories}
          onChange={setCategories}
        />
        {fieldErrors.service_categories ? (
          <p className="mt-2 text-xs text-rose-400">{fieldErrors.service_categories}</p>
        ) : null}
      </div>

      {data.service_categories.map((cat) => {
        const defs = CATEGORY_SERVICE_DEFINITIONS[cat] ?? [];
        return (
          <ServiceYesNoMatrix
            key={cat}
            category={cat}
            definitions={defs}
            answers={wizardServiceAnswers[cat] ?? {}}
            onChange={(key, v) => patchWizardAnswer(cat, key, v)}
          />
        );
      })}

      <CustomServiceEditor rows={customServices} onChange={setCustomServices} />

      {stepMessage ? (
        <p className="text-sm text-amber-200/90" role="alert">
          {stepMessage}
        </p>
      ) : null}
    </div>
  );
}
