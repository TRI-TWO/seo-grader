import { LeadStatus, ClientStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PlanTier } from '@prisma/client';

export type LifecycleState = 
  | 'anonymous'
  | 'paid_unlock'
  | 'meeting_scheduled'
  | 'proposal_sent'
  | 'signed'
  | 'active'
  | 'declined';

export const LIFECYCLE_STATES: Record<LifecycleState, { leadStatus: LeadStatus; clientStatus?: ClientStatus }> = {
  anonymous: { leadStatus: LeadStatus.ANONYMOUS },
  paid_unlock: { leadStatus: LeadStatus.PAID_UNLOCK },
  meeting_scheduled: { leadStatus: LeadStatus.MEETING_SCHEDULED },
  proposal_sent: { leadStatus: LeadStatus.PROPOSAL_SENT },
  signed: { leadStatus: LeadStatus.SIGNED, clientStatus: ClientStatus.SIGNED },
  active: { leadStatus: LeadStatus.ACTIVE, clientStatus: ClientStatus.ACTIVE },
  declined: { leadStatus: LeadStatus.DECLINED },
};

export function isValidTransition(
  currentState: LifecycleState,
  newState: LifecycleState
): boolean {
  const validTransitions: Record<LifecycleState, LifecycleState[]> = {
    anonymous: ['paid_unlock', 'meeting_scheduled', 'declined'],
    paid_unlock: ['meeting_scheduled', 'declined'],
    meeting_scheduled: ['proposal_sent', 'declined'],
    proposal_sent: ['signed', 'declined'],
    signed: ['active'],
    active: ['active'], // Can stay active
    declined: [], // Terminal state
  };

  return validTransitions[currentState]?.includes(newState) || false;
}

export async function convertLeadToClient(
  leadId: string,
  contractParams: {
    planTier: PlanTier;
    contractStartDate: Date;
    contractLengthMonths: number;
  }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
  });

  if (!lead) {
    throw new Error(`Lead ${leadId} not found`);
  }

  if (!lead.email || !lead.canonicalUrl) {
    throw new Error('Lead must have email and canonicalUrl to convert to client');
  }

  // Calculate contract end date
  const contractEndDate = new Date(contractParams.contractStartDate);
  contractEndDate.setMonth(
    contractEndDate.getMonth() + contractParams.contractLengthMonths
  );

  // Create client
  const client = await prisma.client.create({
    data: {
      email: lead.email,
      companyName: lead.companyName || undefined,
      canonicalUrl: lead.canonicalUrl,
      planTier: contractParams.planTier,
      contractStartDate: contractParams.contractStartDate,
      contractLengthMonths: contractParams.contractLengthMonths,
      status: ClientStatus.SIGNED,
      leadId: lead.id,
    },
  });

  // Create contract
  const contract = await prisma.contract.create({
    data: {
      clientId: client.id,
      startDate: contractParams.contractStartDate,
      endDate: contractEndDate,
      lengthMonths: contractParams.contractLengthMonths,
      planTier: contractParams.planTier,
      status: 'ACTIVE',
    },
  });

  // Update lead status and link to client
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: LeadStatus.SIGNED,
      clientId: client.id,
    },
  });

  return { client, contract };
}

