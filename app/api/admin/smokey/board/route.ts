import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlansByMonth, getActivePlans } from '@/lib/smokey/planEngine';

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
    // Get client to determine contract duration
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    const contractDuration = client.contracts[0]?.lengthMonths || client.contractLengthMonths || 12;

    // Get plans organized by month
    const plansByMonth: Record<number, any[]> = {};
    for (let month = 1; month <= contractDuration; month++) {
      plansByMonth[month] = await getPlansByMonth(clientId, month);
    }

    // Get all active plans (may not have scheduledMonth set)
    const activePlans = await getActivePlans(clientId);

    return NextResponse.json({
      client: {
        id: client.id,
        companyName: client.companyName,
        canonicalUrl: client.canonicalUrl,
        planTier: client.planTier,
        contractDuration,
      },
      plansByMonth,
      activePlans,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load board data' },
      { status: 500 }
    );
  }
}
