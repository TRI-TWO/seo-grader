import { prisma } from '@/lib/prisma';
import { PlanTier, TimelineStatus, Client } from '@prisma/client';
import { getTimelineTemplate, type TimelinePhase } from './templates';

export async function instantiateTimeline(
  clientId: string,
  contractStartDate: Date,
  planTier: PlanTier
): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  // Get template for this tier
  const template = getTimelineTemplate(planTier);

  // Delete existing timeline if regenerating
  await prisma.clientTimeline.deleteMany({
    where: { clientId },
  });

  // Create timeline entries
  const timelineEntries = template.map((phase: TimelinePhase) => {
    const scheduledDate = new Date(contractStartDate);
    scheduledDate.setDate(scheduledDate.getDate() + phase.dayOffset);

    return {
      clientId,
      phaseName: phase.phaseName,
      scheduledDate,
      status: TimelineStatus.UPCOMING,
      toolSequence: phase.toolSequence,
    };
  });

  await prisma.clientTimeline.createMany({
    data: timelineEntries,
  });
}

export async function reschedulePhase(
  timelineId: string,
  newDate: Date
): Promise<void> {
  await prisma.clientTimeline.update({
    where: { id: timelineId },
    data: {
      scheduledDate: newDate,
      status: TimelineStatus.RESCHEDULED,
    },
  });
}

export async function skipPhase(timelineId: string): Promise<void> {
  await prisma.clientTimeline.update({
    where: { id: timelineId },
    data: {
      status: TimelineStatus.SKIPPED,
    },
  });
}

export async function regenerateTimeline(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { contracts: { where: { status: 'ACTIVE' }, take: 1 } },
  });

  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }

  const activeContract = client.contracts[0];
  if (!activeContract) {
    throw new Error(`No active contract found for client ${clientId}`);
  }

  await instantiateTimeline(
    clientId,
    activeContract.startDate,
    activeContract.planTier
  );
}

export async function getUpcomingPhases(
  clientId: string,
  daysAhead: number = 30
): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  return await prisma.clientTimeline.findMany({
    where: {
      clientId,
      scheduledDate: {
        lte: cutoffDate,
        gte: new Date(),
      },
      status: {
        in: [TimelineStatus.UPCOMING, TimelineStatus.RESCHEDULED],
      },
    },
    orderBy: {
      scheduledDate: 'asc',
    },
  });
}

export async function getClientTimeline(clientId: string): Promise<any[]> {
  return await prisma.clientTimeline.findMany({
    where: { clientId },
    orderBy: { scheduledDate: 'asc' },
  });
}

