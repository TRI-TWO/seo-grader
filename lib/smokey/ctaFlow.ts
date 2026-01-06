/**
 * CTA Flow Validation
 * Enforces the authoritative CTA flow rules:
 * - Audit → Burnt only
 * - Burnt → Crimson/Midnight only
 * - Execution tools (Crimson/Midnight) → Return to Client Database (no forward CTAs)
 * - Smokey → Plans/Tasks/Checkpoints only
 */

export type ToolRole = 'audit' | 'burnt' | 'crimson' | 'midnight' | 'smokey' | 'admin';

export type CTATarget = 'burnt' | 'crimson' | 'midnight' | 'plans' | 'tasks' | 'checkpoints' | 'client_database';

/**
 * CTA flow rules matrix
 * Maps source tool to allowed target tools
 */
const CTA_FLOW_RULES: Record<ToolRole, CTATarget[]> = {
  audit: ['burnt'], // Audit can only route to Burnt
  burnt: ['crimson', 'midnight'], // Burnt can route to execution tools
  crimson: ['client_database'], // Execution tools return to client database only
  midnight: ['client_database'], // Execution tools return to client database only
  smokey: ['plans', 'tasks', 'checkpoints'], // Smokey routes to plans/tasks/checkpoints
  admin: ['burnt', 'crimson', 'midnight', 'plans', 'tasks', 'checkpoints', 'client_database'], // Admin can override
};

/**
 * Validate if a CTA flow is allowed
 */
export function validateCTAFlow(
  sourceTool: ToolRole,
  targetTool: CTATarget
): { valid: boolean; reason?: string } {
  const allowedTargets = CTA_FLOW_RULES[sourceTool];
  
  if (!allowedTargets) {
    return {
      valid: false,
      reason: `Unknown source tool: ${sourceTool}`,
    };
  }

  if (!allowedTargets.includes(targetTool)) {
    return {
      valid: false,
      reason: `${sourceTool} cannot route to ${targetTool}. Allowed targets: ${allowedTargets.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Get allowed CTA targets for a source tool
 */
export function getAllowedCTATargets(sourceTool: ToolRole): CTATarget[] {
  return CTA_FLOW_RULES[sourceTool] || [];
}

/**
 * Check if a tool is an execution tool (Crimson/Midnight)
 */
export function isExecutionTool(tool: string): boolean {
  return tool === 'crimson' || tool === 'midnight';
}

/**
 * Check if a tool is a planning tool (Smokey)
 */
export function isPlanningTool(tool: string): boolean {
  return tool === 'smokey';
}

/**
 * Check if a tool is a fact generator (Audit)
 */
export function isFactGenerator(tool: string): boolean {
  return tool === 'audit';
}

/**
 * Check if a tool is a prioritization tool (Burnt)
 */
export function isPrioritizationTool(tool: string): boolean {
  return tool === 'burnt';
}

/**
 * Determine tool role from request context
 */
export function getToolRoleFromContext(
  referer?: string | null,
  fromTool?: string | null,
  userEmail?: string | null
): ToolRole {
  // Admin override
  if (userEmail === 'mgr@tri-two.com') {
    return 'admin';
  }

  // Check fromTool parameter
  if (fromTool) {
    const normalized = fromTool.toLowerCase();
    if (normalized === 'smokey') return 'smokey';
    if (normalized === 'burnt') return 'burnt';
    if (normalized === 'audit') return 'audit';
  }

  // Check referer
  if (referer) {
    if (referer.includes('/admin/smokey')) return 'smokey';
    if (referer.includes('/admin/burnt')) return 'burnt';
    if (referer.includes('/admin/audit')) return 'audit';
  }

  // Default to admin for API routes (backward compatibility)
  return 'admin';
}

