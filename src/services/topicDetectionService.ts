export interface TopicInfo {
  currentTopic: string;
  topicDuration: number;
  isQuestionPending: boolean;
  recentTopics: string[];
  conversationState: 'greeting' | 'casual' | 'deep' | 'emotional_support' | 'playful';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export async function detectTopic(recentMessages: Message[]): Promise<TopicInfo> {
  if (recentMessages.length === 0) {
    return {
      currentTopic: 'greeting',
      topicDuration: 0,
      isQuestionPending: false,
      recentTopics: [],
      conversationState: 'greeting',
    };
  }

  const lastFewMessages = recentMessages.slice(-6);
  const lastUserMessages = lastFewMessages.filter(m => m.role === 'user');
  const lastAssistantMessage = lastFewMessages.filter(m => m.role === 'assistant').pop();

  const hasQuestion = lastAssistantMessage && lastAssistantMessage.content.includes('?');

  const topics: string[] = [];
  const emotionalWords = {
    support: ['sad', 'depressed', 'anxious', 'worried', 'scared', 'hurt', 'stressed', 'overwhelmed', 'struggling'],
    deep: ['feel', 'feeling', 'think', 'believe', 'wonder', 'understand', 'meaning', 'purpose', 'life', 'future'],
    playful: ['haha', 'lol', 'funny', 'fun', 'play', 'game', 'joke', 'tease'],
    greeting: ['hi', 'hey', 'hello', 'good morning', 'good night', 'what\'s up', 'how are you'],
  };

  const topicKeywords: Record<string, string[]> = {
    work: ['work', 'job', 'career', 'boss', 'office', 'coworker', 'meeting', 'project'],
    relationships: ['relationship', 'partner', 'boyfriend', 'girlfriend', 'dating', 'love'],
    family: ['family', 'mom', 'dad', 'parent', 'sibling', 'brother', 'sister'],
    health: ['health', 'fitness', 'workout', 'exercise', 'sick', 'doctor', 'therapy'],
    hobbies: ['hobby', 'fun', 'enjoy', 'like', 'passion', 'interest'],
    plans: ['plan', 'going to', 'will', 'future', 'want to', 'hoping'],
  };

  for (const msg of lastUserMessages) {
    const lower = msg.content.toLowerCase();
    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lower.includes(kw))) {
        topics.push(topic);
      }
    }
  }

  let conversationState: TopicInfo['conversationState'] = 'casual';
  if (lastUserMessages.length > 0) {
    const lastUserContent = lastUserMessages[lastUserMessages.length - 1].content.toLowerCase();

    if (emotionalWords.greeting.some(w => lastUserContent.includes(w)) && lastUserMessages.length === 1) {
      conversationState = 'greeting';
    } else if (emotionalWords.support.some(w => lastUserContent.includes(w))) {
      conversationState = 'emotional_support';
    } else if (emotionalWords.deep.some(w => lastUserContent.includes(w))) {
      conversationState = 'deep';
    } else if (emotionalWords.playful.some(w => lastUserContent.includes(w))) {
      conversationState = 'playful';
    }
  }

  const currentTopic = topics.length > 0 ? topics[topics.length - 1] : 'general conversation';

  let topicDuration = 1;
  if (topics.length > 0) {
    const sameTopic = topics.filter(t => t === currentTopic).length;
    topicDuration = sameTopic;
  }

  return {
    currentTopic,
    topicDuration,
    isQuestionPending: !!hasQuestion,
    recentTopics: [...new Set(topics)].slice(-3),
    conversationState,
  };
}

export function formatTopicContext(topicInfo: TopicInfo): string {
  const parts: string[] = [];

  if (topicInfo.currentTopic && topicInfo.currentTopic !== 'greeting') {
    parts.push(`CURRENT TOPIC: ${topicInfo.currentTopic}`);
    parts.push(`This topic has been discussed for ${topicInfo.topicDuration} message(s)`);
  }

  if (topicInfo.isQuestionPending) {
    parts.push('⚠️ IMPORTANT: You asked a question that they haven\'t answered yet. DO NOT change topics or ask new questions until they respond to your previous question.');
  }

  if (topicInfo.recentTopics.length > 0) {
    parts.push(`Recent topics: ${topicInfo.recentTopics.join(', ')}`);
  }

  if (topicInfo.conversationState) {
    const stateGuidance: Record<string, string> = {
      greeting: 'Keep it warm and welcoming, but don\'t overdo it',
      casual: 'Light and easy conversation - match their energy',
      deep: 'They want meaningful conversation - go deeper, ask thoughtful questions',
      emotional_support: 'They need support right now - be empathetic, validating, and present',
      playful: 'Fun and flirty energy - keep the banter going',
    };

    parts.push(`Conversation state: ${topicInfo.conversationState} - ${stateGuidance[topicInfo.conversationState]}`);
  }

  return parts.length > 0 ? `\n=== CONVERSATION CONTEXT ===\n${parts.join('\n')}\n` : '';
}
