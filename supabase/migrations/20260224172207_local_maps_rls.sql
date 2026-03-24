-- Local Service OS v1 - Maps & GBP RLS

ALTER TABLE maps_rank_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_health_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role full access for backend workloads

CREATE POLICY maps_rank_snapshots_service_all
ON maps_rank_snapshots
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY gbp_health_snapshots_service_all
ON gbp_health_snapshots
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

