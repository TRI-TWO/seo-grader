-- Drop existing policy if it exists
DROP POLICY IF EXISTS "subscriptions_read_own" ON subscriptions;

-- Users can read their own subscription
CREATE POLICY "subscriptions_read_own"
ON subscriptions FOR SELECT
USING (user_id = auth.uid());

