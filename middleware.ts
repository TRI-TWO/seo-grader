import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';
import { prisma } from '@/lib/prisma';

export async function middleware(request: NextRequest) {
  // Protect /admin/* routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    try {
      const { supabase } = createClient(request);
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        // Redirect to login if not authenticated
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check role from user metadata
      const role = (user.user_metadata?.role as string) || 'VISITOR';
      
      // Also verify in Prisma User table
      try {
        const prismaUser = await prisma.user.findUnique({
          where: { email: user.email || '' },
        });

        const isAdmin = (role === 'ADMIN' && prismaUser?.role === 'ADMIN') || false;

        if (!isAdmin) {
          // Redirect to home if not admin
          return NextResponse.redirect(new URL('/', request.url));
        }
      } catch (prismaError) {
        console.error('Error checking Prisma user in middleware:', prismaError);
        // Fallback to Supabase metadata check
        if (role !== 'ADMIN') {
          return NextResponse.redirect(new URL('/', request.url));
        }
      }
    } catch (error) {
      console.error('Middleware error:', error);
      // Redirect to login on error
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

