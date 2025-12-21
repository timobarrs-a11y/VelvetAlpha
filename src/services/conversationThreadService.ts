import { supabase } from './supabase';

export interface ConversationThread {
  id: string;
  user_id: string;
  topic: string;
  status: 'active' | 'resolved' | 'dormant';
  context_summary: string;
  emotional_tone: string;
  user_sentiment: string;
  ai_sentiment: string;
  unresolved_questions: string[];
  key_points: string[];
  started_at: string;
  last_active: string;
  resolved_at?: string;
}

export class ConversationThreadService {
  static async detectAndUpdateThreads(
    userId: string,
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<void> {
    const detectedTopics = this.detectTopics(userMessage, aiResponse);

    for (const topic of detectedTopics) {
      await this.updateOrCreateThread(userId, topic, userMessage, aiResponse);
    }

    await this.markDormantThreads(userId);
  }

  private static detectTopics(userMessage: string, aiResponse: string): string[] {
    const topics: string[] = [];
    const lowerMessage = userMessage.toLowerCase();

    const topicKeywords: Record<string, string[]> = {
      'work/career': ['work', 'job', 'career', 'boss', 'coworker', 'office', 'promotion', 'interview', 'hired', 'fired', 'quit'],
      'relationships': ['relationship', 'partner', 'boyfriend', 'girlfriend', 'husband', 'wife', 'dating', 'break up', 'marriage', 'divorce'],
      'family': ['family', 'mom', 'dad', 'mother', 'father', 'sister', 'brother', 'parent', 'sibling', 'child', 'kid'],
      'mental health': ['depressed', 'anxious', 'anxiety', 'therapy', 'therapist', 'mental health', 'stressed', 'panic', 'overwhelmed'],
      'health/fitness': ['health', 'fitness', 'workout', 'exercise', 'gym', 'diet', 'weight', 'doctor', 'sick', 'illness'],
      'education': ['school', 'college', 'university', 'class', 'teacher', 'professor', 'study', 'exam', 'grade', 'degree'],
      'hobbies': ['hobby', 'hobbies', 'fun', 'enjoy', 'passion', 'interest'],
      'future plans': ['plan', 'future', 'goal', 'dream', 'want to', 'hoping to', 'thinking about'],
      'personal growth': ['improve', 'better', 'change', 'growth', 'develop', 'learn', 'skill'],
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        topics.push(topic);
      }
    }

    if (lowerMessage.includes('?')) {
      const question = this.extractQuestions(userMessage);
      if (question.length > 0 && topics.length === 0) {
        topics.push('general conversation');
      }
    }

    return topics.length > 0 ? topics : ['general conversation'];
  }

  private static extractQuestions(text: string): string[] {
    return text.split(/[.!]/).filter(s => s.includes('?')).map(q => q.trim());
  }

  private static detectEmotionalTone(message: string): string {
    const lower = message.toLowerCase();

    if (['excited', 'happy', 'great', 'amazing', 'love', 'wonderful'].some(w => lower.includes(w))) {
      return 'positive';
    }
    if (['sad', 'depressed', 'anxious', 'worried', 'scared', 'upset', 'angry'].some(w => lower.includes(w))) {
      return 'negative';
    }
    if (['okay', 'fine', 'alright', 'whatever', 'sure'].some(w => lower.includes(w))) {
      return 'neutral';
    }

    return 'neutral';
  }

