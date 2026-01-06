import { prisma } from '@/lib/prisma';
import { createPlan } from './plans';
import { logEvent } from './events';
import { SignalType } from './signals';

export type DecisionType = 
  | 'create_plan'
  | 'pause_plan'
  | 'resume_plan'
  | 'branch_plan'
  | 'complete_plan'
  | 'queue_plan';

/**
 * Calculate decision confidence based on signal strength and decision logic
 */
function calculateDecisionConfidence(
  signalId: string | null,
  decisionType: DecisionType,
  metadata?: any
): number {
  // Base confidence
  let confidence = 0.5;

  // If decision is based on a signal, increase confidence
  if (signalId) {
    confidence += 0.2; // Signal-based decisions are more confident
  }

  // Decision type affects confidence
  if (decisionType === 'create_plan') {
    confidence += 0.2; // Creating plans is a strong decision
  } else if (decisionType === 'branch_plan') {
    confidence += 0.1; // Branching is moderate confidence
  }

  // Signal strength from metadata
  if (metadata?.signalStrength) {
    confidence += metadata.signalStrength * 0.1; // Add up to 0.1 based on signal strength
  }

  // Cap at 1.0
  return Math.min(confidence, 1.0);
}

/**
 * Generate decision summary from reasoning and metadata
 */
function generateDecisionSummary(
  decisionType: DecisionType,
  reasoning: string,
  metadata?: any
): string {
  // Use reasoning if provided
  if (reasoning) {
    return reasoning;
  }

  // Generate summary from decision type and metadata
  const summaries: Record<DecisionType, string> = {
    create_plan: `Create plan based on ${metadata?.planType || 'analysis'}`,
    pause_plan: 'Pause plan due to dependencies or resource constraints',
    resume_plan: 'Resume plan after dependencies resolved',
    branch_plan: 'Branch plan due to checkpoint failure',
    complete_plan: 'Complete plan - all tasks finished',
    queue_plan: 'Queue plan - WIP limit reached',
  };

  return summaries[decisionType] || `Decision: ${decisionType}`;
}

/**
 * Analyze signals and create a decision
 * One decision can generate multiple plans
 */
export async function createDecision(
  clientId: string,
  decisionType: DecisionType,
  signalId: string | null,
  reasoning: string,
  metadata?: any
) {
  const decisionSummary = generateDecisionSummary(decisionType, reasoning, metadata);
  const decisionConfidence = calculateDecisionConfidence(signalId, decisionType, metadata);

  const decision = await prisma.decision.create({
    data: {
      clientId,
      signalId,
      decisionType,
      reasoning,
      decisionSummary,
      decisionConfidence,
      metadata: metadata || {},
    },
  });

  // Log event
  await logEvent(clientId, 'decision_created', 'decision', decision.id, {
    decisionType,
    reasoning,
    decisionSummary,
    decisionConfidence,
  });

  return decision;
}

/**
 * Create decision and generate plans from it
 * One decision can generate multiple plans
 */
export async function createDecisionWithPlans(
  clientId: string,
  decisionType: DecisionType,
  signalId: string | null,
  reasoning: string,
  planTypes: string[],
  metadata?: any
) {
  // Create decision
  const decision = await createDecision(
    clientId,
    decisionType,
    signalId,
    reasoning,
    metadata
  );

  // Generate plans from decision
  const plans = [];
  for (const planType of planTypes) {
    const plan = await createPlan(
      clientId,
      planType,
      decision.id,
      undefined, // scheduledMonth
      undefined, // dependsOnPlanId
      metadata
    );
    plans.push(plan);
  }

  return { decision, plans };
}

/**
 * Get decisions for a client
 */
export async function getClientDecisions(
  clientId: string,
  decisionType?: DecisionType,
  limit?: number
) {
  return await prisma.decision.findMany({
    where: {
      clientId,
      ...(decisionType && { decisionType }),
    },
    include: {
      signal: true,
      plans: {
        include: {
          tasks: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get decision by ID
 */
export async function getDecision(decisionId: string) {
  return await prisma.decision.findUnique({
    where: { id: decisionId },
    include: {
      signal: true,
      plans: {
        include: {
          tasks: {
            // Note: checkpoint fetched explicitly when needed
          },
        },
      },
    },
  });
}

