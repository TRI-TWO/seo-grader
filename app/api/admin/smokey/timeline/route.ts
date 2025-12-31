import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getClientTimeline } from '@/lib/smokey/scheduler';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
  }

  try {
    const timeline = await getClientTimeline(clientId);
    return NextResponse.json({ timeline });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load timeline' },
      { status: 500 }
    );
  }
}