  private static async updateOrCreateThread(
    userId: string,
    topic: string,
    userMessage: string,
    aiResponse: string
  ): Promise<void> {
    try {
      const { data: existingThread } = await supabase
        .from('conversation_threads')
        .select('*')
        .eq('user_id', userId)
        .eq('topic', topic)
        .eq('status', 'active')
        .maybeSingle();

      const questions = this.extractQuestions(userMessage);
      const emotionalTone = this.detectEmotionalTone(userMessage);

      if (existingThread) {
        const updatedQuestions = [
          ...existingThread.unresolved_questions.filter((q: string) =>
            !aiResponse.toLowerCase().includes(q.toLowerCase().substring(0, 20))
          ),
          ...questions,
        ].slice(0, 5);

        const newKeyPoint = userMessage.split(/[.!?]/)[0]?.trim();
        const updatedKeyPoints = newKeyPoint && newKeyPoint.length > 10
          ? [...existingThread.key_points, newKeyPoint].slice(-10)
          : existingThread.key_points;

        await supabase
          .from('conversation_threads')
          .update({
            last_active: new Date().toISOString(),
            emotional_tone: emotionalTone,
            unresolved_questions: updatedQuestions,
            key_points: updatedKeyPoints,
            context_summary: this.generateSummary(updatedKeyPoints),
          })
          .eq('id', existingThread.id);
      } else {
        await supabase
          .from('conversation_threads')
          .insert({
            user_id: userId,
            topic,
            status: 'active',
            context_summary: userMessage.substring(0, 200),
            emotional_tone: emotionalTone,
            unresolved_questions: questions,
            key_points: [userMessage.split(/[.!?]/)[0]?.trim() || userMessage.substring(0, 100)],
          });
      }
    } catch (error) {
      console.error('Error updating thread:', error);
    }
  }

  private static generateSummary(keyPoints: string[]): string {
    if (keyPoints.length === 0) return 'No context yet';
    return keyPoints.slice(-3).join('; ');
  }

  private static async markDormantThreads(userId: string): Promise<void> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      await supabase
        .from('conversation_threads')
        .update({ status: 'dormant' })
        .eq('user_id', userId)
        .eq('status', 'active')
        .lt('last_active', oneDayAgo);
    } catch (error) {
      console.error('Error marking dormant threads:', error);
    }
  }

  static async getActiveThreads(userId: string): Promise<ConversationThread[]> {
    try {
      const { data, error } = await supabase
        .from('conversation_threads')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_active', { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting active threads:', error);
      return [];
    }
  }

  static async resolveThread(threadId: string): Promise<void> {
    try {
      await supabase
        .from('conversation_threads')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', threadId);
    } catch (error) {
      console.error('Error resolving thread:', error);
    }
  }

  static formatThreadsForContext(threads: ConversationThread[]): string {
    if (threads.length === 0) return '';

    let context = '\n\n📋 ACTIVE CONVERSATION THREADS:';

    for (const thread of threads) {
      context += `\n\n• ${thread.topic.toUpperCase()}:`;
      context += `\n  Summary: ${thread.context_summary}`;
      context += `\n  Emotional tone: ${thread.emotional_tone}`;

      if (thread.unresolved_questions.length > 0) {
        context += `\n  Unresolved questions: ${thread.unresolved_questions.slice(0, 2).join('; ')}`;
      }
    }

    context += '\n\nCONTINUITY RULES:';
    context += '\n- Reference ongoing threads when relevant';
    context += '\n- Follow up on unresolved questions naturally';
    context += '\n- Show you remember what you were discussing';
    context += '\n- Don\'t abruptly change topics unless they do';

    return context;
  }

  static async getThreadStats(userId: string): Promise<{
    active: number;
    resolved: number;
    dormant: number;
    byTopic: Record<string, number>;
  }> {
    try {
      const { data: threads } = await supabase
        .from('conversation_threads')
        .select('*')
        .eq('user_id', userId);

      if (!threads) return { active: 0, resolved: 0, dormant: 0, byTopic: {} };

      const stats = {
        active: threads.filter(t => t.status === 'active').length,
        resolved: threads.filter(t => t.status === 'resolved').length,
        dormant: threads.filter(t => t.status === 'dormant').length,
        byTopic: {} as Record<string, number>,
      };

      for (const thread of threads) {
        stats.byTopic[thread.topic] = (stats.byTopic[thread.topic] || 0) + 1;
      }

      return stats;
    } catch (error) {
      console.error('Error getting thread stats:', error);
      return { active: 0, resolved: 0, dormant: 0, byTopic: {} };
    }
  }
}
