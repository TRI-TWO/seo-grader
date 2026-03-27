import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Legacy plan engine excluded from compilation; `public.plans` schema differs from old Prisma models. */
export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    {
      error:
        'Smokey plans API is not available in this build. Align `lib/smokey/planEngine` with `public.plans` / `public.tasks` or query Prisma directly.',
    },
    { status: 501 }
  );
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    {
      error:
        'Smokey plans API is not available in this build. Align `lib/smokey/planEngine` with `public.plans` / `public.tasks` or query Prisma directly.',
    },
    { status: 501 }
  );
}
