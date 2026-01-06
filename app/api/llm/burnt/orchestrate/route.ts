import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, unauthorizedResponse } from '@/lib/auth';
import type { BurntOrchestrateAPIRequest, BurntOrchestrateAPIResponse } from '@/lib/llms/types';

export const runtime = 'nodejs';

const HARD_TIMEOUT = 120000; // 2 minutes (orchestration can take longer)

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
    const body: BurntOrchestrateAPIRequest = await req.json();
    const { url, runAudit = false, runMidnight = false, runCrimson = false } = body;

    // Validate required fields
    if (!url) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { error: 'url is required' },
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

    const response: BurntOrchestrateAPIResponse = {
      burnt: {
        prioritizedActions: [],
        burntScores: [],
      },
    };

    // Step 1: Read signals (Burnt reads signals, not direct audit)
    // If runAudit is true, we should read the latest audit signal for the client
    let auditContext: any = null;
    if (runAudit) {
      try {
        // Find client by URL
        const { prisma } = await import('@/lib/prisma');
        const client = await prisma.client.findFirst({
          where: { canonicalUrl: url },
        });

        if (client) {
          // Read latest audit signal
          const { getLatestSignal } = await import('@/lib/smokey/signals');
          const auditSignal = await getLatestSignal(client.id, 'audit_result');
          
          if (auditSignal) {
            auditContext = auditSignal.data;
            response.audit = auditContext;
          } else {
            // No signal yet - run audit to create signal
            const auditResponse = await fetch(`${req.nextUrl.origin}/api/audit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ url }),
            });

            if (auditResponse.ok) {
              const auditData = await auditResponse.json();
              auditContext = auditData.results;
              response.audit = auditContext;
            }
          }
        } else {
          // No client found - run audit directly (will create signal if client exists)
          const auditResponse = await fetch(`${req.nextUrl.origin}/api/audit`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
          });

          if (auditResponse.ok) {
            const auditData = await auditResponse.json();
            auditContext = auditData.results;
            response.audit = auditContext;
          }
        }
      } catch (error) {
        console.error('Signal read/audit step failed:', error);
        // Continue without audit context
      }
    }

    // Step 2: Optionally run Midnight
    let midnightContext: any = null;
    if (runMidnight) {
      try {
        const midnightResponse = await fetch(`${req.nextUrl.origin}/api/llm/midnight`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            url,
            mode: 'homepage_edit',
            optionalAuditContext: auditContext,
          }),
        });

        if (midnightResponse.ok) {
          const midnightData = await midnightResponse.json();
          midnightContext = midnightData;
          response.midnight = midnightData;
        }
      } catch (error) {
        console.error('Midnight step failed:', error);
        // Continue without midnight context
      }
    }

    // Step 3: Optionally run Crimson
    let crimsonContext: any = null;
    if (runCrimson) {
      try {
        const crimsonResponse = await fetch(`${req.nextUrl.origin}/api/llm/crimson`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            url,
            goal: 'Optimize content based on audit and structure analysis',
            optionalAuditContext: auditContext || midnightContext,
          }),
        });

        if (crimsonResponse.ok) {
          const crimsonData = await crimsonResponse.json();
          crimsonContext = crimsonData;
          response.crimson = crimsonData;
        }
      } catch (error) {
        console.error('Crimson step failed:', error);
        // Continue without crimson context
      }
    }

    // Step 4: Collect all actions
    const allActions: any[] = [];
    
    if (midnightContext?.midnightActions) {
      allActions.push(...midnightContext.midnightActions);
    }
    
    if (crimsonContext?.crimsonActions) {
      allActions.push(...crimsonContext.crimsonActions);
    }

    // Step 5: Score actions with Burnt
    if (allActions.length > 0) {
      try {
        const burntResponse = await fetch(`${req.nextUrl.origin}/api/llm/burnt/score`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: req.headers.get('cookie') || '',
          },
          body: JSON.stringify({
            actions: allActions,
            optionalContext: {
              audit: auditContext,
              midnight: midnightContext,
              crimson: crimsonContext,
            },
          }),
        });

        if (burntResponse.ok) {
          const burntData = await burntResponse.json();
          response.burnt = burntData;
        }
      } catch (error) {
        console.error('Burnt scoring step failed:', error);
        // Return partial results
      }
    }

    clearTimeout(timeoutId);
    return NextResponse.json(response);
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error('Burnt Orchestrate API error:', error);
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timed out' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Orchestration failed' },
      { status: 500 }
    );
  }
}

