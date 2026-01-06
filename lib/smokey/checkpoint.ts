import { prisma } from '@/lib/prisma';
import { PlayType, StepStatus, PlayStatus } from '@prisma/client';
import { getPlayTemplate } from './plays';
import { unlockNextStep } from './decision';
import { regenerateTimelineAfterCheckpoint } from './migration';
import { processStage1Sync, processStage2Sync, processStage3Sync } from '@/lib/auditStagesSync';

// CheckpointResult enum (legacy - not exported by Prisma as it's not used by current models)
enum CheckpointResult {
  PASS = 'PASS',
  PARTIAL = 'PARTIAL',
  FAIL = 'FAIL',
}

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
  result: CheckpointResult;
  data: {
    score?: number;
    metrics?: Record<string, any>;
    reasoning?: string;
  };
};

/**
 * Evaluate a checkpoint for a play step
 * Returns pass/partial/fail based on play type and audit results
 */
export async function evaluateCheckpoint(
  playId: string,
  stepNumber: number
): Promise<CheckpointEvaluation> {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      steps: {
        where: { stepNumber },
        include: {
          checkpoint: true,
        },
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

  // Get execution results
  const executionResults = step.executionResults as any;
  if (!executionResults) {
    throw new Error(`Step ${stepNumber} has no execution results. Execute the step first.`);
  }

  // Get template for checkpoint config
  const template = getPlayTemplate(play.playType);

  // Evaluate based on play type
  let evaluation: CheckpointEvaluation;

  // Use play-specific evaluator if available, otherwise use generic
  switch (play.playType) {
    case PlayType.HOMEPAGE_ELIGIBILITY:
    case PlayType.TITLE_SEARCH_RELEVANCE:
      evaluation = await evaluateHomepageEligibility(
        play.clientId,
        executionResults
      );
      break;
    case PlayType.TRUST_STRUCTURING:
    case PlayType.TRUST_SIGNALS:
    case PlayType.SCHEMA_FOUNDATION:
      evaluation = await evaluateTrustStructuring(
        play.clientId,
        executionResults
      );
      break;
    case PlayType.AI_READABILITY:
    case PlayType.AI_MODULARITY:
      evaluation = await evaluateAIReadability(
        play.clientId,
        executionResults
      );
      break;
    case PlayType.TECHNICAL_FOUNDATIONS:
    case PlayType.CRAWL_INDEX:
      evaluation = await evaluateTechnicalCheckpoint(
        play.clientId,
        executionResults
      );
      break;
    case PlayType.IMAGE_ALT_COVERAGE:
      evaluation = await evaluateImageAltCheckpoint(
        play.clientId,
        executionResults
      );
      break;
    case PlayType.ENTITY_COVERAGE:
    case PlayType.STRUCTURE_UX:
      // Use generic evaluation based on template success conditions
      evaluation = await evaluateGenericCheckpoint(
        play.clientId,
        executionResults,
        template
      );
      break;
    default:
      // Fallback to generic evaluation
      evaluation = await evaluateGenericCheckpoint(
        play.clientId,
        executionResults,
        template
      );
  }

  // Get checkpoint config from template
  const checkpointConfig = template?.checkpoint;

  // Save checkpoint result with config
  await prisma.checkpoint.upsert({
    where: { playStepId: step.id },
    create: {
      playStepId: step.id,
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
  if (evaluation.result === CheckpointResult.PASS) {
    // Unlock next step
    await unlockNextStep(playId, stepNumber);
    // Mark current step as completed
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.COMPLETED },
    });

    // Check if play is completed - if so, regenerate timeline
    const updatedPlay = await prisma.play.findUnique({
      where: { id: playId },
    });

    if (updatedPlay?.status === PlayStatus.COMPLETED) {
      // All steps completed - regenerate timeline as per spec
      await regenerateTimelineAfterCheckpoint(play.clientId);
    }
  } else if (evaluation.result === CheckpointResult.PARTIAL) {
    // Keep step unlocked for adjustment/retry
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.UNLOCKED },
    });
  } else {
    // FAIL - step is blocked, requires branching
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.BLOCKED },
    });
  }

  return evaluation;
}

/**
 * Evaluate homepage eligibility checkpoint
 * Based on title score and homepage eligibility metrics
 */
