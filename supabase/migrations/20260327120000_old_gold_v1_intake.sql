create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_call_status') then
    create type lead_call_status as enum (
      'new',
      'intake_in_progress',
      'intake_completed',
      'callback_requested',
      'callback_scheduled',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'timeline_event_type') then
    create type timeline_event_type as enum (
      'call_answered',
      'intake_started',
      'intake_completed',
      'sms_sent',
      'slack_sent',
      'email_sent',
      'crm_logged',
      'callback_requested',
      'callback_scheduled'
    );
  end if;
end $$;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  client_account text not null,
  caller_name text null,
  caller_phone text not null,
  service_type text null,
  project_description text null,
  service_address text null,
  city text null,
  state text null,
  zip text null,
  is_emergency boolean not null default false,
  preferred_callback_notes text null,
  budget_notes text null,
  lead_source text not null default 'inbound_call_bot',
  call_summary text null,
  call_status lead_call_status not null default 'new',
  sms_sent boolean not null default false,
  email_sent boolean not null default false,
  slack_sent boolean not null default false,
  crm_logged boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid null references public.leads(id) on delete set null,
  client_account text not null,
  twilio_call_sid text not null unique,
  from_phone text not null,
  to_phone text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  duration_seconds integer null,
  transcript text null,
  recording_url text null,
  intake_completed boolean not null default false,
  call_outcome text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  call_log_id uuid null references public.call_logs(id) on delete set null,
  event_type timeline_event_type not null,
  channel text null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_leads_client_created_at
  on public.leads (client_account, created_at desc);

create index if not exists idx_leads_caller_phone
  on public.leads (caller_phone);

create index if not exists idx_leads_call_status_created_at
  on public.leads (call_status, created_at desc);

create index if not exists idx_call_logs_lead_id
  on public.call_logs (lead_id);

create index if not exists idx_call_logs_client_started_at
  on public.call_logs (client_account, started_at desc);

create index if not exists idx_timeline_events_lead_occurred_at
  on public.timeline_events (lead_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_leads_updated_at on public.leads;
create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists trg_call_logs_updated_at on public.call_logs;
create trigger trg_call_logs_updated_at
before update on public.call_logs
for each row execute function public.set_updated_at();

alter table public.leads
  drop constraint if exists leads_state_len_check;

alter table public.leads
  add constraint leads_state_len_check
  check (state is null or char_length(state) between 2 and 32);

alter table public.leads
  drop constraint if exists leads_zip_len_check;

alter table public.leads
  add constraint leads_zip_len_check
  check (zip is null or char_length(zip) between 3 and 16);
