-- Admin-created Arch client onboarding records (extends org + clients + auth linkage)

create table if not exists public.client_portal_registrations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  auth_user_id uuid not null unique,
  org_id uuid not null references public.organizations (id) on delete cascade,
  contact_name text not null,
  company_name text not null,
  email text not null,
  phone text not null,
  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  zip text not null,
  industry text not null,
  invite_status text not null default 'pending',
  invited_at timestamptz not null default now(),
  invite_email_sent_at timestamptz,
  questionnaire_status text not null default 'not_started',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_portal_registrations_invite_status_check
    check (invite_status in ('pending', 'sent', 'accepted', 'inactive')),
  constraint client_portal_registrations_questionnaire_status_check
    check (questionnaire_status in ('not_started', 'in_progress', 'completed'))
);

create index if not exists idx_client_portal_registrations_email
  on public.client_portal_registrations (lower(email));

create index if not exists idx_client_portal_registrations_deleted_at
  on public.client_portal_registrations (deleted_at);

drop trigger if exists trg_client_portal_registrations_updated_at on public.client_portal_registrations;
create trigger trg_client_portal_registrations_updated_at
before update on public.client_portal_registrations
for each row execute function public.set_updated_at();
