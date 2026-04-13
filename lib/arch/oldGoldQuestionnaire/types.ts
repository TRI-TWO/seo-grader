/** Base questionnaire shape (persisted on final submit). */
export type BusinessAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type BusinessHours = {
  open: string;
  close: string;
};

/** Per category, each service key maps to offered (true) or not (false). */
export type ServicesOffered = {
  [category: string]: {
    [serviceKey: string]: boolean;
  };
};

export type QuestionnaireData = {
  client_name: string;
  business_name: string;
  business_address: BusinessAddress;
  website: string;
  work_number: string;
  email: string;
  emergency_line: string;
  numbers_to_bypass_csv: string;

  days_open: string[];
  business_hours: BusinessHours;
  time_zone: string;
  primary_service_area: string;
  travel_radius_value: number;
  travel_radius_unit: "miles" | "minutes";
  out_of_area_behavior: string;
  after_hours_behavior: string;
  holiday_notes: string;

  service_categories: string[];
  services_offered: ServicesOffered;
  custom_services: Array<{
    category: string;
    label: string;
    enabled: boolean | null;
  }>;

  required_intake_fields: string[];
  pricing_behavior: string;
  scheduling_behavior: string;
  emergency_behavior: string;
  existing_customer_behavior: string;
  greeting_style: string;
  banned_phrases: string;
  business_notes: string;
};

/** Tri-state while editing: null = unanswered. */
export type ServiceTriState = boolean | null;

/** Answers for predefined services: category -> serviceKey -> tri-state */
export type WizardServiceAnswers = Record<string, Record<string, ServiceTriState>>;

export type CustomServiceRow = {
  id: string;
  category: string;
  label: string;
  offered: ServiceTriState;
};

/** Session + DB draft envelope (wizard state beyond QuestionnaireData). */
export type QuestionnaireDraftEnvelope = {
  version: 1;
  stepIndex: number;
  data: QuestionnaireData;
  wizardServiceAnswers: WizardServiceAnswers;
  customServices: CustomServiceRow[];
};

/** Normalized payload stored in final_payload for OLD GOLD bot logic. */
export type OldGoldFinalPayload = {
  questionnaire: QuestionnaireData;
  services_not_offered: ServicesOffered;
  supported_service_categories: string[];
  routing_signals: {
    out_of_area_behavior: string;
    after_hours_behavior: string;
    pricing_behavior: string;
    scheduling_behavior: string;
    emergency_behavior: string;
    existing_customer_behavior: string;
  };
};

export type ValidationResult = {
  ok: boolean;
  fieldErrors?: Record<string, string>;
  stepMessage?: string;
};
