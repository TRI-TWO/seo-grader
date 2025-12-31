import { NextRequest, NextResponse } from 'next/server';
import { createUnlockCheckoutSession } from '@/lib/stripe/checkout';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, customerName, companyName, canonicalUrl, auditId } = body;

    // Validate required fields
    if (!email || !customerName || !companyName || !canonicalUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: email, customerName, companyName, and canonicalUrl are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(canonicalUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format for canonicalUrl' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
    const successUrl = `${baseUrl}/report?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/report?canceled=true`;

    const session = await createUnlockCheckoutSession({
      email,
      customerName,
      companyName,
      canonicalUrl,
      auditId: auditId || undefined,
      successUrl,
      cancelUrl,
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

