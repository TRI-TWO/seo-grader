import { prisma } from '@/lib/prisma';
import { ClientStatus } from '@prisma/client';
import { getPlanTemplate, createPlan } from './plans';
import { validateSmokeyPreconditions } from './guardrails';
import {
  canActivatePlan,
  checkWIPLimit,
  getQueuedPlans,
  activateQueuedPlan,
} from './parallel';
import { logEvent } from './events';

/**
 * Get ALL active plans for a client (supports parallel plans)
 */
export async function getActivePlans(clientId: string) {
  return await prisma.plan.findMany({
    where: {
      clientId,
      status: 'active',
    },
    include: {
      tasks: {
        orderBy: {
          taskNumber: 'asc',
        },
        include: {
          checkpoint: true,
          toolSessions: {
            orderBy: {
              createdAt: 'desc',
            },
            take: 1,
          },
        },
      },
      dependsOnPlan: true,
      dependentPlans: true,
    },
    orderBy: {
      startedAt: 'asc',
    },
  });
}

/**
 * Get the active plan for a client (backward compatibility)
 * Returns first active plan
 */
export async function getActivePlan(clientId: string) {
  const plans = await getActivePlans(clientId);
  return plans[0] || null;
}

/**
 * Suggest a plan type based on client state
 * Analyzes recent audit results to determine best plan
 */
export async function suggestPlan(clientId: string): Promise<string | null> {
  // Validate preconditions
  const preconditions = await validateSmokeyPreconditions(clientId);
  if (!preconditions.valid) {
    return null;
  }

  // Get client's most recent audit
  const recentAudit = await prisma.auditResult.findFirst({
    where: {
      clientId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!recentAudit) {
    // No audit yet - suggest title_search_relevance as starting point
    return 'title_search_relevance';
  }

  // Analyze audit scores to suggest plan
  const auditData = recentAudit.rawSeoJson as any;
  const aiScore = recentAudit.aiOptimizationScore || 0;
  const titleScore = recentAudit.titleSearchRelevanceScore || 0;
  const technicalScore = recentAudit.technicalFoundationsScore || 0;

  // Check homepage eligibility (title score is key indicator)
  if (titleScore < 70) {
    return 'title_search_relevance';
  }

  // Check AI readability (AI score components)
  if (aiScore < 60) {
    return 'ai_modularity';
  }

  // Default to trust signals for well-performing sites
  return 'trust_signals';
}

/**
 * Create a new plan instance for a client
 * Checks WIP limit and dependencies, queues if needed
 * 
 * Guardrail: Plans can only be created by Smokey via decisions (or Admin override).
 */
export async function createPlanInstance(
  clientId: string,
  planType: string,
  scheduledMonth?: number,
  dependsOnPlanId?: string | null,
  decisionId?: string | null,
  isAdmin: boolean = false
): Promise<any> {
  // Validate preconditions
  const preconditions = await validateSmokeyPreconditions(clientId);
  if (!preconditions.valid) {
    throw new Error(`Smokey precondition failed: ${preconditions.reason}`);
  }

  // Guardrail: Validate plan creation authority
  const { validatePlanCreationAuthority } = await import('./guardrails');
  const authorityCheck = await validatePlanCreationAuthority(decisionId, isAdmin);
  if (!authorityCheck.valid) {
    throw new Error(`Plan creation guardrail: ${authorityCheck.reason}`);
  }

  // Get template
  const template = getPlanTemplate(planType);
  if (!template) {
    throw new Error(`Plan template not found for type: ${planType}`);
  }

  // Check if can activate
  const canActivate = await canActivatePlan(
    clientId,
    planType,
    dependsOnPlanId
  );

  // Determine initial status
  let initialStatus = 'pending';
  if (canActivate.canActivate) {
    initialStatus = 'active';
  } else {
    // Queue if at WIP limit
    const wipCheck = await checkWIPLimit(clientId);
    if (!wipCheck.underLimit) {
      initialStatus = 'queued';
    } else {
      // Can't activate due to dependencies or other reasons
      throw new Error(
        `Cannot create plan: ${canActivate.reason || 'Unknown reason'}`
      );
    }
  }

  // Create plan with tasks
  const plan = await createPlan(
    clientId,
    planType,
    decisionId,
    scheduledMonth,
    dependsOnPlanId
  );

  // Update status if needed
  if (initialStatus !== 'pending') {
    await prisma.plan.update({
      where: { id: plan.id },
      data: { status: initialStatus },
    });
    plan.status = initialStatus;
    
    // Log event for status change
    if (initialStatus === 'active') {
      await logEvent(clientId, 'plan_created', 'plan', plan.id, {
        planType,
        status: 'active',
      });
    } else if (initialStatus === 'queued') {
      await logEvent(clientId, 'plan_queued', 'plan', plan.id, {
        planType,
      });
    }
  }

  return plan;
}

/**
 * Get the next ready task for a plan
 */
export async function getNextTask(planId: string) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      tasks: {
        orderBy: {
          taskNumber: 'asc',
        },
        include: {
          checkpoint: true,
        },
      },
    },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Find first ready or in-progress task
  const nextTask = plan.tasks.find(
    (task) =>
      task.status === 'ready' ||
      task.status === 'in_progress'
  );

  return nextTask || null;
}

