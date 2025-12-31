import { stripe, STRIPE_UNLOCK_PRICE_ID } from './client';
import type Stripe from 'stripe';

export interface CreateCheckoutSessionParams {
  email: string;
  customerName: string;
  companyName: string;
  canonicalUrl: string;
  auditId?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createUnlockCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<Stripe.Checkout.Session> {
  if (!STRIPE_UNLOCK_PRICE_ID) {
    throw new Error('STRIPE_UNLOCK_PRICE_ID is not set in environment variables');
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: STRIPE_UNLOCK_PRICE_ID,
        quantity: 1,
      },
    ],
    customer_email: params.email,
    metadata: {
      customer_name: params.customerName,
      company_name: params.companyName,
      canonical_url: params.canonicalUrl,
      audit_id: params.auditId || '',
    },
    payment_intent_data: {
      metadata: {
        customer_name: params.customerName,
        company_name: params.companyName,
        canonical_url: params.canonicalUrl,
        audit_id: params.auditId || '',
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

