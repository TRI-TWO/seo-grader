-- Arch module schema
-- Client-facing SEO & growth health layer

CREATE TABLE IF NOT EXISTS arch_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/New_York',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arch_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arch_categories_client_key_unique UNIQUE (client_id, key)
);

CREATE TABLE IF NOT EXISTS arch_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  category_id uuid NOT NULL,
  key text NOT NULL,
  label text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  direction text NOT NULL DEFAULT 'higher_is_better',
  unit text NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arch_signals_client_key_unique UNIQUE (client_id, key)
);

CREATE TABLE IF NOT EXISTS arch_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  signal_id uuid NOT NULL,
  rule_type text NOT NULL DEFAULT 'threshold',
  operator text NOT NULL,
  threshold numeric NOT NULL,
  points int NOT NULL,
  message text NOT NULL,
  action_title text NULL,
  action_detail text NULL,
  severity text NOT NULL DEFAULT 'info',
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS arch_signal_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  signal_id uuid NOT NULL,
  as_of_date date NOT NULL,
  value numeric NOT NULL,
  source text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arch_signal_values_unique_per_day UNIQUE (client_id, signal_id, as_of_date)
);

CREATE TABLE IF NOT EXISTS arch_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  as_of_date date NOT NULL,
  overall_score int NOT NULL,
  category_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_positive_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_negative_drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT arch_snapshots_unique_per_day UNIQUE (client_id, as_of_date)
);

CREATE TABLE IF NOT EXISTS arch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  detail text NULL,
  as_of_date date NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arch_clients_client_id ON arch_clients (client_id);
CREATE INDEX IF NOT EXISTS idx_arch_categories_client_id ON arch_categories (client_id);
CREATE INDEX IF NOT EXISTS idx_arch_signals_client_id ON arch_signals (client_id);
CREATE INDEX IF NOT EXISTS idx_arch_rules_client_id ON arch_rules (client_id);
CREATE INDEX IF NOT EXISTS idx_arch_signal_values_client_id_date ON arch_signal_values (client_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_arch_snapshots_client_id_date ON arch_snapshots (client_id, as_of_date);
CREATE INDEX IF NOT EXISTS idx_arch_events_client_id_date ON arch_events (client_id, as_of_date);