/**
 * Unlock the next task after checkpoint passes
 */
export async function unlockNextTask(planId: string, currentTaskNumber: number) {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      tasks: {
        orderBy: {
          taskNumber: 'asc',
        },
      },
    },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const nextTaskNumber = currentTaskNumber + 1;

  // Check if there's a next task
  const nextTask = plan.tasks.find(
    (task) => task.taskNumber === nextTaskNumber
  );

  if (nextTask) {
    // Unlock next task (use ready status)
    await prisma.task.update({
      where: { id: nextTask.id },
      data: { status: 'ready' },
    });
    
    // Log event
    await logEvent(plan.clientId, 'task_created', 'task', nextTask.id, {
      planId,
      taskNumber: nextTask.taskNumber,
      status: 'ready',
    });
  } else {
    // All tasks completed - mark plan as completed
    await prisma.plan.update({
      where: { id: planId },
      data: {
        status: 'completed',
      },
    });

    // Log event
    await logEvent(plan.clientId, 'plan_completed', 'plan', plan.id, {});

    // Try to activate a queued plan
    await activateQueuedPlan(plan.clientId);
  }
}

/**
 * Get all plans for a client (including completed)
 */
export async function getClientPlans(clientId: string) {
  return await prisma.plan.findMany({
    where: { clientId },
    include: {
      decision: {
        select: {
          id: true,
          decisionSummary: true,
          decisionConfidence: true,
          reasoning: true,
        },
      },
      tasks: {
        orderBy: {
          taskNumber: 'asc',
        },
        include: {
          checkpoint: true,
        },
      },
      dependsOnPlan: true,
      dependentPlans: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get plans scheduled for a specific month
 */
export async function getPlansByMonth(clientId: string, month: number) {
  return await prisma.plan.findMany({
    where: {
      clientId,
      scheduledMonth: month,
    },
    include: {
      tasks: {
        orderBy: {
          taskNumber: 'asc',
        },
        include: {
          checkpoint: true,
        },
      },
    },
    orderBy: {
      startedAt: 'asc',
    },
  });
}

/**
 * Schedule a plan for a specific month
 */
export async function schedulePlanForMonth(planId: string, month: number) {
  const plan = await prisma.plan.update({
    where: { id: planId },
    data: { scheduledMonth: month },
  });
  
  await logEvent(plan.clientId, 'plan_created', 'plan', plan.id, {
    scheduledMonth: month,
  });
  
  return plan;
}

/**
 * Queue a plan (move to queued status)
 */
export async function queuePlan(planId: string) {
  return await prisma.plan.update({
    where: { id: planId },
    data: { status: 'queued' },
  });
}

/**
 * Pause an active plan
 */
export async function pausePlan(planId: string) {
  const plan = await prisma.plan.update({
    where: { id: planId },
    data: { status: 'paused' },
  });
  await logEvent(plan.clientId, 'plan_paused', 'plan', plan.id, {});
  return plan;
}

/**
 * Resume a paused plan
 */
export async function resumePlan(planId: string) {
  const plan = await prisma.plan.update({
    where: { id: planId },
    data: { status: 'active' },
  });
  await logEvent(plan.clientId, 'plan_resumed', 'plan', plan.id, {});
  return plan;
}

/**
 * Branch a plan to a new plan type, marking the current plan as branched
 */
export async function branchPlan(
  planId: string,
  newPlanType: string,
  reason: string
): Promise<any> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Mark current plan as completed (branched)
  await prisma.plan.update({
    where: { id: planId },
    data: {
      status: 'completed',
    },
  });

  // Create the new plan (via decision for proper authority)
  // For branching, we create a decision first, then the plan
  const { createDecisionWithPlans } = await import('./decisions');
  const { decision, plans } = await createDecisionWithPlans(
    plan.clientId,
    'branch_plan',
    null, // signalId
    `Branched from plan ${planId}: ${reason}`,
    [newPlanType],
    { branchedFrom: planId, reason }
  );
  
  const newPlan = plans[0];
  await logEvent(plan.clientId, 'plan_created', 'plan', newPlan.id, {
    branchedFrom: planId,
    reason,
    decisionId: decision.id,
  });
  return newPlan;
}

