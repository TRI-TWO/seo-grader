-- Drop existing policies if they exist
DROP POLICY IF EXISTS "llm_runs_read_own" ON llm_runs;
DROP POLICY IF EXISTS "llm_runs_insert_own" ON llm_runs;
DROP POLICY IF EXISTS "llm_runs_update_own" ON llm_runs;
DROP POLICY IF EXISTS "llm_runs_delete_own" ON llm_runs;

-- Users can read their own runs
CREATE POLICY "llm_runs_read_own"
ON llm_runs FOR SELECT
USING (user_id = auth.uid());

-- Users can insert runs for themselves
CREATE POLICY "llm_runs_insert_own"
ON llm_runs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own runs
CREATE POLICY "llm_runs_update_own"
ON llm_runs FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own runs (optional)
CREATE POLICY "llm_runs_delete_own"
ON llm_runs FOR DELETE
USING (user_id = auth.uid());

