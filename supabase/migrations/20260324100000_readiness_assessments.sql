-- Local Service OS v1 - Readiness assessments

CREATE TABLE IF NOT EXISTS readiness_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  as_of_date date NOT NULL DEFAULT current_date,
  readiness_status text NOT NULL,
  readiness_score int NOT NULL,
  audit_scorecard_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  loom_url text NULL,
  top_5_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_track text NULL,
  source_inputs_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT readiness_assessments_unique_day UNIQUE (client_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_assessments_client_id
  ON readiness_assessments (client_id);

