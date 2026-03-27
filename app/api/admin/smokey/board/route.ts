import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  try {
    // Legacy Smokey board endpoint depended on an older Prisma schema (Client/Contract/Plan models).
    // The current Supabase platform schema uses `clients`, `plans`, `tasks`, and a set of `smokey_*` tables.
    // This endpoint is intentionally disabled until the admin UI is migrated.
    return NextResponse.json(
      { error: 'Smokey board is not available on the current schema.' },
      { status: 501 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load board data' },
      { status: 500 }
    );
  }
}
