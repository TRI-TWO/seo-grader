import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contracts = await prisma.contract.findMany({
      include: {
        client: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ contracts });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load contracts' },
      { status: 500 }
    );
  }
}

