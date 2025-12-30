import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth';
import { runBurnt } from '@/lib/llms/runBurnt';
import type { BurntScoreAPIRequest, BurntScoreAPIResponse } from '@/lib/llms/types';

export const runtime = 'nodejs';

const HARD_TIMEOUT = 25000; // 25 seconds (matching audit timeout)

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HARD_TIMEOUT);

  try {
    // Check admin authentication
    const adminUser = await requireAdmin();
    if (!adminUser) {
      clearTimeout(timeoutId);
      return unauthorizedResponse('Authentication required');
    }

    // Parse request body
    const body: BurntScoreAPIRequest = await req.json();
    const { actions, optionalContext } = body;

    // Validate required fields
    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'actions array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate actions structure
    for (const action of actions) {
      if (!action.title || !action.description) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Each action must have title and description' },
          { status: 400 }
        );
      }
    }

    // Run Burnt scoring
    const result = await runBurnt({
      actions,
      optionalContext,
    });

    clearTimeout(timeoutId);

    const response: BurntScoreAPIResponse = {
      prioritizedActions: result.prioritizedActions,
      burntScores: result.burntScores,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Burnt Score API error:', error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Burnt scoring failed' },
      { status: 500 }
    );
  }
}

