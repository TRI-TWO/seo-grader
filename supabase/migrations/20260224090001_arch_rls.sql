-- RLS policies for Arch tables

ALTER TABLE arch_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_signal_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_events ENABLE ROW LEVEL SECURITY;

-- Service role full access

CREATE POLICY arch_clients_service_all
ON arch_clients
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY arch_categories_service_all
ON arch_categories
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY arch_signals_service_all
ON arch_signals
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY arch_rules_service_all
ON arch_rules
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY arch_signal_values_service_all
ON arch_signal_values
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY arch_snapshots_service_all
ON arch_snapshots
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY arch_events_service_all
ON arch_events
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

