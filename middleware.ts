import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';

function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email === 'mgr@tri-two.com' || email === 'tri-two@mgr';
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedAdmin = pathname.startsWith('/admin');
  const protectedArch = pathname === '/arch' || pathname.startsWith('/arch/');

  // Protect /admin/* and /arch/* routes
  if (protectedAdmin || protectedArch) {
    try {
      const { supabase, response } = createClient(request);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      const isAdmin = isAdminEmail(user.email);

      // Admin pages are admin only
      if (protectedAdmin && !isAdmin) {
        return NextResponse.redirect(new URL('/arch', request.url));
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
  matcher: ['/admin', '/admin/:path*', '/arch', '/arch/:path*'],
};

