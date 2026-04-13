export const QUESTIONNAIRE_STEPS = [
  { id: 1, title: "Business info", description: "Contact and location details." },
  { id: 2, title: "Hours + service area", description: "When you operate and where you travel." },
  { id: 3, title: "Services offered", description: "Categories and each service line." },
  { id: 4, title: "Call handling", description: "How OLD GOLD should handle callers." },
  { id: 5, title: "Review + save", description: "Confirm and save your setup." },
] as const;

export const SERVICE_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Roofing",
  "Siding",
  "Painting",
  "Remodeling",
  "Pools",
  "Handyman",
  "General Contracting",
  "Other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

/** Stable key + display label per predefined service row */
export type ServiceDefinition = { key: string; label: string };

export const CATEGORY_SERVICE_DEFINITIONS: Record<string, ServiceDefinition[]> = {
  Plumbing: [
    { key: "leak_repair", label: "Leak repair" },
    { key: "drain_cleaning", label: "Drain cleaning" },
    { key: "toilet_repair", label: "Toilet repair" },
    { key: "faucet_repair", label: "Faucet repair" },
    { key: "water_heater_repair", label: "Water heater repair" },
    { key: "water_heater_replacement", label: "Water heater replacement" },
    { key: "sewer_line_work", label: "Sewer line work" },
    { key: "garbage_disposal_repair", label: "Garbage disposal repair" },
    { key: "emergency_plumbing", label: "Emergency plumbing" },
  ],
  Electrical: [
    { key: "outlet_switch_repair", label: "Outlet / switch repair" },
    { key: "lighting_install_repair", label: "Lighting install / repair" },
    { key: "breaker_panel_issues", label: "Breaker / panel issues" },
    { key: "panel_upgrades", label: "Panel upgrades" },
    { key: "ceiling_fan_install", label: "Ceiling fan install" },
    { key: "generator_work", label: "Generator work" },
    { key: "ev_charger_install", label: "EV charger install" },
    { key: "emergency_electrical", label: "Emergency electrical service" },
  ],
  HVAC: [
    { key: "ac_repair", label: "AC repair" },
    { key: "furnace_repair", label: "Furnace repair" },
    { key: "heat_pump_service", label: "Heat pump service" },
    { key: "seasonal_tuneups", label: "Seasonal tune-ups" },
    { key: "thermostat_install_repair", label: "Thermostat install / repair" },
    { key: "ductwork", label: "Ductwork" },
    { key: "new_system_installation", label: "New system installation" },
    { key: "emergency_hvac", label: "Emergency HVAC service" },
  ],
  Roofing: [
    { key: "roof_inspection", label: "Roof inspection" },
    { key: "shingle_repair", label: "Shingle repair" },
    { key: "leak_response", label: "Leak response" },
    { key: "full_replacement", label: "Full roof replacement" },
  ],
  Siding: [
    { key: "siding_repair", label: "Siding repair" },
    { key: "siding_replacement", label: "Siding replacement" },
    { key: "trim_capping", label: "Trim / capping" },
  ],
  Painting: [
    { key: "interior_painting", label: "Interior painting" },
    { key: "exterior_painting", label: "Exterior painting" },
    { key: "cabinet_finishing", label: "Cabinet finishing" },
  ],
  Remodeling: [
    { key: "kitchen_remodel", label: "Kitchen remodel" },
    { key: "bath_remodel", label: "Bath remodel" },
    { key: "basement_finish", label: "Basement finish" },
  ],
  Pools: [
    { key: "pool_open_close", label: "Pool open / close" },
    { key: "equipment_repair", label: "Equipment repair" },
    { key: "weekly_service", label: "Weekly service" },
  ],
  Handyman: [
    { key: "drywall_patch", label: "Drywall patch" },
    { key: "minor_repairs", label: "Minor repairs" },
    { key: "assembly_mounting", label: "Assembly / mounting" },
  ],
  "General Contracting": [
    { key: "project_management", label: "Project management" },
    { key: "subcontractor_coordination", label: "Subcontractor coordination" },
    { key: "permits_inspections", label: "Permits / inspections support" },
  ],
  Other: [
    { key: "general_service_1", label: "General service (line 1)" },
    { key: "general_service_2", label: "General service (line 2)" },
    { key: "general_service_3", label: "General service (line 3)" },
  ],
};

export const OUT_OF_AREA_OPTIONS: { value: string; label: string }[] = [
  { value: "take_message_office_decides", label: "Take message and let office decide" },
  { value: "politely_decline", label: "Politely decline" },
  { value: "route_office_review", label: "Route to office review" },
];

export const AFTER_HOURS_OPTIONS: { value: string; label: string }[] = [
  { value: "take_message", label: "Take message" },
  { value: "callback_details", label: "Ask for callback details" },
  { value: "route_emergency_line", label: "Route to emergency line" },
  { value: "voicemail", label: "Send to voicemail" },
];

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const US_TIME_ZONES: { value: string; label: string }[] = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

export const REQUIRED_INTAKE_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "caller_name", label: "Caller name" },
  { value: "phone_number", label: "Phone number" },
  { value: "service_address", label: "Service address" },
  { value: "service_issue", label: "Service issue" },
  { value: "urgency", label: "Urgency" },
  { value: "best_callback_time", label: "Best callback time" },
  { value: "email_address_optional", label: "Email address (optional)" },
];

export const PRICING_BEHAVIOR_OPTIONS: { value: string; label: string }[] = [
  { value: "do_not_provide_pricing", label: "Do not provide pricing" },
  { value: "starting_prices_only", label: "Provide starting prices only" },
  { value: "range_only", label: "Provide range only" },
  { value: "office_follow_up_required", label: "Office follow-up required" },
];

export const SCHEDULING_BEHAVIOR_OPTIONS: { value: string; label: string }[] = [
  { value: "do_not_promise_scheduling", label: "Do not promise scheduling" },
  { value: "collect_request_only", label: "Collect request only" },
  { value: "soft_callback_expectation", label: "Offer soft callback expectation only" },
];

export const EMERGENCY_BEHAVIOR_OPTIONS: { value: string; label: string }[] = [
  { value: "route_emergency_line", label: "Route to emergency line" },
  { value: "urgent_callback_request", label: "Take urgent callback request" },
  { value: "office_review", label: "Office review" },
];

export const EXISTING_CUSTOMER_BEHAVIOR_OPTIONS: { value: string; label: string }[] = [
  { value: "priority_callback", label: "Priority callback request" },
  { value: "immediate_transfer", label: "Immediate transfer" },
  { value: "standard_intake", label: "Standard intake" },
];
