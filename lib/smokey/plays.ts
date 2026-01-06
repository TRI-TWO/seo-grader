import { PlayType } from '@prisma/client';

export type ToolConfig = {
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual';
  required: boolean;
  blocking?: boolean; // If true, next tool waits for this to complete
};

export type StepConfig = {
  stepNumber: number; // 1-5
  stepCode: string; // e.g., "1.1", "1.2"
  tool: 'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual';
  title: string;
  toolSequence?: ToolConfig[]; // For backward compatibility
};

export type CheckpointConfig = {
  validateWith: 'audit' | 'manual';
  successConditions: string[]; // Array of condition strings to evaluate
};

export type PlayTemplate = {
  playType: PlayType;
  objective: string;
  triggerConditions: string[]; // Audit conditions that trigger this play
  allowedTools: Array<'audit' | 'crimson' | 'midnight' | 'burnt' | 'manual'>;
  steps: StepConfig[]; // Steps 1-5 with stepCode, tool, title
  checkpoint: CheckpointConfig;
  parallelSafeWith: PlayType[]; // Play types that can run concurrently
  reassessAfterDays: number;
};

/**
 * Play Templates for Smokey Decision Engine
 * Complete set of 9 play types covering all audit categories
 */
export const PLAY_TEMPLATES: Partial<Record<PlayType, PlayTemplate>> = {
  TITLE_SEARCH_RELEVANCE: {
    playType: PlayType.TITLE_SEARCH_RELEVANCE,
    objective: 'Optimize title for service + locality intent',
    triggerConditions: [
      'title_contains_service=false',
      "semantic_match='no match'",
    ],
    allowedTools: ['crimson', 'audit', 'manual'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '1.1',
        tool: 'crimson',
        title: 'Generate 3 title variants (service + locality)',
      },
      {
        stepNumber: 2,
        stepCode: '1.2',
        tool: 'manual',
        title: 'Select best variant (SERP clarity)',
      },
      {
        stepNumber: 3,
        stepCode: '1.3',
        tool: 'crimson',
        title: 'Generate meta description',
      },
      {
        stepNumber: 4,
        stepCode: '1.4',
        tool: 'manual',
        title: 'Deploy title + meta',
      },
      {
        stepNumber: 5,
        stepCode: '1.5',
        tool: 'audit',
        title: 'Validate semantic match + score delta',
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
    parallelSafeWith: [
      PlayType.IMAGE_ALT_COVERAGE,
      PlayType.SCHEMA_FOUNDATION,
    ],
    reassessAfterDays: 14,
  },
  TECHNICAL_FOUNDATIONS: {
    playType: PlayType.TECHNICAL_FOUNDATIONS,
    objective: 'Fix canonical, robots, sitemap, and status code issues',
    triggerConditions: [
      'canonical_missing=true OR robots_missing=true OR sitemap_missing=true OR status_code!=200',
    ],
    allowedTools: ['manual', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '2.1',
        tool: 'audit',
        title: 'Confirm technical gaps list',
      },
      {
        stepNumber: 2,
        stepCode: '2.2',
        tool: 'manual',
        title: 'Implement fixes (canonical/robots/sitemap/status)',
      },
      {
        stepNumber: 3,
        stepCode: '2.3',
        tool: 'manual',
        title: 'Validate server responses',
      },
      {
        stepNumber: 4,
        stepCode: '2.4',
        tool: 'audit',
        title: 'Re-run technical checks',
      },
      {
        stepNumber: 5,
        stepCode: '2.5',
        tool: 'audit',
        title: 'Regression scan',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['technical_score>=90', 'status_code=200'],
    },
    parallelSafeWith: [
      PlayType.IMAGE_ALT_COVERAGE,
      PlayType.TRUST_SIGNALS,
    ],
    reassessAfterDays: 14,
  },
  IMAGE_ALT_COVERAGE: {
    playType: PlayType.IMAGE_ALT_COVERAGE,
    objective: 'Improve alt text coverage for images',
    triggerConditions: ['alt_text_coverage<0.8'],
    allowedTools: ['manual', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '3.1',
        tool: 'audit',
        title: 'Export image list missing alt',
      },
      {
        stepNumber: 2,
        stepCode: '3.2',
        tool: 'manual',
        title: 'Write descriptive alt text (service/context)',
      },
      {
        stepNumber: 3,
        stepCode: '3.3',
        tool: 'manual',
        title: 'Apply alts + confirm filenames',
      },
      {
        stepNumber: 4,
        stepCode: '3.4',
        tool: 'audit',
        title: 'Recheck alt coverage',
      },
      {
        stepNumber: 5,
        stepCode: '3.5',
        tool: 'audit',
        title: 'Confirm media score delta',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['alt_text_coverage>=0.8'],
    },
    parallelSafeWith: [
      PlayType.SCHEMA_FOUNDATION,
      PlayType.AI_MODULARITY,
      PlayType.TITLE_SEARCH_RELEVANCE,
      PlayType.TECHNICAL_FOUNDATIONS,
    ],
    reassessAfterDays: 14,
  },
  SCHEMA_FOUNDATION: {
    playType: PlayType.SCHEMA_FOUNDATION,
    objective: 'Add LocalBusiness and FAQ schema markup',
    triggerConditions: [
      'schema_missing=true OR schema_incomplete=true',
    ],
    allowedTools: ['manual', 'burnt', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '4.1',
        tool: 'manual',
        title: 'Add LocalBusiness schema (JSON-LD)',
      },
      {
        stepNumber: 2,
        stepCode: '4.2',
        tool: 'burnt',
        title: 'Generate FAQ schema (top 3 intents)',
      },
      {
        stepNumber: 3,
        stepCode: '4.3',
        tool: 'manual',
        title: 'Deploy schema blocks',
      },
      {
        stepNumber: 4,
        stepCode: '4.4',
        tool: 'audit',
        title: 'Validate schema detection + errors',
      },
      {
        stepNumber: 5,
        stepCode: '4.5',
        tool: 'audit',
        title: 'Confirm AI trust signals delta',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['schema_detected=true', 'schema_errors=0'],
    },
    parallelSafeWith: [
      PlayType.IMAGE_ALT_COVERAGE,
      PlayType.TRUST_SIGNALS,
    ],
    reassessAfterDays: 21,
  },
  AI_MODULARITY: {
    playType: PlayType.AI_MODULARITY,
    objective: 'Improve AI extraction friendliness and structured answer readiness',
    triggerConditions: [
      'ai_extraction_friendliness<10 OR structured_answer_readiness<15',
    ],
    allowedTools: ['midnight', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '5.1',
        tool: 'midnight',
        title: 'Identify long blocks + weak headings',
      },
      {
        stepNumber: 2,
        stepCode: '5.2',
        tool: 'midnight',
        title: 'Convert into modular answer blocks',
      },
      {
        stepNumber: 3,
        stepCode: '5.3',
        tool: 'midnight',
        title: 'Add implicit Q/A formatting + section breaks',
      },
      {
        stepNumber: 4,
        stepCode: '5.4',
        tool: 'audit',
        title: 'Re-run AI scoring',
      },
      {
        stepNumber: 5,
        stepCode: '5.5',
        tool: 'audit',
        title: 'Confirm improvements without regressions',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: [
        'ai_score>=baseline+1',
        'structured_answer_readiness>=baseline+3',
      ],
    },
    parallelSafeWith: [PlayType.IMAGE_ALT_COVERAGE],
    reassessAfterDays: 21,
  },
  ENTITY_COVERAGE: {
    playType: PlayType.ENTITY_COVERAGE,
    objective: 'Add related services, tools, and locations for entity clarity',
    triggerConditions: [
      "entity_relationships='thin' OR missing_related_entities=true",
    ],
    allowedTools: ['burnt', 'midnight', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '6.1',
        tool: 'burnt',
        title: 'Generate entity list (services, tools, locations)',
      },
      {
        stepNumber: 2,
        stepCode: '6.2',
        tool: 'midnight',
        title: 'Insert entities naturally into sections',
      },
      {
        stepNumber: 3,
        stepCode: '6.3',
        tool: 'midnight',
        title: 'Add service-area clarity blocks',
      },
      {
        stepNumber: 4,
        stepCode: '6.4',
        tool: 'audit',
        title: 'Recheck entity density and clarity',
      },
      {
        stepNumber: 5,
        stepCode: '6.5',
        tool: 'audit',
        title: 'Validate AI semantic clarity remains strong',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: [
        'semantic_clarity_entity_density>=baseline',
      ],
    },
    parallelSafeWith: [
      PlayType.TRUST_SIGNALS,
      PlayType.IMAGE_ALT_COVERAGE,
    ],
    reassessAfterDays: 21,
  },
  TRUST_SIGNALS: {
    playType: PlayType.TRUST_SIGNALS,
    objective: 'Add team bios, citations, internal links, and testimonials',
    triggerConditions: [
      'trust_enhancers_missing=true OR testimonials_missing=true',
    ],
    allowedTools: ['manual', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '7.1',
        tool: 'manual',
        title: 'Add 2–3 internal trust links (About, Licenses, Contact)',
      },
      {
        stepNumber: 2,
        stepCode: '7.2',
        tool: 'manual',
        title: 'Add visible trust markers (years, certifications, awards)',
      },
      {
        stepNumber: 3,
        stepCode: '7.3',
        tool: 'manual',
        title: 'Add testimonials section or surface existing reviews',
      },
      {
        stepNumber: 4,
        stepCode: '7.4',
        tool: 'audit',
        title: 'Recheck AI trust signals score',
      },
      {
        stepNumber: 5,
        stepCode: '7.5',
        tool: 'audit',
        title: 'Confirm no layout regression warnings',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['ai_trust_signals>=baseline'],
    },
    parallelSafeWith: [
      PlayType.SCHEMA_FOUNDATION,
      PlayType.IMAGE_ALT_COVERAGE,
    ],
    reassessAfterDays: 21,
  },
  CRAWL_INDEX: {
    playType: PlayType.CRAWL_INDEX,
    objective: 'Fix robots.txt, sitemap, and indexing issues',
    triggerConditions: [
      'robots_accessible=false OR sitemap_accessible=false OR indexing_errors=true',
    ],
    allowedTools: ['manual', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '8.1',
        tool: 'audit',
        title: 'Confirm crawl/index blockers',
      },
      {
        stepNumber: 2,
        stepCode: '8.2',
        tool: 'manual',
        title: 'Fix robots/sitemap/index directives',
      },
      {
        stepNumber: 3,
        stepCode: '8.3',
        tool: 'manual',
        title: 'Validate endpoints accessible',
      },
      {
        stepNumber: 4,
        stepCode: '8.4',
        tool: 'audit',
        title: 'Re-run crawl checks',
      },
      {
        stepNumber: 5,
        stepCode: '8.5',
        tool: 'audit',
        title: 'Confirm status 200 + crawlability OK',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ["crawlability='good'"],
    },
    parallelSafeWith: [PlayType.IMAGE_ALT_COVERAGE],
    reassessAfterDays: 14,
  },
  STRUCTURE_UX: {
    playType: PlayType.STRUCTURE_UX,
    objective: 'Improve hero, navigation, services grid, and footer structure',
    triggerConditions: [
      "layout_guidance_present=true AND tier in ('growth','enterprise')",
    ],
    allowedTools: ['manual', 'midnight', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '9.1',
        tool: 'manual',
        title: 'Implement hero clarity (service + geo + CTA)',
      },
      {
        stepNumber: 2,
        stepCode: '9.2',
        tool: 'manual',
        title: 'Improve navigation labels (service clarity)',
      },
      {
        stepNumber: 3,
        stepCode: '9.3',
        tool: 'manual',
        title: 'Services grid with short descriptions + CTA',
      },
      {
        stepNumber: 4,
        stepCode: '9.4',
        tool: 'manual',
        title: 'Footer expansion (contact, minisitemap)',
      },
      {
        stepNumber: 5,
        stepCode: '9.5',
        tool: 'audit',
        title: 'Regression + content clarity check',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: [
        'no_new_warnings_introduced',
        'content_clarity>=baseline',
      ],
    },
    parallelSafeWith: [], // No parallel plays for structure changes
    reassessAfterDays: 21,
  },
  // Legacy play types (keep for backward compatibility)
  HOMEPAGE_ELIGIBILITY: {
    playType: PlayType.HOMEPAGE_ELIGIBILITY,
    objective: 'Restore homepage eligibility for service + locality intent',
    triggerConditions: ['title_score<70', 'homepage_eligibility=false'],
    allowedTools: ['crimson', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '10.1',
        tool: 'audit',
        title: 'Baseline audit to assess current homepage eligibility',
      },
      {
        stepNumber: 2,
        stepCode: '10.2',
        tool: 'crimson',
        title: 'Optimize content for service + locality intent',
      },
      {
        stepNumber: 3,
        stepCode: '10.3',
        tool: 'audit',
        title: 'Re-audit to measure improvement',
      },
      {
        stepNumber: 4,
        stepCode: '10.4',
        tool: 'crimson',
        title: 'Fine-tune content based on audit results',
      },
      {
        stepNumber: 5,
        stepCode: '10.5',
        tool: 'audit',
        title: 'Final audit to confirm eligibility restoration',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['title_score>=80', 'seo_score>=75'],
    },
    parallelSafeWith: [],
    reassessAfterDays: 14,
  },
  TRUST_STRUCTURING: {
    playType: PlayType.TRUST_STRUCTURING,
    objective: 'Increase trust, schema coverage, and entity confidence',
    triggerConditions: ['trust_score<55', 'schema_missing=true'],
    allowedTools: ['manual', 'burnt', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '11.1',
        tool: 'audit',
        title: 'Assess current trust signals and schema coverage',
      },
      {
        stepNumber: 2,
        stepCode: '11.2',
        tool: 'burnt',
        title: 'Prioritize trust-building actions',
      },
      {
        stepNumber: 3,
        stepCode: '11.3',
        tool: 'manual',
        title: 'Implement schema and trust signal improvements',
      },
      {
        stepNumber: 4,
        stepCode: '11.4',
        tool: 'audit',
        title: 'Verify trust signal improvements',
      },
      {
        stepNumber: 5,
        stepCode: '11.5',
        tool: 'burnt',
        title: 'Final prioritization and optimization',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['trust_score>=75'],
    },
    parallelSafeWith: [PlayType.IMAGE_ALT_COVERAGE],
    reassessAfterDays: 21,
  },
  AI_READABILITY: {
    playType: PlayType.AI_READABILITY,
    objective: 'Improve AI extraction and structured answer readiness',
    triggerConditions: ['ai_score<60', 'ai_readability_score<50'],
    allowedTools: ['midnight', 'audit'],
    steps: [
      {
        stepNumber: 1,
        stepCode: '12.1',
        tool: 'audit',
        title: 'Assess current AI readability scores',
      },
      {
        stepNumber: 2,
        stepCode: '12.2',
        tool: 'midnight',
        title: 'Analyze and improve structure for AI extraction',
      },
      {
        stepNumber: 3,
        stepCode: '12.3',
        tool: 'audit',
        title: 'Measure AI readability improvements',
      },
      {
        stepNumber: 4,
        stepCode: '12.4',
        tool: 'midnight',
        title: 'Refine structure based on audit results',
      },
      {
        stepNumber: 5,
        stepCode: '12.5',
        tool: 'audit',
        title: 'Final assessment of AI extraction readiness',
      },
    ],
    checkpoint: {
      validateWith: 'audit',
      successConditions: ['ai_readability_score>=70'],
    },
    parallelSafeWith: [PlayType.IMAGE_ALT_COVERAGE],
    reassessAfterDays: 21,
  },
};

/**
 * Get play template by type
 */
export function getPlayTemplate(playType: PlayType): PlayTemplate | undefined {
  return PLAY_TEMPLATES[playType];
}

/**
 * Get all available play types
 */
export function getAllPlayTypes(): PlayType[] {
  return Object.values(PlayType);
}

/**
 * Validate that a tool is allowed for a play type
 */
export function isToolAllowed(playType: PlayType, tool: string): boolean {
  const template = getPlayTemplate(playType);
  if (!template) return false;
  return template.allowedTools.includes(tool as any);
}

/**
 * Check if two play types can run in parallel
 */
export function canRunInParallel(
  playType1: PlayType,
  playType2: PlayType
): boolean {
  const template1 = getPlayTemplate(playType1);
  const template2 = getPlayTemplate(playType2);
  if (!template1 || !template2) return false;
  return (
    template1.parallelSafeWith.includes(playType2) ||
    template2.parallelSafeWith.includes(playType1)
  );
}

/**
 * Evaluate trigger conditions against audit results
 */
export function evaluateTriggerConditions(
  playType: PlayType,
  auditResults: any
): boolean {
  const template = getPlayTemplate(playType);
  if (!template) return false;

  // Simple evaluation - in production, use a proper expression evaluator
  for (const condition of template.triggerConditions) {
    // This is a simplified version - would need proper parsing
    // For now, return true if any condition matches
    if (condition.includes('=')) {
      const [key, value] = condition.split('=').map((s) => s.trim());
      const auditValue = auditResults[key];
      if (auditValue !== undefined) {
        // Simple comparison
        if (value === 'true' && auditValue === true) return true;
        if (value === 'false' && auditValue === false) return true;
        if (auditValue === value) return true;
      }
    }
  }
  return false;
}
