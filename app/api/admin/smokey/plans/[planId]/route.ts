import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Legacy Smokey plans API is not available on the current schema.' },
    { status: 501 }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: { planId: string } }
) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Legacy Smokey plans API is not available on the current schema.' },
    { status: 501 }
  );
}

