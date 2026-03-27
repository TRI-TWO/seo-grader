import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/** Minimal event log aligned with `public.events`. */
export async function logClientEvent(
  clientId: string,
  eventType: string,
  payload: Record<string, unknown> = {}
) {
  return prisma.events.create({
    data: {
      client_id: clientId,
      event_type: eventType,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}
