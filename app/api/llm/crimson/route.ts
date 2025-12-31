import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, unauthorizedResponse, forbiddenResponse, getCurrentUser } from '@/lib/auth';
import { hasCapability, getUserPersona } from '@/lib/capabilities/check';
import { runCrimson } from '@/lib/llms/runCrimson';
import type { CrimsonAPIRequest, CrimsonAPIResponse } from '@/lib/llms/types';
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

    // Check if user has Crimson capability (templates or review)
    const hasTemplatesCapability = await hasCapability(user.id, 'use_crimson_templates');
    const hasReviewCapability = await hasCapability(user.id, 'use_crimson_review');
    if (!hasTemplatesCapability && !hasReviewCapability) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'You do not have permission to use Crimson. Please upgrade your subscription.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body: CrimsonAPIRequest = await req.json();
    const { url, goal, tonePreset, optionalAuditContext, templateId } = body;

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

    // Store in llm_runs
    const persona = await getUserPersona(user.id);
    const supabase = createClient();
    try {
      await supabase.from('llm_runs').insert({
        user_id: user.id,
        persona: persona || 'bulldog',
        tool: 'crimson',
        template_id: templateId || null,
        input: { url, goal, tonePreset, optionalAuditContext, templateId },
        output: response,
        visibility: persona === 'smokey' ? 'internal' : 'client',
      });
    } catch (err) {
      console.error('Error storing Crimson run:', err);
      // Don't fail the request if storage fails
    }

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

