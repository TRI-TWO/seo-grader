import { prisma } from '@/lib/prisma';
import { runCrimson } from '@/lib/llms/runCrimson';
import { runMidnight } from '@/lib/llms/runMidnight';
import { runBurnt } from '@/lib/llms/runBurnt';
import { processStage1Sync, processStage2Sync, processStage3Sync } from '@/lib/auditStagesSync';
import { logEvent } from './events';

const US_STATES = [
  { name: 'Alabama', abbr: 'AL' },
  { name: 'Alaska', abbr: 'AK' },
  { name: 'Arizona', abbr: 'AZ' },
  { name: 'Arkansas', abbr: 'AR' },
  { name: 'California', abbr: 'CA' },
  { name: 'Colorado', abbr: 'CO' },
  { name: 'Connecticut', abbr: 'CT' },
  { name: 'Delaware', abbr: 'DE' },
  { name: 'Florida', abbr: 'FL' },
  { name: 'Georgia', abbr: 'GA' },
  { name: 'Hawaii', abbr: 'HI' },
  { name: 'Idaho', abbr: 'ID' },
  { name: 'Illinois', abbr: 'IL' },
  { name: 'Indiana', abbr: 'IN' },
  { name: 'Iowa', abbr: 'IA' },
  { name: 'Kansas', abbr: 'KS' },
  { name: 'Kentucky', abbr: 'KY' },
  { name: 'Louisiana', abbr: 'LA' },
  { name: 'Maine', abbr: 'ME' },
  { name: 'Maryland', abbr: 'MD' },
  { name: 'Massachusetts', abbr: 'MA' },
  { name: 'Michigan', abbr: 'MI' },
  { name: 'Minnesota', abbr: 'MN' },
  { name: 'Mississippi', abbr: 'MS' },
  { name: 'Missouri', abbr: 'MO' },
  { name: 'Montana', abbr: 'MT' },
  { name: 'Nebraska', abbr: 'NE' },
  { name: 'Nevada', abbr: 'NV' },
  { name: 'New Hampshire', abbr: 'NH' },
  { name: 'New Jersey', abbr: 'NJ' },
  { name: 'New Mexico', abbr: 'NM' },
  { name: 'New York', abbr: 'NY' },
  { name: 'North Carolina', abbr: 'NC' },
  { name: 'North Dakota', abbr: 'ND' },
  { name: 'Ohio', abbr: 'OH' },
  { name: 'Oklahoma', abbr: 'OK' },
  { name: 'Oregon', abbr: 'OR' },
  { name: 'Pennsylvania', abbr: 'PA' },
  { name: 'Rhode Island', abbr: 'RI' },
  { name: 'South Carolina', abbr: 'SC' },
  { name: 'South Dakota', abbr: 'SD' },
  { name: 'Tennessee', abbr: 'TN' },
  { name: 'Texas', abbr: 'TX' },
  { name: 'Utah', abbr: 'UT' },
  { name: 'Vermont', abbr: 'VT' },
  { name: 'Virginia', abbr: 'VA' },
  { name: 'Washington', abbr: 'WA' },
  { name: 'West Virginia', abbr: 'WV' },
  { name: 'Wisconsin', abbr: 'WI' },
  { name: 'Wyoming', abbr: 'WY' },
];

/**
 * Execute a task by running the configured tool
 */
export async function executeTask(
  planId: string,
  taskNumber: number
): Promise<any> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      tasks: {
        where: { taskNumber },
      },
      client: true,
    },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const task = plan.tasks[0];
  if (!task) {
    throw new Error(`Task ${taskNumber} not found for plan ${planId}`);
  }

  // Check if task is ready
  if (task.status === 'locked') {
    throw new Error(`Task ${taskNumber} is locked. Complete previous tasks first.`);
  }

  // Update task status to in progress
  await prisma.task.update({
    where: { id: task.id },
    data: { status: 'in_progress' },
  });

  // Log event for task status change
  await logEvent(plan.clientId, 'task_started', 'task', task.id, {
    planId,
    taskNumber,
    tool: task.tool,
    status: 'in_progress',
  });

  const clientUrl = plan.client.canonicalUrl;
  const executionResults: any = {};

  try {
    // Get tool from task
    const tool = task.tool;

    if (tool === 'manual') {
      // Manual tools require admin intervention - mark as waiting
      executionResults.manual = {
        status: 'pending',
        message: 'Manual intervention required',
      };
    } else {
      try {
        const result = await executeTool(tool, clientUrl, executionResults);
        executionResults[tool] = result;
      } catch (error: any) {
        // Required tool failed - throw error
        throw new Error(
          `Required tool ${tool} failed: ${error.message}`
        );
      }
    }

    // Store execution results
    await prisma.task.update({
      where: { id: task.id },
      data: {
        executionResults,
        status: 'done',
      },
    });

    await logEvent(plan.clientId, 'task_completed', 'task', task.id, {
      planId,
      taskNumber,
      tool: task.tool,
    });

    return executionResults;
  } catch (error: any) {
    // Mark task as ready (can retry) on error
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'ready' },
    });
    throw error;
  }
}

/**
 * Execute a single tool
 */
async function executeTool(
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt',
  url: string,
  context: any
): Promise<any> {
  switch (tool) {
    case 'audit':
      return await executeAudit(url);

    case 'crimson':
      return await executeCrimson(url, context);

    case 'midnight':
      return await executeMidnight(url, context);

    case 'burnt':
      return await executeBurnt(url, context);

    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

/**
 * Execute audit tool
 */
async function executeAudit(url: string): Promise<any> {
  const stage1 = await processStage1Sync(url);
  const stage2 = await processStage2Sync(stage1, US_STATES);
  const stage3 = await processStage3Sync(stage2);

  return {
    status: 'completed',
    results: stage3,
  };
}

/**
 * Execute crimson tool
 */
async function executeCrimson(url: string, context: any): Promise<any> {
  const goal = 'Optimize content for SEO and conversion';
  const tonePreset = 'Professional, Friendly, Authoritative';

  const result = await runCrimson({
    url,
    goal,
    tonePreset,
    optionalAuditContext: context.audit?.results,
  });

  return {
    status: 'completed',
    results: result,
  };
}

/**
 * Execute midnight tool
 */
async function executeMidnight(url: string, context: any): Promise<any> {
  const mode = 'homepage_edit';

  const result = await runMidnight({
    url,
    mode,
    optionalAuditContext: context.audit?.results,
  });

  return {
    status: 'completed',
    results: result,
  };
}

/**
 * Execute burnt tool
 */
async function executeBurnt(url: string, context: any): Promise<any> {
  // Collect actions from context (crimson, midnight, etc.)
  const actions: any[] = [];

  if (context.crimson?.results?.crimsonActions) {
    actions.push(...context.crimson.results.crimsonActions);
  }

  if (context.midnight?.results?.midnightActions) {
    actions.push(...context.midnight.results.midnightActions);
  }

  if (actions.length === 0) {
    // No actions to prioritize
    return {
      status: 'skipped',
      message: 'No actions available for prioritization',
    };
  }

  const result = await runBurnt({
    actions,
    optionalContext: {
      audit: context.audit?.results,
    },
  });

  return {
    status: 'completed',
    results: result,
  };
}

