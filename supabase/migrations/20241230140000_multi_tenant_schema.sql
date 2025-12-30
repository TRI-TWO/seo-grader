-- Multi-tenant schema for TRI-TWO
-- Run this in Supabase SQL editor

-- 1. Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  display_name text,
  created_at timestamptz DEFAULT now()
);

-- 2. Tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Tenant memberships table
CREATE TABLE IF NOT EXISTS tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','member','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 4. Audits table (tenant-scoped)
CREATE TABLE IF NOT EXISTS audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  result_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. LLM runs table
CREATE TABLE IF NOT EXISTS llm_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  audit_id uuid REFERENCES audits(id) ON DELETE CASCADE,
  engine text NOT NULL CHECK (engine IN ('crimson','midnight','burnt')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','complete','failed')),
  input_json jsonb,
  output_json jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row-Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_runs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if current user is a member of a tenant
CREATE OR REPLACE FUNCTION current_user_is_member(tenant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_memberships
    WHERE tenant_memberships.tenant_id = current_user_is_member.tenant_id
      AND tenant_memberships.user_id = auth.uid()
  );
$$;

-- Helper function: Get current user's role in a tenant
CREATE OR REPLACE FUNCTION current_user_role(tenant_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM tenant_memberships
  WHERE tenant_memberships.tenant_id = current_user_role.tenant_id
    AND tenant_memberships.user_id = auth.uid()
  LIMIT 1;
$$;

-- RLS Policies for tenants
CREATE POLICY "Users can view tenants they are members of"
  ON tenants FOR SELECT
  USING (current_user_is_member(id));

-- RLS Policies for tenant_memberships
CREATE POLICY "Users can view their own memberships"
  ON tenant_memberships FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships in their tenants"
  ON tenant_memberships FOR ALL
  USING (
    current_user_role(tenant_id) = 'admin'
  );

-- RLS Policies for audits
CREATE POLICY "Users can view audits for their tenants"
  ON audits FOR SELECT
  USING (current_user_is_member(tenant_id));

CREATE POLICY "Users can create audits for their tenants"
  ON audits FOR INSERT
  WITH CHECK (current_user_is_member(tenant_id));

CREATE POLICY "Users can update audits for their tenants"
  ON audits FOR UPDATE
  USING (current_user_is_member(tenant_id));

CREATE POLICY "Admins can delete audits in their tenants"
  ON audits FOR DELETE
  USING (current_user_role(tenant_id) = 'admin');

-- RLS Policies for llm_runs
CREATE POLICY "Users can view llm_runs for their tenants"
  ON llm_runs FOR SELECT
  USING (current_user_is_member(tenant_id));

CREATE POLICY "Users can create llm_runs for their tenants"
  ON llm_runs FOR INSERT
  WITH CHECK (current_user_is_member(tenant_id));

CREATE POLICY "Users can update llm_runs for their tenants"
  ON llm_runs FOR UPDATE
  USING (current_user_is_member(tenant_id));

CREATE POLICY "Admins can delete llm_runs in their tenants"
  ON llm_runs FOR DELETE
  USING (current_user_role(tenant_id) = 'admin');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_id ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant_id ON tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audits_tenant_id ON audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audits_created_by ON audits(created_by);
CREATE INDEX IF NOT EXISTS idx_llm_runs_tenant_id ON llm_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_llm_runs_audit_id ON llm_runs(audit_id);

