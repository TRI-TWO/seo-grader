import { prisma } from '@/lib/prisma';
import { PlayType, PlayStatus, StepStatus, ClientStatus } from '@prisma/client';
import { getPlayTemplate } from './plays';
import { validateSmokeyPreconditions } from './guardrails';
import {
  canActivatePlan,
  checkWIPLimit,
  getQueuedPlans,
  activateQueuedPlan,
} from './parallel';

// Legacy aliases for backward compatibility with Play system
const canActivatePlay = canActivatePlan;
const getQueuedPlays = getQueuedPlans;
const activateQueuedPlay = activateQueuedPlan;

/**
 * Get ALL active plays for a client (supports parallel plays)
 */
export async function getActivePlays(clientId: string) {
  return await prisma.play.findMany({
    where: {
      clientId,
      status: PlayStatus.ACTIVE,
    },
    include: {
      steps: {
        orderBy: {
          stepNumber: 'asc',
        },
        // Note: Legacy Play system - toolSessions relation removed
        // New ToolSession model is related to Task, not PlayStep
      },
      dependencyPlay: true,
      dependentPlays: true,
    },
    orderBy: {
      startedAt: 'asc',
    },
  });
}

/**
 * Get the active play for a client (backward compatibility)
 * Returns first active play
 */
export async function getActivePlay(clientId: string) {
  const plays = await getActivePlays(clientId);
  return plays[0] || null;
}

/**
 * Suggest a play type based on client state
 * Analyzes recent audit results to determine best play
 */
export async function suggestPlay(clientId: string): Promise<PlayType | null> {
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
    // No audit yet - suggest homepage_eligibility as starting point
    return PlayType.HOMEPAGE_ELIGIBILITY;
  }

  // Analyze audit scores to suggest play
  const auditData = recentAudit.rawSeoJson as any;
  const aiScore = recentAudit.aiOptimizationScore || 0;
  const titleScore = recentAudit.titleSearchRelevanceScore || 0;
  const technicalScore = recentAudit.technicalFoundationsScore || 0;

  // Check homepage eligibility (title score is key indicator)
  if (titleScore < 70) {
    return PlayType.HOMEPAGE_ELIGIBILITY;
  }

  // Check AI readability (AI score components)
  if (aiScore < 60) {
    return PlayType.AI_READABILITY;
  }

  // Default to trust structuring for well-performing sites
  return PlayType.TRUST_STRUCTURING;
}

/**
 * Create a new play instance for a client
 * Checks WIP limit and dependencies, queues if needed
 */
export async function createPlay(
  clientId: string,
  playType: PlayType,
  scheduledMonth?: number,
  dependsOnPlayId?: string | null
): Promise<any> {
  // Validate preconditions
  const preconditions = await validateSmokeyPreconditions(clientId);
  if (!preconditions.valid) {
    throw new Error(`Smokey precondition failed: ${preconditions.reason}`);
  }

  // Get template
  const template = getPlayTemplate(playType);
  if (!template) {
    throw new Error(`Play template not found for type: ${playType}`);
  }

  // Check if can activate
  const canActivate = await canActivatePlay(
    clientId,
    playType,
    dependsOnPlayId
  );

  // Determine initial status
  let initialStatus: PlayStatus = PlayStatus.PENDING;
  if (canActivate.canActivate) {
    initialStatus = PlayStatus.ACTIVE;
  } else {
    // Queue if at WIP limit
    const wipCheck = await checkWIPLimit(clientId);
    if (!wipCheck.underLimit) {
      initialStatus = PlayStatus.QUEUED;
    } else {
      // Can't activate due to dependencies or other reasons
      throw new Error(
        `Cannot create play: ${canActivate.reason || 'Unknown reason'}`
      );
    }
  }

  // Calculate reassessment date
  const reassessAfter = new Date();
  reassessAfter.setDate(reassessAfter.getDate() + template.reassessAfterDays);

  // Create play with steps using new step format
  const play = await prisma.play.create({
    data: {
      clientId,
      playType,
      status: initialStatus,
      currentStep: 1,
      reassessAfter,
      scheduledMonth,
      dependsOnPlayId,
      objective: template.objective,
      blocking: false, // Can be set based on play type
      steps: {
        create: template.steps.map((stepConfig) => ({
          stepNumber: stepConfig.stepNumber,
          stepCode: stepConfig.stepCode,
          title: stepConfig.title,
          status:
            stepConfig.stepNumber === 1 && initialStatus === PlayStatus.ACTIVE
              ? StepStatus.READY
              : StepStatus.LOCKED,
          toolSequence: [
            {
              tool: stepConfig.tool,
              required: true,
              blocking: true,
            },
          ],
        })),
      },
    },
    include: {
      steps: {
        orderBy: {
          stepNumber: 'asc',
        },
        include: {
          checkpoint: true,
        },
      },
      dependencyPlay: true,
    },
  });

  return play;
}

