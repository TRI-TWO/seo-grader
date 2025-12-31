import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getAllLeads } from '@/lib/wildcat/leads';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get('status');
    const source = searchParams.get('source');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const leads = await getAllLeads({
      status: status as any,
      source: source as any,
      limit,
      offset,
    });

    return NextResponse.json({ leads });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load leads' },
      { status: 500 }
    );
  }
}

