-- Arch-specific capabilities

INSERT INTO capabilities (key, description) VALUES
('use_arch_dashboard', 'View Arch health dashboard'),
('configure_arch', 'Configure Arch categories, signals, and rules')
ON CONFLICT (key) DO NOTHING;

-- Enable Arch dashboard for growth and enterprise tiers by default
INSERT INTO tier_capabilities (tier, capability_key) VALUES
('growth', 'use_arch_dashboard'),
('enterprise', 'use_arch_dashboard'),
('enterprise', 'configure_arch')
ON CONFLICT DO NOTHING;

