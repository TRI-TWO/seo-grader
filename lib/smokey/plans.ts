import { prisma } from '@/lib/prisma';
import { logEvent } from './events';

export type ToolConfig = {
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual';
  required: boolean;
  blocking?: boolean;
};

export type TaskConfig = {
  taskNumber: number;
  taskCode: string;
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual';
  title: string;
  hasCheckpoint: boolean;
};

export type CheckpointConfig = {
  validateWith: 'audit' | 'manual';
  successConditions: string[];
};

export type PlanTemplate = {
  planType: string;
  objective: string;
  triggerConditions: string[];
  allowedTools: Array<'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual'>;
  tasks: TaskConfig[];
  checkpoint: CheckpointConfig;
  parallelSafeWith: string[];
  reassessAfterDays: number;
};

/**
 * Plan Templates for Smokey Decision Engine
 * Complete set of plan types covering all audit categories
 */
export const PLAN_TEMPLATES: Record<string, PlanTemplate> = {
  title_search_relevance: {
    planType: 'title_search_relevance',
    objective: 'Optimize title for service + locality intent',
    triggerConditions: [
      'title_contains_service=false',
      "semantic_match='no match'",
    ],
    allowedTools: ['crimson', 'audit', 'manual'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '1.1',
        tool: 'crimson',
        title: 'Generate 3 title variants (service + locality)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '1.2',
        tool: 'manual',
        title: 'Select best variant (SERP clarity)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '1.3',
        tool: 'crimson',
        title: 'Generate meta description',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '1.4',
        tool: 'manual',
        title: 'Deploy title + meta',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '1.5',
        tool: 'audit',
        title: 'Validate semantic match + score delta',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: [
        "semantic_match!='no match'",
        'title_contains_service=true',
        'title_contains_locality=true',
      ],
    },
    parallelSafeWith: ['image_alt_coverage', 'schema_foundation'],
    reassessAfterDays: 14,
  },
  technical_foundations: {
    planType: 'technical_foundations',
    objective: 'Fix canonical, robots, sitemap, and status code issues',
    triggerConditions: [
      'canonical_missing=true OR robots_missing=true OR sitemap_missing=true OR status_code!=200',
    ],
    allowedTools: ['manual', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '2.1',
        tool: 'audit',
        title: 'Confirm technical gaps list',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '2.2',
        tool: 'manual',
        title: 'Implement fixes (canonical/robots/sitemap/status)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '2.3',
        tool: 'manual',
        title: 'Validate server responses',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '2.4',
        tool: 'audit',
        title: 'Re-run technical checks',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '2.5',
        tool: 'audit',
        title: 'Regression scan',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['technical_score>=90', 'status_code=200'],
    },
    parallelSafeWith: ['image_alt_coverage', 'trust_signals'],
    reassessAfterDays: 14,
  },
  image_alt_coverage: {
    planType: 'image_alt_coverage',
    objective: 'Improve alt text coverage for images',
    triggerConditions: ['alt_text_coverage<0.8'],
    allowedTools: ['manual', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '3.1',
        tool: 'audit',
        title: 'Export image list missing alt',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '3.2',
        tool: 'manual',
        title: 'Write descriptive alt text (service/context)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '3.3',
        tool: 'manual',
        title: 'Apply alts + confirm filenames',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '3.4',
        tool: 'audit',
        title: 'Recheck alt coverage',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '3.5',
        tool: 'audit',
        title: 'Confirm media score delta',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['alt_text_coverage>=0.8'],
    },
    parallelSafeWith: [
      'schema_foundation',
      'ai_modularity',
      'title_search_relevance',
      'technical_foundations',
    ],
    reassessAfterDays: 14,
  },
  schema_foundation: {
    planType: 'schema_foundation',
    objective: 'Add LocalBusiness and FAQ schema markup',
    triggerConditions: ['schema_missing=true OR schema_incomplete=true'],
    allowedTools: ['manual', 'burnt', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '4.1',
        tool: 'manual',
        title: 'Add LocalBusiness schema (JSON-LD)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '4.2',
        tool: 'burnt',
        title: 'Generate FAQ schema (top 3 intents)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '4.3',
        tool: 'manual',
        title: 'Deploy schema blocks',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '4.4',
        tool: 'audit',
        title: 'Validate schema detection + errors',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '4.5',
        tool: 'audit',
        title: 'Confirm AI trust signals delta',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['schema_detected=true', 'schema_errors=0'],
    },
    parallelSafeWith: ['image_alt_coverage', 'trust_signals'],
    reassessAfterDays: 21,
  },
  ai_modularity: {
    planType: 'ai_modularity',
    objective: 'Improve AI extraction friendliness and structured answer readiness',
    triggerConditions: [
      'ai_extraction_friendliness<10 OR structured_answer_readiness<15',
    ],
    allowedTools: ['midnight', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '5.1',
        tool: 'midnight',
        title: 'Identify long blocks + weak headings',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '5.2',
        tool: 'midnight',
        title: 'Convert into modular answer blocks',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '5.3',
        tool: 'midnight',
        title: 'Add implicit Q/A formatting + section breaks',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '5.4',
        tool: 'audit',
        title: 'Re-run AI scoring',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '5.5',
        tool: 'audit',
        title: 'Confirm improvements without regressions',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: [
        'ai_score>=baseline+1',
        'structured_answer_readiness>=baseline+3',
      ],
    },
    parallelSafeWith: ['image_alt_coverage'],
    reassessAfterDays: 21,
  },
  entity_coverage: {
    planType: 'entity_coverage',
    objective: 'Add related services, tools, and locations for entity clarity',
    triggerConditions: [
      "entity_relationships='thin' OR missing_related_entities=true",
    ],
    allowedTools: ['burnt', 'midnight', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '6.1',
        tool: 'burnt',
        title: 'Generate entity list (services, tools, locations)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '6.2',
        tool: 'midnight',
        title: 'Insert entities naturally into sections',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '6.3',
        tool: 'midnight',
        title: 'Add service-area clarity blocks',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '6.4',
        tool: 'audit',
        title: 'Recheck entity density and clarity',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '6.5',
        tool: 'audit',
        title: 'Validate AI semantic clarity remains strong',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['semantic_clarity_entity_density>=baseline'],
    },
    parallelSafeWith: ['trust_signals', 'image_alt_coverage'],
    reassessAfterDays: 21,
  },
  trust_signals: {
    planType: 'trust_signals',
    objective: 'Add team bios, citations, internal links, and testimonials',
    triggerConditions: [
      'trust_enhancers_missing=true OR testimonials_missing=true',
    ],
    allowedTools: ['manual', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '7.1',
        tool: 'manual',
        title: 'Add 2–3 internal trust links (About, Licenses, Contact)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '7.2',
        tool: 'manual',
        title: 'Add visible trust markers (years, certifications, awards)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '7.3',
        tool: 'manual',
        title: 'Add testimonials section or surface existing reviews',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '7.4',
        tool: 'audit',
        title: 'Recheck AI trust signals score',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '7.5',
        tool: 'audit',
        title: 'Confirm no layout regression warnings',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['ai_trust_signals>=baseline'],
    },
    parallelSafeWith: ['schema_foundation', 'image_alt_coverage'],
    reassessAfterDays: 21,
  },
  crawl_index: {
    planType: 'crawl_index',
    objective: 'Fix robots.txt, sitemap, and indexing issues',
    triggerConditions: [
      'robots_accessible=false OR sitemap_accessible=false OR indexing_errors=true',
    ],
    allowedTools: ['manual', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '8.1',
        tool: 'audit',
        title: 'Confirm crawl/index blockers',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '8.2',
        tool: 'manual',
        title: 'Fix robots/sitemap/index directives',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '8.3',
        tool: 'manual',
        title: 'Validate endpoints accessible',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '8.4',
        tool: 'audit',
        title: 'Re-run crawl checks',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '8.5',
        tool: 'audit',
        title: 'Confirm status 200 + crawlability OK',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ["crawlability='good'"],
    },
    parallelSafeWith: ['image_alt_coverage'],
    reassessAfterDays: 14,
  },
  structure_ux: {
    planType: 'structure_ux',
    objective: 'Improve hero, navigation, services grid, and footer structure',
    triggerConditions: [
      "layout_guidance_present=true AND tier in ('growth','accelerate')",
    ],
    allowedTools: ['manual', 'midnight', 'audit'],
    tasks: [
      {
        taskNumber: 1,
        taskCode: '9.1',
        tool: 'manual',
        title: 'Implement hero clarity (service + geo + CTA)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 2,
        taskCode: '9.2',
        tool: 'manual',
        title: 'Improve navigation labels (service clarity)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 3,
        taskCode: '9.3',
        tool: 'manual',
        title: 'Services grid with short descriptions + CTA',
        hasCheckpoint: false,
      },
      {
        taskNumber: 4,
        taskCode: '9.4',
        tool: 'manual',
        title: 'Footer expansion (contact, minisitemap)',
        hasCheckpoint: false,
      },
      {
        taskNumber: 5,
        taskCode: '9.5',
        tool: 'audit',
        title: 'Regression + content clarity check',
        hasCheckpoint: true,
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: [
        'no_new_warnings_introduced',
        'content_clarity>=baseline',
      ],
    },
    parallelSafeWith: [],
    reassessAfterDays: 21,
  },
};

/**
 * Get plan template by type
 */
export function getPlanTemplate(planType: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES[planType];
}

/**
 * Get all available plan types
 */
export function getAllPlanTypes(): string[] {
  return Object.keys(PLAN_TEMPLATES);
}

/**
 * Check if two plan types can run in parallel
 */
export function canRunInParallel(planType1: string, planType2: string): boolean {
  const template1 = getPlanTemplate(planType1);
  const template2 = getPlanTemplate(planType2);
  if (!template1 || !template2) return false;
  return (
    template1.parallelSafeWith.includes(planType2) ||
    template2.parallelSafeWith.includes(planType1)
  );
}

/**
 * Create a plan with tasks
 */
export async function createPlan(
  clientId: string,
  planType: string,
  decisionId?: string | null,
  scheduledMonth?: number,
  dependsOnPlanId?: string | null,
  metadata?: any
) {
  const template = getPlanTemplate(planType);
  if (!template) {
    throw new Error(`Plan template not found for type: ${planType}`);
  }

  // Calculate reassessment date
  const reassessAfter = new Date();
  reassessAfter.setDate(reassessAfter.getDate() + template.reassessAfterDays);

  // Create plan with tasks
  const plan = await prisma.plan.create({
    data: {
      clientId,
      decisionId,
      planType,
      objective: template.objective,
      status: 'pending',
      scheduledMonth,
      dependsOnPlanId,
      reassessAfter,
      tasks: {
        create: template.tasks.map((taskConfig) => ({
          taskNumber: taskConfig.taskNumber,
          taskCode: taskConfig.taskCode,
          title: taskConfig.title,
          tool: taskConfig.tool,
          status: taskConfig.taskNumber === 1 ? 'ready' : 'locked',
          hasCheckpoint: taskConfig.hasCheckpoint,
        })),
      },
    },
    include: {
      tasks: {
        orderBy: {
          taskNumber: 'asc',
        },
      },
    },
  });

  // Log event
  await logEvent(clientId, 'plan_created', 'plan', plan.id, {
    planType,
    objective: template.objective,
  });

  return plan;
}
