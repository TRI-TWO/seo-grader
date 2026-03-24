-- Arch v1 denormalized client-safe output cache

CREATE TABLE IF NOT EXISTS arch_client_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  site_id text NULL,
  month_key text NOT NULL,
  health_score int NOT NULL DEFAULT 0,
  health_status text NOT NULL DEFAULT 'warning',
  health_direction text NOT NULL DEFAULT 'flat',
  summary text NULL,
  what_we_did_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  why_it_matters_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_next_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  trust_signals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  before_after_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  activity_summary_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  waiting_approval_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  upcoming_tasks_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  renewal_updates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arch_client_outputs_unique_month UNIQUE (client_id, month_key)
);

CREATE INDEX IF NOT EXISTS idx_arch_client_outputs_client_id
  ON arch_client_outputs (client_id);

