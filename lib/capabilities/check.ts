import { createClient } from '@/lib/supabase/server';

/**
 * Check if user has a specific capability
 * Smokey users and admin users (mgr@tri-two.com) bypass all checks (have all capabilities)
 */
export async function hasCapability(
  userId: string,
  capabilityKey: string
): Promise<boolean> {
  const supabase = createClient();

  // Check if user is Smokey (bypasses all tier checks)
  const { data: profile } = await supabase
    .from('profiles')
    .select('persona, email')
    .eq('id', userId)
    .single();

  if (profile?.persona === 'smokey') {
    return true; // Smokey has all capabilities
  }

  // Check if user is admin by email (bypasses all tier checks)
  if (profile?.email === 'mgr@tri-two.com') {
    return true; // Admin has all capabilities
  }

  // Get user's subscription tier
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription?.tier) {
    return false; // No active subscription
  }

  // Check if tier has the capability
  const { data: tierCapability } = await supabase
    .from('tier_capabilities')
    .select('capability_key')
    .eq('tier', subscription.tier)
    .eq('capability_key', capabilityKey)
    .single();

  return !!tierCapability;
}

/**
 * Get all capabilities for a user
 * Returns all capability keys the user has access to
 */
export async function getUserCapabilities(userId: string): Promise<string[]> {
  const supabase = createClient();

  // Check if user is Smokey
  const { data: profile } = await supabase
    .from('profiles')
    .select('persona')
    .eq('id', userId)
    .single();

  if (profile?.persona === 'smokey') {
    // Smokey has all capabilities - return all
    const { data: allCapabilities } = await supabase
      .from('capabilities')
      .select('key');
    
    return allCapabilities?.map(c => c.key) || [];
  }

  // Get user's subscription tier
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (!subscription?.tier) {
    return []; // No active subscription
  }

  // Get all capabilities for the tier
  const { data: tierCapabilities } = await supabase
    .from('tier_capabilities')
    .select('capability_key')
    .eq('tier', subscription.tier);

  return tierCapabilities?.map(tc => tc.capability_key) || [];
}

/**
 * Check if user is Smokey persona (bypasses tier logic)
 */
export async function isSmokeyUser(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('persona')
    .eq('id', userId)
    .single();

  return profile?.persona === 'smokey';
}

/**
 * Get user's persona
 */
export async function getUserPersona(userId: string): Promise<'smokey' | 'wildcat' | null> {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('persona')
    .eq('id', userId)
    .single();

  return profile?.persona as 'smokey' | 'wildcat' | null;
}

