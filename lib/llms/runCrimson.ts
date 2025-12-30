/**
 * Crimson LLM Execution Wrapper
 * Standalone content + conversion engine
 */

import { getOpenAIClient, CRIMSON_CONFIG } from './registry';
import type { CrimsonInput, CrimsonOutput, ContentEdit, CTASuggestion, Action } from './types';

const HARD_TIMEOUT = 30000; // 30 seconds

export async function runCrimson(input: CrimsonInput): Promise<CrimsonOutput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HARD_TIMEOUT);

  try {
    const openai = getOpenAIClient();
    
    // Build prompt for Crimson
    const prompt = buildCrimsonPrompt(input);
    
    const response = await openai.chat.completions.create(
      {
        model: CRIMSON_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `You are Crimson, an SEO content optimization expert. Your goal is to edit and optimize page content for clarity, trust, and conversion. 
            Focus on improving readability, trust signals, and call-to-action effectiveness.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: CRIMSON_CONFIG.temperature,
        max_tokens: CRIMSON_CONFIG.maxTokens,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response (assuming JSON format)
    const parsed = parseCrimsonResponse(content, input);
    
    return parsed;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Crimson execution timed out');
    }
    throw new Error(`Crimson execution failed: ${error.message}`);
  }
}

function buildCrimsonPrompt(input: CrimsonInput): string {
  let prompt = `Optimize the content for this URL: ${input.url}\n\n`;
  prompt += `Goal: ${input.goal}\n\n`;
  
  if (input.tonePreset) {
    prompt += `Tone Preset: ${input.tonePreset}\n\n`;
  }
  
  if (input.optionalAuditContext) {
    prompt += `Audit Context:\n${JSON.stringify(input.optionalAuditContext, null, 2)}\n\n`;
  }
  
  prompt += `Please provide:
1. Content edits with before/after comparisons
2. CTA suggestions with locations and rationale
3. Action items for implementation

Return your response as JSON with this structure:
{
  "contentEdits": [
    {
      "section": "string",
      "original": "string",
      "edited": "string",
      "rationale": "string"
    }
  ],
  "ctaSuggestions": [
    {
      "location": "string",
      "text": "string",
      "style": "string",
      "rationale": "string"
    }
  ],
  "crimsonActions": [
    {
      "title": "string",
      "description": "string",
      "category": "string"
    }
  ]
}`;

  return prompt;
}

function parseCrimsonResponse(content: string, input: CrimsonInput): CrimsonOutput {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        contentEdits: parsed.contentEdits || [],
        ctaSuggestions: parsed.ctaSuggestions || [],
        crimsonActions: parsed.crimsonActions || [],
      };
    }
  } catch (error) {
    console.error('Failed to parse Crimson response as JSON:', error);
  }

  // Fallback: create a basic response from text
  return {
    contentEdits: [
      {
        section: 'Content',
        original: 'Original content',
        edited: content.substring(0, 500),
        rationale: 'AI-generated optimization',
      },
    ],
    ctaSuggestions: [],
    crimsonActions: [
      {
        title: 'Review AI suggestions',
        description: content.substring(0, 200),
        category: 'content',
      },
    ],
  };
}

