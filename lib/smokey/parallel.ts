import { prisma } from '@/lib/prisma';
import { PlanTier } from '@prisma/client';
import { canRunInParallel } from './plans';

/**
 * WIP Limits by Tier
 * - starter (6 mo): parallel_plan_limit = 1
 * - growth (9 mo): parallel_plan_limit = 1 (optionally 2)
 * - accelerate (12 mo): parallel_plan_limit = 2 (max 3)
 */
const TIER_WIP_LIMITS: Record<PlanTier, number> = {
  starter: 1,
  growth: 1, // Can be increased to 2 later
  accelerate: 2, // Max 3 if needed
};

/**
 * Get or create client config with tier-based parallel plan limit
 */
export async function getClientConfig(clientId: string) {
  let config = await prisma.clientConfig.findUnique({
    where: { clientId },
  });

  if (!config) {
    // Get client to determine tier
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
      throw new Error(`Client ${clientId} not found`);
    }

    const tier = client.contracts[0]?.planTier || client.planTier || PlanTier.starter;
    const parallelPlanLimit = TIER_WIP_LIMITS[tier];

    config = await prisma.clientConfig.create({
      data: {
        clientId,
        tier,
        parallelPlayLimit: parallelPlanLimit, // Keep field name for now
      },
    });
  }

  return config;
}

/**
 * Check if client is under WIP limit
 * Returns { underLimit: boolean, activeCount: number, limit: number }
 */
export async function checkWIPLimit(clientId: string) {
  const config = await getClientConfig(clientId);

  const activeCount = await prisma.plan.count({
    where: {
      clientId,
      status: 'active',
    },
  });

  return {
    underLimit: activeCount < config.parallelPlayLimit,
    activeCount,
    limit: config.parallelPlayLimit,
  };
}

/**
 * Check if a plan's dependencies are met
 */
export async function checkDependencies(
  planType: string,
  clientId: string,
  dependsOnPlanId?: string | null
): Promise<{ valid: boolean; reason?: string }> {
  if (!dependsOnPlanId) {
    return { valid: true };
  }

  // Check if dependency plan exists and is completed
  const dependencyPlan = await prisma.plan.findUnique({
    where: { id: dependsOnPlanId },
  });

  if (!dependencyPlan) {
    return {
      valid: false,
      reason: `Dependency plan ${dependsOnPlanId} not found`,
    };
  }

  if (dependencyPlan.clientId !== clientId) {
    return {
      valid: false,
      reason: 'Dependency plan belongs to different client',
    };
  }

  if (dependencyPlan.status !== 'completed') {
    return {
      valid: false,
      reason: `Dependency plan is ${dependencyPlan.status}, must be completed`,
    };
  }

  return { valid: true };
}

/**
 * Get plans that can run concurrently with the given plan type
 */
export async function getParallelSafePlans(
  clientId: string,
  planType: string
): Promise<any[]> {
  const activePlans = await prisma.plan.findMany({
    where: {
      clientId,
      status: 'active',
    },
  });

  // Filter to plans that are parallel-safe with the given plan type
  return activePlans.filter((plan) =>
    canRunInParallel(planType, plan.planType)
  );
}

/**
 * Combined check: Can activate plan? (WIP limit + dependencies + parallel safety)
 */
export async function canActivatePlan(
  clientId: string,
  planType: string,
  dependsOnPlanId?: string | null
): Promise<{ canActivate: boolean; reason?: string }> {
  // Check WIP limit
  const wipCheck = await checkWIPLimit(clientId);
  if (!wipCheck.underLimit) {
    return {
      canActivate: false,
      reason: `WIP limit reached (${wipCheck.activeCount}/${wipCheck.limit} active plans)`,
    };
  }

  // Check dependencies
  const depCheck = await checkDependencies(planType, clientId, dependsOnPlanId);
  if (!depCheck.valid) {
    return {
      canActivate: false,
      reason: depCheck.reason,
    };
  }

  // Check parallel safety with existing active plans
  const safePlans = await getParallelSafePlans(clientId, planType);
  const unsafePlans = await prisma.plan.findMany({
    where: {
      clientId,
      status: 'active',
    },
  });

  // If there are active plans that aren't parallel-safe, check if we're at limit
  const unsafeCount = unsafePlans.length - safePlans.length;
  if (unsafeCount > 0 && !wipCheck.underLimit) {
    return {
      canActivate: false,
      reason: 'Cannot run in parallel with existing active plans',
    };
  }

  return { canActivate: true };
}

/**
 * Get queued plans for a client
 */
export async function getQueuedPlans(clientId: string) {
  return await prisma.plan.findMany({
    where: {
      clientId,
      status: 'queued',
    },
    orderBy: {
      createdAt: 'asc', // FIFO queue
    },
  });
}

/**
 * Activate next queued plan when WIP slot opens
 */
export async function activateQueuedPlan(clientId: string): Promise<any | null> {
  const wipCheck = await checkWIPLimit(clientId);
  if (!wipCheck.underLimit) {
    return null; // No slot available
  }

  const queuedPlans = await getQueuedPlans(clientId);
  if (queuedPlans.length === 0) {
    return null; // No queued plans
  }

  // Try to activate the first queued plan
  const planToActivate = queuedPlans[0];

  // Check if it can be activated now
  const canActivate = await canActivatePlan(
    clientId,
    planToActivate.planType,
    planToActivate.dependsOnPlanId
  );

  if (!canActivate.canActivate) {
    return null; // Still can't activate (dependency not met, etc.)
  }

  // Activate the plan
  const activated = await prisma.plan.update({
    where: { id: planToActivate.id },
    data: {
      status: 'active',
    },
  });

  return activated;
}

/**
 * Update client config parallel plan limit (admin function)
 */
export async function updateParallelPlanLimit(
  clientId: string,
  newLimit: number
) {
  const config = await getClientConfig(clientId);

  // Validate limit based on tier
  const tier = config.tier;
  const maxLimit = tier === PlanTier.accelerate ? 3 : tier === PlanTier.growth ? 2 : 1;

  if (newLimit > maxLimit) {
    throw new Error(
      `Parallel plan limit cannot exceed ${maxLimit} for ${tier} tier`
    );
  }

  return await prisma.clientConfig.update({
    where: { id: config.id },
    data: {
      parallelPlayLimit: newLimit,
    },
  });
}
