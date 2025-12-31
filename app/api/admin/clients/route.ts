import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ClientStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Only return clients that are signed or active (Smokey can work with)
    const clients = await prisma.client.findMany({
      where: {
        status: {
          in: [ClientStatus.SIGNED, ClientStatus.ACTIVE],
        },
      },
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        lead: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ clients });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load clients' },
      { status: 500 }
    );
  }
}

