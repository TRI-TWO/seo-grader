-- Supabase Migration: Create audit_jobs table
-- Copy and paste this entire file into Supabase SQL Editor and run it

-- Create audit_jobs table for storing audit job state and results
CREATE TABLE IF NOT EXISTS audit_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'done', 'error')),
  stage INTEGER DEFAULT 0,
  results JSONB,
  error_message TEXT,
  partial_audit BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_jobs_url_status_created ON audit_jobs(url, status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_jobs_status ON audit_jobs(status);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update updated_at on row updates
CREATE TRIGGER update_audit_jobs_updated_at
  BEFORE UPDATE ON audit_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify table was created
SELECT 'audit_jobs table created successfully!' as status;

