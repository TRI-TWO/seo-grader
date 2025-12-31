-- Create capabilities table
CREATE TABLE IF NOT EXISTS capabilities (
  key TEXT PRIMARY KEY,
  description TEXT NOT NULL
);

-- Create tier_capabilities junction table
CREATE TABLE IF NOT EXISTS tier_capabilities (
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'growth', 'enterprise')),
  capability_key TEXT NOT NULL REFERENCES capabilities(key) ON DELETE CASCADE,
  PRIMARY KEY (tier, capability_key)
);

-- Seed capabilities
INSERT INTO capabilities (key, description) VALUES
('run_audit', 'Run SEO audits'),
('use_midnight', 'Use Midnight diagnostics'),
('use_crimson_templates', 'Create content via Crimson templates'),
('use_crimson_review', 'Edit pages via Crimson review'),
('use_burnt_scoring', 'Score and prioritize actions'),
('multi_page_runs', 'Run multi-page workflows'),
('admin_override', 'Bypass paywalls and limits')
ON CONFLICT (key) DO NOTHING;

-- Seed tier_capabilities
-- Starter
INSERT INTO tier_capabilities (tier, capability_key) VALUES
('starter', 'run_audit'),
('starter', 'use_midnight')
ON CONFLICT DO NOTHING;

-- Growth
INSERT INTO tier_capabilities (tier, capability_key) VALUES
('growth', 'run_audit'),
('growth', 'use_midnight'),
('growth', 'use_crimson_templates'),
('growth', 'use_burnt_scoring')
ON CONFLICT DO NOTHING;

-- Enterprise
INSERT INTO tier_capabilities (tier, capability_key) VALUES
('enterprise', 'run_audit'),
('enterprise', 'use_midnight'),
('enterprise', 'use_crimson_templates'),
('enterprise', 'use_crimson_review'),
('enterprise', 'use_burnt_scoring'),
('enterprise', 'multi_page_runs')
ON CONFLICT DO NOTHING;

