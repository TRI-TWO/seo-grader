/**
 * Midnight LLM Execution Wrapper
 * Homepage structure and decision routing
 */

import { getOpenAIClient, MIDNIGHT_CONFIG } from './registry';
import { runCrimson } from './runCrimson';
import type { MidnightInput, MidnightOutput, StructureRecommendation, Action, CrimsonOutput } from './types';

const HARD_TIMEOUT = 30000; // 30 seconds

export async function runMidnight(input: MidnightInput): Promise<MidnightOutput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HARD_TIMEOUT);

  try {
    const openai = getOpenAIClient();
    
    // Build prompt for Midnight
    const prompt = buildMidnightPrompt(input);
    
    const response = await openai.chat.completions.create(
      {
        model: MIDNIGHT_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `You are Midnight, a local-service homepage structure expert. Prioritize a hub-first strategy (fewer stronger service hubs), avoid thin service-city page spray, and produce local clustering outputs when possible.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: MIDNIGHT_CONFIG.temperature,
        max_tokens: MIDNIGHT_CONFIG.maxTokens,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response
    const parsed = parseMidnightResponse(content, input);
    
    // If mode is route_to_crimson, also run Crimson
    let crimsonArtifacts: CrimsonOutput | undefined;
    if (input.mode === 'route_to_crimson') {
      try {
        crimsonArtifacts = await runCrimson({
          url: input.url,
          goal: 'Optimize content based on Midnight structure recommendations',
          optionalAuditContext: input.optionalAuditContext,
        });
      } catch (error) {
        console.error('Failed to run Crimson after Midnight:', error);
        // Continue without Crimson artifacts
      }
    }
    
    return {
      ...parsed,
      optionalCrimsonArtifacts: crimsonArtifacts,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Midnight execution timed out');
    }
    throw new Error(`Midnight execution failed: ${error.message}`);
  }
}

function buildMidnightPrompt(input: MidnightInput): string {
  let prompt = `Analyze the homepage structure for this URL: ${input.url}\n\n`;
  prompt += `Mode: ${input.mode}\n\n`;
  
  if (input.optionalAuditContext) {
    prompt += `Audit Context:\n${JSON.stringify(input.optionalAuditContext, null, 2)}\n\n`;
  }
  
  if (input.mode === 'homepage_edit') {
    prompt += `Provide structure recommendations for improving homepage layout and local-service hub clarity.
Prioritize one strong hub per major service, with city/service-area sections inside hubs by default.
    
Return your response as JSON with this structure:
{
  "structureRecommendations": [
    {
      "section": "string",
      "currentStructure": "string",
      "recommendedStructure": "string",
      "rationale": "string",
      "priority": number
    }
  ],
  "midnightActions": [
    {
      "title": "string",
      "description": "string",
      "category": "string"
    }
  ],
  "service_keyword_buckets": ["string"],
  "emergency_intent_terms": ["string"],
  "city_modifier_sets": ["string"],
  "hub_structure_plan": ["string"],
  "internal_linking_plan_local": ["string"]
}`;
  } else {
    prompt += `Analyze the homepage and determine what content should be edited. Route specific optimization tasks to Crimson.
Return local-service clustering guidance using hub-first planning.
    
Return your response as JSON with this structure:
{
  "structureRecommendations": [
    {
      "section": "string",
      "currentStructure": "string",
      "recommendedStructure": "string",
      "rationale": "string",
      "priority": number
    }
  ],
  "midnightActions": [
    {
      "title": "string",
      "description": "string",
      "category": "string"
    }
  ],
  "service_keyword_buckets": ["string"],
  "emergency_intent_terms": ["string"],
  "city_modifier_sets": ["string"],
  "hub_structure_plan": ["string"],
  "internal_linking_plan_local": ["string"]
}`;
  }

  return prompt;
}

function parseMidnightResponse(content: string, input: MidnightInput): Omit<MidnightOutput, 'optionalCrimsonArtifacts'> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        structureRecommendations: parsed.structureRecommendations || [],
        midnightActions: parsed.midnightActions || [],
        service_keyword_buckets: parsed.service_keyword_buckets || [],
        emergency_intent_terms: parsed.emergency_intent_terms || [],
        city_modifier_sets: parsed.city_modifier_sets || [],
        hub_structure_plan: parsed.hub_structure_plan || [],
        internal_linking_plan_local: parsed.internal_linking_plan_local || [],
      };
    }
  } catch (error) {
    console.error('Failed to parse Midnight response as JSON:', error);
  }

  // Fallback: create a basic response from text
  return {
    structureRecommendations: [
      {
        section: 'Homepage Structure',
        currentStructure: 'Current structure',
        recommendedStructure: content.substring(0, 300),
        rationale: 'AI-generated recommendation',
        priority: 1,
      },
    ],
    midnightActions: [
      {
        title: 'Review structure recommendations',
        description: content.substring(0, 200),
        category: 'structure',
      },
    ],
    service_keyword_buckets: [],
    emergency_intent_terms: [],
    city_modifier_sets: [],
    hub_structure_plan: [],
    internal_linking_plan_local: [],
  };
}


