-- Local Service OS tier capability gating

INSERT INTO capabilities (key, description) VALUES
('maps_tracking_visibility', 'View maps tracking and local reporting'),
('geo_visibility_features', 'View GEO expansion and advanced local visibility features')
ON CONFLICT (key) DO NOTHING;

-- Existing tier model in repo (starter/growth/enterprise)
INSERT INTO tier_capabilities (tier, capability_key) VALUES
('growth', 'maps_tracking_visibility'),
('enterprise', 'maps_tracking_visibility'),
('enterprise', 'geo_visibility_features')
ON CONFLICT DO NOTHING;

-- Note: current schema supports starter/growth/enterprise tiers.
-- If/when tier enums are migrated to FOUNDATION/SEO_CORE/SEO_ELITE,
-- mirror these capability mappings in that migration.

