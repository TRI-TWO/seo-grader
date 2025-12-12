"use client";

import React from "react";

// Supabase Auth doesn't require a provider wrapper
// Components can directly use the Supabase client
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
