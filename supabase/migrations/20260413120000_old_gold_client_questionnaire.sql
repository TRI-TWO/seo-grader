-- OLD GOLD client questionnaire: draft + final payloads (one row per client)

create table if not exists public.old_gold_client_questionnaires (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null default 'draft',
  draft_payload jsonb not null default '{}'::jsonb,
  final_payload jsonb null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint old_gold_client_questionnaires_client_id_unique unique (client_id),
  constraint old_gold_client_questionnaires_status_check
    check (status in ('draft', 'completed'))
);

create index if not exists idx_old_gold_client_questionnaires_client_id
  on public.old_gold_client_questionnaires (client_id);

drop trigger if exists trg_old_gold_client_questionnaires_updated_at on public.old_gold_client_questionnaires;
create trigger trg_old_gold_client_questionnaires_updated_at
before update on public.old_gold_client_questionnaires
for each row execute function public.set_updated_at();
