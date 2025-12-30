/**
 * Shared TypeScript types for all LLM systems (Crimson, Midnight, Burnt)
 */

// Action types
export interface Action {
  id?: string;
  title: string;
  description: string;
  category?: string;
  priority?: number;
  effort?: string;
  impact?: string;
  [key: string]: any; // Allow additional properties
}

export interface PrioritizedAction extends Action {
  burntScore: BurntScore;
  priorityBand: PriorityBand;
}

export interface BurntScore {
  impact: number; // 0-25
  confidence: number; // 0-25
  effort_inverse: number; // 0-25 (inverse of effort, higher = easier)
  urgency: number; // 0-25
  total: number; // 0-100 (sum of all dimensions)
}

export type PriorityBand = 'Do now' | 'High priority' | 'Opportunistic' | 'Backlog';

// Crimson types
export interface CrimsonInput {
  url: string;
  goal: string;
  tonePreset?: string;
  optionalAuditContext?: any; // Audit results if available
}

export interface CrimsonOutput {
  contentEdits: ContentEdit[];
  ctaSuggestions: CTASuggestion[];
  crimsonActions: Action[];
}

export interface ContentEdit {
  section: string;
  original: string;
  edited: string;
  rationale: string;
}

export interface CTASuggestion {
  location: string;
  text: string;
  style: string;
  rationale: string;
}

// Midnight types
export type MidnightMode = 'homepage_edit' | 'route_to_crimson';

export interface MidnightInput {
  url: string;
  mode: MidnightMode;
  optionalAuditContext?: any; // Audit results if available
}

export interface MidnightOutput {
  structureRecommendations: StructureRecommendation[];
  midnightActions: Action[];
  optionalCrimsonArtifacts?: CrimsonOutput; // Only present if mode is route_to_crimson
}

export interface StructureRecommendation {
  section: string;
  currentStructure: string;
  recommendedStructure: string;
  rationale: string;
  priority: number;
}

// Burnt types
export interface BurntInput {
  actions: Action[];
  optionalContext?: any; // Additional context for scoring
}

export interface BurntOutput {
  prioritizedActions: PrioritizedAction[];
  burntScores: BurntScore[];
}

// API request/response types
export interface CrimsonAPIRequest {
  url: string;
  goal: string;
  tonePreset?: string;
  optionalAuditContext?: any;
}

export interface CrimsonAPIResponse {
  contentEdits: ContentEdit[];
  ctaSuggestions: CTASuggestion[];
  crimsonActions: Action[];
}

export interface MidnightAPIRequest {
  url: string;
  mode: MidnightMode;
  optionalAuditContext?: any;
}

export interface MidnightAPIResponse {
  structureRecommendations: StructureRecommendation[];
  midnightActions: Action[];
  optionalCrimsonArtifacts?: CrimsonOutput;
}

export interface BurntScoreAPIRequest {
  actions: Action[];
  optionalContext?: any;
}

export interface BurntScoreAPIResponse {
  prioritizedActions: PrioritizedAction[];
  burntScores: BurntScore[];
}

export interface BurntOrchestrateAPIRequest {
  url: string;
  runAudit?: boolean;
  runMidnight?: boolean;
  runCrimson?: boolean;
}

export interface BurntOrchestrateAPIResponse {
  audit?: any; // AuditResults from /api/audit
  midnight?: MidnightAPIResponse;
  crimson?: CrimsonAPIResponse;
  burnt: {
    prioritizedActions: PrioritizedAction[];
    burntScores: BurntScore[];
  };
}

