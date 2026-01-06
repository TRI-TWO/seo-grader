import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('clientId');

  try {
    const now = new Date();
    
    // Find plans that are due for reassessment
    const where: any = {
      status: 'completed',
      reassessAfter: {
        lte: now,
      },
    };

    if (clientId) {
      where.clientId = clientId;
    }

    const plans = await prisma.plan.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            companyName: true,
            canonicalUrl: true,
          },
        },
        tasks: {
          orderBy: {
            taskNumber: 'desc',
          },
          take: 1,
          include: {
            checkpoint: true,
          },
        },
      },
      orderBy: {
        reassessAfter: 'asc',
      },
    });

    // Group by date
    const grouped: Record<string, any[]> = {};
    for (const plan of plans) {
      const dateKey = plan.reassessAfter?.toISOString().split('T')[0] || 'unknown';
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(plan);
    }

    return NextResponse.json({ plans: grouped });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load reassess queue' },
      { status: 500 }
    );
  }
}
