export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'topic_switch' | 'generic_response' | 'factual_error' | 'repetition' | 'length_mismatch' | 'personality_break';
  severity: 'critical' | 'warning' | 'minor';
  description: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function validateResponse(
  userMessage: string,
  assistantResponse: string,
  conversationHistory: Message[],
  characterName: string
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  let score = 100;

  const responseLower = assistantResponse.toLowerCase();
  const userLower = userMessage.toLowerCase();

  const genericPhrases = [
    'that\'s cool',
    'that\'s nice',
    'sounds good',
    'interesting',
    'cool!',
    'nice!',
    'awesome!',
  ];

  const isGeneric = genericPhrases.some(phrase => responseLower.includes(phrase)) &&
                    assistantResponse.split(/\s+/).length < 15;

  if (isGeneric) {
    issues.push({
      type: 'generic_response',
      severity: 'warning',
      description: 'Response is too generic and doesn\'t engage deeply with user\'s message',
    });
    score -= 15;
  }

  const userWordCount = userMessage.split(/\s+/).length;
  const responseWordCount = assistantResponse.split(/\s+/).length;

  if (userWordCount < 5 && responseWordCount > 50) {
    issues.push({
      type: 'length_mismatch',
      severity: 'warning',
      description: 'Response is too long for a short user message',
    });
    score -= 10;
  } else if (userWordCount > 30 && responseWordCount < 20) {
    issues.push({
      type: 'length_mismatch',
      severity: 'warning',
      description: 'Response is too short for a detailed user message',
    });
    score -= 10;
  }

  const roboticPhrases = [
    'as an ai',
    'i\'m an ai',
    'i don\'t have feelings',
    'i cannot',
    'i\'m not able to',
    'my purpose is',
    'i was designed',
  ];

  if (roboticPhrases.some(phrase => responseLower.includes(phrase))) {
    issues.push({
      type: 'personality_break',
      severity: 'critical',
      description: 'Response breaks character with AI-like language',
    });
    score -= 30;
  }

  const recentAssistantMessages = conversationHistory
    .filter(m => m.role === 'assistant')
    .slice(-5);

  for (const prevMsg of recentAssistantMessages) {
    const prevQuestions = prevMsg.content.split(/[.!]/).filter(s => s.includes('?'));
    const currentQuestions = assistantResponse.split(/[.!]/).filter(s => s.includes('?'));

    for (const currentQ of currentQuestions) {
      for (const prevQ of prevQuestions) {
        const similarity = calculateSimilarity(currentQ.toLowerCase(), prevQ.toLowerCase());
        if (similarity > 0.7) {
          issues.push({
            type: 'repetition',
            severity: 'critical',
            description: `Asked similar question before: "${prevQ.trim()}"`,
          });
          score -= 25;
        }
      }
    }
  }

  const topicChangeIndicators = [
    'what are you up to',
    'what are you doing',
    'how was your day',
    'how\'s your day',
    'what\'s going on',
    'what else',
    'anything new',
  ];

  const userDiscussingTopic = userWordCount > 10 && !userLower.includes('?');

  if (userDiscussingTopic && topicChangeIndicators.some(phrase => responseLower.includes(phrase))) {
    issues.push({
      type: 'topic_switch',
      severity: 'critical',
      description: 'Switched topics when user was engaged in current discussion',
    });
    score -= 25;
  }

  const isValid = issues.filter(i => i.severity === 'critical').length === 0 && score >= 60;

  const suggestions: string[] = [];
  if (issues.some(i => i.type === 'generic_response')) {
    suggestions.push('Engage more deeply with what the user said');
  }
  if (issues.some(i => i.type === 'topic_switch')) {
    suggestions.push('Stay on the current topic unless user wants to change it');
  }
  if (issues.some(i => i.type === 'repetition')) {
    suggestions.push('Check conversation history to avoid asking the same questions');
  }
  if (issues.some(i => i.type === 'length_mismatch')) {
    suggestions.push('Match the user\'s message length and energy level');
  }

  return {
    isValid,
    score: Math.max(0, score),
    issues,
    suggestions,
  };
}

function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/).filter(w => w.length > 3);
  const words2 = str2.split(/\s+/).filter(w => w.length > 3);

  if (words1.length === 0 || words2.length === 0) return 0;

  const common = words1.filter(w => words2.includes(w)).length;
  return (common / Math.max(words1.length, words2.length)) * 2;
}

export function shouldRetryResponse(validation: ValidationResult): boolean {
  if (!validation.isValid) {
    return true;
  }

  const criticalIssues = validation.issues.filter(i => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    return true;
  }

  if (validation.score < 60) {
    return true;
  }

  return false;
}

export function formatValidationFeedback(validation: ValidationResult): string {
  if (validation.issues.length === 0) {
    return '';
  }

  const parts: string[] = ['PREVIOUS RESPONSE HAD ISSUES - AVOID THESE:'];

  for (const issue of validation.issues) {
    parts.push(`- ${issue.type.toUpperCase()}: ${issue.description}`);
  }

  if (validation.suggestions.length > 0) {
    parts.push('\nIMPROVEMENTS TO MAKE:');
    validation.suggestions.forEach(s => parts.push(`- ${s}`));
  }

  return parts.join('\n');
}
