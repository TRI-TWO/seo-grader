import { PlanTier } from '@prisma/client';

export type ToolConfig = {
  tool: 'audit' | 'midnight' | 'crimson' | 'burnt';
  required: boolean;
  blocking?: boolean; // If true, next tool waits for this to complete
};

export type TimelinePhase = {
  phaseName: string;
  dayOffset: number;
  toolSequence: ToolConfig[];
  description?: string;
};

export const TIMELINE_TEMPLATES: Record<PlanTier, TimelinePhase[]> = {
  STARTER: [
    {
      phaseName: 'Initial Audit',
      dayOffset: 0,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Baseline SEO audit and structure analysis',
    },
    {
      phaseName: 'Month 1 - Priority Actions',
      dayOffset: 30,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Prioritize and execute top action items',
    },
    {
      phaseName: 'Month 2 - Content Optimization',
      dayOffset: 60,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
      ],
      description: 'Optimize page content and messaging',
    },
    {
      phaseName: 'Month 3 - Review & Adjust',
      dayOffset: 90,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Quarterly review and progress assessment',
    },
    {
      phaseName: 'Month 4 - Priority Actions',
      dayOffset: 120,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Continue priority action execution',
    },
    {
      phaseName: 'Month 5 - Content Optimization',
      dayOffset: 150,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
      ],
      description: 'Additional content improvements',
    },
    {
      phaseName: 'Month 6 - Mid-Year Review',
      dayOffset: 180,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Comprehensive mid-year assessment',
    },
    {
      phaseName: 'Month 7 - Priority Actions',
      dayOffset: 210,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Execute next priority batch',
    },
    {
      phaseName: 'Month 8 - Content Optimization',
      dayOffset: 240,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
      ],
      description: 'Content refinement',
    },
    {
      phaseName: 'Month 9 - Review & Adjust',
      dayOffset: 270,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Q3 review and adjustments',
    },
    {
      phaseName: 'Month 10 - Priority Actions',
      dayOffset: 300,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Final priority execution phase',
    },
    {
      phaseName: 'Month 11 - Content Optimization',
      dayOffset: 330,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
      ],
      description: 'Year-end content improvements',
    },
    {
      phaseName: 'Month 12 - Annual Review',
      dayOffset: 360,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Comprehensive annual review and renewal assessment',
    },
  ],
  GROWTH: [
    {
      phaseName: 'Initial Audit',
      dayOffset: 0,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Comprehensive baseline audit and structure analysis',
    },
    {
      phaseName: 'Month 1 - Priority Actions',
      dayOffset: 30,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: false, blocking: false },
      ],
      description: 'Prioritize and execute top actions with content optimization',
    },
    {
      phaseName: 'Month 2 - Content & Structure',
      dayOffset: 60,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Content optimization and structure improvements',
    },
    {
      phaseName: 'Month 3 - Review & Adjust',
      dayOffset: 90,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Quarterly review with structure analysis',
    },
    {
      phaseName: 'Month 4 - Priority Actions',
      dayOffset: 120,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: false, blocking: false },
      ],
      description: 'Continue priority execution',
    },
    {
      phaseName: 'Month 5 - Content & Structure',
      dayOffset: 150,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Content and structure optimization',
    },
    {
      phaseName: 'Month 6 - Mid-Year Review',
      dayOffset: 180,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Comprehensive mid-year assessment',
    },
    {
      phaseName: 'Month 7 - Priority Actions',
      dayOffset: 210,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: false, blocking: false },
      ],
      description: 'Execute next priority batch',
    },
    {
      phaseName: 'Month 8 - Content & Structure',
      dayOffset: 240,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Content and structure refinement',
    },
    {
      phaseName: 'Month 9 - Review & Adjust',
      dayOffset: 270,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Q3 review and adjustments',
    },
    {
      phaseName: 'Month 10 - Priority Actions',
      dayOffset: 300,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: false, blocking: false },
      ],
      description: 'Final priority execution phase',
    },
    {
      phaseName: 'Month 11 - Content & Structure',
      dayOffset: 330,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Year-end content and structure improvements',
    },
    {
      phaseName: 'Month 12 - Annual Review',
      dayOffset: 360,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Comprehensive annual review and renewal assessment',
    },
  ],
  ENTERPRISE: [
    {
      phaseName: 'Initial Audit',
      dayOffset: 0,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Comprehensive baseline with full analysis',
    },
    {
      phaseName: 'Month 1 - Full Optimization',
      dayOffset: 30,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Priority actions, content, and structure optimization',
    },
    {
      phaseName: 'Month 2 - Content & Structure',
      dayOffset: 60,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Advanced content and structure improvements',
    },
    {
      phaseName: 'Month 3 - Review & Adjust',
      dayOffset: 90,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Quarterly review with full analysis',
    },
    {
      phaseName: 'Month 4 - Full Optimization',
      dayOffset: 120,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Continue comprehensive optimization',
    },
    {
      phaseName: 'Month 5 - Content & Structure',
      dayOffset: 150,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Content and structure optimization',
    },
    {
      phaseName: 'Month 6 - Mid-Year Review',
      dayOffset: 180,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Comprehensive mid-year assessment',
    },
    {
      phaseName: 'Month 7 - Full Optimization',
      dayOffset: 210,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Execute next optimization batch',
    },
    {
      phaseName: 'Month 8 - Content & Structure',
      dayOffset: 240,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Content and structure refinement',
    },
    {
      phaseName: 'Month 9 - Review & Adjust',
      dayOffset: 270,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Q3 review with full analysis',
    },
    {
      phaseName: 'Month 10 - Full Optimization',
      dayOffset: 300,
      toolSequence: [
        { tool: 'burnt', required: true, blocking: true },
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: false, blocking: false },
      ],
      description: 'Final optimization phase',
    },
    {
      phaseName: 'Month 11 - Content & Structure',
      dayOffset: 330,
      toolSequence: [
        { tool: 'crimson', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
      ],
      description: 'Year-end content and structure improvements',
    },
    {
      phaseName: 'Month 12 - Annual Review',
      dayOffset: 360,
      toolSequence: [
        { tool: 'audit', required: true, blocking: true },
        { tool: 'midnight', required: true, blocking: true },
        { tool: 'burnt', required: true, blocking: true },
      ],
      description: 'Comprehensive annual review and renewal assessment',
    },
  ],
};

export function getTimelineTemplate(planTier: PlanTier): TimelinePhase[] {
  return TIMELINE_TEMPLATES[planTier] || TIMELINE_TEMPLATES.STARTER;
}

