/**
 * Client-side utility functions for chaining Tri-Two system components
 * These functions handle sequential API calls and context passing between components
 */

import type {
  CrimsonAPIRequest,
  CrimsonAPIResponse,
  MidnightAPIRequest,
  MidnightAPIResponse,
  BurntScoreAPIRequest,
  BurntScoreAPIResponse,
  BurntOrchestrateAPIRequest,
  BurntOrchestrateAPIResponse,
  Action,
} from './llms/types';

/**
 * Run Audit and then pass results to Crimson
 */
export async function runAuditToCrimson(
  url: string,
  goal: string,
  tonePreset?: string
): Promise<{ audit: any; crimson: CrimsonAPIResponse }> {
  // Step 1: Run Audit
  const auditResponse = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!auditResponse.ok) {
    const errorData = await auditResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Audit failed');
  }

  const auditData = await auditResponse.json();
  const auditResults = auditData.results;

  // Step 2: Run Crimson with audit context
  const crimsonRequest: CrimsonAPIRequest = {
    url,
    goal,
    tonePreset,
    optionalAuditContext: auditResults,
  };

  const crimsonResponse = await fetch('/api/llm/crimson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(crimsonRequest),
  });

  if (!crimsonResponse.ok) {
    const errorData = await crimsonResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Crimson failed');
  }

  const crimsonData: CrimsonAPIResponse = await crimsonResponse.json();

  return { audit: auditResults, crimson: crimsonData };
}

/**
 * Run Audit and then pass results to Midnight
 */
export async function runAuditToMidnight(
  url: string,
  mode: 'homepage_edit' | 'route_to_crimson'
): Promise<{ audit: any; midnight: MidnightAPIResponse }> {
  // Step 1: Run Audit
  const auditResponse = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!auditResponse.ok) {
    const errorData = await auditResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Audit failed');
  }

  const auditData = await auditResponse.json();
  const auditResults = auditData.results;

  // Step 2: Run Midnight with audit context
  const midnightRequest: MidnightAPIRequest = {
    url,
    mode,
    optionalAuditContext: auditResults,
  };

  const midnightResponse = await fetch('/api/llm/midnight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(midnightRequest),
  });

  if (!midnightResponse.ok) {
    const errorData = await midnightResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Midnight failed');
  }

  const midnightData: MidnightAPIResponse = await midnightResponse.json();

  return { audit: auditResults, midnight: midnightData };
}

/**
 * Run Audit and then pass results to Burnt orchestration
 */
export async function runAuditToBurnt(
  url: string
): Promise<{ audit: any; burnt: BurntOrchestrateAPIResponse }> {
  // Step 1: Run Audit
  const auditResponse = await fetch('/api/audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!auditResponse.ok) {
    const errorData = await auditResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Audit failed');
  }

  const auditData = await auditResponse.json();
  const auditResults = auditData.results;

  // Step 2: Run Burnt orchestration with audit context
  // Note: Burnt orchestrate can run its own audit, but we'll pass the context
  const burntRequest: BurntOrchestrateAPIRequest = {
    url,
    runAudit: false, // We already ran it
    runMidnight: true,
    runCrimson: true,
  };

  const burntResponse = await fetch('/api/llm/burnt/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(burntRequest),
  });

  if (!burntResponse.ok) {
    const errorData = await burntResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Burnt orchestration failed');
  }

  const burntData: BurntOrchestrateAPIResponse = await burntResponse.json();

  return { audit: auditResults, burnt: burntData };
}

/**
 * Run Crimson and then pass results to Midnight
 */
export async function runCrimsonToMidnight(
  url: string,
  goal: string,
  tonePreset?: string,
  crimsonContext?: CrimsonAPIResponse
): Promise<{ crimson: CrimsonAPIResponse; midnight: MidnightAPIResponse }> {
  // Step 1: Run Crimson (if not provided)
  let crimsonResults: CrimsonAPIResponse;
  if (crimsonContext) {
    crimsonResults = crimsonContext;
  } else {
    const crimsonRequest: CrimsonAPIRequest = {
      url,
      goal,
      tonePreset,
    };

    const crimsonResponse = await fetch('/api/llm/crimson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crimsonRequest),
    });

    if (!crimsonResponse.ok) {
      const errorData = await crimsonResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Crimson failed');
    }

    crimsonResults = await crimsonResponse.json();
  }

  // Step 2: Run Midnight with crimson context
  const midnightRequest: MidnightAPIRequest = {
    url,
    mode: 'homepage_edit',
    optionalAuditContext: { crimson: crimsonResults },
  };

  const midnightResponse = await fetch('/api/llm/midnight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(midnightRequest),
  });

  if (!midnightResponse.ok) {
    const errorData = await midnightResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Midnight failed');
  }

  const midnightData: MidnightAPIResponse = await midnightResponse.json();

  return { crimson: crimsonResults, midnight: midnightData };
}

/**
 * Run Crimson and then score actions with Burnt
 */
