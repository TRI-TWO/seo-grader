/**
 * Burnt LLM Execution Wrapper
 * Action scoring and prioritization engine
 */

import { getOpenAIClient, BURNT_CONFIG } from './registry';
import type { BurntInput, BurntOutput, Action, PrioritizedAction, BurntScore, PriorityBand } from './types';

const HARD_TIMEOUT = 25000; // 25 seconds (matching audit timeout)

export async function runBurnt(input: BurntInput): Promise<BurntOutput> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HARD_TIMEOUT);

  try {
    const openai = getOpenAIClient();
    
    // Build prompt for Burnt
    const prompt = buildBurntPrompt(input);
    
    const response = await openai.chat.completions.create(
      {
        model: BURNT_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: `You are Burnt, an SEO action prioritization expert. Your role is to score and prioritize SEO actions based on impact, confidence, effort (inverse), and urgency. 
            Each dimension is scored 0-25, for a total score of 0-100. Be precise and analytical in your scoring.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: BURNT_CONFIG.temperature,
        max_tokens: BURNT_CONFIG.maxTokens,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response and score actions
    const parsed = parseBurntResponse(content, input);
    
    return parsed;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Burnt execution timed out');
    }
    throw new Error(`Burnt execution failed: ${error.message}`);
  }
}

function buildBurntPrompt(input: BurntInput): string {
  let prompt = `Score and prioritize the following SEO actions:\n\n`;
  
  prompt += `Actions:\n${JSON.stringify(input.actions, null, 2)}\n\n`;
  
  if (input.optionalContext) {
    prompt += `Additional Context:\n${JSON.stringify(input.optionalContext, null, 2)}\n\n`;
  }
  
  prompt += `For each action, score it on 4 dimensions (each 0-25):
1. Impact: How much will this improve SEO performance? (0-25)
2. Confidence: How confident are we this will work? (0-25)
3. Effort Inverse: How easy is this to implement? (0-25, higher = easier)
4. Urgency: How time-sensitive is this? (0-25)

Total score = sum of all 4 dimensions (0-100)

Priority bands:
- 80-100: "Do now"
- 60-79: "High priority"
- 40-59: "Opportunistic"
- 0-39: "Backlog"

Return your response as JSON with this structure:
{
  "prioritizedActions": [
    {
      "id": "string",
      "title": "string",
      "description": "string",
      "category": "string",
      "burntScore": {
        "impact": number,
        "confidence": number,
        "effort_inverse": number,
        "urgency": number,
        "total": number
      },
      "priorityBand": "Do now" | "High priority" | "Opportunistic" | "Backlog"
    }
  ]
}

Sort actions by total score (highest first).`;

  return prompt;
}

function parseBurntResponse(content: string, input: BurntInput): BurntOutput {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const prioritizedActions: PrioritizedAction[] = (parsed.prioritizedActions || []).map((action: any) => {
        const score = action.burntScore || {};
        const total = (score.impact || 0) + (score.confidence || 0) + (score.effort_inverse || 0) + (score.urgency || 0);
        
        return {
          ...action,
          burntScore: {
            impact: score.impact || 0,
            confidence: score.confidence || 0,
            effort_inverse: score.effort_inverse || 0,
            urgency: score.urgency || 0,
            total: total,
          },
          priorityBand: getPriorityBand(total),
        };
      });
      
      const burntScores = prioritizedActions.map(a => a.burntScore);
      
      return {
        prioritizedActions,
        burntScores,
      };
    }
  } catch (error) {
    console.error('Failed to parse Burnt response as JSON:', error);
  }

  // Fallback: create basic scores for all actions
  const prioritizedActions: PrioritizedAction[] = input.actions.map((action, index) => {
    // Simple scoring based on index (first actions get higher scores)
    const baseScore = Math.max(0, 20 - index * 2);
    const score: BurntScore = {
      impact: baseScore,
      confidence: baseScore,
      effort_inverse: baseScore,
      urgency: baseScore,
      total: baseScore * 4,
    };
    
    return {
      ...action,
      burntScore: score,
      priorityBand: getPriorityBand(score.total),
    };
  });

  return {
    prioritizedActions: prioritizedActions.sort((a, b) => b.burntScore.total - a.burntScore.total),
    burntScores: prioritizedActions.map(a => a.burntScore),
  };
}

function getPriorityBand(total: number): PriorityBand {
  if (total >= 80) return 'Do now';
  if (total >= 60) return 'High priority';
  if (total >= 40) return 'Opportunistic';
  return 'Backlog';
}

