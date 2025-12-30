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
            content: `You are Midnight, an SEO homepage structure expert. Your role is to analyze homepage structure and either provide layout recommendations or route content editing tasks to Crimson.`,
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
    prompt += `Provide structure recommendations for improving the homepage layout, navigation, and information architecture.
    
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
  ]
}`;
  } else {
    prompt += `Analyze the homepage and determine what content should be edited. Route specific content optimization tasks to Crimson.
    
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
  ]
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
  };
}

