import Anthropic from '@anthropic-ai/sdk';

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

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

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

  const prompt = `Analyze this recent conversation and provide a structured summary to help maintain context:

${recentMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Provide a JSON response with:
1. keyPoints: Main topics discussed (array of strings, max 5)
2. emotionalTone: Overall emotional state of the user (string: "happy", "stressed", "sad", "excited", "neutral", "frustrated", etc.)
3. userNeeds: What the user seems to need right now (array: "support", "advice", "validation", "distraction", "deep conversation", etc.)
4. importantDetails: Specific facts the user shared that should be remembered (array of strings)
5. pendingTopics: Topics that were brought up but not fully explored (array of strings)

Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const result = JSON.parse(textContent.text);

    return {
      keyPoints: result.keyPoints || [],
      emotionalTone: result.emotionalTone || 'neutral',
      userNeeds: result.userNeeds || [],
      importantDetails: result.importantDetails || [],
      pendingTopics: result.pendingTopics || [],
    };
  } catch (error) {
    console.error('Conversation summary failed:', error);
    return {
      keyPoints: [],
      emotionalTone: 'neutral',
      userNeeds: [],
      importantDetails: [],
      pendingTopics: [],
    };
  }
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
