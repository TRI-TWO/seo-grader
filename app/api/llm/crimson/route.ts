import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from '@/lib/auth';
import { runCrimson } from '@/lib/llms/runCrimson';
import type { CrimsonAPIRequest, CrimsonAPIResponse } from '@/lib/llms/types';

export const runtime = 'nodejs';

const HARD_TIMEOUT = 30000; // 30 seconds

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
    const body: CrimsonAPIRequest = await req.json();
    const { url, goal, tonePreset, optionalAuditContext } = body;

    // Validate required fields
    if (!url || !goal) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'url and goal are required' },
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

    // Run Crimson
    const result = await runCrimson({
      url,
      goal,
      tonePreset,
      optionalAuditContext,
    });

    clearTimeout(timeoutId);

    const response: CrimsonAPIResponse = {
      contentEdits: result.contentEdits,
      ctaSuggestions: result.ctaSuggestions,
      crimsonActions: result.crimsonActions,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Crimson API error:', error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Crimson execution failed' },
      { status: 500 }
    );
  }
}

