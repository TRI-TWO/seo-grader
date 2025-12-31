import { prisma } from '@/lib/prisma';
import { LeadStatus, LeadSource } from '@prisma/client';
import { createLead, updateLead, getLeadByEmail, transitionLeadStatus } from './leads';
import { convertLeadToClient } from './lifecycle';
import { instantiateTimeline } from '@/lib/smokey/scheduler';
import { PlanTier } from '@prisma/client';

export interface MeetingScheduledParams {
  email: string;
  name?: string;
  companyName?: string;
  canonicalUrl?: string;
  calendlyEventId: string;
  scheduledAt: Date;
  meetingType?: 'DISCOVERY' | 'ONBOARDING' | 'QUARTERLY_REVIEW' | 'AD_HOC';
}

export async function handleMeetingScheduled(params: MeetingScheduledParams) {
  // Find or create lead
  let lead = await getLeadByEmail(params.email);

  if (lead) {
    // Update existing lead
    lead = await updateLead({
      leadId: lead.id,
      name: params.name || lead.name || undefined,
      companyName: params.companyName || lead.companyName || undefined,
      canonicalUrl: params.canonicalUrl || lead.canonicalUrl || undefined,
      status: LeadStatus.MEETING_SCHEDULED,
    });
  } else {
    // Create new lead
    lead = await createLead({
      email: params.email,
      name: params.name,
      companyName: params.companyName,
      canonicalUrl: params.canonicalUrl,
      source: LeadSource.CALENDLY,
    });
    await transitionLeadStatus(lead.id, LeadStatus.MEETING_SCHEDULED);
  }

  // Find client if lead has been converted
  const client = await prisma.client.findUnique({
    where: { leadId: lead.id },
  });

  // Create or update meeting record
  const existingMeeting = await prisma.meeting.findUnique({
    where: { calendlyEventId: params.calendlyEventId },
  });

  if (existingMeeting) {
    await prisma.meeting.update({
      where: { id: existingMeeting.id },
      data: {
        email: params.email,
        scheduledAt: params.scheduledAt,
        status: 'scheduled',
        meetingType: params.meetingType || 'DISCOVERY',
        meetingSource: 'CALENDLY',
        clientId: client?.id || undefined,
      },
    });
  } else {
    await prisma.meeting.create({
      data: {
        email: params.email,
        calendlyEventId: params.calendlyEventId,
        scheduledAt: params.scheduledAt,
        status: 'scheduled',
        meetingType: params.meetingType || 'DISCOVERY',
        meetingSource: 'CALENDLY',
        clientId: client?.id || undefined,
      },
    });
  }

  // Trigger audit if canonicalUrl is available
  if (params.canonicalUrl) {
    // Note: Audit triggering would be handled by the Calendly webhook handler
    // This function just ensures the lead and meeting are set up
  }

  return lead;
}

export interface ContractSignedParams {
  leadId: string;
  planTier: PlanTier;
  contractStartDate: Date;
  contractLengthMonths: number;
}

export async function handleContractSigned(params: ContractSignedParams) {
  // Convert lead to client
  const { client, contract } = await convertLeadToClient(params.leadId, {
    planTier: params.planTier,
    contractStartDate: params.contractStartDate,
    contractLengthMonths: params.contractLengthMonths,
  });

  // Hand off to Smokey: Build timeline
  await instantiateTimeline(
    client.id,
    contract.startDate,
    contract.planTier
  );

  // Update client status to ACTIVE
  await prisma.client.update({
    where: { id: client.id },
    data: {
      status: 'ACTIVE',
    },
  });

  // Update lead status to ACTIVE
  await transitionLeadStatus(params.leadId, LeadStatus.ACTIVE);

  return { client, contract };
}

