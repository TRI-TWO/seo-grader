import { prisma } from '@/lib/prisma';
import { LeadStatus, LeadSource } from '@prisma/client';

export interface CreateLeadParams {
  email: string;
  name?: string;
  companyName?: string;
  canonicalUrl?: string;
  source: LeadSource;
  auditId?: string;
  metadata?: Record<string, any>;
}

export interface UpdateLeadParams {
  leadId: string;
  name?: string;
  companyName?: string;
  canonicalUrl?: string;
  status?: LeadStatus;
  auditId?: string;
  metadata?: Record<string, any>;
}

export async function createLead(params: CreateLeadParams) {
  return await prisma.lead.create({
    data: {
      email: params.email,
      name: params.name,
      companyName: params.companyName,
      canonicalUrl: params.canonicalUrl,
      source: params.source,
      status: LeadStatus.ANONYMOUS,
      auditId: params.auditId,
      metadata: params.metadata || {},
    },
  });
}

export async function updateLead(params: UpdateLeadParams) {
  const updateData: any = {};
  
  if (params.name !== undefined) updateData.name = params.name;
  if (params.companyName !== undefined) updateData.companyName = params.companyName;
  if (params.canonicalUrl !== undefined) updateData.canonicalUrl = params.canonicalUrl;
  if (params.status !== undefined) updateData.status = params.status;
  if (params.auditId !== undefined) updateData.auditId = params.auditId;
  if (params.metadata !== undefined) updateData.metadata = params.metadata;

  return await prisma.lead.update({
    where: { id: params.leadId },
    data: updateData,
    include: {
      audit: true,
      client: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function getLeadByEmail(email: string) {
  return await prisma.lead.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
    include: {
      audit: true,
      client: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function getLeadById(leadId: string) {
  return await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      audit: true,
      client: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

export async function getAllLeads(filters?: {
  status?: LeadStatus;
  source?: LeadSource;
  limit?: number;
  offset?: number;
}) {
  const where: any = {};
  
  if (filters?.status) where.status = filters.status;
  if (filters?.source) where.source = filters.source;

  return await prisma.lead.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      audit: true,
      client: true,
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    take: filters?.limit || 100,
    skip: filters?.offset || 0,
  });
}

export async function transitionLeadStatus(
  leadId: string,
  newStatus: LeadStatus
): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: newStatus },
  });
}

