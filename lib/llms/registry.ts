/**
 * LLM Registry - Centralized configuration and OpenAI client initialization
 */

import OpenAI from 'openai';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY environment variable is not set. ' +
      'Please set this variable in your deployment environment (e.g., Vercel). ' +
      'Get your API key from https://platform.openai.com/api-keys'
    );
  }

  openaiClient = new OpenAI({
    apiKey: apiKey,
  });

  return openaiClient;
}

// LLM Model Configuration
export const LLM_MODELS = {
  // Default model for most operations
  DEFAULT: 'gpt-4-turbo-preview',
  // Faster, cheaper model for simple tasks
  FAST: 'gpt-3.5-turbo',
  // Latest model for complex reasoning
  LATEST: 'gpt-4-turbo-preview',
} as const;

export type LLMModel = typeof LLM_MODELS[keyof typeof LLM_MODELS];

// Temperature settings for different use cases
export const TEMPERATURE = {
  CREATIVE: 0.9, // For content generation
  BALANCED: 0.7, // For general tasks
  PRECISE: 0.3, // For scoring and analysis
} as const;

// Timeout settings (in milliseconds)
export const TIMEOUTS = {
  DEFAULT: 30000, // 30 seconds
  LONG: 60000, // 60 seconds
  SHORT: 15000, // 15 seconds
} as const;

// LLM Configuration per system
export interface LLMConfig {
  model: LLMModel;
  temperature: number;
  maxTokens?: number;
  timeout: number;
}

export const CRIMSON_CONFIG: LLMConfig = {
  model: LLM_MODELS.DEFAULT,
  temperature: TEMPERATURE.CREATIVE,
  maxTokens: 4000,
  timeout: TIMEOUTS.DEFAULT,
};

export const MIDNIGHT_CONFIG: LLMConfig = {
  model: LLM_MODELS.DEFAULT,
  temperature: TEMPERATURE.BALANCED,
  maxTokens: 3000,
  timeout: TIMEOUTS.DEFAULT,
};

export const BURNT_CONFIG: LLMConfig = {
  model: LLM_MODELS.DEFAULT,
  temperature: TEMPERATURE.PRECISE,
  maxTokens: 2000,
  timeout: TIMEOUTS.SHORT,
};

