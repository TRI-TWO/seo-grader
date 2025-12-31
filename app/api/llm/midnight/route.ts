import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, unauthorizedResponse, getCurrentUser } from '@/lib/auth';
import { hasCapability, getUserPersona } from '@/lib/capabilities/check';
import { runMidnight } from '@/lib/llms/runMidnight';
import type { MidnightAPIRequest, MidnightAPIResponse } from '@/lib/llms/types';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const HARD_TIMEOUT = 30000; // 30 seconds

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

    // Check if user has use_midnight capability or is Smokey
    const hasMidnightCapability = await hasCapability(user.id, 'use_midnight');
    if (!hasMidnightCapability) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'You do not have permission to use Midnight. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: MidnightAPIRequest = await req.json();
    const { url, mode, optionalAuditContext } = body;

    // Validate required fields
    if (!url || !mode) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'url and mode are required' },
        { status: 400 }
      );
    }

    // Validate mode
    if (mode !== 'homepage_edit' && mode !== 'route_to_crimson') {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'mode must be "homepage_edit" or "route_to_crimson"' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Run Midnight
    const result = await runMidnight({
      url,
      mode,
      optionalAuditContext,
    });

    clearTimeout(timeoutId);

    const response: MidnightAPIResponse = {
      structureRecommendations: result.structureRecommendations,
      midnightActions: result.midnightActions,
      optionalCrimsonArtifacts: result.optionalCrimsonArtifacts,
    };

    // Store in llm_runs
    const persona = await getUserPersona(user.id);
    const supabase = createClient();
    try {
      await supabase.from('llm_runs').insert({
        user_id: user.id,
        persona: persona || 'wildcat',
        tool: 'midnight',
        input: { url, mode, optionalAuditContext },
        output: response,
        visibility: persona === 'smokey' ? 'internal' : 'client',
      });
    } catch (err) {
      console.error('Error storing Midnight run:', err);
      // Don't fail the request if storage fails
    }

    return NextResponse.json(response);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Midnight API error:', error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Midnight execution failed' },
      { status: 500 }
    );
  }
}

