import { stripe } from './client';
import { prisma } from '@/lib/prisma';
import { LeadSource, LeadStatus, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  // Extract metadata
  const customerName = session.metadata?.customer_name || session.customer_details?.name || '';
  const companyName = session.metadata?.company_name || '';
  const canonicalUrl = session.metadata?.canonical_url || '';
  const email = session.customer_email || session.customer_details?.email || '';
  const auditId = session.metadata?.audit_id || null;

  if (!email) {
    throw new Error('Email is required but not found in checkout session');
  }

  // Create or update lead
  let lead = await prisma.lead.findFirst({
    where: { email },
    orderBy: { createdAt: 'desc' },
  });

  if (lead) {
    // Update existing lead
    lead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        name: customerName || lead.name,
        companyName: companyName || lead.companyName,
        canonicalUrl: canonicalUrl || lead.canonicalUrl,
        status: LeadStatus.PAID_UNLOCK,
        auditId: auditId || lead.auditId,
      },
    });
  } else {
    // Create new lead
    lead = await prisma.lead.create({
      data: {
        email,
        name: customerName,
        companyName,
        canonicalUrl,
        status: LeadStatus.PAID_UNLOCK,
        source: LeadSource.STRIPE,
        auditId: auditId || undefined,
      },
    });
  }

  // Create payment record
  const paymentIntentId = typeof session.payment_intent === 'string' 
    ? session.payment_intent 
    : session.payment_intent?.id || null;

  await prisma.payment.create({
    data: {
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      leadId: lead.id,
      amountCents: session.amount_total || 0,
      currency: session.currency || 'usd',
      status: PaymentStatus.COMPLETED,
      customerName,
      companyName,
      canonicalUrl,
      email,
      metadata: {
        sessionId: session.id,
        auditId: auditId || null,
      },
    },
  });

  // Update audit if auditId is provided
  if (auditId) {
    await prisma.auditResult.update({
      where: { id: auditId },
      data: {
        isPaid: true,
      },
    });
  }
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}

