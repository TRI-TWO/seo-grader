import { prisma } from '@/lib/prisma';

export type EventType =
  | 'plan_created'
  | 'plan_paused'
  | 'plan_resumed'
  | 'plan_completed'
  | 'plan_queued'
  | 'task_created'
  | 'task_started'
  | 'task_completed'
  | 'task_blocked'
  | 'checkpoint_created'
  | 'checkpoint_passed'
  | 'checkpoint_partial'
  | 'checkpoint_failed'
  | 'signal_detected'
  | 'decision_created'
  | 'tool_session_created'
  | 'tool_session_launched'
  | 'tool_session_completed';

export type EntityType = 'plan' | 'task' | 'checkpoint' | 'signal' | 'decision' | 'tool_session';

/**
 * Log an event
 */
export async function logEvent(
  clientId: string,
  eventType: EventType,
  entityType: EntityType | null,
  entityId: string | null,
  data?: any
) {
  return await prisma.event.create({
    data: {
      clientId,
      eventType,
      entityType,
      entityId,
      data: data || {},
    },
  });
}

/**
 * Get events for a client
 */
export async function getClientEvents(
  clientId: string,
  eventType?: EventType,
  entityType?: EntityType,
  limit?: number
) {
  return await prisma.event.findMany({
    where: {
      clientId,
      ...(eventType && { eventType }),
      ...(entityType && { entityType }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get events for a specific entity
 */
export async function getEntityEvents(
  entityType: EntityType,
  entityId: string,
  limit?: number
) {
  return await prisma.event.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get recent events for audit trail
 */
export async function getRecentEvents(
  clientId: string,
  hours: number = 24,
  limit: number = 100
) {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  return await prisma.event.findMany({
    where: {
      clientId,
      createdAt: {
        gte: since,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

