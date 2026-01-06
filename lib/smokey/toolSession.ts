import { prisma } from '@/lib/prisma';

// ToolSessionStatus enum is not exported by Prisma Client because ToolSession model uses String
// Define it locally for backward compatibility
enum ToolSessionStatus {
  CREATED = 'created',
  LAUNCHED = 'launched',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export type ToolPayload = {
  url?: string;
  goal?: string;
  tonePreset?: string;
  mode?: 'homepage_edit' | 'route_to_crimson';
  actions?: any[];
  [key: string]: any;
};

/**
 * Create a tool session for a play step
 * @deprecated This function is for legacy Play system. Use Task-based tool sessions for new Plan/Task system.
 * The new ToolSession model uses taskId/planId, not playStepId/playId.
 */
export async function createToolSession(
  playStepId: string,
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual',
  payload: ToolPayload
) {
  // Get play step to find playId
  const playStep = await prisma.playStep.findUnique({
    where: { id: playStepId },
    include: {
      play: true,
    },
  });

  if (!playStep) {
    throw new Error(`Play step ${playStepId} not found`);
  }

  // Note: New ToolSession model doesn't have playStepId/playId fields
  // This function is kept for legacy compatibility but will fail with new schema
  // TODO: Update to use Task/Plan system or remove if no longer needed
  throw new Error('createToolSession for PlayStep is deprecated. Use Task-based tool sessions instead.');
  
  // Legacy code (commented out - won't work with new schema):
  // const session = await prisma.toolSession.create({
  //   data: {
  //     playStepId,
  //     playId: playStep.playId,
  //     tool,
  //     status: ToolSessionStatus.CREATED,
  //     payload,
  //   },
  // });
  // return session;
}

/**
 * Launch a tool session and return routing information
 */
export async function launchToolSession(sessionId: string) {
  const session = await prisma.toolSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error(`Tool session ${sessionId} not found`);
  }

  if (session.status !== ToolSessionStatus.CREATED) {
    throw new Error(`Tool session ${sessionId} is not in CREATED status`);
  }

  // Update status to LAUNCHED
  const updatedSession = await prisma.toolSession.update({
    where: { id: sessionId },
    data: {
      status: ToolSessionStatus.LAUNCHED, // String value: 'launched'
      launchedAt: new Date(),
    },
  });

  // Generate routing information based on tool type
  const routing = getToolRouting(session.tool, session.payload as ToolPayload);
  
  // Add sessionId to routing state
  if (routing.state) {
    routing.state.sessionId = sessionId;
  }

  return {
    session: updatedSession,
    routing,
  };
}

/**
 * Get routing information for a tool
 */
function getToolRouting(
  tool: string,
  payload: ToolPayload
): { path: string; query?: Record<string, string>; state?: any } {
  switch (tool) {
    case 'audit':
      return {
        path: '/admin/audit',
        state: {
          url: payload.url,
          fromSmokey: true,
          sessionId: null, // Will be set by caller
        },
      };

    case 'crimson':
      return {
        path: '/admin/crimson',
        state: {
          url: payload.url,
          goal: payload.goal || 'Optimize content for SEO and conversion',
          tonePreset: payload.tonePreset || 'Professional, Friendly, Authoritative',
          fromSmokey: true,
          sessionId: null,
        },
      };

    case 'midnight':
      return {
        path: '/admin/midnight',
        state: {
          url: payload.url,
          mode: payload.mode || 'homepage_edit',
          fromSmokey: true,
          sessionId: null,
        },
      };

    case 'burnt':
      return {
        path: '/admin/burnt',
        state: {
          actions: payload.actions || [],
          fromSmokey: true,
          sessionId: null,
        },
      };

    case 'manual':
      // Manual tools don't route - show instructions in UI
      return {
        path: '/admin/smokey',
        state: {
          manualInstructions: payload.instructions || 'Manual intervention required',
          fromSmokey: true,
          sessionId: null,
        },
      };

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

/**
 * Complete a tool session with results
 */
export async function completeToolSession(
  sessionId: string,
  results: any
) {
  const session = await prisma.toolSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error(`Tool session ${sessionId} not found`);
  }

  return await prisma.toolSession.update({
    where: { id: sessionId },
    data: {
      status: ToolSessionStatus.COMPLETED,
      completedAt: new Date(),
      results,
    },
  });
}

/**
 * Mark tool session as failed
 */
export async function failToolSession(sessionId: string, error: string) {
  return await prisma.toolSession.update({
    where: { id: sessionId },
    data: {
      status: ToolSessionStatus.FAILED,
      completedAt: new Date(),
      results: { error },
    },
  });
}

/**
 * Get active tool session for a play step
 * @deprecated This function is for legacy Play system. Use Task-based tool sessions for new Plan/Task system.
 */
export async function getToolSession(playStepId: string) {
  // Note: New ToolSession model doesn't have playStepId field - it uses taskId
  // This function is kept for legacy compatibility but will fail with new schema
  // TODO: Create Task-based version or remove if no longer needed
  throw new Error('getToolSession for PlayStep is deprecated. Use Task-based tool sessions instead.');
}

/**
 * Get all tool sessions for a play
 * @deprecated This function is for legacy Play system. Use Plan-based tool sessions for new Plan/Task system.
 */
export async function getPlayToolSessions(playId: string) {
  // Note: New ToolSession model uses planId, not playId
  // This function is kept for legacy compatibility but will fail with new schema
  throw new Error('getPlayToolSessions for Play is deprecated. Use Plan-based tool sessions instead.');
}

/**
 * Build tool payload from play step context
 * @deprecated This function is for legacy Play system. Use Task-based tool sessions for new Plan/Task system.
 */
export async function buildToolPayload(
  playStepId: string,
  tool: string
): Promise<ToolPayload> {
  const playStep = await prisma.playStep.findUnique({
    where: { id: playStepId },
    include: {
      play: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!playStep) {
    throw new Error(`Play step ${playStepId} not found`);
  }

  const basePayload: ToolPayload = {
    url: playStep.play.client.canonicalUrl,
  };

  // Get previous step results for context
  const previousSteps = await prisma.playStep.findMany({
    where: {
      playId: playStep.playId,
      stepNumber: {
        lt: playStep.stepNumber,
      },
    },
    orderBy: {
      stepNumber: 'desc',
    },
    take: 1,
  });

  if (previousSteps.length > 0) {
    const prevResults = previousSteps[0].executionResults as any;
    if (prevResults?.audit?.results) {
      basePayload.auditContext = prevResults.audit.results;
    }
    if (prevResults?.crimson?.results) {
      basePayload.crimsonContext = prevResults.crimson.results;
    }
    if (prevResults?.midnight?.results) {
      basePayload.midnightContext = prevResults.midnight.results;
    }
  }

  // Tool-specific payload building
  switch (tool) {
    case 'crimson':
      return {
        ...basePayload,
        goal: 'Optimize content for SEO and conversion',
        tonePreset: 'Professional, Friendly, Authoritative',
      };

    case 'midnight':
      return {
        ...basePayload,
        mode: 'homepage_edit',
      };

    case 'burnt':
      // Collect actions from previous steps
      const actions: any[] = [];
      for (const step of previousSteps) {
        const results = step.executionResults as any;
        if (results?.crimson?.results?.crimsonActions) {
          actions.push(...results.crimson.results.crimsonActions);
        }
        if (results?.midnight?.results?.midnightActions) {
          actions.push(...results.midnight.results.midnightActions);
        }
      }
      return {
        ...basePayload,
        actions,
      };

    case 'audit':
    case 'manual':
    default:
      return basePayload;
  }
}