export async function runCrimsonToBurnt(
  url: string,
  goal: string,
  tonePreset?: string,
  crimsonContext?: CrimsonAPIResponse
): Promise<{ crimson: CrimsonAPIResponse; burnt: BurntScoreAPIResponse }> {
  // Step 1: Run Crimson (if not provided)
  let crimsonResults: CrimsonAPIResponse;
  if (crimsonContext) {
    crimsonResults = crimsonContext;
  } else {
    const crimsonRequest: CrimsonAPIRequest = {
      url,
      goal,
      tonePreset,
    };

    const crimsonResponse = await fetch('/api/llm/crimson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(crimsonRequest),
    });

    if (!crimsonResponse.ok) {
      const errorData = await crimsonResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Crimson failed');
    }

    crimsonResults = await crimsonResponse.json();
  }

  // Step 2: Score Crimson actions with Burnt
  if (!crimsonResults.crimsonActions || crimsonResults.crimsonActions.length === 0) {
    throw new Error('No actions from Crimson to score');
  }

  const burntRequest: BurntScoreAPIRequest = {
    actions: crimsonResults.crimsonActions,
    optionalContext: { crimson: crimsonResults },
  };

  const burntResponse = await fetch('/api/llm/burnt/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(burntRequest),
  });

  if (!burntResponse.ok) {
    const errorData = await burntResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Burnt scoring failed');
  }

  const burntData: BurntScoreAPIResponse = await burntResponse.json();

  return { crimson: crimsonResults, burnt: burntData };
}

/**
 * Run Midnight and then pass results to Crimson
 */
export async function runMidnightToCrimson(
  url: string,
  mode: 'homepage_edit' | 'route_to_crimson',
  goal: string,
  tonePreset?: string,
  midnightContext?: MidnightAPIResponse
): Promise<{ midnight: MidnightAPIResponse; crimson: CrimsonAPIResponse }> {
  // Step 1: Run Midnight (if not provided)
  let midnightResults: MidnightAPIResponse;
  if (midnightContext) {
    midnightResults = midnightContext;
  } else {
    const midnightRequest: MidnightAPIRequest = {
      url,
      mode,
    };

    const midnightResponse = await fetch('/api/llm/midnight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(midnightRequest),
    });

    if (!midnightResponse.ok) {
      const errorData = await midnightResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Midnight failed');
    }

    midnightResults = await midnightResponse.json();
  }

  // Step 2: Run Crimson with midnight context
  const crimsonRequest: CrimsonAPIRequest = {
    url,
    goal,
    tonePreset,
    optionalAuditContext: { midnight: midnightResults },
  };

  const crimsonResponse = await fetch('/api/llm/crimson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(crimsonRequest),
  });

  if (!crimsonResponse.ok) {
    const errorData = await crimsonResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Crimson failed');
  }

  const crimsonData: CrimsonAPIResponse = await crimsonResponse.json();

  return { midnight: midnightResults, crimson: crimsonData };
}

/**
 * Run Midnight and then score actions with Burnt
 */
export async function runMidnightToBurnt(
  url: string,
  mode: 'homepage_edit' | 'route_to_crimson',
  midnightContext?: MidnightAPIResponse
): Promise<{ midnight: MidnightAPIResponse; burnt: BurntScoreAPIResponse }> {
  // Step 1: Run Midnight (if not provided)
  let midnightResults: MidnightAPIResponse;
  if (midnightContext) {
    midnightResults = midnightContext;
  } else {
    const midnightRequest: MidnightAPIRequest = {
      url,
      mode,
    };

    const midnightResponse = await fetch('/api/llm/midnight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(midnightRequest),
    });

    if (!midnightResponse.ok) {
      const errorData = await midnightResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Midnight failed');
    }

    midnightResults = await midnightResponse.json();
  }

  // Step 2: Score Midnight actions with Burnt
  if (!midnightResults.midnightActions || midnightResults.midnightActions.length === 0) {
    throw new Error('No actions from Midnight to score');
  }

  const burntRequest: BurntScoreAPIRequest = {
    actions: midnightResults.midnightActions,
    optionalContext: { midnight: midnightResults },
  };

  const burntResponse = await fetch('/api/llm/burnt/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(burntRequest),
  });

  if (!burntResponse.ok) {
    const errorData = await burntResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Burnt scoring failed');
  }

  const burntData: BurntScoreAPIResponse = await burntResponse.json();

  return { midnight: midnightResults, burnt: burntData };
}

/**
 * Run Burnt orchestration (Audit → Crimson → Midnight → Burnt)
 */
export async function runBurntOrchestrate(
  url: string
): Promise<BurntOrchestrateAPIResponse> {
  const burntRequest: BurntOrchestrateAPIRequest = {
    url,
    runAudit: true,
    runMidnight: true,
    runCrimson: true,
  };

  const burntResponse = await fetch('/api/llm/burnt/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(burntRequest),
  });

  if (!burntResponse.ok) {
    const errorData = await burntResponse.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || 'Burnt orchestration failed');
  }

  const burntData: BurntOrchestrateAPIResponse = await burntResponse.json();

  return burntData;
}

