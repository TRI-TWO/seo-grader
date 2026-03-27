import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Legacy play engine removed from typecheck; platform uses `smokey_plays` + different APIs. */
export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    {
      error:
        'Smokey plays API is not available in this build. Use Supabase `smokey_plays` or restore `lib/smokey` migration.',
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
        'Smokey plays API is not available in this build. Use Supabase `smokey_plays` or restore `lib/smokey` migration.',
    },
    { status: 501 }
  );
}
