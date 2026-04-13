import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Disabled: Supabase SSR client pulls Node APIs that can crash in Edge Runtime.
  // Auth gating is handled inside server components and route handlers.
  return NextResponse.next()
}

export const config = {
  // Disable middleware matching entirely.
  matcher: [],
};

