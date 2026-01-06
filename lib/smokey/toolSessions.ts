import { prisma } from '@/lib/prisma';
import { logEvent } from './events';

export type ToolPayload = {
  url?: string;
  goal?: string;
  tonePreset?: string;
  mode?: 'homepage_edit' | 'route_to_crimson';
  actions?: any[];
  [key: string]: any;
};

/**
 * Create a tool session for a task
 */
export async function createToolSession(
  taskId: string,
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual',
  payload: ToolPayload
) {
  // Get task to find planId
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      plan: true,
    },
  });

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const session = await prisma.toolSession.create({
    data: {
      taskId,
      planId: task.planId,
      tool,
      status: 'created',
      payload,
    },
  });

  await logEvent(task.plan.clientId, 'tool_session_created', 'tool_session', session.id, {
    taskId,
    planId: task.planId,
    tool,
  });

  return session;
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

  if (session.status !== 'created') {
    throw new Error(`Tool session ${sessionId} is not in created status`);
  }

  // Update status to launched
  const updatedSession = await prisma.toolSession.update({
    where: { id: sessionId },
    data: {
      status: 'launched',
      launchedAt: new Date(),
    },
  });

  // Get plan to access clientId
  const task = await prisma.task.findUnique({
    where: { id: session.taskId },
    include: { plan: true },
  });

  if (task) {
    await logEvent(task.plan.clientId, 'tool_session_launched', 'tool_session', session.id, {
      taskId: session.taskId,
      planId: session.planId,
      tool: session.tool,
    });
  }

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
    include: {
      task: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Tool session ${sessionId} not found`);
  }

  const updated = await prisma.toolSession.update({
    where: { id: sessionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      results,
    },
  });

  if (session.task) {
    await logEvent(session.task.plan.clientId, 'tool_session_completed', 'tool_session', session.id, {
      taskId: session.taskId,
      planId: session.planId,
      tool: session.tool,
    });
  }

  return updated;
}

/**
 * Mark tool session as failed
 */
export async function failToolSession(sessionId: string, error: string) {
  const session = await prisma.toolSession.findUnique({
    where: { id: sessionId },
    include: {
      task: {
        include: {
          plan: true,
        },
      },
    },
  });

  if (!session) {
    throw new Error(`Tool session ${sessionId} not found`);
  }

  const updated = await prisma.toolSession.update({
    where: { id: sessionId },
    data: {
      status: 'failed',
      completedAt: new Date(),
      results: { error },
    },
  });

  if (session.task) {
    await logEvent(session.task.plan.clientId, 'tool_session_completed', 'tool_session', session.id, {
      taskId: session.taskId,
      planId: session.planId,
      tool: session.tool,
      error,
    });
  }

  return updated;
}

/**
 * Get active tool session for a task
 */
export async function getToolSession(taskId: string) {
  return await prisma.toolSession.findFirst({
    where: {
      taskId,
      status: {
        in: ['created', 'launched'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get all tool sessions for a plan
 */
export async function getPlanToolSessions(planId: string) {
  return await prisma.toolSession.findMany({
    where: {
      planId,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

/**
 * Build tool payload from task context
 */
export async function buildToolPayload(
  taskId: string,
  tool: string
): Promise<ToolPayload> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      plan: {
        include: {
          client: true,
        },
      },
    },
  });

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const basePayload: ToolPayload = {
    url: task.plan.client.canonicalUrl,
  };

  // Get previous task results for context
  const previousTasks = await prisma.task.findMany({
    where: {
      planId: task.planId,
      taskNumber: {
        lt: task.taskNumber,
      },
    },
    orderBy: {
      taskNumber: 'desc',
    },
    take: 1,
  });

  if (previousTasks.length > 0) {
    const prevResults = previousTasks[0].executionResults as any;
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
      // Collect actions from previous tasks
      const actions: any[] = [];
      for (const prevTask of previousTasks) {
        const results = prevTask.executionResults as any;
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

