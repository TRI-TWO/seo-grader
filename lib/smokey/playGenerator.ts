import { PlayType } from '@prisma/client';
import { getPlayTemplate, evaluateTriggerConditions } from './plays';
import { getPlanTemplate } from './plans';
import { createPlanInstance } from './planEngine';
import { canActivatePlan } from './parallel';

/**
 * Map PlayType enum to planType string
 */
function mapPlayTypeToPlanType(playType: PlayType): string {
  const mapping: Record<PlayType, string> = {
    [PlayType.TITLE_SEARCH_RELEVANCE]: 'title_search_relevance',
    [PlayType.TECHNICAL_FOUNDATIONS]: 'technical_foundations',
    [PlayType.IMAGE_ALT_COVERAGE]: 'image_alt_coverage',
    [PlayType.SCHEMA_FOUNDATION]: 'schema_foundation',
    [PlayType.AI_MODULARITY]: 'ai_modularity',
    [PlayType.ENTITY_COVERAGE]: 'entity_coverage',
    [PlayType.TRUST_SIGNALS]: 'trust_signals',
    [PlayType.CRAWL_INDEX]: 'crawl_index',
    [PlayType.STRUCTURE_UX]: 'structure_ux',
    [PlayType.HOMEPAGE_ELIGIBILITY]: 'title_search_relevance', // Map to closest equivalent
    [PlayType.TRUST_STRUCTURING]: 'trust_signals', // Map to closest equivalent
    [PlayType.AI_READABILITY]: 'ai_modularity', // Map to closest equivalent
  };
  return mapping[playType] || 'title_search_relevance';
}

/**
 * Analyze audit results and return array of play types that match trigger conditions
 */
export function getTriggeredPlays(auditResults: any): PlayType[] {
  const triggeredPlays: PlayType[] = [];

  // Check each play type's trigger conditions
  const allPlayTypes = Object.values(PlayType);
  for (const playType of allPlayTypes) {
    const template = getPlayTemplate(playType);
    if (!template) continue;

    if (evaluateTriggerConditions(playType, auditResults)) {
      triggeredPlays.push(playType);
    }
  }

  return triggeredPlays;
}

/**
 * Analyze audit and suggest play types based on scores and conditions
 */
export function analyzeAuditForPlays(auditResults: any): {
  suggestedPlays: PlayType[];
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}[] {
  const suggestions: {
    suggestedPlays: PlayType[];
    priority: 'high' | 'medium' | 'low';
    reasoning: string;
  }[] = [];

  // Extract key metrics
  const titleScore = auditResults.titleSearchRelevanceScore || auditResults.titleScoreRaw || 0;
  const technicalScore = auditResults.technicalFoundationsScore || auditResults.technicalScore || 0;
  const aiScore = auditResults.aiOptimizationScore || auditResults.aiScoreRaw || 0;
  const mediaScore = auditResults.mediaOptimizationScore || 0;
  const seoScore = auditResults.seoScore || 0;

  // High priority: Critical issues
  if (titleScore < 60) {
    suggestions.push({
      suggestedPlays: [PlayType.TITLE_SEARCH_RELEVANCE],
      priority: 'high',
      reasoning: 'Title score is critically low - immediate action needed',
    });
  }

  if (technicalScore < 70) {
    suggestions.push({
      suggestedPlays: [PlayType.TECHNICAL_FOUNDATIONS],
      priority: 'high',
      reasoning: 'Technical foundations need improvement',
    });
  }

  // Medium priority: Important improvements
  const altCoverage = auditResults.altTextCoverage || auditResults.mediaMetrics?.altCoverage || 1;
  if (altCoverage < 0.8) {
    suggestions.push({
      suggestedPlays: [PlayType.IMAGE_ALT_COVERAGE],
      priority: 'medium',
      reasoning: 'Image alt text coverage below 80%',
    });
  }

  if (aiScore < 60) {
    suggestions.push({
      suggestedPlays: [PlayType.AI_MODULARITY],
      priority: 'medium',
      reasoning: 'AI extraction friendliness needs improvement',
    });
  }

  // Check for schema
  const hasSchema = auditResults.schemaDetected || auditResults.schema?.detected || false;
  if (!hasSchema) {
    suggestions.push({
      suggestedPlays: [PlayType.SCHEMA_FOUNDATION],
      priority: 'medium',
      reasoning: 'No schema markup detected',
    });
  }

  // Lower priority: Optimization opportunities
  if (seoScore >= 70 && seoScore < 85) {
    suggestions.push({
      suggestedPlays: [PlayType.ENTITY_COVERAGE, PlayType.TRUST_SIGNALS],
      priority: 'low',
      reasoning: 'Good baseline - optimize for advanced signals',
    });
  }

  return suggestions;
}

/**
 * Auto-generate plans from audit results
 * Creates plans based on triggered conditions (migrated from Play system)
 * @deprecated This function name is legacy - it now creates Plans, not Plays
 */
export async function generatePlaysFromAudit(
  clientId: string,
  auditResults: any
): Promise<{
  created: any[];
  suggested: PlayType[];
  skipped: PlayType[];
}> {
  const triggeredPlays = getTriggeredPlays(auditResults);
  const created: any[] = [];
  const suggested: PlayType[] = [];
  const skipped: PlayType[] = [];

  for (const playType of triggeredPlays) {
    try {
      // Map PlayType to planType string
      const planType = mapPlayTypeToPlanType(playType);
      
      // Check if plan template exists
      const template = getPlanTemplate(planType);
      if (!template) {
        skipped.push(playType);
        continue;
      }

      // Check if can activate using Plan system
      const canActivate = await canActivatePlan(clientId, planType, null);

      if (canActivate.canActivate) {
        // Create plan immediately using Plan system
        const plan = await createPlanInstance(clientId, planType, undefined, undefined, undefined, false);
        created.push(plan);
      } else {
        // Queue or suggest
        if (canActivate.reason?.includes('WIP limit')) {
          // Will be queued automatically by createPlanInstance
          try {
            const plan = await createPlanInstance(clientId, planType, undefined, undefined, undefined, false);
            created.push(plan);
          } catch (error) {
            suggested.push(playType);
          }
        } else {
          suggested.push(playType);
        }
      }
    } catch (error) {
      skipped.push(playType);
    }
  }

  return { created, suggested, skipped };
}