async function evaluateHomepageEligibility(
  clientId: string,
  executionResults: any
): Promise<CheckpointEvaluation> {
  // Get most recent audit from execution results or latest audit
  // Executor stores as: { status: 'completed', results: auditData }
  let auditData = executionResults.audit?.results || executionResults.audit;

  if (!auditData) {
    // Fallback: get latest audit for client
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
      result: CheckpointResult.FAIL,
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  // Extract scores - handle both direct properties and nested structure
  const titleScore = auditData.titleSearchRelevanceScore || 
                     (auditData as any).titleScoreRaw || 0;
  const seoScore = auditData.seoScore || 0;

  // Homepage eligibility thresholds
  if (titleScore >= 80 && seoScore >= 75) {
    return {
      result: CheckpointResult.PASS,
      data: {
        score: titleScore,
        metrics: { titleScore, seoScore },
        reasoning: 'Homepage eligibility restored - strong title and SEO scores',
      },
    };
  } else if (titleScore >= 60 && seoScore >= 60) {
    return {
      result: CheckpointResult.PARTIAL,
      data: {
        score: titleScore,
        metrics: { titleScore, seoScore },
        reasoning: 'Partial improvement - needs further optimization',
      },
    };
  } else {
    return {
      result: CheckpointResult.FAIL,
      data: {
        score: titleScore,
        metrics: { titleScore, seoScore },
        reasoning: 'Insufficient improvement - consider branching play',
      },
    };
  }
}

/**
 * Evaluate trust structuring checkpoint
 * Based on trust signals, schema coverage, and entity confidence
 */
async function evaluateTrustStructuring(
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
      result: CheckpointResult.FAIL,
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  // Extract trust-related metrics
  // Handle both direct properties and nested structure
  const aiScore = auditData.aiOptimizationScore || 
                  (auditData as any).aiScoreRaw || 0;
  const technicalScore = auditData.technicalFoundationsScore || 
                         (auditData as any).technicalScore || 0;
  // Trust signals are typically part of AI score components
  const trustScore = (aiScore + technicalScore) / 2;

  if (trustScore >= 75) {
    return {
      result: CheckpointResult.PASS,
      data: {
        score: trustScore,
        metrics: { aiScore, technicalScore, trustScore },
        reasoning: 'Strong trust signals and schema coverage achieved',
      },
    };
  } else if (trustScore >= 55) {
    return {
      result: CheckpointResult.PARTIAL,
      data: {
        score: trustScore,
        metrics: { aiScore, technicalScore, trustScore },
        reasoning: 'Moderate improvement - continue trust signal optimization',
      },
    };
  } else {
    return {
      result: CheckpointResult.FAIL,
      data: {
        score: trustScore,
        metrics: { aiScore, technicalScore, trustScore },
        reasoning: 'Insufficient trust improvement - consider different approach',
      },
    };
  }
}

/**
 * Evaluate AI readability checkpoint
 * Based on AI score components (extraction readiness, structured answers)
 */
async function evaluateAIReadability(
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
      result: CheckpointResult.FAIL,
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  // Extract AI readability metrics
  // Handle both direct properties and nested structure
  const aiScore = auditData.aiOptimizationScore || 
                  (auditData as any).aiScoreRaw || 0;
  const contentSemanticsScore = auditData.contentSemanticsScore || 
                                (auditData as any).contentSemanticsScore || 0;
  const aiReadabilityScore = (aiScore + contentSemanticsScore) / 2;

  if (aiReadabilityScore >= 70) {
    return {
      result: CheckpointResult.PASS,
      data: {
        score: aiReadabilityScore,
        metrics: { aiScore, contentSemanticsScore, aiReadabilityScore },
        reasoning: 'AI extraction readiness achieved - structured answers ready',
      },
    };
  } else if (aiReadabilityScore >= 50) {
    return {
      result: CheckpointResult.PARTIAL,
      data: {
        score: aiReadabilityScore,
        metrics: { aiScore, contentSemanticsScore, aiReadabilityScore },
        reasoning: 'Partial improvement - continue structure optimization',
      },
    };
  } else {
    return {
      result: CheckpointResult.FAIL,
      data: {
        score: aiReadabilityScore,
        metrics: { aiScore, contentSemanticsScore, aiReadabilityScore },
        reasoning: 'Insufficient AI readability - consider different play type',
      },
    };
  }
}

/**
 * Evaluate checkpoint with audit (runs audit and evaluates)
 */
export async function evaluateCheckpointWithAudit(
  playId: string,
  stepNumber: number
): Promise<CheckpointEvaluation> {
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

  // Run audit
  const url = play.client.canonicalUrl;
  const stage1 = await processStage1Sync(url);
  const stage2 = await processStage2Sync(stage1, US_STATES);
  const stage3 = await processStage3Sync(stage2);

  // Update step execution results with new audit
  await prisma.playStep.update({
    where: { id: step.id },
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
  return await evaluateCheckpoint(playId, stepNumber);
}

/**
 * Manually evaluate checkpoint (for admin review)
 */
export async function manualCheckpointEvaluation(
  playId: string,
  stepNumber: number,
  result: CheckpointResult,
  reasoning: string
): Promise<CheckpointEvaluation> {
  const play = await prisma.play.findUnique({
    where: { id: playId },
    include: {
      steps: {
        where: { stepNumber },
      },
    },
  });

  if (!play) {
    throw new Error(`Play ${playId} not found`);
  }

  const step = play.steps[0];
  if (!step) {
    throw new Error(`Step ${stepNumber} not found for play ${playId}`);
  }

  const evaluation: CheckpointEvaluation = {
    result,
    data: {
      reasoning,
    },
  };

  // Get checkpoint config from template
  const template = play ? getPlayTemplate(play.playType) : undefined;
  const checkpointConfig = template?.checkpoint;

  // Save checkpoint result with config
  await prisma.checkpoint.upsert({
    where: { playStepId: step.id },
    create: {
      playStepId: step.id,
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
  if (evaluation.result === CheckpointResult.PASS) {
    await unlockNextStep(playId, stepNumber);
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.COMPLETED },
    });

    // Check if play is completed - if so, regenerate timeline
    const updatedPlay = await prisma.play.findUnique({
      where: { id: playId },
    });

    if (updatedPlay?.status === PlayStatus.COMPLETED) {
      // All steps completed - regenerate timeline as per spec
      await regenerateTimelineAfterCheckpoint(updatedPlay.clientId);
    }
  } else if (evaluation.result === CheckpointResult.PARTIAL) {
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.UNLOCKED },
    });
  } else {
    await prisma.playStep.update({
      where: { id: step.id },
      data: { status: StepStatus.BLOCKED },
    });
  }

  return evaluation;
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
      result: CheckpointResult.FAIL,
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
      result: CheckpointResult.PASS,
      data: {
        score: technicalScore,
        metrics: { technicalScore, statusCode },
        reasoning: 'Technical foundations solid - all checks passing',
      },
    };
  } else if (technicalScore >= 70 && statusCode === 200) {
    return {
      result: CheckpointResult.PARTIAL,
      data: {
        score: technicalScore,
        metrics: { technicalScore, statusCode },
        reasoning: 'Partial improvement - some technical issues remain',
      },
    };
  } else {
    return {
      result: CheckpointResult.FAIL,
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
      result: CheckpointResult.FAIL,
      data: {
        reasoning: 'No audit data available for evaluation',
      },
    };
  }

  const altCoverage = auditData.altTextCoverage || 
                     auditData.mediaMetrics?.altCoverage || 0;

  if (altCoverage >= 0.8) {
    return {
      result: CheckpointResult.PASS,
      data: {
        score: altCoverage * 100,
        metrics: { altCoverage },
        reasoning: 'Alt text coverage meets target (80%+)',
      },
    };
  } else if (altCoverage >= 0.6) {
    return {
      result: CheckpointResult.PARTIAL,
      data: {
        score: altCoverage * 100,
        metrics: { altCoverage },
        reasoning: 'Partial improvement - continue adding alt text',
      },
    };
  } else {
    return {
      result: CheckpointResult.FAIL,
      data: {
        score: altCoverage * 100,
        metrics: { altCoverage },
        reasoning: 'Insufficient alt text coverage - significant work needed',
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
      result: CheckpointResult.FAIL,
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
      result: CheckpointResult.PASS,
      data: {
        score: seoScore,
        metrics: { seoScore, baseline },
        reasoning: 'Significant improvement detected',
      },
    };
  } else if (seoScore >= baseline + 2) {
    return {
      result: CheckpointResult.PARTIAL,
      data: {
        score: seoScore,
        metrics: { seoScore, baseline },
        reasoning: 'Moderate improvement - continue optimization',
      },
    };
  } else {
    return {
      result: CheckpointResult.FAIL,
      data: {
        score: seoScore,
        metrics: { seoScore, baseline },
        reasoning: 'Insufficient improvement - consider different approach',
      },
    };
  }
}
