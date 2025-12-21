import { supabase } from './supabase';

export interface RelationshipMemory {
  id: string;
  user_id: string;
  memory_type: 'user_fact' | 'relationship_moment' | 'emotional_context' | 'inside_joke' | 'shared_experience';
  content: string;
  emotional_valence: 'positive' | 'negative' | 'neutral' | 'mixed';
  importance_score: number;
  context_tags: string[];
  related_messages: string[];
  last_referenced: string;
  reference_count: number;
  created_at: string;
  updated_at: string;
}

export class MemoryService {
  static async extractAndStoreMemories(
    userId: string,
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Promise<void> {
    const memories = this.extractMemoriesFromConversation(userMessage, aiResponse, conversationHistory);

    for (const memory of memories) {
      await this.storeMemory(userId, memory);
    }
  }

  private static extractMemoriesFromConversation(
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{ role: string; content: string }>
  ): Array<Partial<RelationshipMemory>> {
    const memories: Array<Partial<RelationshipMemory>> = [];
    const lowerMessage = userMessage.toLowerCase();

    const factPatterns = [
      { pattern: /my name is (\w+)/i, type: 'user_fact' as const, tag: 'name', importance: 10 },
      { pattern: /i work (?:as|at) ([^.,!?]+)/i, type: 'user_fact' as const, tag: 'work', importance: 8 },
      { pattern: /i'?m (?:a |an )?(\w+) (?:by profession|for a living)/i, type: 'user_fact' as const, tag: 'profession', importance: 8 },
      { pattern: /i live in ([^.,!?]+)/i, type: 'user_fact' as const, tag: 'location', importance: 7 },
      { pattern: /i'?m from ([^.,!?]+)/i, type: 'user_fact' as const, tag: 'origin', importance: 7 },
      { pattern: /my (\w+) is ([^.,!?]+)/i, type: 'user_fact' as const, tag: 'personal_detail', importance: 6 },
      { pattern: /i (?:love|really like|enjoy) ([^.,!?]+)/i, type: 'user_fact' as const, tag: 'interest', importance: 6 },
      { pattern: /i hate|can'?t stand|dislike ([^.,!?]+)/i, type: 'user_fact' as const, tag: 'dislike', importance: 6 },
    ];

    for (const { pattern, type, tag, importance } of factPatterns) {
      const match = userMessage.match(pattern);
      if (match) {
        const sentence = this.extractSentence(userMessage, match.index || 0);
        memories.push({
          memory_type: type,
          content: sentence,
          emotional_valence: 'neutral',
          importance_score: importance,
          context_tags: [tag],
        });
      }
    }

    const emotionalKeywords = {
      positive: ['happy', 'excited', 'love', 'great', 'amazing', 'wonderful', 'perfect', 'best', 'joy', 'glad', 'proud'],
      negative: ['sad', 'depressed', 'anxious', 'scared', 'worried', 'upset', 'hurt', 'angry', 'frustrated', 'stressed', 'hate', 'terrible', 'worst'],
      mixed: ['bittersweet', 'conflicted', 'torn', 'mixed feelings', 'complicated'],
    };

    let emotionalValence: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    for (const [valence, keywords] of Object.entries(emotionalKeywords)) {
      if (keywords.some(kw => lowerMessage.includes(kw))) {
        emotionalValence = valence as any;
        break;
      }
    }

    if (emotionalValence !== 'neutral') {
      const emotionalSentences = userMessage.split(/[.!?]/).filter(s => {
        const lower = s.toLowerCase();
        return emotionalKeywords[emotionalValence as keyof typeof emotionalKeywords]?.some(kw => lower.includes(kw));
      });

      if (emotionalSentences.length > 0) {
        memories.push({
          memory_type: 'emotional_context',
          content: emotionalSentences[0].trim(),
          emotional_valence: emotionalValence,
          importance_score: emotionalValence === 'negative' ? 9 : 7,
          context_tags: ['emotion', emotionalValence],
        });
      }
    }

    const relationshipKeywords = [
      'i love you', 'love you', 'miss you', 'thank you so much', 'appreciate you',
      'you mean', 'special to me', 'lucky to have', 'remember when we',
      'our first', 'this reminds me of', 'you always', 'you never'
    ];

    for (const keyword of relationshipKeywords) {
      if (lowerMessage.includes(keyword)) {
        const sentence = this.extractSentenceWithKeyword(userMessage, keyword);
        if (sentence) {
          memories.push({
            memory_type: 'relationship_moment',
            content: sentence,
            emotional_valence: 'positive',
            importance_score: 9,
            context_tags: ['relationship', 'emotional'],
          });
        }
      }
    }

    const humorPatterns = [
      /haha|lol|lmao|😂|🤣/i,
      /that'?s (?:funny|hilarious)/i,
      /made me laugh/i,
    ];

    for (const pattern of humorPatterns) {
      if (pattern.test(userMessage) || pattern.test(aiResponse)) {
        const recentExchange = conversationHistory.slice(-2).map(m => m.content).join(' | ');
        memories.push({
          memory_type: 'inside_joke',
          content: recentExchange.substring(0, 200),
          emotional_valence: 'positive',
          importance_score: 6,
          context_tags: ['humor', 'bonding'],
        });
        break;
      }
    }

    const milestoneKeywords = [
      'first time', 'finally', 'achieved', 'accomplished', 'got the job',
      'graduated', 'moved to', 'started', 'finished', 'completed',
      'celebration', 'anniversary', 'birthday', 'special day'
    ];

    for (const keyword of milestoneKeywords) {
      if (lowerMessage.includes(keyword)) {
        const sentence = this.extractSentenceWithKeyword(userMessage, keyword);
        if (sentence) {
          memories.push({
            memory_type: 'shared_experience',
            content: sentence,
            emotional_valence: 'positive',
            importance_score: 8,
            context_tags: ['milestone', 'achievement'],
          });
        }
      }
    }

    return memories;
  }

  private static extractSentence(text: string, position: number): string {
    const sentences = text.split(/[.!?]/);
    let currentPos = 0;

    for (const sentence of sentences) {
      currentPos += sentence.length;
      if (currentPos >= position) {
        return sentence.trim();
      }
      currentPos += 1;
    }

    return sentences[sentences.length - 1]?.trim() || text.substring(0, 150);
  }

  private static extractSentenceWithKeyword(text: string, keyword: string): string | null {
    const sentences = text.split(/[.!?]/);
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
        return sentence.trim();
      }
    }
    return null;
  }

  private static async storeMemory(
    userId: string,
    memory: Partial<RelationshipMemory>
  ): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('relationship_memories')
        .select('*')
        .eq('user_id', userId)
        .eq('content', memory.content)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('relationship_memories')
          .update({
            reference_count: existing.reference_count + 1,
            last_referenced: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('relationship_memories')
          .insert({
            user_id: userId,
            memory_type: memory.memory_type,
            content: memory.content,
            emotional_valence: memory.emotional_valence || 'neutral',
            importance_score: memory.importance_score || 5,
            context_tags: memory.context_tags || [],
            related_messages: memory.related_messages || [],
          });
      }
    } catch (error) {
      console.error('Error storing memory:', error);
    }
  }

  static async getRelevantMemories(
    userId: string,
    currentMessage: string,
    limit: number = 10
  ): Promise<RelationshipMemory[]> {
    try {
      const messageLower = currentMessage.toLowerCase();
      const messageWords = messageLower.split(/\s+/).filter(w => w.length > 3);

      const { data: allMemories, error } = await supabase
        .from('relationship_memories')
        .select('*')
        .eq('user_id', userId)
        .order('importance_score', { ascending: false })
        .order('last_referenced', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!allMemories || allMemories.length === 0) return [];

      const scoredMemories = allMemories.map(memory => {
        let relevanceScore = 0;

        relevanceScore += memory.importance_score * 10;

        for (const tag of memory.context_tags) {
          if (messageLower.includes(tag)) {
            relevanceScore += 50;
          }
        }

        const memoryWords = memory.content.toLowerCase().split(/\s+/);
        const commonWords = messageWords.filter(w => memoryWords.includes(w));
        relevanceScore += commonWords.length * 5;

        const daysSinceLastRef = (Date.now() - new Date(memory.last_referenced).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastRef < 1) relevanceScore += 20;
        else if (daysSinceLastRef < 7) relevanceScore += 10;

        const emotionalWords = ['feel', 'feeling', 'sad', 'happy', 'worried', 'scared', 'love', 'hate', 'anxious', 'excited'];
        if (emotionalWords.some(w => messageLower.includes(w)) && memory.memory_type === 'emotional_context') {
          relevanceScore += 30;
        }

        return { memory, score: relevanceScore };
      });

      scoredMemories.sort((a, b) => b.score - a.score);

      const topMemories = scoredMemories.slice(0, limit).map(sm => sm.memory);

      for (const memory of topMemories) {
        await supabase
          .from('relationship_memories')
          .update({
            last_referenced: new Date().toISOString(),
            reference_count: memory.reference_count + 1,
          })
          .eq('id', memory.id);
      }

      return topMemories;
    } catch (error) {
      console.error('Error retrieving relevant memories:', error);
      return [];
    }
  }

  static formatMemoriesForContext(memories: RelationshipMemory[]): string {
    if (memories.length === 0) return '';

    const grouped: Record<string, string[]> = {
      user_fact: [],
      relationship_moment: [],
      emotional_context: [],
      inside_joke: [],
      shared_experience: [],
    };

    for (const memory of memories) {
      grouped[memory.memory_type]?.push(memory.content);
    }

    let context = '\n\n🧠 RELATIONSHIP MEMORY CONTEXT:';

    if (grouped.user_fact.length > 0) {
      context += `\n\nKEY FACTS ABOUT THEM:\n${grouped.user_fact.map(f => `- ${f}`).join('\n')}`;
    }

    if (grouped.relationship_moment.length > 0) {
      context += `\n\nIMPORTANT RELATIONSHIP MOMENTS:\n${grouped.relationship_moment.map(m => `- ${m}`).join('\n')}`;
    }

    if (grouped.emotional_context.length > 0) {
      context += `\n\nEMOTIONAL HISTORY:\n${grouped.emotional_context.map(e => `- ${e}`).join('\n')}`;
    }

    if (grouped.inside_joke.length > 0) {
      context += `\n\nINSIDE JOKES & HUMOR:\n${grouped.inside_joke.slice(0, 2).map(j => `- ${j}`).join('\n')}`;
    }

    if (grouped.shared_experience.length > 0) {
      context += `\n\nSHARED EXPERIENCES:\n${grouped.shared_experience.map(e => `- ${e}`).join('\n')}`;
    }

    context += '\n\nUSE THIS CONTEXT to show you remember them and build on your relationship. Reference these naturally when relevant.';

    return context;
  }

  static async updateMemoryImportance(
    memoryId: string,
    newImportance: number
  ): Promise<void> {
    try {
      await supabase
        .from('relationship_memories')
        .update({ importance_score: newImportance })
        .eq('id', memoryId);
    } catch (error) {
      console.error('Error updating memory importance:', error);
    }
  }

  static async deleteMemory(memoryId: string): Promise<void> {
    try {
      await supabase
        .from('relationship_memories')
        .delete()
        .eq('id', memoryId);
    } catch (error) {
      console.error('Error deleting memory:', error);
    }
  }

  static async getMemoryStats(userId: string): Promise<{
    totalMemories: number;
    byType: Record<string, number>;
    byValence: Record<string, number>;
    mostImportant: RelationshipMemory[];
  }> {
    try {
      const { data: memories } = await supabase
        .from('relationship_memories')
        .select('*')
        .eq('user_id', userId);

      if (!memories) return {
        totalMemories: 0,
        byType: {},
        byValence: {},
        mostImportant: [],
      };

      const byType: Record<string, number> = {};
      const byValence: Record<string, number> = {};

      for (const memory of memories) {
        byType[memory.memory_type] = (byType[memory.memory_type] || 0) + 1;
        byValence[memory.emotional_valence] = (byValence[memory.emotional_valence] || 0) + 1;
      }

      const mostImportant = [...memories]
        .sort((a, b) => b.importance_score - a.importance_score)
        .slice(0, 10);

      return {
        totalMemories: memories.length,
        byType,
        byValence,
        mostImportant,
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        totalMemories: 0,
        byType: {},
        byValence: {},
        mostImportant: [],
      };
    }
  }
}
