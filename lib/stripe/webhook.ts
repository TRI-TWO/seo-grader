import { stripe } from './client';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

function parseOptionalUuid(value: string | null): string | null {
  if (!value) return null;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuid.test(value) ? value : null;
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const customerName =
    session.metadata?.customer_name || session.customer_details?.name || '';
  const companyName = session.metadata?.company_name || '';
  const canonicalUrl = session.metadata?.canonical_url || '';
  const email = session.customer_email || session.customer_details?.email || '';
  const auditIdRaw = session.metadata?.audit_id || null;

  if (!email) {
    throw new Error('Email is required but not found in checkout session');
  }

  const org = await prisma.organizations.findFirst({
    orderBy: { created_at: 'asc' },
  });
  if (!org) {
    throw new Error(
      'No row in organizations; cannot record payment. Seed an organization first.'
    );
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  await prisma.payments.create({
    data: {
      org_id: org.id,
      client_id: null,
      audit_id: parseOptionalUuid(auditIdRaw),
      user_id: null,
      provider: 'stripe',
      provider_checkout_id: session.id,
      provider_payment_id: paymentIntentId,
      amount_cents: session.amount_total || 0,
      currency: (session.currency || 'usd').toUpperCase(),
      status: 'paid',
      paid_at: new Date(),
      metadata: {
        email,
        customerName,
        companyName,
        canonicalUrl,
        audit_id: auditIdRaw,
        stripe_session_id: session.id,
      },
    },
  });
}

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string,
  secret: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
