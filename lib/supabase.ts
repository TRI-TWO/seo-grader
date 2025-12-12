import { createClient } from '@supabase/supabase-js';

// Lazy initialization pattern to prevent build-time errors
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.warn('SUPABASE_URL is not set. Supabase client will not be available.');
}

if (!supabaseServiceKey) {
  console.warn('SUPABASE_SERVICE_ROLE_KEY is not set. Supabase client will not be available.');
}

// Create Supabase client with service role key (server-side only, admin privileges)
export const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Helper function to get Supabase client (with error handling)
export function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }
  return supabase;
}
