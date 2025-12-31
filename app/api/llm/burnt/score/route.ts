import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, unauthorizedResponse, getCurrentUser } from '@/lib/auth';
import { hasCapability, getUserPersona } from '@/lib/capabilities/check';
import { runBurnt } from '@/lib/llms/runBurnt';
import type { BurntScoreAPIRequest, BurntScoreAPIResponse } from '@/lib/llms/types';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const HARD_TIMEOUT = 25000; // 25 seconds (matching audit timeout)

export async function POST(req: NextRequest) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HARD_TIMEOUT);

  try {
    // Check authentication and capability
    const user = await getCurrentUser();
    if (!user) {
      clearTimeout(timeoutId);
      return unauthorizedResponse('Authentication required');
    }

    // Check if user has use_burnt_scoring capability or is Smokey
    const hasBurntCapability = await hasCapability(user.id, 'use_burnt_scoring');
    if (!hasBurntCapability) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'You do not have permission to use Burnt. Please upgrade your subscription.' },
        { status: 403 }
      );
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

    // Store in llm_runs
    const persona = await getUserPersona(user.id);
    const supabase = createClient();
    try {
      await supabase.from('llm_runs').insert({
        user_id: user.id,
        persona: persona || 'bulldog',
        tool: 'burnt',
        input: { actions, optionalContext },
        output: response,
        visibility: persona === 'smokey' ? 'internal' : 'client',
      });
    } catch (err) {
      console.error('Error storing Burnt run:', err);
      // Don't fail the request if storage fails
    }

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

