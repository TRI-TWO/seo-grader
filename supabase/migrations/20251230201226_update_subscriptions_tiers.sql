-- Update subscriptions table tier constraint
ALTER TABLE subscriptions
DROP CONSTRAINT IF EXISTS subscriptions_tier_check;

ALTER TABLE subscriptions
ADD CONSTRAINT subscriptions_tier_check 
  CHECK (tier IN ('starter', 'growth', 'enterprise'));

-- Update existing data (if any)
UPDATE subscriptions 
SET tier = 'starter' WHERE tier = 'base';
UPDATE subscriptions 
SET tier = 'growth' WHERE tier = 'pro';

