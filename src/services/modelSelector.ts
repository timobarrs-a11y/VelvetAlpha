import { SubscriptionTier } from './chatService';
import { isPremiumTier } from '../types/subscription';

export type ModelType = 'claude-haiku-4-5-20251001' | 'claude-sonnet-5';
export type ComplexityLevel = 'simple' | 'complex';

export const MODEL_CONFIG = {
  CHEAP_MODEL: 'claude-haiku-4-5-20251001' as const,
  PREMIUM_MODEL: 'claude-sonnet-5' as const,
};

export const MODEL_COSTS = {
  CHEAP_MODEL_COST_PER_1K_TOKENS: 0.00025,
  PREMIUM_MODEL_COST_PER_1K_TOKENS: 0.003,
};

export function analyzeMessageComplexity(message: string): ComplexityLevel {
  const wordCount = message.trim().split(/\s+/).length;
  const lowerMessage = message.toLowerCase();

  const emotionalKeywords = [
    'sad', 'depressed', 'anxious', 'scared', 'worried', 'upset',
    'hurt', 'angry', 'frustrated', 'stressed', 'lonely', 'hate',
    'love', 'feel', 'heart', 'soul', 'fear', 'dream', 'hope',
    'miss', 'need', 'relationship', 'break up', 'divorce', 'crying',
    'tears', 'pain', 'suffering', 'miserable'
  ];

  const adviceKeywords = [
    'should i', 'help me', 'advice', 'what do you think',
    'your opinion', 'thoughts on', 'recommend', 'suggest',
    'what would you', 'how do i', 'how should'
  ];

  const deepKeywords = [
    'why do', 'what\'s the meaning', 'believe', 'faith',
    'purpose', 'existence', 'life is', 'death', 'dying',
    'meaning of', 'think about', 'philosophy', 'deep down'
  ];

  const storyIndicators = [
    'so today i', 'this happened', 'let me tell you',
    'i need to tell', 'can i be honest', 'we need to talk',
    'i want to tell you', 'listen to this', 'you won\'t believe'
  ];

  const hasEmotionalContent = emotionalKeywords.some(kw => lowerMessage.includes(kw));
  const seekingAdvice = adviceKeywords.some(kw => lowerMessage.includes(kw));
  const isPhilosophical = deepKeywords.some(kw => lowerMessage.includes(kw));
  const isSharingStory = storyIndicators.some(kw => lowerMessage.includes(kw));
  const hasMultipleQuestions = (message.match(/\?/g) || []).length > 1;
  const isLongMessage = wordCount > 15;

  if (hasEmotionalContent || seekingAdvice || isPhilosophical ||
      isSharingStory || hasMultipleQuestions || isLongMessage) {
    return 'complex';
  }

  return 'simple';
}

export function selectModel(userMessage: string, userTier: SubscriptionTier): ModelType {
  if (isPremiumTier(userTier) || userTier === 'essential') {
    const complexity = analyzeMessageComplexity(userMessage);
    if (complexity === 'simple') {
      return MODEL_CONFIG.CHEAP_MODEL;
    }
    return MODEL_CONFIG.PREMIUM_MODEL;
  }
  return MODEL_CONFIG.CHEAP_MODEL;
}

export function getModelDisplayName(model: ModelType): string {
  return model === MODEL_CONFIG.PREMIUM_MODEL ? 'Claude Sonnet 5 (Premium)' : 'Claude Haiku 4.5 (Fast)';
}

export function getModelCostPer1K(model: ModelType): number {
  return model === MODEL_CONFIG.PREMIUM_MODEL
    ? MODEL_COSTS.PREMIUM_MODEL_COST_PER_1K_TOKENS
    : MODEL_COSTS.CHEAP_MODEL_COST_PER_1K_TOKENS;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function calculateCost(model: ModelType, tokens: number): number {
  const costPer1K = getModelCostPer1K(model);
  return (tokens / 1000) * costPer1K;
}
