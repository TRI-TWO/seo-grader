import { prisma } from '@/lib/prisma';
import { getPlanTemplate } from './plans';
import { unlockNextTask } from './planEngine';
import { logEvent } from './events';
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

export type CheckpointEvaluation = {
  result: 'pass' | 'partial' | 'fail';
  data: {
    score?: number;
    metrics?: Record<string, any>;
    reasoning?: string;
  };
};

/**
 * Evaluate a checkpoint for a task
 * Returns pass/partial/fail based on plan type and audit results
 */
export async function evaluateCheckpoint(
  planId: string,
  taskNumber: number
): Promise<CheckpointEvaluation> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      tasks: {
        where: { taskNumber },
        // Note: checkpoint fetched explicitly when needed
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

  // Get execution results
  const executionResults = task.executionResults as any;
  if (!executionResults) {
    throw new Error(`Task ${taskNumber} has no execution results. Execute the task first.`);
  }

  // Get template for checkpoint config
  const template = getPlanTemplate(plan.planType);

  // Evaluate based on plan type
  let evaluation: CheckpointEvaluation;

  // Use plan-specific evaluator if available, otherwise use generic
  switch (plan.planType) {
    case 'title_search_relevance':
      evaluation = await evaluateTitleSearchRelevance(
        plan.clientId,
        executionResults
      );
      break;
    case 'technical_foundations':
    case 'crawl_index':
      evaluation = await evaluateTechnicalCheckpoint(
        plan.clientId,
        executionResults
      );
      break;
    case 'image_alt_coverage':
      evaluation = await evaluateImageAltCheckpoint(
        plan.clientId,
        executionResults
      );
      break;
    case 'schema_foundation':
    case 'trust_signals':
      evaluation = await evaluateTrustCheckpoint(
        plan.clientId,
        executionResults
      );
      break;
    case 'ai_modularity':
      evaluation = await evaluateAICheckpoint(
        plan.clientId,
        executionResults
      );
      break;
    case 'entity_coverage':
    case 'structure_ux':
    default:
      // Use generic evaluation based on template success conditions
      evaluation = await evaluateGenericCheckpoint(
        plan.clientId,
        executionResults,
        template
      );
  }

  // Get checkpoint config from template
  const checkpointConfig = template?.checkpoint;

  // Save checkpoint result with config
  await prisma.checkpoint.upsert({
    where: { taskId: task.id },
    create: {
      taskId: task.id,
      result: evaluation.result,
      evaluatedAt: new Date(),
      evaluationData: evaluation.data,
      validateWith: checkpointConfig?.validateWith || 'audit',
      successConditions: checkpointConfig?.successConditions || [],
    },
    update: {
      result: evaluation.result,
      evaluatedAt: new Date(),
      evaluationData: evaluation.data,
      validateWith: checkpointConfig?.validateWith || 'audit',
      successConditions: checkpointConfig?.successConditions || [],
    },
  });

  // Handle checkpoint result
  if (evaluation.result === 'pass') {
    // Unlock next task
    await unlockNextTask(planId, taskNumber);
    
    await logEvent(plan.clientId, 'checkpoint_passed', 'checkpoint', task.id, {
      planId,
      taskNumber,
      result: 'pass',
    });
  } else if (evaluation.result === 'partial') {
    // Keep task ready for adjustment/retry
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'ready' },
    });
    
    await logEvent(plan.clientId, 'checkpoint_partial', 'checkpoint', task.id, {
      planId,
      taskNumber,
      result: 'partial',
    });
  } else {
    // FAIL - task is blocked, requires branching
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'blocked' },
    });
    
    await logEvent(plan.clientId, 'checkpoint_failed', 'checkpoint', task.id, {
      planId,
      taskNumber,
      result: 'fail',
    });
  }

  return evaluation;
}

/**
 * Evaluate title search relevance checkpoint
 */