/**
 * Get the next unlocked step for a play
 */
export async function getNextStep(playId: string) {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      steps: {
        orderBy: {
          stepNumber: 'asc',
        },
        include: {
          checkpoint: true,
        },
      },
    },
  });

  if (!play) {
    throw new Error(`Play ${playId} not found`);
  }

  // Find first ready or in-progress step
  const nextStep = play.steps.find(
    (step) =>
      step.status === StepStatus.READY ||
      step.status === StepStatus.UNLOCKED ||
      step.status === StepStatus.IN_PROGRESS
  );

  return nextStep || null;
}

/**
 * Unlock the next step after checkpoint passes
 */
export async function unlockNextStep(playId: string, currentStepNumber: number) {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      steps: {
        orderBy: {
          stepNumber: 'asc',
        },
      },
    },
  });

  if (!play) {
    throw new Error(`Play ${playId} not found`);
  }

  const nextStepNumber = currentStepNumber + 1;

  // Check if there's a next step
  const nextStep = play.steps.find(
    (step) => step.stepNumber === nextStepNumber
  );

  if (nextStep) {
    // Unlock next step (use READY status)
    await prisma.playStep.update({
      where: { id: nextStep.id },
      data: { status: StepStatus.READY },
    });

    // Update play's current step
    await prisma.play.update({
      where: { id: playId },
      data: { currentStep: nextStepNumber },
    });
  } else {
    // All steps completed - mark play as completed
    await prisma.play.update({
      where: { id: playId },
      data: {
        status: PlayStatus.COMPLETED,
        currentStep: currentStepNumber,
      },
    });

    // Try to activate a queued play
    await activateQueuedPlay(play.clientId);
  }
}

/**
 * Branch to a new play when checkpoint fails
 */
export async function branchPlay(
  playId: string,
  newPlayType: PlayType,
  reason: string
) {
  const currentPlay = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      client: true,
    },
  });

  if (!currentPlay) {
    throw new Error(`Play ${playId} not found`);
  }

  // Mark current play as branched
  await prisma.play.update({
    where: { id: playId },
    data: {
      status: PlayStatus.BRANCHED,
    },
  });

  // Create new play
  const newPlay = await createPlay(currentPlay.clientId, newPlayType);

  // Update new play to reference the branch
  await prisma.play.update({
    where: { id: newPlay.id },
    data: {
      branchedFrom: playId,
      branchReason: reason,
    },
  });

  return newPlay;
}

/**
 * Pause an active play
 */
export async function pausePlay(playId: string) {
  return await prisma.play.update({
    where: { id: playId },
    data: {
      status: PlayStatus.PAUSED,
    },
  });
}

/**
 * Resume a paused play
 */
export async function resumePlay(playId: string) {
  return await prisma.play.update({
    where: { id: playId },
    data: {
      status: PlayStatus.ACTIVE,
    },
  });
}

/**
 * Get all plays for a client (including completed/branched)
 */
export async function getClientPlays(clientId: string) {
  return await prisma.play.findMany({
    where: { clientId },
    include: {
      steps: {
        orderBy: {
          stepNumber: 'asc',
        },
        include: {
          checkpoint: true,
        },
      },
      dependencyPlay: true,
      dependentPlays: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get plays scheduled for a specific month
 */
export async function getPlaysByMonth(clientId: string, month: number) {
  return await prisma.play.findMany({
    where: {
      clientId,
      scheduledMonth: month,
    },
    include: {
      steps: {
        orderBy: {
          stepNumber: 'asc',
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
 * Schedule a play for a specific month
 */
export async function schedulePlayForMonth(playId: string, month: number) {
  return await prisma.play.update({
    where: { id: playId },
    data: { scheduledMonth: month },
  });
}

/**
 * Queue a play (move to QUEUED status)
 */
export async function queuePlay(playId: string) {
  return await prisma.play.update({
    where: { id: playId },
    data: { status: PlayStatus.QUEUED },
  });
}

/**
 * Get queued plays for a client (alias for getQueuedPlays)
 */
export async function getQueuedPlaysForClient(clientId: string) {
  return await getQueuedPlays(clientId);
}

