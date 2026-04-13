-- Launch-core voice schema (Foundation): session, issue gate layer, extracted fields, outcomes,
-- notifications, settings mirror, callback commitments.
-- Additive; requires public.set_updated_at from prior migrations.

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  bot_client_id uuid null,
  channel_type text not null default 'voice',
  call_provider text not null default 'twilio',
  provider_call_id text not null,
  caller_phone text null,
  called_phone text null,
  started_at timestamptz null,
  ended_at timestamptz null,
  duration_seconds integer null,
  transcript_raw text null,
  summary_text text null,
  current_stage text null,
  call_outcome text null,
  needs_human_followup boolean not null default false,
  owner_notified_at timestamptz null,
  call_log_id uuid null references public.call_logs(id) on delete set null
);

create unique index if not exists idx_call_sessions_provider_call
  on public.call_sessions (call_provider, provider_call_id);

create index if not exists idx_call_sessions_bot_started
  on public.call_sessions (bot_client_id, started_at desc);

create table if not exists public.call_issue_state (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  issue_raw_initial text null,
  issue_raw_latest text null,
  issue_normalized_latest text null,
  issue_status text not null default 'unknown',
  issue_confirmed_at timestamptz null,
  correction_count integer not null default 0,
  last_correction_at timestamptz null,
  last_confirmation_prompt text null,
  last_confirmed_issue_text text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_session_id)
);

create table if not exists public.call_extracted_fields (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  caller_name text null,
  callback_phone text null,
  service_need text null,
  urgency_level text null,
  service_address text null,
  city text null,
  state text null,
  zip text null,
  estimate_requested boolean null,
  callback_requested boolean null,
  callback_expectation_text text null,
  existing_customer_flag boolean null,
  emergency_flag boolean null,
  unsupported_request_flag boolean null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_session_id)
);

create table if not exists public.call_outcomes (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  outcome_type text null,
  qualified_lead_flag boolean null,
  emergency_route_taken boolean null,
  existing_customer_route_taken boolean null,
  after_hours_flag boolean null,
  handoff_required boolean null,
  handoff_reason text null,
  follow_up_priority text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_session_id)
);

create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  notification_type text not null,
  destination text null,
  status text not null default 'pending',
  sent_at timestamptz null,
  payload_snapshot jsonb null default '{}'::jsonb,
  error_text text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_log_session
  on public.notification_log (call_session_id, created_at desc);

create table if not exists public.bot_client_settings (
  id uuid primary key default gen_random_uuid(),
  business_name text null,
  trade_type text null,
  greeting_style text null,
  service_area text null,
  services_offered jsonb null,
  excluded_services jsonb null,
  business_hours text null,
  fallback_phone text null,
  fallback_email text null,
  slack_destination text null,
  pricing_mode text null,
  emergency_service_enabled boolean null,
  emergency_routing_mode text null,
  emergency_forward_number text null,
  existing_customer_enabled boolean null,
  existing_customer_routing_mode text null,
  existing_customer_forward_number text null,
  after_hours_behavior text null,
  callback_expectation_policy text null,
  estimate_request_handling_mode text null,
  notes_guardrails text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.callback_commitments (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  commitment_type text not null,
  commitment_text text null,
  target_by timestamptz null,
  status text not null default 'open',
  completed_at timestamptz null,
  assigned_owner text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_callback_commitments_session
  on public.callback_commitments (call_session_id, status);

drop trigger if exists trg_call_sessions_updated_at on public.call_sessions;
create trigger trg_call_sessions_updated_at
before update on public.call_sessions
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_issue_state_updated_at on public.call_issue_state;
create trigger trg_call_issue_state_updated_at
before update on public.call_issue_state
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_extracted_fields_updated_at on public.call_extracted_fields;
create trigger trg_call_extracted_fields_updated_at
before update on public.call_extracted_fields
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_outcomes_updated_at on public.call_outcomes;
create trigger trg_call_outcomes_updated_at
before update on public.call_outcomes
for each row execute function public.set_updated_at();

drop trigger if exists trg_bot_client_settings_updated_at on public.bot_client_settings;
create trigger trg_bot_client_settings_updated_at
before update on public.bot_client_settings
for each row execute function public.set_updated_at();

drop trigger if exists trg_callback_commitments_updated_at on public.callback_commitments;
create trigger trg_callback_commitments_updated_at
before update on public.callback_commitments
for each row execute function public.set_updated_at();
