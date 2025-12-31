import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const clients = await prisma.client.findMany({
      include: {
        lead: true,
        contracts: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ clients });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load clients' },
      { status: 500 }
    );
  }
}

