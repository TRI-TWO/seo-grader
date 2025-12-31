import { stripe } from './client';
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
  // Read at runtime to ensure Vercel env vars are available
  const priceId = process.env.STRIPE_UNLOCK_PRICE_ID;
  if (!priceId) {
    // Debug: Log available env vars (without exposing secrets)
    const envKeys = Object.keys(process.env).filter(key => key.includes('STRIPE'));
    console.error('STRIPE_UNLOCK_PRICE_ID not found. Available STRIPE env vars:', envKeys);
    throw new Error(
      `STRIPE_UNLOCK_PRICE_ID is not set in environment variables. ` +
      `Please verify it's set in Vercel with the exact name: STRIPE_UNLOCK_PRICE_ID. ` +
      `Available STRIPE vars: ${envKeys.join(', ')}`
    );
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
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

