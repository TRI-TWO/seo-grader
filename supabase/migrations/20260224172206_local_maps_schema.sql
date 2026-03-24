-- Local Service OS v1 - Maps & GBP schema

CREATE TABLE IF NOT EXISTS maps_rank_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  keyword text NOT NULL,
  city text NOT NULL,
  rank_position int NOT NULL,
  as_of_date date NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maps_rank_snapshots_unique_per_day UNIQUE (client_id, keyword, city, as_of_date)
);

CREATE TABLE IF NOT EXISTS gbp_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  primary_category text NOT NULL,
  secondary_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_count int NOT NULL,
  average_rating numeric NOT NULL,
  review_velocity_30d int NOT NULL,
  completeness_score int NOT NULL,
  as_of_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gbp_health_snapshots_unique_per_day UNIQUE (client_id, as_of_date)
);

CREATE INDEX IF NOT EXISTS idx_maps_rank_snapshots_client_date
  ON maps_rank_snapshots (client_id, as_of_date);

CREATE INDEX IF NOT EXISTS idx_gbp_health_snapshots_client_date
  ON gbp_health_snapshots (client_id, as_of_date);

