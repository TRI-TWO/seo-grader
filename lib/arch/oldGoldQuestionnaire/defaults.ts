import type { QuestionnaireData, QuestionnaireDraftEnvelope } from "./types";

export function defaultQuestionnaireData(): QuestionnaireData {
  return {
    client_name: "",
    business_name: "",
    business_address: { street: "", city: "", state: "", zip: "" },
    website: "",
    work_number: "",
    email: "",
    emergency_line: "",
    numbers_to_bypass_csv: "",
    days_open: [],
    business_hours: { open: "", close: "" },
    time_zone: "America/New_York",
    primary_service_area: "",
    travel_radius_value: 0,
    travel_radius_unit: "miles",
    out_of_area_behavior: "",
    after_hours_behavior: "",
    holiday_notes: "",
    service_categories: [],
    services_offered: {},
    custom_services: [],
    required_intake_fields: [],
    pricing_behavior: "",
    scheduling_behavior: "",
    emergency_behavior: "",
    existing_customer_behavior: "",
    greeting_style: "",
    banned_phrases: "",
    business_notes: "",
  };
}

export function emptyDraftEnvelope(): QuestionnaireDraftEnvelope {
  return {
    version: 1,
    stepIndex: 0,
    data: defaultQuestionnaireData(),
    wizardServiceAnswers: {},
    customServices: [],
  };
}
