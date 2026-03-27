/**
 * CTA Flow Validation
 * Enforces the authoritative CTA flow rules:
 * - Audit → Burnt only
 * - Burnt → Crimson/Midnight only
 * - Execution tools (Crimson/Midnight) → Return to Client Database (no forward CTAs)
 * - Smokey → Plans/Tasks/Checkpoints only
 */

export type ToolRole = 'audit' | 'burnt' | 'crimson' | 'midnight' | 'smokey' | 'admin';

export type CTATarget =
  | 'burnt'
  | 'crimson'
  | 'midnight'
  | 'plans'
  | 'tasks'
  | 'checkpoints'
  | 'client_database';

const CTA_FLOW_RULES: Record<ToolRole, CTATarget[]> = {
  audit: ['burnt'],
  burnt: ['crimson', 'midnight'],
  crimson: ['client_database'],
  midnight: ['client_database'],
  smokey: ['plans', 'tasks', 'checkpoints'],
  admin: [
    'burnt',
    'crimson',
    'midnight',
    'plans',
    'tasks',
    'checkpoints',
    'client_database',
  ],
};

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

export function getAllowedCTATargets(sourceTool: ToolRole): CTATarget[] {
  return CTA_FLOW_RULES[sourceTool] || [];
}

export function isExecutionTool(tool: string): boolean {
  return tool === 'crimson' || tool === 'midnight';
}

export function isPlanningTool(tool: string): boolean {
  return tool === 'smokey';
}

export function isFactGenerator(tool: string): boolean {
  return tool === 'audit';
}

export function isPrioritizationTool(tool: string): boolean {
  return tool === 'burnt';
}

export function getToolRoleFromContext(
  referer?: string | null,
  fromTool?: string | null,
  userEmail?: string | null
): ToolRole {
  if (userEmail === 'mgr@tri-two.com') {
    return 'admin';
  }

  if (fromTool) {
    const normalized = fromTool.toLowerCase();
    if (normalized === 'smokey') return 'smokey';
    if (normalized === 'burnt') return 'burnt';
    if (normalized === 'audit') return 'audit';
  }

  if (referer) {
    if (referer.includes('/admin/smokey')) return 'smokey';
    if (referer.includes('/admin/burnt')) return 'burnt';
    if (referer.includes('/admin/audit')) return 'audit';
  }

  return 'admin';
}
