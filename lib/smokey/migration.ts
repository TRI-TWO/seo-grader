import { prisma } from '@/lib/prisma';
import { PlayType, PlayStatus } from '@prisma/client';
import { getPlayTemplate } from './plays';
import { createPlay } from './decision';

/**
 * Migration utilities for transitioning from timeline system to play system
 * Keeps both systems running in parallel for backward compatibility
 */

/**
 * Check if a client should use the new play system
 * For now, all clients can use plays - timelines remain for reference
 */
export async function shouldUsePlaySystem(clientId: string): Promise<boolean> {
  // For now, always allow play system
  // In the future, this could check client creation date or other criteria
  return true;
}

/**
 * Migrate a client from timeline to play system
 * Creates an initial play based on the client's current state
 */
export async function migrateClientToPlaySystem(
  clientId: string,
  playType?: PlayType
): Promise<any> {
  // Check if client already has an active play
  const existingPlay = await prisma.play.findFirst({
    where: {
      clientId,
      status: PlayStatus.ACTIVE,
    },
  });

  if (existingPlay) {
    return existingPlay;
  }

  // Determine play type if not provided
  let targetPlayType = playType;
  if (!targetPlayType) {
    // Use homepage_eligibility as default for migration
    targetPlayType = PlayType.HOMEPAGE_ELIGIBILITY;
  }

  // Create play
  return await createPlay(clientId, targetPlayType);
}

/**
 * Regenerate timeline after checkpoint completion
 * As per spec: "Timeline is regenerated only after checkpoint completion"
 */
export async function regenerateTimelineAfterCheckpoint(
  clientId: string
): Promise<void> {
  // Import timeline regeneration function
  const { regenerateTimeline } = await import('./scheduler');
  
  // Regenerate timeline for the client
  await regenerateTimeline(clientId);
}

/**
 * Check if timeline should be regenerated
 * Timeline regeneration happens after checkpoint completion
 */
export async function shouldRegenerateTimeline(
  clientId: string,
  playId: string
): Promise<boolean> {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      steps: {
        include: {
          checkpoint: true,
        },
      },
    },
  });

  if (!play) {
    return false;
  }

  // Check if all steps are completed with passing checkpoints
  const allStepsCompleted = play.steps.every(
    (step) =>
      step.checkpoint?.result === 'PASS' ||
      step.status === 'COMPLETED'
  );

  // Regenerate timeline if play is completed
  if (play.status === PlayStatus.COMPLETED && allStepsCompleted) {
    return true;
  }

  return false;
}

