import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Protect /admin/* routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      const { supabase, response } = createClient(request);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check if user is admin by email
      const isAdmin = user.email === 'mgr@tri-two.com';

      if (!isAdmin) {
        // Redirect to home if not admin
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Return the response object to ensure cookies are properly handled
      return response;
    } catch (error) {
      console.error('Middleware error:', error);
      // Redirect to login on error
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For non-admin routes, allow through
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};

