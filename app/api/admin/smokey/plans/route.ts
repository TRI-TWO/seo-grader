import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getActivePlans,
  getActivePlan,
  suggestPlan,
  createPlanInstance,
  getClientPlans,
  getPlansByMonth,
} from '@/lib/smokey/planEngine';
import { getQueuedPlans } from '@/lib/smokey/parallel';

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clientId = searchParams.get('clientId');
  const action = searchParams.get('action'); // 'active' | 'suggest' | 'all'

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  try {
    if (action === 'active') {
      const plans = await getActivePlans(clientId);
      return NextResponse.json({ plans });
    } else if (action === 'queued') {
      const plans = await getQueuedPlans(clientId);
      return NextResponse.json({ plans });
    } else if (action === 'suggest') {
      const suggestedPlanType = await suggestPlan(clientId);
      return NextResponse.json({ suggestedPlanType });
    } else if (action === 'all') {
      const plans = await getClientPlans(clientId);
      // Plans already include decision data from getClientPlans
      return NextResponse.json({ plans });
    } else if (action === 'by-month') {
      const month = searchParams.get('month');
      if (!month) {
        return NextResponse.json(
          { error: 'month parameter is required for by-month action' },
          { status: 400 }
        );
      }
      const plans = await getPlansByMonth(clientId, parseInt(month));
      return NextResponse.json({ plans });
    } else {
      // Default: get all active plans
      const plans = await getActivePlans(clientId);
      return NextResponse.json({ plans });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { clientId, planType, scheduledMonth, dependsOnPlanId, decisionId } = body;

    if (!clientId) {
      return NextResponse.json(
        { error: 'clientId is required' },
        { status: 400 }
      );
    }

    if (!planType) {
      return NextResponse.json(
        { error: 'planType is required' },
        { status: 400 }
      );
    }

    // Admin can override (manual plan creation)
    const isAdmin = user.email === 'mgr@tri-two.com';
    const plan = await createPlanInstance(
      clientId,
      planType,
      scheduledMonth,
      dependsOnPlanId,
      decisionId,
      isAdmin
    );
    return NextResponse.json({ plan });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create plan' },
      { status: 500 }
    );
  }
}

