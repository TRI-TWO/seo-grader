-- Drop existing policies if they exist
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- Users can read their own profile
CREATE POLICY "profiles_read_own"
ON profiles FOR SELECT
USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
USING (id = auth.uid());

