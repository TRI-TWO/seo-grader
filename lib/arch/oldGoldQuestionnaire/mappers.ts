import { CATEGORY_SERVICE_DEFINITIONS } from "./constants";
import type {
  CustomServiceRow,
  OldGoldFinalPayload,
  QuestionnaireData,
  QuestionnaireDraftEnvelope,
  ServicesOffered,
  WizardServiceAnswers,
} from "./types";

export function slugifyCustomServiceId(id: string): string {
  return `custom_${id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

/** Build / merge wizard answers when categories change; preserve prior answers where keys still exist. */
export function mergeWizardAnswersForCategories(
  selectedCategories: string[],
  prev: WizardServiceAnswers
): WizardServiceAnswers {
  const next: WizardServiceAnswers = {};
  const selected = new Set(selectedCategories);

  for (const cat of selectedCategories) {
    const defs = CATEGORY_SERVICE_DEFINITIONS[cat] ?? [];
    next[cat] = {};
    const prevCat = prev[cat] ?? {};
    for (const { key } of defs) {
      next[cat][key] = prevCat[key] !== undefined ? prevCat[key]! : null;
    }
  }

  return next;
}

export function envelopeFromDbJson(raw: unknown): QuestionnaireDraftEnvelope | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  if (typeof o.stepIndex !== "number" || !o.data) return null;
  return o as unknown as QuestionnaireDraftEnvelope;
}

/** Build final QuestionnaireData + OldGoldFinalPayload from wizard state. */
export function buildFinalPayload(
  data: QuestionnaireData,
  wizardServiceAnswers: WizardServiceAnswers,
  customServices: CustomServiceRow[]
): OldGoldFinalPayload {
  const categories = [...data.service_categories];
  const services_offered: ServicesOffered = {};
  const services_not_offered: ServicesOffered = {};

  for (const cat of categories) {
    const defs = CATEGORY_SERVICE_DEFINITIONS[cat] ?? [];
    services_offered[cat] = {};
    services_not_offered[cat] = {};
    for (const { key } of defs) {
      const v = wizardServiceAnswers[cat]?.[key];
      if (v === true) {
        services_offered[cat][key] = true;
      } else if (v === false) {
        services_offered[cat][key] = false;
        services_not_offered[cat][key] = true;
      }
    }
  }

  const custom_services = customServices
    .filter((r) => r.label.trim().length > 0)
    .map((r) => ({
      category: r.category,
      label: r.label.trim(),
      enabled: r.offered === true ? true : r.offered === false ? false : null,
    }));

  for (const row of customServices) {
    if (!row.label.trim()) continue;
    const cat = row.category || "Other";
    if (!services_offered[cat]) services_offered[cat] = {};
    if (!services_not_offered[cat]) services_not_offered[cat] = {};
    const key = slugifyCustomServiceId(row.id);
    if (row.offered === true) {
      services_offered[cat][key] = true;
    } else if (row.offered === false) {
      services_offered[cat][key] = false;
      services_not_offered[cat][key] = true;
    }
  }

  const questionnaire: QuestionnaireData = {
    ...data,
    service_categories: categories,
    services_offered,
    custom_services,
  };

  return {
    questionnaire,
    services_not_offered,
    supported_service_categories: categories.filter((c) => {
      const offered = services_offered[c];
      if (!offered) return false;
      return Object.values(offered).some((v) => v === true);
    }),
    routing_signals: {
      out_of_area_behavior: data.out_of_area_behavior,
      after_hours_behavior: data.after_hours_behavior,
      pricing_behavior: data.pricing_behavior,
      scheduling_behavior: data.scheduling_behavior,
      emergency_behavior: data.emergency_behavior,
      existing_customer_behavior: data.existing_customer_behavior,
    },
  };
}

/** Hydrate wizard answers from a saved draft envelope or from final questionnaire booleans. */
export function wizardAnswersFromQuestionnaire(data: QuestionnaireData): WizardServiceAnswers {
  const out: WizardServiceAnswers = {};
  for (const cat of data.service_categories) {
    const defs = CATEGORY_SERVICE_DEFINITIONS[cat] ?? [];
    const offered = data.services_offered[cat] ?? {};
    out[cat] = {};
    for (const { key } of defs) {
      const v = offered[key];
      out[cat][key] = v === true ? true : v === false ? false : null;
    }
  }
  return out;
}
