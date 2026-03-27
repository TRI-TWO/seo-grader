import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type SignalType =
  | 'audit_result'
  | 'status_change'
  | 'metric_threshold'
  | 'client_status'
  | 'contract_event'
  | 'manual_trigger';

export type SignalSource = 'audit' | 'manual' | 'system';

/** Maps to `public.signals` (payload + signal_type + source). */
export async function createAuditSignal(
  clientId: string,
  auditData: unknown,
  metadata?: Record<string, unknown>
) {
  const payload = {
    audit: auditData,
    ...(metadata ?? {}),
  } as Prisma.InputJsonValue;

  return prisma.signals.create({
    data: {
      client_id: clientId,
      signal_type: 'audit_result',
      source: 'audit',
      payload,
    },
  });
}

export async function getLatestSignal(clientId: string, signalType: SignalType) {
  return prisma.signals.findFirst({
    where: { client_id: clientId, signal_type: signalType },
    orderBy: { created_at: 'desc' },
  });
}
