import { createClient } from '@supabase/supabase-js';

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

// Lazy initialization pattern to prevent build-time errors
const supabaseUrl = trimEnv(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseServiceKey = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);

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
    const url = trimEnv(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
    const key = trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const parts: string[] = [
      "Supabase admin client is not configured (required for Admin CRM auth operations).",
    ];
    if (!url) parts.push("Set SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
    if (!key) parts.push("Set SUPABASE_SERVICE_ROLE_KEY.");
    throw new Error(parts.join(" "));
  }
  return supabase;
}



