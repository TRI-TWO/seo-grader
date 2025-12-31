-- Add persona and role columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS persona TEXT 
  CHECK (persona IN ('smokey', 'bulldog')) 
  NOT NULL DEFAULT 'bulldog',
ADD COLUMN IF NOT EXISTS role TEXT 
  CHECK (role IN ('admin', 'user')) 
  NOT NULL DEFAULT 'user';

-- Create index for persona lookups
CREATE INDEX IF NOT EXISTS idx_profiles_persona ON profiles(persona);

