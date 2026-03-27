import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(
    {
      error:
        'Wildcat leads are not stored as `Lead` in the current Supabase schema. Use `profiles` / `org_members` / CRM or add a leads table.',
    },
    { status: 501 }
  );
}
