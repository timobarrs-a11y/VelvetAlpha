export interface ConversationSummary {
  keyPoints: string[];
  emotionalTone: string;
  userNeeds: string[];
  importantDetails: string[];
  pendingTopics: string[];
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateConversationSummary(
  messages: Message[],
  windowSize: number = 10
): Promise<ConversationSummary> {
  if (messages.length === 0) {
    return {
      keyPoints: [],
      emotionalTone: 'neutral',
      userNeeds: [],
      importantDetails: [],
      pendingTopics: [],
    };
  }

  const recentMessages = messages.slice(-windowSize);
  const userMessages = recentMessages.filter(m => m.role === 'user');

  const keyPoints: string[] = [];
  const importantDetails: string[] = [];
  const pendingTopics: string[] = [];

  const topicKeywords = {
    work: ['work', 'job', 'career', 'boss', 'office', 'coworker'],
    relationships: ['relationship', 'partner', 'boyfriend', 'girlfriend', 'dating'],
    family: ['family', 'mom', 'dad', 'parent', 'sibling'],
    health: ['health', 'fitness', 'workout', 'sick', 'doctor'],
    hobbies: ['hobby', 'fun', 'enjoy', 'passion'],
    plans: ['plan', 'going to', 'future', 'want to'],
  };

  for (const msg of userMessages) {
    const lower = msg.content.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        if (!keyPoints.includes(topic)) {
          keyPoints.push(topic);
        }
      }
    }

    if (msg.content.match(/my name is (\w+)/i) ||
        msg.content.match(/i'?m (\w+)/i) ||
        msg.content.match(/i work (?:as|at) ([^.,!?]+)/i) ||
        msg.content.match(/i live in ([^.,!?]+)/i)) {
      importantDetails.push(msg.content.split(/[.!?]/)[0].trim());
    }
  }

  const emotionalWords = {
    happy: ['happy', 'excited', 'great', 'amazing', 'love', 'wonderful', 'perfect', 'best'],
    stressed: ['stressed', 'overwhelmed', 'busy', 'exhausted', 'tired', 'pressure'],
    sad: ['sad', 'depressed', 'down', 'hurt', 'upset', 'disappointed'],
    anxious: ['anxious', 'worried', 'scared', 'nervous', 'afraid'],
    frustrated: ['frustrated', 'angry', 'annoyed', 'irritated', 'mad'],
    excited: ['excited', 'pumped', 'can\'t wait', 'looking forward'],
  };

  let emotionalTone = 'neutral';
  let maxCount = 0;

  for (const [tone, words] of Object.entries(emotionalWords)) {
    let count = 0;
    for (const msg of userMessages) {
      const lower = msg.content.toLowerCase();
      count += words.filter(w => lower.includes(w)).length;
    }
    if (count > maxCount) {
      maxCount = count;
      emotionalTone = tone;
    }
  }

  const userNeeds: string[] = [];
  const lastUserMessage = userMessages[userMessages.length - 1]?.content.toLowerCase() || '';

  if (['help', 'advice', 'should i', 'what do you think'].some(w => lastUserMessage.includes(w))) {
    userNeeds.push('advice');
  }
  if (['feel', 'feeling', 'sad', 'depressed', 'anxious'].some(w => lastUserMessage.includes(w))) {
    userNeeds.push('support');
  }
  if (['?'].some(w => lastUserMessage.includes(w))) {
    userNeeds.push('conversation');
  }
  if (['validate', 'right', 'wrong', 'am i'].some(w => lastUserMessage.includes(w))) {
    userNeeds.push('validation');
  }

  const assistantQuestions = recentMessages
    .filter(m => m.role === 'assistant' && m.content.includes('?'))
    .map(m => {
      const sentences = m.content.split(/[.!?]/);
      return sentences.find(s => s.includes('?'))?.trim();
    })
    .filter(Boolean);

  if (assistantQuestions.length > 0) {
    pendingTopics.push(...assistantQuestions.slice(-2) as string[]);
  }

  return {
    keyPoints: keyPoints.slice(0, 5),
    emotionalTone,
    userNeeds,
    importantDetails: importantDetails.slice(0, 3),
    pendingTopics: pendingTopics.slice(0, 3),
  };
}

export function formatSummaryContext(summary: ConversationSummary): string {
  const parts: string[] = [];

  if (summary.keyPoints.length > 0) {
    parts.push(`Recent discussion points: ${summary.keyPoints.join(', ')}`);
  }

  if (summary.emotionalTone && summary.emotionalTone !== 'neutral') {
    parts.push(`User's current mood: ${summary.emotionalTone}`);
  }

  if (summary.userNeeds.length > 0) {
    parts.push(`What they need: ${summary.userNeeds.join(', ')}`);
  }

  if (summary.importantDetails.length > 0) {
    parts.push(`Important details they shared:\n${summary.importantDetails.map(d => `  - ${d}`).join('\n')}`);
  }

  if (summary.pendingTopics.length > 0) {
    parts.push(`Topics to potentially revisit: ${summary.pendingTopics.join(', ')}`);
  }

  return parts.length > 0 ? `\n=== RECENT CONVERSATION SUMMARY ===\n${parts.join('\n')}\n` : '';
}

export function shouldGenerateSummary(messageCount: number): boolean {
  return messageCount % 8 === 0 && messageCount > 0;
}
