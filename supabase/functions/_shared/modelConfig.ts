/**
 * Centralized AI Model Configuration
 *
 * This file contains the current recommended Anthropic models for all edge functions.
 * Update these values when new models are released to automatically update all functions.
 *
 * Last updated: 2026-10-08
 */

export const MODEL_CONFIG = {
  /**
   * Primary model for complex tasks requiring advanced reasoning
   * Use for: Main chat, article discussions, complex analysis
   */
  SONNET: "claude-sonnet-5-5",

  /**
   * Fast, efficient model for simpler tasks
   * Use for: Summaries, quick responses, embeddings, simple generations
   */
  HAIKU: "claude-haiku-4-5",

  /**
   * Model version information for debugging
   */
  VERSION_INFO: {
    sonnet: "5.5 (2026-09-28)",
    haiku: "4.5 (2025-10-01)",
    lastChecked: "2026-10-08"
  }
} as const;

/**
 * The one place model ids live. Nothing else in the app (edge functions or the web app) may write a `claude-...`
 * id: the test src/services/__tests__/modelIds.test.ts fails if one appears. Moving to a newer model is a
 * one-line change here. Callers ask for a tier, not a model:
 *   small    background characters, summaries, classifiers, short replies (Haiku)
 *   standard the companion, main characters and anything that needs more care (Sonnet)
 */
export type ModelTier = 'small' | 'standard';

export function modelForTier(tier: ModelTier): string {
  return tier === 'standard' ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;
}

/**
 * Helper function to get the appropriate model based on task complexity
 * @param complexity - 'high' for complex reasoning tasks, 'low' for simple tasks
 * @returns The appropriate model identifier
 */
export function getModelForTask(complexity: 'high' | 'low'): string {
  return complexity === 'high' ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;
}

/**
 * Get model info for logging/debugging
 */
export function getModelInfo() {
  return MODEL_CONFIG.VERSION_INFO;
}