async function evaluateTitleSearchRelevance(
  clientId: string,
  executionResults: any
): Promise<CheckpointEvaluation> {
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    const latestAudit = await prisma.auditResult.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAudit) {
      auditData = latestAudit.rawSeoJson as any;
    }
  }

  if (!auditData) {
    return {
      result: 'fail',
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  const titleScore = auditData.titleSearchRelevanceScore || 
                     (auditData as any).titleScoreRaw || 0;
  const seoScore = auditData.seoScore || 0;

  if (titleScore >= 80 && seoScore >= 75) {
    return {
      result: 'pass',
      data: {
        score: titleScore,
        metrics: { titleScore, seoScore },
        reasoning: 'Title search relevance restored - strong title and SEO scores',
      },
    };
  } else if (titleScore >= 60 && seoScore >= 60) {
    return {
      result: 'partial',
      data: {
        score: titleScore,
        metrics: { titleScore, seoScore },
        reasoning: 'Partial improvement - needs further optimization',
      },
    };
  } else {
    return {
      result: 'fail',
      data: {
        score: titleScore,
        metrics: { titleScore, seoScore },
        reasoning: 'Insufficient improvement - consider branching plan',
      },
    };
  }
}

/**
 * Evaluate technical foundations checkpoint
 */
async function evaluateTechnicalCheckpoint(
  clientId: string,
  executionResults: any
): Promise<CheckpointEvaluation> {
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    const latestAudit = await prisma.auditResult.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAudit) {
      auditData = latestAudit.rawSeoJson as any;
    }
  }

  if (!auditData) {
    return {
      result: 'fail',
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  const technicalScore = auditData.technicalFoundationsScore || 
                         (auditData as any).technicalScore || 0;
  const statusCode = auditData.statusCode || auditData.status || 200;

  if (technicalScore >= 90 && statusCode === 200) {
    return {
      result: 'pass',
      data: {
        score: technicalScore,
        metrics: { technicalScore, statusCode },
        reasoning: 'Technical foundations solid - all checks passing',
      },
    };
  } else if (technicalScore >= 70 && statusCode === 200) {
    return {
      result: 'partial',
      data: {
        score: technicalScore,
        metrics: { technicalScore, statusCode },
        reasoning: 'Partial improvement - some technical issues remain',
      },
    };
  } else {
    return {
      result: 'fail',
      data: {
        score: technicalScore,
        metrics: { technicalScore, statusCode },
        reasoning: 'Technical issues persist - requires further fixes',
      },
    };
  }
}

/**
 * Evaluate image alt coverage checkpoint
 */
async function evaluateImageAltCheckpoint(
  clientId: string,
  executionResults: any
): Promise<CheckpointEvaluation> {
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    const latestAudit = await prisma.auditResult.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAudit) {
      auditData = latestAudit.rawSeoJson as any;
    }
  }

  if (!auditData) {
    return {
      result: 'fail',
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  const altCoverage = auditData.altTextCoverage || 
                     auditData.mediaMetrics?.altCoverage || 0;

  if (altCoverage >= 0.8) {
    return {
      result: 'pass',
      data: {
        score: altCoverage * 100,
        metrics: { altCoverage },
        reasoning: 'Alt text coverage meets target (80%+)',
      },
    };
  } else if (altCoverage >= 0.6) {
    return {
      result: 'partial',
      data: {
        score: altCoverage * 100,
        metrics: { altCoverage },
        reasoning: 'Partial improvement - continue adding alt text',
      },
    };
  } else {
    return {
      result: 'fail',
      data: {
        score: altCoverage * 100,
        metrics: { altCoverage },
        reasoning: 'Insufficient alt text coverage - significant work needed',
      },
    };
  }
}

/**
 * Evaluate trust checkpoint
 */
async function evaluateTrustCheckpoint(
  clientId: string,
  executionResults: any
): Promise<CheckpointEvaluation> {
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    const latestAudit = await prisma.auditResult.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAudit) {
      auditData = latestAudit.rawSeoJson as any;
    }
  }

  if (!auditData) {
    return {
      result: 'fail',
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  const aiScore = auditData.aiOptimizationScore || 
                  (auditData as any).aiScoreRaw || 0;
  const technicalScore = auditData.technicalFoundationsScore || 
                         (auditData as any).technicalScore || 0;
  const trustScore = (aiScore + technicalScore) / 2;

  if (trustScore >= 75) {
    return {
      result: 'pass',
      data: {
        score: trustScore,
        metrics: { aiScore, technicalScore, trustScore },
        reasoning: 'Strong trust signals and schema coverage achieved',
      },
    };
  } else if (trustScore >= 55) {
    return {
      result: 'partial',
      data: {
        score: trustScore,
        metrics: { aiScore, technicalScore, trustScore },
        reasoning: 'Moderate improvement - continue trust signal optimization',
      },
    };
  } else {
    return {
      result: 'fail',
      data: {
        score: trustScore,
        metrics: { aiScore, technicalScore, trustScore },
        reasoning: 'Insufficient trust improvement - consider different approach',
      },
    };
  }
}

/**
 * Evaluate AI checkpoint
 */
async function evaluateAICheckpoint(
  clientId: string,
  executionResults: any
): Promise<CheckpointEvaluation> {
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    const latestAudit = await prisma.auditResult.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAudit) {
      auditData = latestAudit.rawSeoJson as any;
    }
  }

  if (!auditData) {
    return {
      result: 'fail',
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  const aiScore = auditData.aiOptimizationScore || 
                  (auditData as any).aiScoreRaw || 0;
  const contentSemanticsScore = auditData.contentSemanticsScore || 
                                (auditData as any).contentSemanticsScore || 0;
  const aiReadabilityScore = (aiScore + contentSemanticsScore) / 2;

  if (aiReadabilityScore >= 70) {
    return {
      result: 'pass',
      data: {
        score: aiReadabilityScore,
        metrics: { aiScore, contentSemanticsScore, aiReadabilityScore },
        reasoning: 'AI extraction readiness achieved - structured answers ready',
      },
    };
  } else if (aiReadabilityScore >= 50) {
    return {
      result: 'partial',
      data: {
        score: aiReadabilityScore,
        metrics: { aiScore, contentSemanticsScore, aiReadabilityScore },
        reasoning: 'Partial improvement - continue structure optimization',
      },
    };
  } else {
    return {
      result: 'fail',
      data: {
        score: aiReadabilityScore,
        metrics: { aiScore, contentSemanticsScore, aiReadabilityScore },
        reasoning: 'Insufficient AI readability - consider different plan type',
      },
    };
  }
}

/**
 * Generic checkpoint evaluation based on template success conditions
 */
async function evaluateGenericCheckpoint(
  clientId: string,
  executionResults: any,
  template: any
): Promise<CheckpointEvaluation> {
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    const latestAudit = await prisma.auditResult.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    if (latestAudit) {
      auditData = latestAudit.rawSeoJson as any;
    }
  }

  if (!auditData) {
    return {
      result: 'fail',
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  // Simple evaluation based on overall SEO score improvement
  const seoScore = auditData.seoScore || 0;
  const baseline = auditData.baselineScore || seoScore;

  if (seoScore >= baseline + 5) {
    return {
      result: 'pass',
      data: {
        score: seoScore,
        metrics: { seoScore, baseline },
        reasoning: 'Significant improvement detected',
      },
    };
  } else if (seoScore >= baseline + 2) {
    return {
      result: 'partial',
      data: {
        score: seoScore,
        metrics: { seoScore, baseline },
        reasoning: 'Moderate improvement - continue optimization',
      },
    };
  } else {
    return {
      result: 'fail',
      data: {
        score: seoScore,
        metrics: { seoScore, baseline },
        reasoning: 'Insufficient improvement - consider different approach',
      },
    };
  }
}

/**
 * Evaluate checkpoint with audit (runs audit and evaluates)
 */
export async function evaluateCheckpointWithAudit(
  planId: string,
  taskNumber: number
): Promise<CheckpointEvaluation> {
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

  // Run audit
  const url = plan.client.canonicalUrl;
  const stage1 = await processStage1Sync(url);
  const stage2 = await processStage2Sync(stage1, US_STATES);
  const stage3 = await processStage3Sync(stage2);

  // Update task execution results with new audit
  await prisma.task.update({
    where: { id: task.id },
    data: {
      executionResults: {
        audit: {
          status: 'completed',
          results: stage3,
        },
      },
    },
  });

  // Evaluate checkpoint with new audit data
  return await evaluateCheckpoint(planId, taskNumber);
}

/**
 * Manually evaluate checkpoint (for admin review)
 */
export async function manualCheckpointEvaluation(
  planId: string,
  taskNumber: number,
  result: 'pass' | 'partial' | 'fail',
  reasoning: string
): Promise<CheckpointEvaluation> {
  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: {
      tasks: {
        where: { taskNumber },
      },
    },
  });

  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  const task = plan.tasks[0];
  if (!task) {
    throw new Error(`Task ${taskNumber} not found for plan ${planId}`);
  }

  const evaluation: CheckpointEvaluation = {
    result,
    data: {
      reasoning,
    },
  };

  // Get checkpoint config from template
  const template = getPlanTemplate(plan.planType);
  const checkpointConfig = template?.checkpoint;

  // Save checkpoint result with config
  await prisma.checkpoint.upsert({
    where: { taskId: task.id },
    create: {
      taskId: task.id,
      result: evaluation.result,
      evaluatedAt: new Date(),
      evaluationData: evaluation.data,
      validateWith: checkpointConfig?.validateWith || 'manual',
      successConditions: checkpointConfig?.successConditions || [],
    },
    update: {
      result: evaluation.result,
      evaluatedAt: new Date(),
      evaluationData: evaluation.data,
      validateWith: checkpointConfig?.validateWith || 'manual',
      successConditions: checkpointConfig?.successConditions || [],
    },
  });

  // Handle checkpoint result
  if (evaluation.result === 'pass') {
    await unlockNextTask(planId, taskNumber);
    await logEvent(plan.clientId, 'checkpoint_passed', 'checkpoint', task.id, {
      planId,
      taskNumber,
      result: 'pass',
    });
  } else if (evaluation.result === 'partial') {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'ready' },
    });
    await logEvent(plan.clientId, 'checkpoint_partial', 'checkpoint', task.id, {
      planId,
      taskNumber,
      result: 'partial',
    });
  } else {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'blocked' },
    });
    await logEvent(plan.clientId, 'checkpoint_failed', 'checkpoint', task.id, {
      planId,
      taskNumber,
      result: 'fail',
    });
  }

  return evaluation;
}

