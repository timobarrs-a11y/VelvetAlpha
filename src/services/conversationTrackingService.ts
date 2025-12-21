export interface ConversationMetrics {
  totalTurns: number;
  userInitiatedTopics: number;
  aiInitiatedTopics: number;
  averageUserMessageLength: number;
  averageAiMessageLength: number;
  questionsAskedByAi: number;
  questionsAskedByUser: number;
  conversationPace: 'fast' | 'medium' | 'slow';
  engagementLevel: 'high' | 'medium' | 'low';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function analyzeConversationMetrics(messages: Message[]): ConversationMetrics {
  if (messages.length === 0) {
    return {
      totalTurns: 0,
      userInitiatedTopics: 0,
      aiInitiatedTopics: 0,
      averageUserMessageLength: 0,
      averageAiMessageLength: 0,
      questionsAskedByAi: 0,
      questionsAskedByUser: 0,
      conversationPace: 'medium',
      engagementLevel: 'medium',
    };
  }

  const userMessages = messages.filter(m => m.role === 'user');
  const aiMessages = messages.filter(m => m.role === 'assistant');

  const avgUserLength = userMessages.length > 0
    ? userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length
    : 0;

  const avgAiLength = aiMessages.length > 0
    ? aiMessages.reduce((sum, m) => sum + m.content.length, 0) / aiMessages.length
    : 0;

  const aiQuestions = aiMessages.filter(m => m.content.includes('?')).length;
  const userQuestions = userMessages.filter(m => m.content.includes('?')).length;

  let conversationPace: 'fast' | 'medium' | 'slow' = 'medium';
  if (avgUserLength < 30 && avgAiLength < 80) {
    conversationPace = 'fast';
  } else if (avgUserLength > 100 || avgAiLength > 200) {
    conversationPace = 'slow';
  }

  let engagementLevel: 'high' | 'medium' | 'low' = 'medium';
  if (avgUserLength > 80 && userQuestions > 2) {
    engagementLevel = 'high';
  } else if (avgUserLength < 20 && userQuestions === 0) {
    engagementLevel = 'low';
  }

  return {
    totalTurns: Math.floor(messages.length / 2),
    userInitiatedTopics: 0,
    aiInitiatedTopics: 0,
    averageUserMessageLength: avgUserLength,
    averageAiMessageLength: avgAiLength,
    questionsAskedByAi: aiQuestions,
    questionsAskedByUser: userQuestions,
    conversationPace,
    engagementLevel,
  };
}

export function formatConversationMetrics(metrics: ConversationMetrics): string {
  const parts: string[] = [];

  parts.push('=== CONVERSATION FLOW ANALYSIS ===');

  parts.push(`Turns: ${metrics.totalTurns}`);
  parts.push(`Pace: ${metrics.conversationPace.toUpperCase()} - User avg: ${Math.round(metrics.averageUserMessageLength)} chars, AI avg: ${Math.round(metrics.averageAiMessageLength)} chars`);
  parts.push(`Engagement: ${metrics.engagementLevel.toUpperCase()}`);

  if (metrics.conversationPace === 'fast') {
    parts.push('NOTE: Keep responses short and snappy to match the fast pace.');
  } else if (metrics.conversationPace === 'slow') {
    parts.push('NOTE: User is engaging deeply - provide thoughtful, detailed responses.');
  }

  if (metrics.engagementLevel === 'low') {
    parts.push('⚠️ WARNING: User engagement is low. They may be busy or distracted. Keep it light and don\'t push too hard.');
  } else if (metrics.engagementLevel === 'high') {
    parts.push('✅ User is highly engaged! This is a great time for deeper conversation.');
  }

  if (metrics.questionsAskedByAi > metrics.questionsAskedByUser * 2 && metrics.questionsAskedByAi > 3) {
    parts.push('⚠️ You\'re asking too many questions. Balance it out - share more about yourself, make statements, tell stories.');
  }

  return '\n' + parts.join('\n') + '\n';
}

export function getConversationGuidance(metrics: ConversationMetrics): string {
  const guidance: string[] = [];

  if (metrics.conversationPace === 'fast') {
    guidance.push('Match their energy with brief, punchy responses');
    guidance.push('Keep messages under 50 words unless they ask for more');
  } else if (metrics.conversationPace === 'slow') {
    guidance.push('They want depth - take time to explore topics fully');
    guidance.push('2-4 sentence responses are appropriate here');
  }

  if (metrics.engagementLevel === 'low') {
    guidance.push('Don\'t overwhelm with questions');
    guidance.push('Give them space - they may just want casual chat');
  }

  if (metrics.questionsAskedByAi > 5 && metrics.totalTurns < 10) {
    guidance.push('CRITICAL: Stop asking so many questions!');
    guidance.push('Share thoughts, make observations, tell brief stories instead');
  }

  return guidance.length > 0 ? '\nGUIDANCE:\n' + guidance.map(g => `- ${g}`).join('\n') : '';
}
