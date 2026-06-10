/**
 * Centralized AI Model Configuration
 *
 * This file contains the current recommended Anthropic models for all edge functions.
 * Update these values when new models are released to automatically update all functions.
 *
 * Last updated: 2026-02-10
 */

export const MODEL_CONFIG = {
  /**
   * Primary model for complex tasks requiring advanced reasoning
   * Use for: Main chat, article discussions, complex analysis
   */
  SONNET: "claude-sonnet-4-5-20250929",

  /**
   * Fast, efficient model for simpler tasks
   * Use for: Summaries, quick responses, embeddings, simple generations
   */
  HAIKU: "claude-haiku-4-5-20251001",

  /**
   * Model version information for debugging
   */
  VERSION_INFO: {
    sonnet: "4.5 (2025-09-29)",
    haiku: "4.5 (2025-10-01)",
    lastChecked: "2026-02-10"
  }
} as const;

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
