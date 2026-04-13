import { CATEGORY_SERVICE_DEFINITIONS } from "./constants";
import type {
  CustomServiceRow,
  QuestionnaireData,
  ValidationResult,
  WizardServiceAnswers,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}$/;
const WEBSITE_RE =
  /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/[\w\-./?%&=]*)?$/i;

export function validateBusinessInfoStep(data: QuestionnaireData): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  if (!data.client_name.trim()) fieldErrors.client_name = "Required.";
  if (!data.business_name.trim()) fieldErrors.business_name = "Required.";
  if (!data.business_address.street.trim()) fieldErrors.street = "Required.";
  if (!data.business_address.city.trim()) fieldErrors.city = "Required.";
  if (!data.business_address.state.trim()) fieldErrors.state = "Required.";
  if (!ZIP_RE.test(data.business_address.zip.trim())) {
    fieldErrors.zip = "Enter a valid 5-digit US ZIP.";
  }
  if (!data.work_number.trim()) fieldErrors.work_number = "Required.";
  if (!data.email.trim()) fieldErrors.email = "Required.";
  else if (!EMAIL_RE.test(data.email.trim())) fieldErrors.email = "Enter a valid email.";

  if (data.website.trim() && !WEBSITE_RE.test(data.website.trim())) {
    fieldErrors.website = "Enter a valid website URL.";
  }

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateHoursServiceAreaStep(data: QuestionnaireData): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  if (!data.days_open.length) fieldErrors.days_open = "Select at least one day.";
  if (!data.business_hours.open.trim()) fieldErrors.business_hours_open = "Required.";
  if (!data.business_hours.close.trim()) fieldErrors.business_hours_close = "Required.";
  if (!data.time_zone.trim()) fieldErrors.time_zone = "Required.";
  if (!data.primary_service_area.trim()) fieldErrors.primary_service_area = "Required.";
  if (!data.travel_radius_value || data.travel_radius_value <= 0) {
    fieldErrors.travel_radius_value = "Enter a radius greater than 0.";
  }
  if (!data.out_of_area_behavior.trim()) fieldErrors.out_of_area_behavior = "Required.";
  if (!data.after_hours_behavior.trim()) fieldErrors.after_hours_behavior = "Required.";

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

const SERVICES_STEP_MESSAGE =
  "Please mark Yes or No for each listed service before continuing.";

export function validateServicesStep(args: {
  categories: string[];
  wizardServiceAnswers: WizardServiceAnswers;
  customServices: CustomServiceRow[];
}): ValidationResult {
  const { categories, wizardServiceAnswers, customServices } = args;

  if (!categories.length) {
    return {
      ok: false,
      fieldErrors: { service_categories: "Select at least one category." },
    };
  }

  for (const cat of categories) {
    const defs = CATEGORY_SERVICE_DEFINITIONS[cat] ?? [];
    const rowAnswers = wizardServiceAnswers[cat] ?? {};
    for (const { key } of defs) {
      const v = rowAnswers[key];
      if (v !== true && v !== false) {
        return { ok: false, stepMessage: SERVICES_STEP_MESSAGE };
      }
    }
  }

  for (const row of customServices) {
    if (!row.label.trim()) continue;
    if (row.offered !== true && row.offered !== false) {
      return { ok: false, stepMessage: SERVICES_STEP_MESSAGE };
    }
  }

  return { ok: true };
}

export function validateCallHandlingStep(data: QuestionnaireData): ValidationResult {
  const fieldErrors: Record<string, string> = {};
  if (!data.required_intake_fields.length) {
    fieldErrors.required_intake_fields = "Select at least one required field.";
  }
  if (!data.pricing_behavior.trim()) fieldErrors.pricing_behavior = "Required.";
  if (!data.scheduling_behavior.trim()) fieldErrors.scheduling_behavior = "Required.";
  if (!data.emergency_behavior.trim()) fieldErrors.emergency_behavior = "Required.";
  if (!data.existing_customer_behavior.trim()) {
    fieldErrors.existing_customer_behavior = "Required.";
  }
  if (!data.greeting_style.trim()) fieldErrors.greeting_style = "Required.";

  return { ok: Object.keys(fieldErrors).length === 0, fieldErrors };
}

export function validateAllSteps(args: {
  data: QuestionnaireData;
  wizardServiceAnswers: WizardServiceAnswers;
  customServices: CustomServiceRow[];
}): ValidationResult {
  const a = validateBusinessInfoStep(args.data);
  if (!a.ok) return a;
  const b = validateHoursServiceAreaStep(args.data);
  if (!b.ok) return b;
  const c = validateServicesStep({
    categories: args.data.service_categories,
    wizardServiceAnswers: args.wizardServiceAnswers,
    customServices: args.customServices,
  });
  if (!c.ok) return c;
  const d = validateCallHandlingStep(args.data);
  if (!d.ok) return d;
  return { ok: true };
}

export function validateStepIndex(
  stepIndex: number,
  args: {
    data: QuestionnaireData;
    wizardServiceAnswers: WizardServiceAnswers;
    customServices: CustomServiceRow[];
  }
): ValidationResult {
  switch (stepIndex) {
    case 0:
      return validateBusinessInfoStep(args.data);
    case 1:
      return validateHoursServiceAreaStep(args.data);
    case 2:
      return validateServicesStep({
        categories: args.data.service_categories,
        wizardServiceAnswers: args.wizardServiceAnswers,
        customServices: args.customServices,
      });
    case 3:
      return validateCallHandlingStep(args.data);
    default:
      return { ok: true };
  }
}
