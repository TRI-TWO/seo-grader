import { prisma } from '@/lib/prisma';

/**
 * Signals are immutable facts derived from audits, admin overrides, or system events.
 * Once created, signals cannot be updated or deleted - they represent historical facts.
 * 
 * Authority: Only Audit (fact generator), Admin (override), or System can create signals.
 */

export type SignalType = 
  | 'audit_result'
  | 'status_change'
  | 'metric_threshold'
  | 'client_status'
  | 'contract_event'
  | 'manual_trigger';

export type SignalSource = 'audit' | 'manual' | 'system';

/**
 * Create a signal from audit results
 */
export async function createAuditSignal(
  clientId: string,
  auditData: any,
  metadata?: any
) {
  return await prisma.signal.create({
    data: {
      clientId,
      signalType: 'audit_result',
      source: 'audit',
      data: auditData,
      metadata: metadata || {},
    },
  });
}

/**
 * Create a signal from status change
 */
export async function createStatusSignal(
  clientId: string,
  statusChange: any,
  metadata?: any
) {
  return await prisma.signal.create({
    data: {
      clientId,
      signalType: 'status_change',
      source: 'system',
      data: statusChange,
      metadata: metadata || {},
    },
  });
}

/**
 * Create a signal from metric threshold
 */
export async function createMetricSignal(
  clientId: string,
  metricData: any,
  metadata?: any
) {
  return await prisma.signal.create({
    data: {
      clientId,
      signalType: 'metric_threshold',
      source: 'system',
      data: metricData,
      metadata: metadata || {},
    },
  });
}

/**
 * Create a manual trigger signal
 */
export async function createManualSignal(
  clientId: string,
  triggerData: any,
  metadata?: any
) {
  return await prisma.signal.create({
    data: {
      clientId,
      signalType: 'manual_trigger',
      source: 'manual',
      data: triggerData,
      metadata: metadata || {},
    },
  });
}

/**
 * Get signals for a client
 */
export async function getClientSignals(
  clientId: string,
  signalType?: SignalType,
  limit?: number
) {
  return await prisma.signal.findMany({
    where: {
      clientId,
      ...(signalType && { signalType }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: limit,
  });
}

/**
 * Get latest signal of a specific type for a client
 */
export async function getLatestSignal(
  clientId: string,
  signalType: SignalType
) {
  return await prisma.signal.findFirst({
    where: {
      clientId,
      signalType,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get signals that match trigger conditions for decision making
 */
export async function getSignalsForDecision(
  clientId: string,
  signalTypes: SignalType[]
) {
  return await prisma.signal.findMany({
    where: {
      clientId,
      signalType: {
        in: signalTypes,
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

