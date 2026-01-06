import { prisma } from '@/lib/prisma';
import { StepStatus } from '@prisma/client';
import { getPlayTemplate } from './plays';
import { runCrimson } from '@/lib/llms/runCrimson';
import { runMidnight } from '@/lib/llms/runMidnight';
import { runBurnt } from '@/lib/llms/runBurnt';
import { processStage1Sync, processStage2Sync, processStage3Sync } from '@/lib/auditStagesSync';

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

type ToolConfig = {
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual';
  required: boolean;
  blocking?: boolean;
};

/**
 * Execute a play step by running the configured tools
 */
export async function executePlayStep(
  playId: string,
  stepNumber: number
): Promise<any> {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      steps: {
        where: { stepNumber },
      },
      client: true,
    },
  });

  if (!play) {
    throw new Error(`Play ${playId} not found`);
  }

  const step = play.steps[0];
  if (!step) {
    throw new Error(`Step ${stepNumber} not found for play ${playId}`);
  }

  // Check if step is unlocked
  if (step.status === StepStatus.LOCKED) {
    throw new Error(`Step ${stepNumber} is locked. Complete previous steps first.`);
  }

  // Update step status to in progress
  await prisma.playStep.update({
    where: { id: step.id },
    data: { status: StepStatus.IN_PROGRESS },
  });

  // Get tool from step - new format has single tool per step
  const toolSequence = step.toolSequence as ToolConfig[];
  const toolConfig = toolSequence[0]; // First tool in sequence
  const tool = toolConfig?.tool || (step.toolSequence as any)?.[0]?.tool;
  
  if (!tool) {
    throw new Error(`No tool configured for step ${stepNumber}`);
  }

  const clientUrl = play.client.canonicalUrl;
  const executionResults: any = {};

  try {
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
        if (toolConfig?.required !== false) {
          // Required tool failed - throw error
          throw new Error(
            `Required tool ${tool} failed: ${error.message}`
          );
        } else {
          // Optional tool failed - log but continue
          executionResults[tool] = {
            error: error.message,
            status: 'failed',
          };
        }
      }
    }

    // Store execution results
    await prisma.playStep.update({
      where: { id: step.id },
      data: {
        executionResults,
        status: StepStatus.DONE,
      },
    });

    return executionResults;
  } catch (error: any) {
    // Mark step as unlocked (can retry) on error
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.UNLOCKED },
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

