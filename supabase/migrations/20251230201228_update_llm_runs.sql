-- Add new columns to llm_runs
ALTER TABLE llm_runs
ADD COLUMN IF NOT EXISTS persona TEXT CHECK (persona IN ('smokey', 'bulldog')),
ADD COLUMN IF NOT EXISTS template_id TEXT,
ADD COLUMN IF NOT EXISTS visibility TEXT 
  CHECK (visibility IN ('private', 'client', 'internal')) 
  DEFAULT 'private';

-- Update tool constraint to include all tools
ALTER TABLE llm_runs
DROP CONSTRAINT IF EXISTS llm_runs_engine_check;

ALTER TABLE llm_runs
ADD CONSTRAINT llm_runs_tool_check 
  CHECK (tool IN ('audit', 'midnight', 'crimson', 'burnt'));

-- Rename engine column to tool if needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'llm_runs' AND column_name = 'engine'
  ) THEN
    ALTER TABLE llm_runs RENAME COLUMN engine TO tool;
  END IF;
END $$;

