import { prisma } from '@/lib/prisma';
import { PlanTier } from '@prisma/client';

const TIER_LIMITS: Record<PlanTier, { maxPagesPerMonth: number; allowMultiLocation: boolean; allowProgrammatic: boolean }> = {
  STARTER: {
    maxPagesPerMonth: 1,
    allowMultiLocation: false,
    allowProgrammatic: false,
  },
  GROWTH: {
    maxPagesPerMonth: 3,
    allowMultiLocation: false,
    allowProgrammatic: false,
  },
  ENTERPRISE: {
    maxPagesPerMonth: 5,
    allowMultiLocation: true,
    allowProgrammatic: true,
  },
};

export async function validateTierLimits(
  clientId: string,
  requestedPages: number
): Promise<{ valid: boolean; reason?: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { contracts: { where: { status: 'ACTIVE' }, take: 1 } },
  });

  if (!client) {
    return { valid: false, reason: 'Client not found' };
  }

  const activeContract = client.contracts[0];
  if (!activeContract) {
    return { valid: false, reason: 'No active contract' };
  }

  const limits = TIER_LIMITS[activeContract.planTier];

  // Check monthly page limit
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const auditsThisMonth = await prisma.auditResult.count({
    where: {
      clientId,
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  if (auditsThisMonth + requestedPages > limits.maxPagesPerMonth) {
    return {
      valid: false,
      reason: `Monthly limit exceeded. ${limits.maxPagesPerMonth} pages/month allowed for ${activeContract.planTier} tier.`,
    };
  }

  return { valid: true };
}

export async function preventOverdelivery(clientId: string): Promise<boolean> {
  const validation = await validateTierLimits(clientId, 1);
  return validation.valid;
}

export async function requireActiveContract(clientId: string): Promise<{ valid: boolean; reason?: string }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { contracts: { where: { status: 'ACTIVE' }, take: 1 } },
  });

  if (!client) {
    return { valid: false, reason: 'Client not found' };
  }

  const activeContract = client.contracts[0];
  if (!activeContract) {
    return { valid: false, reason: 'No active contract found' };
  }

  const now = new Date();
  if (activeContract.endDate < now) {
    return { valid: false, reason: 'Contract has expired' };
  }

  return { valid: true };
}

